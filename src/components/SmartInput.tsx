"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { stashSmartInput } from "@/lib/smart-input-handoff";
import { detectInputKind, type DetectedKind } from "@/lib/input-router";

const HINT: Record<DetectedKind, string> = {
  email: "Looks like an email address",
  url: "Looks like a link",
  phone: "Looks like a phone number",
  text: "Looks like a message",
};

/**
 * The homepage "paste anything" box.
 *
 * Detection runs locally as the user types purely to show a hint — the real
 * check happens on /check/any. The value is handed over through sessionStorage
 * rather than a query string so a pasted message never lands in browser history
 * or a referrer header (see src/lib/smart-input-handoff.ts).
 */
export default function SmartInput() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [storageBlocked, setStorageBlocked] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const trimmed = value.trim();
  const hint = trimmed === "" ? null : HINT[detectInputKind(trimmed).kind];

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (trimmed === "") {
      inputRef.current?.focus();
      return;
    }
    // If sessionStorage is blocked (some private-browsing modes) the value has
    // nowhere to travel. Say so instead of navigating to an empty box — we
    // deliberately don't fall back to a query string, which would put the
    // pasted message in browser history.
    if (!stashSmartInput(value)) {
      setStorageBlocked(true);
      return;
    }
    router.push("/check/any");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-2xl space-y-3"
      aria-label="Check anything"
    >
      <label htmlFor="hero-smart-input" className="sr-only">
        Paste anything you want checked
      </label>
      <textarea
        ref={inputRef}
        id="hero-smart-input"
        rows={3}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder="Paste a link, email, phone number, or the whole text message…"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          // Editing is a fresh attempt — clear any stale storage warning.
          if (storageBlocked) setStorageBlocked(false);
        }}
        onKeyDown={(e) => {
          // Enter submits; Shift+Enter adds a newline (messages are multi-line).
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
          }
        }}
        className="
          w-full resize-y rounded-2xl border-2 border-zinc-700 bg-zinc-900 px-4 py-3.5
          text-white placeholder-zinc-500 text-base
          focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30
          transition-colors duration-150
        "
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button
          type="submit"
          disabled={trimmed === ""}
          className="
            rounded-xl bg-orange-500 hover:bg-orange-400 active:bg-orange-600
            disabled:opacity-50 disabled:cursor-not-allowed
            px-6 py-3 font-semibold text-white text-base
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-orange-400/60
          "
        >
          Check it →
        </button>

        <p aria-live="polite" className="text-sm text-zinc-400 min-h-5 sm:ml-1">
          {hint ?? "Not sure which tool you need? Start here."}
        </p>
      </div>

      {storageBlocked && (
        <p
          role="alert"
          className="rounded-xl border border-yellow-600/50 bg-yellow-950/40 px-4 py-3 text-sm text-yellow-300"
        >
          Your browser is blocking site storage, so we can&apos;t carry that
          over privately.{" "}
          <a
            href="/check/any"
            className="underline underline-offset-2 hover:text-yellow-200"
          >
            Open Smart Check
          </a>{" "}
          and paste it there instead.
        </p>
      )}
    </form>
  );
}
