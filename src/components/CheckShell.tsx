import type { ReactNode } from "react";
import Link from "next/link";
import SiteLogo from "@/components/SiteLogo";

interface CheckShellProps {
  icon: string;
  label: string;
  /** The tool-specific <h1> — pass a ReactNode so callers can bold/colour spans */
  headline: ReactNode;
  sub: string;
  /** Optional badge rendered next to the label (e.g. "Beta", "Coming soon") */
  badge?: string;
  children: ReactNode;
}

/**
 * Shared shell for every /check/* tool page.
 * Provides the back-nav, hero header, and page wrapper.
 * Server component — no client state.
 */
export default function CheckShell({
  icon,
  label,
  headline,
  sub,
  badge,
  children,
}: CheckShellProps) {
  return (
    <main
      id="main-content"
      className="flex flex-col items-center min-h-screen px-4 py-10 gap-10"
    >
      {/* Top bar: back link (left) | logo (centre) | spacer (right) */}
      <nav className="w-full max-w-xl grid grid-cols-3 items-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-sm transition-colors group"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="group-hover:-translate-x-0.5 transition-transform duration-150"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          All tools
        </Link>
        <Link
          href="/"
          aria-label="IsThisValid.com home"
          className="flex justify-center"
        >
          <SiteLogo size="sm" />
        </Link>
        {/* right spacer — keeps logo centred */}
        <span aria-hidden="true" />
      </nav>

      {/* Tool hero */}
      <section
        className="text-center space-y-3 max-w-2xl"
        aria-label="Tool description"
      >
        <div className="inline-flex items-center gap-2 text-orange-400 text-sm font-medium tracking-wider uppercase mb-2">
          <span aria-hidden="true">{icon}</span>
          {label}
          {badge && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest bg-zinc-800 text-zinc-400 border border-zinc-700 uppercase normal-case">
              {badge}
            </span>
          )}
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
          {headline}
        </h1>
        <p className="text-zinc-400 text-base sm:text-lg max-w-md mx-auto">
          {sub}
        </p>
      </section>

      {children}
    </main>
  );
}
