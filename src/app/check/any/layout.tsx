import type { Metadata } from "next";

const SITE_URL = "https://isthisvalid.com";

export const metadata: Metadata = {
  title: "Smart Check — Paste Anything",
  description:
    "Paste anything suspicious — a link, an email address, a phone number, or a whole text message — and we'll work out what it is and check it. Free, no signup.",
  keywords: [
    "is this a scam",
    "check suspicious message",
    "paste a scam text",
    "scam checker",
    "verify a link or number",
  ],
  openGraph: {
    title: "Smart Check — Is This Valid?",
    description:
      "Paste a link, email, phone number, or whole message and we'll check it — free, no signup.",
    url: `${SITE_URL}/check/any`,
  },
  alternates: { canonical: `${SITE_URL}/check/any` },
};

export default function SmartCheckLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
