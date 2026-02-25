"use client";

import { useState, useRef, type FormEvent } from "react";
import type { UrlValidationResult } from "@/lib/url-validator";
import CheckShell from "@/components/CheckShell";
import { UrlResultCard } from "@/components/UrlResultCard";
import AdSenseBanner from "@/components/AdSenseBanner";
import UrlFAQ from "@/components/UrlFAQ";

type State =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "result"; data: UrlValidationResult }
  | { phase: "error"; message: string };

export default function UrlCheckPage() {
  const [state, setState] = useState<State>({ phase: "idle" });
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleReset() {
    setState({ phase: "idle" });
    setValue("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      inputRef.current?.focus();
      return;
    }
    setState({ phase: "loading" });
    try {
      const res = await fetch("/api/validate-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({
          phase: "error",
          message: data.error ?? `Server returned ${res.status}`,
        });
        return;
      }
      setState({ phase: "result", data });
    } catch {
      setState({
        phase: "error",
        message: "Network error — check your connection and try again.",
      });
    }
  }

  return (
    <CheckShell
      icon="🔗"
      label="URL Checker"
      headline={
        <>
          Safe to <span className="text-sky-400">click</span>?
        </>
      }
      sub="Paste a URL and we'll check whether it's a phishing link, malware domain, or just plain sketchy."
    >
      {/* Top ad slot */}
      <AdSenseBanner slot="top" className="w-full max-w-xl" />

      {/* Form + results */}
      <section className="w-full max-w-xl space-y-6" aria-label="URL input">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col sm:flex-row gap-3 w-full"
          noValidate
        >
          <label htmlFor="url-input" className="sr-only">
            URL to check
          </label>
          <input
            ref={inputRef}
            id="url-input"
            type="url"
            inputMode="url"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="https://suspicious-link.example.com"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={state.phase === "loading"}
            className="
              flex-1 rounded-xl border-2 border-zinc-700 bg-zinc-900 px-4 py-3
              text-white placeholder-zinc-500 text-base
              focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150
            "
          />
          <button
            type="submit"
            disabled={state.phase === "loading" || !value.trim()}
            className="
              rounded-xl bg-sky-500 hover:bg-sky-400 active:bg-sky-600
              disabled:opacity-50 disabled:cursor-not-allowed
              px-6 py-3 font-semibold text-white text-base
              flex items-center justify-center gap-2
              transition-colors duration-150 min-w-32.5
              focus:outline-none focus:ring-2 focus:ring-sky-400/60
            "
          >
            {state.phase === "loading" ? (
              <>
                <Spinner /> Checking…
              </>
            ) : (
              "Is it safe? →"
            )}
          </button>
        </form>

        {state.phase === "error" && (
          <div
            role="alert"
            className="w-full rounded-xl border border-red-700 bg-red-950/40 px-5 py-4 text-red-300 text-sm"
          >
            <strong>Error:</strong> {state.message}
          </div>
        )}

        {state.phase === "result" && <UrlResultCard result={state.data} />}

        {(state.phase === "result" || state.phase === "error") && (
          <button
            onClick={handleReset}
            className="cursor-pointer text-sm text-sky-400 hover:text-sky-300 underline underline-offset-2 transition-colors"
          >
            ← Check another URL
          </button>
        )}
      </section>

      {/* Mid ad after result */}
      {(state.phase === "result" || state.phase === "error") && (
        <AdSenseBanner slot="mid" className="w-full max-w-xl" />
      )}

      {/* How it works */}
      <section
        className="w-full max-w-xl space-y-4 text-sm text-zinc-400"
        aria-label="How it works"
      >
        <h2 className="text-zinc-300 font-semibold text-base">How it works</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>
            <strong className="text-zinc-200">Parse &amp; validate</strong> —
            structural URL check, TLD verification, and brand-squatting
            detection across 20 known brands.
          </li>
          <li>
            <strong className="text-zinc-200">Live reachability</strong> — sends
            a HEAD request to confirm the server is actually up.
          </li>
          <li>
            <strong className="text-zinc-200">Google Safe Browsing</strong> —
            cross-references Google&apos;s malware and phishing database (when
            configured).
          </li>
          <li>
            <strong className="text-zinc-200">Phishing pattern analysis</strong>{" "}
            — detects shorteners, Punycode homographs, embedded credentials, and
            suspicious path keywords.
          </li>
        </ol>
      </section>

      {/* Why this tool / FAQ */}
      <UrlFAQ />
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
