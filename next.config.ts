import type { NextConfig } from "next";

// Content-Security-Policy domains for Google AdSense.
// These are inactive until NEXT_PUBLIC_ADSENSE_ID is set, but the CSP must
// allow them from day one so ads render correctly once the key is added.
const ADSENSE_SCRIPT_DOMAINS = [
  "https://pagead2.googlesyndication.com",
  "https://www.googletagservices.com",
  "https://adservice.google.com",
  "https://googleads.g.doubleclick.net",
  "https://www.google.com",
].join(" ");

const ADSENSE_FRAME_DOMAINS = [
  "https://googleads.g.doubleclick.net",
  "https://tpc.googlesyndication.com",
].join(" ");

const ContentSecurityPolicy = [
  // Only load resources from our own origin by default
  "default-src 'self'",
  // Scripts: self + Next.js inline hydration chunks + AdSense
  // 'unsafe-inline' is required by AdSense; Next.js inline scripts also need it
  `script-src 'self' 'unsafe-inline' ${ADSENSE_SCRIPT_DOMAINS}`,
  // Styles: Tailwind inlines CSS via style attributes at runtime
  "style-src 'self' 'unsafe-inline'",
  // Images: allow HTTPS images and data URIs (AdSense tracking pixels)
  "img-src 'self' data: https:",
  // Fetch API calls go to our own origin only
  "connect-src 'self'",
  // AdSense embeds iframes for ad creative
  `frame-src ${ADSENSE_FRAME_DOMAINS}`,
  // Fonts: self-hosted only
  "font-src 'self'",
  // Block plugins (Flash, etc.)
  "object-src 'none'",
  // Restrict <base> tag to prevent base-tag injection
  "base-uri 'self'",
  // Forms only submit to our own origin
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  // Prevent this site from being embedded in an iframe (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send origin only on same-origin, just the origin (no path) on cross-origin
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable browser features we don't use
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // Force HTTPS for 2 years on production (Vercel handles SSL)
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Content-Security-Policy", value: ContentSecurityPolicy },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply to every route
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
