import Link from "next/link";
import type { ReactNode } from "react";
import SiteLogo from "@/components/SiteLogo";

interface Props {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}

/**
 * Shared wrapper for legal/policy pages.
 * Gives them a consistent readable layout without repeating markup.
 */
export default function PolicyLayout({ title, lastUpdated, children }: Props) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="border-b border-zinc-800 py-3 px-6">
        <Link
          href="/"
          aria-label="IsThisValid.com home"
          className="inline-flex"
        >
          <SiteLogo size="sm" />
        </Link>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-6 py-12 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold text-white">{title}</h1>
          <p className="text-sm text-zinc-500">Last updated: {lastUpdated}</p>
        </div>

        {/* Prose styles applied via className on child elements */}
        <div className="space-y-6 text-zinc-300 text-sm leading-7">
          {children}
        </div>
      </main>
    </div>
  );
}

/** Reusable section heading inside policy pages */
export function PolicySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-bold text-white">{title}</h2>
      <div className="space-y-3 text-zinc-300">{children}</div>
    </section>
  );
}
