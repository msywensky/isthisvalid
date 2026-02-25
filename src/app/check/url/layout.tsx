import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { URL_FAQ_DATA } from "@/lib/url-faq-data";

export const metadata: Metadata = {
  title: "URL Checker",
  description:
    "Check if a URL is safe before you click. Detects phishing links, malware domains, and suspicious redirects.",
  alternates: { canonical: "https://isthisvalid.com/check/url" },
};

export default function UrlCheckLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Script
        id="schema-url-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: URL_FAQ_DATA.map(({ q, a }) => ({
              "@type": "Question",
              name: q,
              acceptedAnswer: { "@type": "Answer", text: a },
            })),
          }),
        }}
      />
      {children}
    </>
  );
}
