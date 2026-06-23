import type { Metadata } from "next";
import Script from "next/script";
import { IMAGE_FAQ_DATA } from "@/lib/image-faq-data";

const SITE_URL = "https://isthisvalid.com";

export const metadata: Metadata = {
  title: "Image Deepfake & AI Detection",
  description:
    "Free deepfake and AI-generated image detector. Upload a photo or screenshot — we'll tell you if it's authentic or manipulated. No signup, no nonsense.",
  keywords: [
    "deepfake detector",
    "AI image detection",
    "fake photo checker",
    "is this image real",
    "deepfake checker",
  ],
  openGraph: {
    title: "Image Deepfake & AI Detection — Is This Valid?",
    description:
      "Is that photo real? Upload it and AI will tell you instantly — free, no signup.",
    url: `${SITE_URL}/check/image`,
  },
  alternates: { canonical: `${SITE_URL}/check/image` },
};

export default function ImageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <Script
        id="schema-image-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: IMAGE_FAQ_DATA.map((item) => ({
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
