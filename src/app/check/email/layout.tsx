import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { FAQ_DATA } from "@/lib/faq-data";

export const metadata: Metadata = {
  title: "Email Validator",
  description:
    "Free email address validator. Check syntax, TLD, disposable-domain databases, and live mailbox delivery.",
  alternates: { canonical: "https://isthisvalid.com/check/email" },
};

export default function EmailCheckLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <Script
        id="schema-email-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ_DATA.map(({ q, a }) => ({
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
