import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Phone Number Validator",
  description:
    "Free phone number validator. Check format, identify country and line type, and flag premium-rate and VoIP numbers used in scams.",
  alternates: { canonical: "https://isthisvalid.com/check/phone" },
};

export default function PhoneCheckLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
