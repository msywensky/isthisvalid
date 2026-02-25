import type { Metadata } from "next";
import Script from "next/script";
import { TEXT_FAQ_DATA } from "@/lib/text-faq-data";

const SITE_URL = "https://isthisvalid.com";

export const metadata: Metadata = {
  title: "Text & SMS Scam Checker",
  description:
    "Paste a suspicious text or email message. AI instantly detects smishing, impersonation, urgency tricks, and scam patterns. Free, no signup required.",
  keywords: [
    "scam text checker",
    "SMS scam detector",
    "smishing checker",
    "is this text a scam",
    "phishing text detector",
    "fake text message checker",
    "AI scam detection",
    "scam message analyser",
  ],
  openGraph: {
    title: "Text & SMS Scam Checker — Is This Valid?",
    description:
      "Is that text a scam? Paste it in and AI will tell you instantly — free, no signup.",
    url: `${SITE_URL}/check/text`,
  },
  alternates: { canonical: `${SITE_URL}/check/text` },
};

export default function TextLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <Script
        id="schema-text-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: TEXT_FAQ_DATA.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: item.answer,
              },
            })),
          }),
        }}
      />
    </>
  );
}
