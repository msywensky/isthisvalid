import { classifyQrContent } from "../src/lib/qr-content";

describe("classifyQrContent", () => {
  test("https:// URL classified as url, unchanged", () => {
    const r = classifyQrContent("https://example.com/path?x=1");
    expect(r.kind).toBe("url");
    if (r.kind === "url") {
      expect(r.url).toBe("https://example.com/path?x=1");
    }
  });

  test("http:// URL classified as url", () => {
    const r = classifyQrContent("http://example.com");
    expect(r.kind).toBe("url");
  });

  test("bare domain with path classified as url", () => {
    const r = classifyQrContent("paypal-login.com/verify");
    expect(r.kind).toBe("url");
    if (r.kind === "url") {
      expect(r.url).toBe("paypal-login.com/verify");
    }
  });

  test("bare domain without path classified as url", () => {
    const r = classifyQrContent("example.com");
    expect(r.kind).toBe("url");
  });

  test("tel: scheme classified as tel, scheme stripped", () => {
    const r = classifyQrContent("tel:+15551234567");
    expect(r.kind).toBe("tel");
    if (r.kind === "tel") {
      expect(r.phone).toBe("+15551234567");
    }
  });

  test("uppercase TEL: scheme handled case-insensitively", () => {
    const r = classifyQrContent("TEL:+15551234567");
    expect(r.kind).toBe("tel");
    if (r.kind === "tel") {
      expect(r.phone).toBe("+15551234567");
    }
  });

  test("mailto: with subject strips scheme and query", () => {
    const r = classifyQrContent("mailto:a@b.com?subject=Hi");
    expect(r.kind).toBe("email");
    if (r.kind === "email") {
      expect(r.email).toBe("a@b.com");
    }
  });

  test("mailto: without query", () => {
    const r = classifyQrContent("mailto:a@b.com");
    expect(r.kind).toBe("email");
    if (r.kind === "email") {
      expect(r.email).toBe("a@b.com");
    }
  });

  test("WIFI: string parsed into ssid/encryption/hidden, no password field", () => {
    const r = classifyQrContent("WIFI:T:WPA;S:MyNet;P:secret;H:false;;");
    expect(r.kind).toBe("wifi");
    if (r.kind === "wifi") {
      expect(r.ssid).toBe("MyNet");
      expect(r.encryption).toBe("WPA");
      expect(r.hidden).toBe(false);
      expect(Object.keys(r)).not.toContain("password");
      expect(Object.keys(r)).not.toContain("P");
      expect(Object.keys(r)).not.toContain("p");
    }
  });

  test("uppercase WIFI: scheme handled case-insensitively", () => {
    const r = classifyQrContent("wifi:T:WEP;S:Home;P:x;H:true;;");
    expect(r.kind).toBe("wifi");
    if (r.kind === "wifi") {
      expect(r.ssid).toBe("Home");
      expect(r.encryption).toBe("WEP");
      expect(r.hidden).toBe(true);
    }
  });

  test("WIFI: with no encryption defaults sensibly", () => {
    const r = classifyQrContent("WIFI:T:nopass;S:Open;H:false;;");
    expect(r.kind).toBe("wifi");
    if (r.kind === "wifi") {
      expect(r.encryption).toBe("nopass");
    }
  });

  test("plain text classified as text", () => {
    const r = classifyQrContent("Meet me at 5");
    expect(r.kind).toBe("text");
    if (r.kind === "text") {
      expect(r.text).toBe("Meet me at 5");
    }
  });

  test("javascript: scheme classified as text, not url (regression guard)", () => {
    const r = classifyQrContent("javascript:alert(1)");
    expect(r.kind).toBe("text");
  });

  test("data: scheme classified as text, not url (regression guard)", () => {
    const r = classifyQrContent("data:text/html,<script>alert(1)</script>");
    expect(r.kind).toBe("text");
  });

  test("empty string classified as text with empty content", () => {
    const r = classifyQrContent("");
    expect(r.kind).toBe("text");
    if (r.kind === "text") {
      expect(r.text).toBe("");
    }
  });

  test("whitespace-only string classified as text with empty content", () => {
    const r = classifyQrContent("   ");
    expect(r.kind).toBe("text");
    if (r.kind === "text") {
      expect(r.text).toBe("");
    }
  });
});
