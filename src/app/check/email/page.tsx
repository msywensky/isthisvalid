"use client";

import { useState } from "react";
import type { EmailValidationResult } from "@/lib/email-validator";
import CheckShell from "@/components/CheckShell";
import EmailForm from "@/components/EmailForm";
import ResultCard from "@/components/ResultCard";
import AdSenseBanner from "@/components/AdSenseBanner";
import FAQ from "@/components/FAQ";

type State =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "result"; data: EmailValidationResult }
  | { phase: "error"; message: string };

export default function EmailCheckPage() {
  const [state, setState] = useState<State>({ phase: "idle" });
  const [formKey, setFormKey] = useState(0);

  function handleReset() {
    setState({ phase: "idle" });
    setFormKey((k) => k + 1); // remounts EmailForm, clearing its internal input
  }

  async function handleValidate(email: string) {
    setState({ phase: "loading" });
    try {
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
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
      icon="📧"
      label="Email Validator"
      headline={
        <>
          Is this <span className="text-orange-400">valid</span>?
        </>
      }
      sub="Paste any email address and we'll tell you if it's real, sketchy, or straight-up fake. No signup required."
    >
      {/* Top ad slot */}
      <AdSenseBanner slot="top" className="w-full max-w-xl" />

      {/* Form + results */}
      <section
        className="w-full max-w-xl space-y-6"
        aria-label="Validation input"
      >
        <EmailForm
          key={formKey}
          onSubmit={handleValidate}
          isLoading={state.phase === "loading"}
        />

        {state.phase === "error" && (
          <div
            role="alert"
            className="w-full rounded-xl border border-red-700 bg-red-950/40 px-5 py-4 text-red-300 text-sm"
          >
            <strong>Error:</strong> {state.message}
          </div>
        )}

        {state.phase === "result" && <ResultCard result={state.data} />}

        {(state.phase === "result" || state.phase === "error") && (
          <button
            onClick={handleReset}
            className="cursor-pointer text-sm text-orange-400 hover:text-orange-300 underline underline-offset-2 transition-colors"
          >
            ← Check another email
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
            <strong className="text-zinc-200">Syntax check</strong> — RFC 5322
            regex validates structure.
          </li>
          <li>
            <strong className="text-zinc-200">TLD check</strong> — ensures the
            domain has a real top-level extension.
          </li>
          <li>
            <strong className="text-zinc-200">Disposable-domain check</strong> —
            flags 3,500+ known throwaway providers.
          </li>
          <li>
            <strong className="text-zinc-200">API verification</strong>{" "}
            (optional) — Emailable checks if the mailbox actually exists.
          </li>
        </ol>
      </section>

      {/* FAQ */}
      <FAQ />
    </CheckShell>
  );
}
