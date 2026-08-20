/**
 * Web Share Target receiver.
 *
 * Android/Chrome POSTs here when the user picks IsThisValid from the system
 * share sheet (see the `share_target` block in public/manifest.json).
 *
 * Deliberately NOT under /api/: src/proxy.ts matches `/api/:path*` and rejects
 * browser requests from unrecognised origins with a 403. An OS-initiated share
 * POST has an unreliable Origin header, so it would be rejected there.
 *
 * The shared text is handed to the client through a short-lived cookie and a
 * 303 redirect rather than being echoed into a URL: pasted messages contain
 * names, account numbers and one-time codes, and a query string would persist
 * all of that in browser history. The 303 also stops the POST itself becoming a
 * re-submittable history entry.
 *
 * iOS/Safari does not implement the Web Share Target API at all — the manifest
 * still gives an installable home-screen app there, but this route will never
 * be called from an iOS share sheet.
 */
import { NextRequest, NextResponse } from "next/server";
import { SHARE_COOKIE } from "@/lib/smart-input-handoff";

export const runtime = "nodejs";

/** /api/debunk/text caps at 5000 characters; stay well under it. */
const MAX_PAYLOAD_CHARS = 3000;

/** Leaves headroom under the ~4 KB per-cookie browser limit. */
const MAX_COOKIE_CHARS = 3500;

/** The payload is only needed for the very next navigation. */
const COOKIE_MAX_AGE_SECONDS = 60;

export async function POST(req: NextRequest) {
  let payload = "";

  try {
    const form = await req.formData();
    payload = composeSharedText({
      title: readField(form, "title"),
      text: readField(form, "text"),
      url: readField(form, "url"),
    });
  } catch {
    // Malformed multipart body — fall through to an empty handoff so the user
    // still lands on a usable page rather than an error.
    payload = "";
  }

  const res = NextResponse.redirect(new URL("/share/handoff", req.url), 303);

  if (payload !== "") {
    res.cookies.set(SHARE_COOKIE, toCookieValue(payload), {
      // The client must read this — it cannot be httpOnly.
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE_SECONDS,
      secure: process.env.NODE_ENV === "production",
    });
  }

  return res;
}

/** Someone opening /share directly gets the tool, not a 405. */
export function GET(req: NextRequest) {
  return NextResponse.redirect(new URL("/check/any", req.url), 303);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function readField(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Builds one string out of the three fields a share sheet may send.
 *
 * Android is inconsistent: some apps put a link in `url`, others inline it in
 * `text`, and a few send only `title`. Prefer `text`, append `url` when it adds
 * something new, and fall back to `title`.
 */
export function composeSharedText({
  title,
  text,
  url,
}: {
  title: string;
  text: string;
  url: string;
}): string {
  const parts: string[] = [];

  if (text !== "") parts.push(text);
  else if (title !== "") parts.push(title);

  if (url !== "" && !parts.some((p) => p.includes(url))) parts.push(url);

  return parts.join("\n").slice(0, MAX_PAYLOAD_CHARS);
}

/**
 * Base64-encodes the payload so arbitrary message text (semicolons, commas,
 * newlines, emoji) survives cookie serialisation intact, then shrinks it until
 * it fits inside a single cookie.
 */
function toCookieValue(payload: string): string {
  let text = payload;
  let encoded = Buffer.from(text, "utf8").toString("base64");

  while (encoded.length > MAX_COOKIE_CHARS && text.length > 0) {
    text = text.slice(0, Math.floor(text.length * 0.8));
    encoded = Buffer.from(text, "utf8").toString("base64");
  }

  return encoded;
}
