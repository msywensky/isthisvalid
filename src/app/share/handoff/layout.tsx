import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Opening shared content",
  // Transient redirect page — nothing here for a search engine.
  robots: { index: false, follow: false },
};

export default function ShareHandoffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
