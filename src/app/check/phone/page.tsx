"use client";

import { useState } from "react";
import type { PhoneValidationResult } from "@/lib/phone-validator";
import CheckShell from "@/components/CheckShell";
import PhoneForm from "@/components/PhoneForm";
import PhoneResultCard from "@/components/PhoneResultCard";
import PhoneFAQ from "@/components/PhoneFAQ";
import AdSenseBanner from "@/components/AdSenseBanner";

type State =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "result"; data: PhoneValidationResult }
  | { phase: "error"; message: string };

export default function PhoneCheckPage() {
  const [state, setState] = useState<State>({ phase: "idle" });
  const [formKey, setFormKey] = useState(0);

  function handleReset() {
    setState({ phase: "idle" });
    setFormKey((k) => k + 1);
  }

  async function handleValidate(phone: string) {
    setState({ phase: "loading" });
    try {
      const res = await fetch("/api/validate-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
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
      icon="📞"
      label="Phone Validator"
      headline={
        <>
          Is this <span className="text-teal-400">legit</span>?
        </>
      }
      sub="Paste any phone number and we'll identify the country, line type, and whether it's a known scam vector. No signup required."
    >
      {/* Top ad slot */}
      <AdSenseBanner slot="top" className="w-full max-w-xl" />

      {/* Form + results */}
      <section
        className="w-full max-w-xl space-y-6"
        aria-label="Validation input"
      >
        <PhoneForm
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

        {state.phase === "result" && <PhoneResultCard result={state.data} />}

        {(state.phase === "result" || state.phase === "error") && (
          <button
            onClick={handleReset}
            className="cursor-pointer text-sm text-teal-400 hover:text-teal-300 underline underline-offset-2 transition-colors"
          >
            ← Check another number
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
            <strong className="text-zinc-200">Format parsing</strong> — Accepts
            E.164, national, and international formats from any country.
          </li>
          <li>
            <strong className="text-zinc-200">Numbering plan check</strong> —
            Validates digit count and prefix against ITU-T rules for the
            identified country (via Google&apos;s libphonenumber).
          </li>
          <li>
            <strong className="text-zinc-200">Line type detection</strong> —
            Identifies mobile, landline, VoIP, toll-free, and premium-rate
            numbers. Premium-rate and VoIP are the primary phone scam vectors.
          </li>
          <li>
            <strong className="text-zinc-200">Country identification</strong> —
            Resolves the number to its registered country using the country
            calling code.
          </li>
        </ol>
      </section>

      {/* FAQ */}
      <PhoneFAQ />
    </CheckShell>
  );
}
