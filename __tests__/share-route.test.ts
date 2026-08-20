/**
 * Unit tests for the Web Share Target receiver at POST /share.
 *
 * No mocks needed — the route does no I/O beyond reading the request body and
 * setting a cookie.
 */
import { NextRequest } from "next/server";
import { POST, GET, composeSharedText } from "@/app/share/route";
import { SHARE_COOKIE } from "@/lib/smart-input-handoff";

function shareRequest(fields: Record<string, string>): NextRequest {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }
  return new NextRequest("https://isthisvalid.com/share", {
    method: "POST",
    body: form,
  });
}

/** Reverses the route's base64 cookie encoding. */
function decodeCookie(res: Response): string | null {
  const raw = res.headers.get("set-cookie");
  if (!raw) return null;
  const match = raw.match(new RegExp(`${SHARE_COOKIE}=([^;]*)`));
  if (!match) return null;
  return Buffer.from(decodeURIComponent(match[1]), "base64").toString("utf8");
}

describe("composeSharedText", () => {
  it("prefers the text field", () => {
    expect(
      composeSharedText({ title: "Alert", text: "the message", url: "" }),
    ).toBe("the message");
  });

  it("falls back to the title when there is no text", () => {
    expect(composeSharedText({ title: "Alert", text: "", url: "" })).toBe(
      "Alert",
    );
  });

  it("appends the url when the text does not already contain it", () => {
    expect(
      composeSharedText({
        title: "",
        text: "Check this out",
        url: "https://example.com/a",
      }),
    ).toBe("Check this out\nhttps://example.com/a");
  });

  it("does not duplicate a url already inlined in the text", () => {
    const text = "Go to https://example.com/a now";
    expect(
      composeSharedText({ title: "", text, url: "https://example.com/a" }),
    ).toBe(text);
  });

  it("handles a url-only share", () => {
    expect(
      composeSharedText({ title: "", text: "", url: "https://example.com" }),
    ).toBe("https://example.com");
  });

  it("returns an empty string when every field is empty", () => {
    expect(composeSharedText({ title: "", text: "", url: "" })).toBe("");
  });

  it("truncates to 3000 characters, under the text route's 5000 cap", () => {
    const long = "a".repeat(6000);
    expect(composeSharedText({ title: "", text: long, url: "" })).toHaveLength(
      3000,
    );
  });
});

describe("POST /share", () => {
  it("redirects with 303 so the POST is not a re-submittable history entry", async () => {
    const res = await POST(shareRequest({ text: "a suspicious message" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/share/handoff");
  });

  it("carries the shared text in the itv_share cookie", async () => {
    const res = await POST(
      shareRequest({ text: "FedEx: reschedule at fedex-x.tk/track" }),
    );
    expect(decodeCookie(res)).toBe("FedEx: reschedule at fedex-x.tk/track");
  });

  it("round-trips non-ASCII content intact", async () => {
    const message = "Ihr Paket wartet — jetzt bestätigen 📦 at paket-x.tk";
    const res = await POST(shareRequest({ text: message }));
    expect(decodeCookie(res)).toBe(message);
  });

  it("round-trips content containing cookie delimiters", async () => {
    const message = "Call now; code=1234, ref: ABC=XYZ";
    const res = await POST(shareRequest({ text: message }));
    expect(decodeCookie(res)).toBe(message);
  });

  it("keeps the cookie short-lived, readable by script, and lax", async () => {
    const res = await POST(shareRequest({ text: "a suspicious message" }));
    const raw = res.headers.get("set-cookie") ?? "";
    expect(raw).toContain("Max-Age=60");
    expect(raw.toLowerCase()).toContain("samesite=lax");
    // The handoff page must be able to read it, so it must NOT be httpOnly.
    expect(raw.toLowerCase()).not.toContain("httponly");
  });

  it("never puts the shared content in the redirect URL", async () => {
    const res = await POST(shareRequest({ text: "account 1234 code 9999" }));
    const location = res.headers.get("location") ?? "";
    expect(location).not.toContain("1234");
    expect(location).not.toContain("?");
  });

  it("still redirects when every field is empty, setting no cookie", async () => {
    const res = await POST(shareRequest({ text: "", url: "", title: "" }));
    expect(res.status).toBe(303);
    expect(decodeCookie(res)).toBeNull();
  });

  it("degrades to an empty handoff on a malformed body", async () => {
    const bad = new NextRequest("https://isthisvalid.com/share", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=nope" },
      body: "not actually multipart",
    });
    const res = await POST(bad);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/share/handoff");
  });

  it("shrinks an oversized payload until it fits in one cookie", async () => {
    const res = await POST(shareRequest({ text: "é".repeat(3000) }));
    const raw = res.headers.get("set-cookie") ?? "";
    const value = raw.match(new RegExp(`${SHARE_COOKIE}=([^;]*)`))?.[1] ?? "";
    expect(value.length).toBeLessThanOrEqual(3500);
    expect(value.length).toBeGreaterThan(0);
  });
});

describe("GET /share", () => {
  it("sends a direct visitor to the tool instead of 405ing", () => {
    const res = GET(
      new NextRequest("https://isthisvalid.com/share", { method: "GET" }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/check/any");
  });
});
