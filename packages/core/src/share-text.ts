/**
 * Plain-text summaries for the "Share result" button (web + mobile), plus the
 * verdict strip drawn under a shared image. Pure TS — no DOM, no RN.
 *
 * Verdict labels come from result-verdict.ts so the share text always matches
 * the card the user is looking at. URLs that were *checked* are defanged
 * (hxxps://evil[.]com) so chat apps don't turn a possibly dangerous link into a
 * tappable one; our own link back to the site is not.
 */
import type { EmailValidationResult } from "./email-validator";
import type { UrlValidationResult } from "./url-validator";
import type { PhoneValidationResult } from "./phone-validator";
import type { TextDebunkResult } from "./text-debunker";
import type { ImageClassification, ImageDebunkResult } from "./image-debunker";
import { extractUrls } from "./input-router";
import {
  QR_CONTENT_LABELS,
  QR_WIFI_WARNING,
  type NonUrlQrContent,
} from "./qr-content";
import {
  getEmailVerdict,
  getPhoneVerdict,
  getUrlVerdict,
  TEXT_CLASSIFICATION_LABELS,
  type Sentiment,
} from "./result-verdict";

export const SITE_URL = "https://isthisvalid.com";

/**
 * `kind` matches input-router's DetectedKind for the four text tools, so
 * /check/any maps in one line. A QR code that holds a link is shared as
 * `url`; `qr` is only for non-link QR content (no verdict to share).
 */
export type ShareInput =
  | { kind: "email"; result: EmailValidationResult }
  | { kind: "url"; result: UrlValidationResult }
  | { kind: "phone"; result: PhoneValidationResult }
  | { kind: "text"; result: TextDebunkResult; message: string }
  | { kind: "image"; result: ImageDebunkResult }
  | { kind: "qr"; content: NonUrlQrContent };

export interface ImageStrip {
  headline: string;
  detail: string;
  sentiment: Sentiment;
}

const TOOL_META: Record<ShareInput["kind"], { noun: string; path: string }> = {
  email: { noun: "email address", path: "/check/email" },
  url: { noun: "link", path: "/check/url" },
  phone: { noun: "phone number", path: "/check/phone" },
  text: { noun: "message", path: "/check/text" },
  image: { noun: "image", path: "/check/image" },
  qr: { noun: "QR code", path: "/check/qr" },
};

/** One caution line per non-link QR kind — Wi-Fi reuses the card's wording. */
const QR_CAUTION: Record<NonUrlQrContent["kind"], string> = {
  tel: "⚠️ Check a number from an unexpected QR code before you call it.",
  email: "⚠️ Check an address from an unexpected QR code before you email it.",
  wifi: `⚠️ ${QR_WIFI_WARNING}`,
  text: "⚠️ Be wary of instructions from an unexpected QR code.",
};

function qrValueLine(c: NonUrlQrContent): string {
  switch (c.kind) {
    case "tel":
      return c.phone;
    case "email":
      return c.email;
    case "wifi": {
      // The password is never parsed out of the QR (see qr-content.ts).
      const details = [c.encryption, c.hidden ? "hidden" : null]
        .filter(Boolean)
        .join(", ");
      const network = `Network: ${c.ssid || "(unknown)"}`;
      return details ? `${network} (${details})` : network;
    }
    case "text":
      return c.text ? `"${defangUrlsInText(c.text)}"` : "(empty)";
  }
}

/**
 * Deliberately hedged — never "Authentic". A shared image carries our name on
 * its own, without the card's surrounding context, so it must not read as a
 * certificate of authenticity.
 */
const IMAGE_STRIP: Record<
  ImageClassification,
  { headline: string; sentiment: Sentiment }
> = {
  "ai-generated": { headline: "Likely AI-generated", sentiment: "danger" },
  uncertain: { headline: "Inconclusive", sentiment: "warn" },
  authentic: {
    headline: "No strong signs of AI generation",
    sentiment: "safe",
  },
};

export function buildImageStrip(r: ImageDebunkResult): ImageStrip {
  const { headline, sentiment } = IMAGE_STRIP[r.classification];
  return {
    headline: `${headline} · AI risk score ${r.riskScore}/100`,
    detail: `Automated estimate by ${r.modelLabel ?? "SightEngine"}, not proof · isthisvalid.com`,
    sentiment,
  };
}

function compose(
  kind: ShareInput["kind"],
  lines: (string | null | undefined)[],
): string {
  const { noun, path } = TOOL_META[kind];
  const body = lines.filter((l): l is string => !!l).join("\n");
  return `I checked this ${noun} on IsThisValid:\n${body}\n\nCheck one yourself: ${SITE_URL}${path}`;
}

export function buildShareText(input: ShareInput): string {
  switch (input.kind) {
    case "email": {
      const r = input.result;
      return compose("email", [
        r.email,
        `Verdict: ${getEmailVerdict(r).label} (score ${r.score}/100)`,
      ]);
    }
    case "url": {
      const r = input.result;
      const verdict = getUrlVerdict(r.score);
      return compose("url", [
        defangUrl(r.url),
        r.redirectedTo && `Redirects to: ${defangUrl(r.redirectedTo)}`,
        `Verdict: ${verdict.label} (score ${r.score}/100)`,
        verdict.sentiment !== "safe" ? "⚠️ Don't open this link." : null,
      ]);
    }
    case "phone": {
      const r = input.result;
      return compose("phone", [
        r.internationalFormat ?? r.input,
        `Verdict: ${getPhoneVerdict(r).label} (score ${r.score}/100)`,
      ]);
    }
    case "text": {
      const r = input.result;
      return compose("text", [
        `"${defangUrlsInText(input.message.trim())}"`,
        `Verdict: ${TEXT_CLASSIFICATION_LABELS[r.classification]} (risk ${r.riskScore}/100)`,
        r.summary,
      ]);
    }
    case "image":
      return compose("image", [
        `Verdict: ${buildImageStrip(input.result).headline}`,
        "Automated estimate, not proof.",
      ]);
    case "qr":
      return compose("qr", [
        `Contains: ${QR_CONTENT_LABELS[input.content.kind]}`,
        qrValueLine(input.content),
        QR_CAUTION[input.content.kind],
      ]);
  }
}

// ── Defanging ───────────────────────────────────────────────────────────────

/**
 * "https://evil.example.com/a.b" → "hxxps://evil[.]example[.]com/a.b".
 * Only the scheme and the host's dots change; the path is left alone.
 */
export function defangUrl(url: string): string {
  const schemeMatch = /^(https?)(:\/\/)/i.exec(url);
  const scheme = schemeMatch
    ? schemeMatch[1].replace(/^http/i, "hxxp") + schemeMatch[2]
    : "";
  const rest = url.slice(schemeMatch ? schemeMatch[0].length : 0);
  const hostEnd = rest.search(/[/?#]/);
  const host = hostEnd === -1 ? rest : rest.slice(0, hostEnd);
  const tail = hostEnd === -1 ? "" : rest.slice(hostEnd);
  return scheme + host.replace(/\./g, "[.]") + tail;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Defangs every link in a message. Reuses extractUrls (same bare-domain TLD
 * allowlist and trailing-punctuation handling as Smart Check) rather than a
 * second URL regex — so a bare domain whose TLD isn't in EXTRACTABLE_TLDS is
 * left as typed. Explicit http(s):// links are always caught.
 *
 * One case-insensitive pass, longest URL first, and a match must not follow
 * "@", ".", "/" or a word character — so the domain inside an email address
 * (support@paypal.com) and the host inside an already-matched URL are skipped,
 * and it must not run on into a word character, so "evil.com" never matches
 * the front of "evil.community".
 */
export function defangUrlsInText(text: string): string {
  const urls = extractUrls(text).sort((a, b) => b.length - a.length);
  if (urls.length === 0) return text;
  const re = new RegExp(
    `(^|[^\\w@./])(${urls.map(escapeRegExp).join("|")})(?![\\w-])`,
    "gi",
  );
  return text.replace(re, (_m, before: string, url: string) => {
    return before + defangUrl(url);
  });
}
