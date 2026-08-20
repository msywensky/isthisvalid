"use client";

/**
 * Landing page for the Web Share Target flow.
 *
 * /share sets a 60-second cookie and 303s here. This page moves the payload out
 * of that cookie into sessionStorage, expires the cookie immediately, and
 * replaces itself with /check/any — so the shared message never appears in a
 * URL and is never left sitting in a cookie after it has been read.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SHARE_COOKIE, stashSmartInput } from "@/lib/smart-input-handoff";

export default function ShareHandoffPage() {
  const router = useRouter();

  useEffect(() => {
    const raw = readCookie(SHARE_COOKIE);
    expireCookie(SHARE_COOKIE);

    const shared = raw === null ? null : decodePayload(raw);
    if (shared !== null && shared.trim() !== "") {
      stashSmartInput(shared);
    }

    // replace(), not push() — the handoff must not sit in the back stack.
    router.replace("/check/any");
  }, [router]);

  return (
    <main
      id="main-content"
      className="flex flex-col items-center justify-center min-h-screen gap-4 px-4"
    >
      <svg
        className="animate-spin h-6 w-6 text-orange-400"
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
      <p className="text-zinc-400 text-sm" role="status">
        Opening what you shared…
      </p>
    </main>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(prefix)) return part.slice(prefix.length);
  }
  return null;
}

function expireCookie(name: string): void {
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/**
 * Reverses src/app/share/route.ts's base64 encoding.
 *
 * decodeURIComponent runs first and is a no-op on untouched base64 (it contains
 * no "%"), which keeps this correct whether or not the cookie serialiser
 * percent-encoded the value on the way out.
 */
function decodePayload(raw: string): string | null {
  try {
    const binary = atob(decodeURIComponent(raw));
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}
