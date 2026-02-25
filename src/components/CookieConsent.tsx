"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const CONSENT_KEY = "itv_cookie_consent";

type Consent = "accepted" | "declined" | null;

/**
 * Minimal GDPR-compliant cookie consent banner.
 *
 * - Stores preference in localStorage (no cookie needed for the banner itself)
 * - Shows only until the user makes a choice
 * - "Accept" allows Google AdSense advertising cookies
 * - "Decline" keeps the site functional but omits advertising cookies
 *
 * For full GDPR compliance before AdSense is active, you should also
 * conditionally load the AdSense <script> only after consent is given.
 * See layout.tsx for the integration point.
 */
export default function CookieConsent() {
  const [consent, setConsent] = useState<Consent | "loading">("loading");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_KEY) as Consent | null;
      setConsent(stored);
    } catch {
      // Private browsing or storage blocked — default to null (show banner)
      setConsent(null);
    }
  }, []);

  function handleAccept() {
    try {
      localStorage.setItem(CONSENT_KEY, "accepted");
    } catch {
      // ignore
    }
    setConsent("accepted");
  }

  function handleDecline() {
    try {
      localStorage.setItem(CONSENT_KEY, "declined");
    } catch {
      // ignore
    }
    setConsent("declined");
  }

  // Hide while reading localStorage to avoid flash
  if (consent !== null) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie consent"
      className="
        fixed bottom-0 left-0 right-0 z-50
        bg-zinc-900 border-t border-zinc-700
        px-4 py-4 sm:px-6
        flex flex-col sm:flex-row items-start sm:items-center gap-4
        shadow-2xl
      "
    >
      <p className="text-zinc-300 text-sm flex-1 leading-relaxed">
        We use cookies to display ads and improve your experience. By clicking
        &ldquo;Accept&rdquo;, you consent to our use of advertising cookies by
        Google AdSense. See our{" "}
        <Link href="/privacy" className="text-orange-400 hover:underline">
          Privacy Policy
        </Link>{" "}
        for details.
      </p>

      <div className="flex gap-3 shrink-0">
        <button
          onClick={handleDecline}
          className="
            rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-400
            hover:border-zinc-400 hover:text-zinc-200 transition-colors
            focus:outline-none focus:ring-2 focus:ring-orange-500/50
          "
        >
          Decline
        </button>
        <button
          onClick={handleAccept}
          className="
            rounded-lg bg-orange-500 hover:bg-orange-400 px-4 py-2 text-sm
            font-semibold text-white transition-colors
            focus:outline-none focus:ring-2 focus:ring-orange-400/60
          "
        >
          Accept all
        </button>
      </div>
    </div>
  );
}
