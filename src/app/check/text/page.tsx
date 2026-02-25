"use client";

import { useState, type FormEvent } from "react";
import CheckShell from "@/components/CheckShell";
import AdSenseBanner from "@/components/AdSenseBanner";
import TextResultCard from "@/components/TextResultCard";
import TextFAQ from "@/components/TextFAQ";
import type { TextDebunkResult } from "@/lib/text-debunker";

type Phase = "idle" | "loading" | "result" | "error";

const EXAMPLE =
  "URGENT: Your bank account has been suspended. Click here to verify your identity immediately: http://secure-bank-verify.xyz";

/** Pre-baked result for the example — never calls Claude. */
const EXAMPLE_RESULT: TextDebunkResult = {
  classification: "smishing",
  confidence: 97,
  riskScore: 95,
  safe: false,
  summary:
    "This is a classic smishing (SMS phishing) message designed to create panic and steal banking credentials.",
  flags: [
    "Extreme urgency: 'URGENT' and 'immediately' pressure tactics",
    "Threat of account suspension to force action",
    "Suspicious domain: 'secure-bank-verify.xyz' is not a real bank domain",
    "Generic greeting — no personalisation typical of real banks",
    "Requests you follow an external link rather than use the bank's official app",
  ],
  explanation:
    "Legitimate banks never suspend accounts via SMS and never send links to third-party domains like '.xyz'. The combination of ALL-CAPS urgency, account-suspension threats, and a non-bank URL are textbook smishing hallmarks. Do not click the link. If you are worried about your account, call the number on the back of your card directly.",
  source: "claude",
};

const DETECTS = [
  ["🎣", "Smishing", "Fake delivery, banking, and prize texts"],
  ["🎭", "Impersonation", "Messages pretending to be HMRC, banks, or couriers"],
  [
    "⏰",
    "Urgency tricks",
    '"Act now" / "Your account will be closed" pressure',
  ],
  ["🔗", "Suspicious links", "Shortened or typosquatted URLs embedded in text"],
  [
    "💸",
    "Advance-fee scams",
    "Requests for gift cards, wire transfers, or crypto",
  ],
] as const;

export default function TextCheckPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [value, setValue] = useState("");
  const [result, setResult] = useState<TextDebunkResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim() || phase === "loading") return;

    setPhase("loading");
    setResult(null);
    setErrorMsg("");

    try {
      const res = await fetch("/api/debunk/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: value.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Something went wrong. Please try again.");
        setPhase("error");
        return;
      }
      setResult(data as TextDebunkResult);
      setPhase("result");
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
      setPhase("error");
    }
  }

  function handleReset() {
    setPhase("idle");
    setResult(null);
    setErrorMsg("");
    setValue("");
  }

  return (
    <CheckShell
      icon="💬"
      label="Text / SMS Checker"
      headline={
        <>
          Scam or <span className="text-violet-400">legit</span>?
        </>
      }
      sub="Paste a suspicious text or email message. AI flags smishing, impersonation, urgency tricks, and classic scam patterns."
    >
      <AdSenseBanner slot="top" className="w-full max-w-xl" />

      <section className="w-full max-w-xl space-y-6" aria-label="Text input">
        {/* ── Form (idle + loading) ── */}
        {(phase === "idle" || phase === "loading") && (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-3 w-full"
            noValidate
          >
            <label htmlFor="text-input" className="sr-only">
              Message to analyse
            </label>
            <textarea
              id="text-input"
              rows={6}
              placeholder="Paste the suspicious message here…"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={phase === "loading"}
              className="
                w-full rounded-xl border-2 border-zinc-700 bg-zinc-900 px-4 py-3
                text-white placeholder-zinc-500 text-sm leading-relaxed resize-y
                focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150
              "
            />

            {value.length > 0 && (
              <p
                className="text-xs text-zinc-500 text-right -mt-1"
                aria-live="polite"
              >
                {value.length} character{value.length !== 1 ? "s" : ""}
              </p>
            )}

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setValue(EXAMPLE);
                  setResult(EXAMPLE_RESULT);
                  setPhase("result");
                }}
                className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors"
              >
                Try an example
              </button>

              <button
                type="submit"
                disabled={phase === "loading" || !value.trim()}
                className="
                  rounded-xl bg-violet-500 hover:bg-violet-400 active:bg-violet-600
                  disabled:opacity-50 disabled:cursor-not-allowed
                  px-6 py-3 font-semibold text-white text-sm
                  flex items-center justify-center gap-2
                  transition-colors duration-150
                  focus:outline-none focus:ring-2 focus:ring-violet-400/60
                "
              >
                {phase === "loading" ? (
                  <>
                    <Spinner /> Analysing…
                  </>
                ) : (
                  "Analyse →"
                )}
              </button>
            </div>
          </form>
        )}

        {/* ── Result / Error — aria-live announces to screen readers when content appears ── */}
        <div aria-live="polite" aria-atomic="true" className="contents">
          {/* ── Result ── */}
          {phase === "result" && result && (
            <div className="space-y-4">
              <TextResultCard result={result} />
              <button
                onClick={handleReset}
                className="cursor-pointer text-sm text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors"
              >
                ← Check another message
              </button>
            </div>
          )}

          {/* ── Error ── */}
          {phase === "error" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-red-800/50 bg-red-950/20 px-6 py-5">
                <p className="text-red-400 font-semibold text-sm">
                  ⚠️ {errorMsg}
                </p>
              </div>
              <button
                onClick={handleReset}
                className="cursor-pointer text-sm text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors"
              >
                ← Try again
              </button>
            </div>
          )}
        </div>
        {/* end aria-live */}
      </section>

      {/* ── What AI detects (shown when idle or loading) ── */}
      {(phase === "idle" || phase === "loading") && (
        <section
          className="w-full max-w-xl space-y-4 text-sm text-zinc-400"
          aria-label="What AI detects"
        >
          <h2 className="text-zinc-300 font-semibold text-base">
            What AI will detect
          </h2>
          <ul className="space-y-2">
            {DETECTS.map(([icon, name, detail]) => (
              <li key={name} className="flex items-start gap-3">
                <span aria-hidden="true">{icon}</span>
                <span>
                  <strong className="text-zinc-200">{name}</strong> — {detail}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <TextFAQ />
    </CheckShell>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
