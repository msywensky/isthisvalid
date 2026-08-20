"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import CheckShell from "@/components/CheckShell";
import AdSenseBanner from "@/components/AdSenseBanner";
import KofiDonation from "@/components/KofiDonation";
import ResultCard from "@/components/ResultCard";
import { UrlResultCard } from "@/components/UrlResultCard";
import PhoneResultCard from "@/components/PhoneResultCard";
import TextResultCard from "@/components/TextResultCard";
import { useSmartCheck, type SubCheck } from "@/hooks/useSmartCheck";
import { takeSmartInput } from "@/lib/smart-input-handoff";
import type { DetectedKind } from "@/lib/input-router";

const KIND_LABEL: Record<DetectedKind, string> = {
  email: "an email address",
  url: "a link",
  phone: "a phone number",
  text: "a message",
};

const KIND_ICON: Record<DetectedKind, string> = {
  email: "📧",
  url: "🔗",
  phone: "📞",
  text: "💬",
};

export default function SmartCheckPage() {
  const smart = useSmartCheck();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { run } = smart;

  /**
   * Caches the one destructive read of the handoff value.
   *
   * takeSmartInput() deletes as it reads (so a refresh never replays someone's
   * pasted message), and StrictMode invokes this effect twice in development:
   * mount → cleanup → mount. Without this cache the first pass would consume
   * the value, its cleanup would cancel the pending timer, and the second pass
   * would find nothing — the paste would vanish. `undefined` means "not yet
   * read"; `null` means "read, and there was nothing there".
   */
  const handedRef = useRef<string | null | undefined>(undefined);

  // Pick up a value handed over from the homepage box or the share target.
  //
  // The read must happen after mount — sessionStorage doesn't exist during the
  // static prerender, and reading it in a lazy useState initialiser would
  // desync server and client HTML. The state updates are deferred out of the
  // effect body so the page shell paints before the check starts, rather than
  // cascading a second render synchronously.
  useEffect(() => {
    if (handedRef.current === undefined) {
      handedRef.current = takeSmartInput();
    }
    const handed = handedRef.current;
    if (handed === null || handed.trim() === "") return;

    const timer = setTimeout(() => {
      setValue(handed);
      void run(handed);
    }, 0);
    return () => clearTimeout(timer);
  }, [run]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (value.trim() === "") {
      inputRef.current?.focus();
      return;
    }
    void smart.run(value);
  }

  function handleReset() {
    smart.reset();
    setValue("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const isLoading = smart.phase === "loading";
  const hasOutcome = smart.phase === "result" || smart.phase === "error";
  const urlSubChecks = smart.subChecks.filter((sc) => sc.kind === "url");
  const phoneSubChecks = smart.subChecks.filter((sc) => sc.kind === "phone");
  const hasSubChecks = smart.subChecks.length > 0;

  return (
    <CheckShell
      icon="🔍"
      label="Smart Check"
      headline={
        <>
          Is this <span className="text-orange-400">real</span>?
        </>
      }
      sub="Paste anything — a link, an email address, a phone number, or a whole suspicious message. We'll work out what it is and check it."
    >
      <AdSenseBanner slot="top" className="w-full max-w-xl" />

      <section className="w-full max-w-xl space-y-6" aria-label="Smart input">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
          <label htmlFor="smart-input" className="sr-only">
            Anything you want checked
          </label>
          <textarea
            ref={inputRef}
            id="smart-input"
            rows={4}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Paste a link, email, phone number, or the whole text message…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={isLoading}
            className="
              w-full resize-y rounded-xl border-2 border-zinc-700 bg-zinc-900 px-4 py-3
              text-white placeholder-zinc-500 text-base
              focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150
            "
          />
          <button
            type="submit"
            disabled={isLoading || value.trim() === ""}
            className="
              rounded-xl bg-orange-500 hover:bg-orange-400 active:bg-orange-600
              disabled:opacity-50 disabled:cursor-not-allowed
              px-6 py-3 font-semibold text-white text-base
              flex items-center justify-center gap-2
              transition-colors duration-150
              focus:outline-none focus:ring-2 focus:ring-orange-400/60
            "
          >
            {isLoading ? (
              <>
                <Spinner /> Checking…
              </>
            ) : (
              "Check it →"
            )}
          </button>
        </form>

        {/* What we decided this is */}
        {smart.detected && (isLoading || hasOutcome) && (
          <p className="text-sm text-zinc-400 flex items-center gap-2">
            <span aria-hidden="true">{KIND_ICON[smart.detected.kind]}</span>
            Detected:{" "}
            <span className="text-zinc-200 font-medium">
              {KIND_LABEL[smart.detected.kind]}
            </span>
          </p>
        )}

        {smart.phase === "error" && (
          <div
            role="alert"
            className="w-full rounded-xl border border-red-700 bg-red-950/40 px-5 py-4 text-red-300 text-sm"
          >
            <strong>Error:</strong> {smart.errorMsg}
          </div>
        )}

        {/* Primary verdict */}
        {smart.primary?.kind === "email" && (
          <ResultCard result={smart.primary.data} variant="primary" />
        )}
        {smart.primary?.kind === "url" && (
          <UrlResultCard result={smart.primary.data} variant="primary" />
        )}
        {smart.primary?.kind === "phone" && (
          <PhoneResultCard result={smart.primary.data} variant="primary" />
        )}
        {smart.primary?.kind === "text" && (
          <TextResultCard result={smart.primary.data} variant="primary" />
        )}

        {/* Sub-checks found inside a pasted message */}
        {hasSubChecks && (
          <section
            className="space-y-4"
            aria-label="Other things found in this message"
          >
            <h2 className="text-zinc-300 font-semibold text-base">
              Also found in this message
            </h2>

            {urlSubChecks.length > 0 && (
              <div className="space-y-3">
                {urlSubChecks.map((sc) => (
                  <UrlSubCheck key={sc.id} sub={sc} />
                ))}
              </div>
            )}

            {phoneSubChecks.length > 0 && (
              <div className="space-y-3">
                {phoneSubChecks.map((sc) => (
                  <PhoneSubCheck
                    key={sc.id}
                    sub={sc}
                    onCheck={() => void smart.runPhoneCheck(sc.id)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {hasOutcome && (
          <button
            onClick={handleReset}
            className="cursor-pointer text-sm text-orange-400 hover:text-orange-300 underline underline-offset-2 transition-colors"
          >
            ← Check something else
          </button>
        )}

        {/* Exactly one Ko-fi bar for the whole composite view */}
        {hasOutcome && <KofiDonation />}
      </section>

      {hasOutcome && <AdSenseBanner slot="mid" className="w-full max-w-xl" />}

      <section
        className="w-full max-w-xl space-y-4 text-sm text-zinc-400"
        aria-label="How it works"
      >
        <h2 className="text-zinc-300 font-semibold text-base">How it works</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>
            <strong className="text-zinc-200">Work out what it is</strong> — we
            read what you pasted and route it to the right checker: email, link,
            phone number, or message.
          </li>
          <li>
            <strong className="text-zinc-200">Run the real check</strong> — the
            same analysis the dedicated tool would run, with the same score.
          </li>
          <li>
            <strong className="text-zinc-200">Look inside the message</strong> —
            if you pasted a text, we pull out any links it contains and check
            the first few automatically.
          </li>
          <li>
            <strong className="text-zinc-200">
              Callback numbers on request
            </strong>{" "}
            — phone numbers found in the message are listed but only looked up
            when you ask, so nothing is checked behind your back.
          </li>
        </ol>
        <p className="text-zinc-500 text-xs">
          Nothing you paste is stored. Links found in a message are never opened
          or followed in your browser — only analysed.
        </p>
      </section>
    </CheckShell>
  );
}

/* ── Sub-check rows ─────────────────────────────────────────────────────── */

function UrlSubCheck({ sub }: { sub: SubCheck }) {
  if (sub.kind !== "url") return null;

  if (sub.status === "done") {
    return (
      <div className="space-y-2">
        <SubCheckLabel icon="🔗" target={sub.target} />
        <UrlResultCard result={sub.data} variant="nested" />
      </div>
    );
  }

  if (sub.status === "pending") {
    return (
      <SubCheckRow icon="🔗" target={sub.target}>
        <span className="flex items-center gap-2 text-zinc-400">
          <Spinner /> Checking…
        </span>
      </SubCheckRow>
    );
  }

  if (sub.status === "skipped") {
    return (
      <SubCheckRow icon="🔗" target={sub.target}>
        <span className="text-zinc-400">
          Not checked automatically — too many links in this message.
        </span>
      </SubCheckRow>
    );
  }

  return (
    <SubCheckRow icon="🔗" target={sub.target}>
      <span className="text-yellow-300">
        Couldn&apos;t check this link — {sub.message}
      </span>
    </SubCheckRow>
  );
}

function PhoneSubCheck({
  sub,
  onCheck,
}: {
  sub: SubCheck;
  onCheck: () => void;
}) {
  if (sub.kind !== "phone") return null;

  if (sub.status === "done") {
    return (
      <div className="space-y-2">
        <SubCheckLabel icon="📞" target={sub.target} />
        <PhoneResultCard result={sub.data} variant="nested" />
      </div>
    );
  }

  if (sub.status === "pending") {
    return (
      <SubCheckRow icon="📞" target={sub.target}>
        <span className="flex items-center gap-2 text-zinc-400">
          <Spinner /> Checking…
        </span>
      </SubCheckRow>
    );
  }

  if (sub.status === "error") {
    return (
      <SubCheckRow icon="📞" target={sub.target}>
        <span className="text-yellow-300">
          Couldn&apos;t check this number — {sub.message}
        </span>
      </SubCheckRow>
    );
  }

  return (
    <SubCheckRow icon="📞" target={sub.target}>
      <button
        onClick={onCheck}
        className="
          cursor-pointer rounded-lg border border-orange-500/50 bg-orange-500/10
          px-3 py-1.5 text-sm font-medium text-orange-300
          hover:bg-orange-500/20 transition-colors
          focus:outline-none focus:ring-2 focus:ring-orange-400/60
        "
      >
        Check this number
      </button>
    </SubCheckRow>
  );
}

function SubCheckLabel({ icon, target }: { icon: string; target: string }) {
  return (
    <p className="flex items-center gap-2 text-xs text-zinc-400">
      <span aria-hidden="true">{icon}</span>
      <span className="break-all font-mono text-zinc-300">{target}</span>
    </p>
  );
}

function SubCheckRow({
  icon,
  target,
  children,
}: {
  icon: string;
  target: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 space-y-2">
      <SubCheckLabel icon={icon} target={target} />
      <div className="text-sm">{children}</div>
    </div>
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
