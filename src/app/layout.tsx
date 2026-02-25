import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import CookieConsent from "@/components/CookieConsent";
import SiteFooter from "@/components/SiteFooter";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = "https://isthisvalid.com";
const ADSENSE_ID = process.env.NEXT_PUBLIC_ADSENSE_ID;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Is This Valid? — Free Online Verification Tools",
    template: "%s | IsThisValid.com",
  },
  description:
    "Free tools to verify emails and check URLs for phishing, malware, and scams. No signup required — instant results.",
  keywords: [
    "email validator",
    "email checker",
    "is this email valid",
    "disposable email checker",
    "free email validation",
    "url checker",
    "phishing link checker",
    "is this url safe",
    "malware link detector",
    "safe browsing check",
  ],
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "Is This Valid? — Free Online Verification Tools",
    description:
      "Check emails and URLs instantly. Detect phishing, fake addresses, and malware domains — free, no signup.",
    siteName: "IsThisValid.com",
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Is This Valid?",
    description:
      "Free email validator and URL safety checker — instant results, no signup.",
    images: [`${SITE_URL}/og-image.png`],
  },
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Google AdSense — remove if not using */}
        {ADSENSE_ID && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_ID}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
        {/* Structured data — WebApplication */}
        <Script
          id="schema-org"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "IsThisValid.com",
              url: SITE_URL,
              applicationCategory: "UtilitiesApplication",
              description:
                "Free tools to verify emails and check URLs for phishing, malware, and scams. Instant results, no signup required.",
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            }),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-zinc-50 min-h-screen flex flex-col`}
      >
        {/* Skip navigation — keyboard / screen-reader users jump straight to content */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-orange-500 focus:text-white focus:font-semibold focus:text-sm focus:outline-none"
        >
          Skip to main content
        </a>
        {children}
        <SiteFooter />
        <CookieConsent />
      </body>
    </html>
  );
}
