"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { buildShareText, type ShareInput } from "@/lib/share-text";

interface Props {
  input: ShareInput;
  /** Pre-composed share image (image tool only) — see lib/share-image.ts. */
  file?: File | null;
  /** True while that image is still being composed. */
  preparing?: boolean;
  className?: string;
}

// navigator.share never appears or disappears at runtime, so there's nothing
// to subscribe to. The server snapshot (false) keeps SSR/hydration consistent.
const noopSubscribe = () => () => {};
const hasWebShare = () => typeof navigator.share === "function";
const noWebShareOnServer = () => false;

export default function ShareButton({
  input,
  file,
  preparing = false,
  className = "",
}: Props) {
  const canShare = useSyncExternalStore(
    noopSubscribe,
    hasWebShare,
    noWebShareOnServer,
  );
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (permissions / insecure context) — nothing else to try.
    }
  }

  function handleClick() {
    // The site link is inside `text`; passing `url` too makes iOS show it twice.
    const text = buildShareText(input);

    // navigator.share MUST be called synchronously in the click handler —
    // iOS Safari rejects it as not user-initiated if anything is awaited
    // first. That's why the image file is composed before the tap.
    let shared: Promise<void>;
    try {
      if (file && navigator.canShare?.({ files: [file] })) {
        shared = navigator.share({ files: [file], text });
      } else if (navigator.share) {
        shared = navigator.share({ text });
      } else {
        void copyToClipboard(text);
        return;
      }
    } catch (err) {
      // Some older WebKit builds throw synchronously instead of rejecting.
      shared = Promise.reject(err);
    }

    shared.catch((err: unknown) => {
      // AbortError = the user closed the share sheet; that's not a failure.
      if (err instanceof DOMException && err.name === "AbortError") return;
      void copyToClipboard(text);
    });
  }

  const label = preparing
    ? "Preparing…"
    : copied
      ? "Copied ✓"
      : canShare
        ? "📤 Share result"
        : "📋 Copy result";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={preparing}
      className={`block cursor-pointer rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60 ${className}`}
    >
      {label}
    </button>
  );
}
