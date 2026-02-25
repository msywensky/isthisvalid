import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Image Checker",
  description:
    "Upload or paste an image URL. AI vision detects deepfakes, manipulated screenshots, and out-of-context photos.",
  alternates: { canonical: "https://isthisvalid.com/check/image" },
};

export default function ImageCheckLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
