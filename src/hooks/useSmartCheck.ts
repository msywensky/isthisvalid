"use client";

/**
 * useSmartCheck — orchestrates the "paste anything" flow.
 *
 * Detects what the user pasted, calls the one relevant existing API route for
 * the primary verdict, and (for pasted messages only) fans out sub-checks on
 * links and phone numbers found inside the text.
 *
 * Orchestration lives on the client on purpose: the network helpers and the
 * whole text-debunk LLM pipeline are module-private to their route.ts files, so
 * a server-side aggregator would have to duplicate them and create a second
 * source of truth for regression-critical invariants. Calling the five existing
 * endpoints adds no new API surface and no new env vars.
 */
import { useCallback, useRef, useState } from "react";
import {
  detectInputKind,
  extractPhones,
  extractUrls,
  MAX_AUTO_URL_CHECKS,
  MAX_PHONE_SUGGESTIONS,
  type DetectedInput,
} from "@/lib/input-router";
import type { EmailValidationResult } from "@/lib/email-validator";
import type { UrlValidationResult } from "@/lib/url-validator";
import type { PhoneValidationResult } from "@/lib/phone-validator";
import type { TextDebunkResult } from "@/lib/text-debunker";

// ── Types ──────────────────────────────────────────────────────────────────

export type SmartPhase = "idle" | "loading" | "result" | "error";

export type PrimaryResult =
  | { kind: "email"; data: EmailValidationResult }
  | { kind: "url"; data: UrlValidationResult }
  | { kind: "phone"; data: PhoneValidationResult }
  | { kind: "text"; data: TextDebunkResult };

export type SubCheck =
  | { id: string; target: string; kind: "url"; status: "pending" }
  | {
      id: string;
      target: string;
      kind: "url";
      status: "done";
      data: UrlValidationResult;
    }
  | {
      id: string;
      target: string;
      kind: "url";
      status: "error";
      message: string;
    }
  /** Beyond MAX_AUTO_URL_CHECKS — found but deliberately not checked. */
  | { id: string; target: string; kind: "url"; status: "skipped" }
  /** Phone sub-checks are never dispatched automatically — they cost quota. */
  | { id: string; target: string; kind: "phone"; status: "idle" }
  | { id: string; target: string; kind: "phone"; status: "pending" }
  | {
      id: string;
      target: string;
      kind: "phone";
      status: "done";
      data: PhoneValidationResult;
    }
  | {
      id: string;
      target: string;
      kind: "phone";
      status: "error";
      message: string;
    };

export interface UseSmartCheck {
  phase: SmartPhase;
  detected: DetectedInput | null;
  primary: PrimaryResult | null;
  subChecks: SubCheck[];
  errorMsg: string;
  run: (raw: string) => Promise<void>;
  runPhoneCheck: (id: string) => Promise<void>;
  reset: () => void;
}

// ── Endpoint limits (mirrors each route's Zod schema) ──────────────────────

const LIMITS = {
  email: { max: 254 },
  url: { max: 2048 },
  phone: { min: 5, max: 25 },
  text: { min: 10, max: 5000 },
} as const;

const NETWORK_ERROR = "Network error — check your connection and try again.";

// ── Hook ───────────────────────────────────────────────────────────────────

export function useSmartCheck(): UseSmartCheck {
  const [phase, setPhase] = useState<SmartPhase>("idle");
  const [detected, setDetected] = useState<DetectedInput | null>(null);
  const [primary, setPrimary] = useState<PrimaryResult | null>(null);
  const [subChecks, setSubChecks] = useState<SubCheck[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  /**
   * Guards against a stale run writing over a newer one when the user submits
   * again while sub-checks are still in flight.
   */
  const runIdRef = useRef(0);

  /**
   * Authoritative copy of the sub-check list.
   *
   * Parallel URL checks each write one row, so updates must not clobber each
   * other. Reading and writing through a ref keeps every update based on the
   * latest value without putting side effects inside a state updater (React
   * invokes updaters twice under StrictMode, so they must stay pure).
   * Safe because each promise callback runs to completion on one thread.
   */
  const subChecksRef = useRef<SubCheck[]>([]);

  const applySubChecks = useCallback((fn: (prev: SubCheck[]) => SubCheck[]) => {
    const next = fn(subChecksRef.current);
    subChecksRef.current = next;
    setSubChecks(next);
  }, []);

  const reset = useCallback(() => {
    runIdRef.current += 1;
    subChecksRef.current = [];
    setPhase("idle");
    setDetected(null);
    setPrimary(null);
    setSubChecks([]);
    setErrorMsg("");
  }, []);

  const run = useCallback(
    async (raw: string) => {
      const input = detectInputKind(raw);
      if (input.value.trim() === "") return;

      const runId = ++runIdRef.current;
      const isCurrent = () => runIdRef.current === runId;

      subChecksRef.current = [];
      setDetected(input);
      setPrimary(null);
      setSubChecks([]);
      setErrorMsg("");
      setPhase("loading");

      // Pre-flight length checks, so an over-long paste gets a friendly message
      // instead of a raw 422 from the route's Zod schema.
      const preflight = preflightMessage(input);
      if (preflight) {
        if (!isCurrent()) return;
        setErrorMsg(preflight);
        setPhase("error");
        // A too-short/too-long *message* still has checkable links inside it.
        if (input.kind === "text") {
          await fanOut(input.value, runId, isCurrent, applySubChecks);
        }
        return;
      }

      // ── Primary check — always runs alone, first ──
      const outcome = await requestPrimary(input);
      if (!isCurrent()) return;

      if (outcome.ok) {
        setPrimary(outcome.result);
        setPhase("result");
      } else {
        setErrorMsg(outcome.message);
        setPhase("error");
      }

      // ── Fan-out — pasted messages only ──
      // Runs even when the primary failed (e.g. 503 when the LLM key is
      // absent), because the links inside the message are still worth checking.
      if (input.kind === "text") {
        await fanOut(input.value, runId, isCurrent, applySubChecks);
      }
    },
    [applySubChecks],
  );

  const runPhoneCheck = useCallback(
    async (id: string) => {
      const runId = runIdRef.current;
      const isCurrent = () => runIdRef.current === runId;

      const row = subChecksRef.current.find((sc) => sc.id === id);
      if (!row || row.kind !== "phone" || row.status !== "idle") return;
      const target = row.target;

      applySubChecks((prev) =>
        prev.map((sc) =>
          sc.id === id && sc.kind === "phone"
            ? { id: sc.id, target: sc.target, kind: "phone", status: "pending" }
            : sc,
        ),
      );

      const outcome = await requestPhone(target);
      if (!isCurrent()) return;

      applySubChecks((prev) =>
        prev.map((sc) => {
          if (sc.id !== id || sc.kind !== "phone") return sc;
          return outcome.ok
            ? {
                id: sc.id,
                target: sc.target,
                kind: "phone",
                status: "done",
                data: outcome.data,
              }
            : {
                id: sc.id,
                target: sc.target,
                kind: "phone",
                status: "error",
                message: outcome.message,
              };
        }),
      );
    },
    [applySubChecks],
  );

  return {
    phase,
    detected,
    primary,
    subChecks,
    errorMsg,
    run,
    runPhoneCheck,
    reset,
  };
}

// ── Fan-out ────────────────────────────────────────────────────────────────

/**
 * Builds the sub-check list for a pasted message and dispatches the URL checks.
 *
 * `checkRateLimit` is a 20/min sliding window shared by every API route under
 * one Redis prefix, so only the first MAX_AUTO_URL_CHECKS links are dispatched
 * (worst case 1 + 3 = 4 of 20). Anything beyond that is listed as "skipped".
 * Phone numbers are never dispatched automatically — they consume paid quota.
 */
async function fanOut(
  message: string,
  runId: number,
  isCurrent: () => boolean,
  applySubChecks: (fn: (prev: SubCheck[]) => SubCheck[]) => void,
): Promise<void> {
  const urls = extractUrls(message);
  const phones = extractPhones(message).slice(0, MAX_PHONE_SUGGESTIONS);

  if (urls.length === 0 && phones.length === 0) return;

  const autoUrls = urls.slice(0, MAX_AUTO_URL_CHECKS);
  const skippedUrls = urls.slice(MAX_AUTO_URL_CHECKS);

  const initial: SubCheck[] = [
    ...autoUrls.map<SubCheck>((target, i) => ({
      id: `u${runId}-${i}`,
      target,
      kind: "url",
      status: "pending",
    })),
    ...skippedUrls.map<SubCheck>((target, i) => ({
      id: `us${runId}-${i}`,
      target,
      kind: "url",
      status: "skipped",
    })),
    ...phones.map<SubCheck>((target, i) => ({
      id: `p${runId}-${i}`,
      target,
      kind: "phone",
      status: "idle",
    })),
  ];

  if (!isCurrent()) return;
  applySubChecks(() => initial);

  // Each sub-check owns its own outcome — one failure never touches the
  // primary card or the other rows.
  await Promise.allSettled(
    autoUrls.map(async (target, i) => {
      const id = `u${runId}-${i}`;
      const outcome = await requestUrl(target);
      if (!isCurrent()) return;

      applySubChecks((prev) =>
        prev.map((sc) => {
          if (sc.id !== id || sc.kind !== "url") return sc;
          return outcome.ok
            ? {
                id: sc.id,
                target: sc.target,
                kind: "url",
                status: "done",
                data: outcome.data,
              }
            : {
                id: sc.id,
                target: sc.target,
                kind: "url",
                status: "error",
                message: outcome.message,
              };
        }),
      );
    }),
  );
}

// ── Requests ───────────────────────────────────────────────────────────────

type PrimaryOutcome =
  { ok: true; result: PrimaryResult } | { ok: false; message: string };

type SubOutcome<T> = { ok: true; data: T } | { ok: false; message: string };

async function requestPrimary(input: DetectedInput): Promise<PrimaryOutcome> {
  switch (input.kind) {
    case "email": {
      const r = await postJson<EmailValidationResult>("/api/validate", {
        email: input.value,
      });
      return r.ok
        ? { ok: true, result: { kind: "email", data: r.data } }
        : { ok: false, message: r.message };
    }
    case "url": {
      const r = await postJson<UrlValidationResult>("/api/validate-url", {
        url: input.value,
      });
      return r.ok
        ? { ok: true, result: { kind: "url", data: r.data } }
        : { ok: false, message: r.message };
    }
    case "phone": {
      const r = await requestPhone(input.value);
      return r.ok
        ? { ok: true, result: { kind: "phone", data: r.data } }
        : { ok: false, message: r.message };
    }
    case "text": {
      const r = await postJson<TextDebunkResult>("/api/debunk/text", {
        message: input.value,
      });
      return r.ok
        ? { ok: true, result: { kind: "text", data: r.data } }
        : { ok: false, message: r.message };
    }
  }
}

function requestUrl(target: string): Promise<SubOutcome<UrlValidationResult>> {
  return postJson<UrlValidationResult>("/api/validate-url", { url: target });
}

function requestPhone(
  target: string,
): Promise<SubOutcome<PhoneValidationResult>> {
  return postJson<PhoneValidationResult>("/api/validate-phone", {
    phone: target,
  });
}

async function postJson<T>(
  url: string,
  body: Record<string, unknown>,
): Promise<SubOutcome<T>> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }

    if (!res.ok) {
      return { ok: false, message: friendlyError(res.status, payload) };
    }
    return { ok: true, data: payload as T };
  } catch {
    return { ok: false, message: NETWORK_ERROR };
  }
}

// ── Messages ───────────────────────────────────────────────────────────────

function preflightMessage(input: DetectedInput): string | null {
  const len = input.value.length;
  switch (input.kind) {
    case "email":
      return len > LIMITS.email.max
        ? "That address is too long to be a real email."
        : null;
    case "url":
      return len > LIMITS.url.max
        ? "That link is too long to check (max 2,048 characters)."
        : null;
    case "phone":
      return len < LIMITS.phone.min || len > LIMITS.phone.max
        ? "That doesn't look like a phone number we can check."
        : null;
    case "text":
      if (len < LIMITS.text.min) {
        return "That's too short to analyse — paste the whole message and we'll take a look.";
      }
      if (len > LIMITS.text.max) {
        return "That message is too long to analyse (max 5,000 characters). Try pasting just the suspicious part.";
      }
      return null;
  }
}

function friendlyError(status: number, payload: unknown): string {
  const fromApi =
    payload &&
    typeof payload === "object" &&
    typeof (payload as { error?: unknown }).error === "string"
      ? (payload as { error: string }).error
      : null;

  if (status === 429) {
    return fromApi ?? "Too many checks — wait a minute and try again.";
  }
  if (status === 503) {
    return fromApi ?? "That check isn't available right now.";
  }
  return fromApi ?? `Server returned ${status}`;
}
