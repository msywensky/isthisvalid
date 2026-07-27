import type { Metadata } from "next";
import Script from "next/script";
import { QR_FAQ_DATA } from "@/lib/qr-faq-data";

const SITE_URL = "https://isthisvalid.com";

export const metadata: Metadata = {
  title: "QR Code Scanner",
  description:
    "Free QR code scanner and safety checker. Upload an image or use your camera to see exactly where a QR code leads before you scan it — no signup, no nonsense.",
  keywords: [
    "qr code scanner",
    "is this qr code safe",
    "quishing checker",
    "qr code safety check",
    "scan qr code online",
  ],
  openGraph: {
    title: "QR Code Scanner — Is This Valid?",
    description:
      "See where a QR code really leads before you scan it — free, no signup.",
    url: `${SITE_URL}/check/qr`,
  },
  alternates: { canonical: `${SITE_URL}/check/qr` },
};

export default function QrLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Script
        id="schema-qr-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: QR_FAQ_DATA.map((item) => ({
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
