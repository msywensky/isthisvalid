"use client";

import { useState, useRef, FormEvent } from "react";

interface Props {
  onSubmit: (email: string) => void;
  isLoading: boolean;
}

export default function EmailForm({ onSubmit, isLoading }: Props) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      inputRef.current?.focus();
      return;
    }
    onSubmit(trimmed);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col sm:flex-row gap-3 w-full max-w-xl mx-auto"
      aria-label="Email validation form"
      noValidate
    >
      <label htmlFor="email-input" className="sr-only">
        Email address to validate
      </label>
      <input
        ref={inputRef}
        id="email-input"
        type="email"
        inputMode="email"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="you@example.com"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={isLoading}
        className="
          flex-1 rounded-xl border-2 border-zinc-700 bg-zinc-900 px-4 py-3
          text-white placeholder-zinc-500 text-base
          focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors duration-150
        "
      />
      <button
        type="submit"
        disabled={isLoading || !value.trim()}
        className="
          rounded-xl bg-orange-500 hover:bg-orange-400 active:bg-orange-600
          disabled:opacity-50 disabled:cursor-not-allowed
          px-6 py-3 font-semibold text-white text-base
          flex items-center justify-center gap-2
          transition-colors duration-150 min-w-32.5
          focus:outline-none focus:ring-2 focus:ring-orange-400/60
        "
      >
        {isLoading ? (
          <>
            <Spinner />
            Checking…
          </>
        ) : (
          "Is it valid? →"
        )}
      </button>
    </form>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-white"
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
        d="M4 12a8 8 0 018-8v8H4z"
      />
    </svg>
  );
}
