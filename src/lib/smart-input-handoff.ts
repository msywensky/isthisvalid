/**
 * Privacy-safe handoff of a pasted value between pages.
 *
 * Pasted messages routinely contain names, account numbers, and one-time codes.
 * A query string would leak all of that into browser history, server access
 * logs, and (via Referrer-Policy: strict-origin-when-cross-origin) any
 * third-party the user clicks through to. So the value travels through
 * sessionStorage instead: written by the sender, read exactly once by the
 * receiver, and deleted immediately on read.
 *
 * Both helpers are try/catch-wrapped because sessionStorage throws in some
 * private-browsing modes — matching the convention in CookieConsent.tsx.
 */

/** sessionStorage key. Follows the existing `itv_` prefix convention. */
export const SMART_INPUT_KEY = "itv_smart_input";

/**
 * Short-lived cookie used only to carry an OS share payload from the POST
 * receiver at /share to the client at /share/handoff. See src/app/share/route.ts.
 */
export const SHARE_COOKIE = "itv_share";

/** Stashes a value for the next page. Returns false if storage is unavailable. */
export function stashSmartInput(value: string): boolean {
  try {
    sessionStorage.setItem(SMART_INPUT_KEY, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads the stashed value and deletes it in the same breath, so a refresh or a
 * later visit never re-surfaces someone's pasted message.
 */
export function takeSmartInput(): string | null {
  try {
    const value = sessionStorage.getItem(SMART_INPUT_KEY);
    if (value !== null) sessionStorage.removeItem(SMART_INPUT_KEY);
    return value;
  } catch {
    return null;
  }
}
