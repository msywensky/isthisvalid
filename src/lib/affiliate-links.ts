/**
 * Affiliate partner URLs.
 *
 * Set via environment variables:
 * - NEXT_PUBLIC_ZEROBOUNCE_AFFILIATE_URL
 * - NEXT_PUBLIC_NORDVPN_AFFILIATE_URL
 *
 * These are public-facing URLs (can be in NEXT_PUBLIC_*) used in client/server code.
 */
export const AFFILIATE_LINKS = {
  zerobounce: process.env.NEXT_PUBLIC_ZEROBOUNCE_AFFILIATE_URL || "https://aff.zerobounce.net/PLACEHOLDER",
  nordvpn: process.env.NEXT_PUBLIC_NORDVPN_AFFILIATE_URL || "https://go.nordvpn.net/aff_c?offer_id=15&aff_id=PLACEHOLDER",
} as const;
