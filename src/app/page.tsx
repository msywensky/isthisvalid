import Link from "next/link";
import SiteLogo from "@/components/SiteLogo";

const tools = [
  {
    href: "/check/email",
    icon: "📧",
    name: "Email",
    tagline: "Is this address real?",
    description:
      "Validate syntax, check TLD, flag disposable providers, and verify mailbox delivery.",
    accentHover: "hover:border-orange-500/60",
    accentText: "group-hover:text-orange-400",
    accentBadge: null,
    cta: "Validate email",
  },
  {
    href: "/check/url",
    icon: "🔗",
    name: "URL",
    tagline: "Safe to click?",
    description:
      "Spot phishing links, malware domains, and suspicious redirects before you click.",
    accentHover: "hover:border-sky-500/60",
    accentText: "group-hover:text-sky-400",
    accentBadge: null,
    cta: "Check URL",
  },
  {
    href: "/check/text",
    icon: "💬",
    name: "Text / SMS",
    tagline: "Scam or legit?",
    description:
      "Paste a suspicious message — AI flags smishing, impersonation, and urgency tricks.",
    accentHover: "hover:border-violet-500/60",
    accentText: "group-hover:text-violet-400",
    accentBadge: null,
    cta: "Analyse text",
  },
  {
    href: "/check/image",
    icon: "🖼️",
    name: "Image",
    tagline: "Real or faked?",
    description:
      "AI vision checks for deepfakes, manipulated screenshots, and out-of-context photos.",
    accentHover: "hover:border-emerald-500/60",
    accentText: "group-hover:text-emerald-400",
    accentBadge: "Soon",
    cta: "Coming soon",
  },
];

export default function HubPage() {
  return (
    <main
      id="main-content"
      className="flex flex-col items-center min-h-screen px-4 py-16 gap-14"
    >
      {/* Hero */}
      <section className="text-center space-y-4 max-w-2xl">
        <div className="flex justify-center mb-2">
          <SiteLogo />
        </div>

        <div className="inline-flex items-center gap-2 text-orange-400 text-sm font-medium tracking-wider uppercase">
          <span aria-hidden="true">🔍</span> Free verification tools
        </div>
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-white">
          Is this <span className="text-orange-400">real</span>?
        </h1>
        <p className="text-zinc-400 text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
          Pick something suspicious. We&apos;ll tell you if it&rsquo;s genuine,
          sketchy, or straight-up fake. No signup. No nonsense.
        </p>
      </section>

      {/* Tool grid */}
      <section
        className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-4"
        aria-label="Available tools"
      >
        {tools.map((tool) => {
          const isSoon = tool.accentBadge === "Soon";
          const cardBody = (
            <>
              {tool.accentBadge && (
                <span className="absolute top-4 right-4 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest bg-zinc-800 text-zinc-500 border border-zinc-700 uppercase">
                  {tool.accentBadge}
                </span>
              )}
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden="true">
                  {tool.icon}
                </span>
                <span
                  className={`text-base font-semibold text-zinc-200 transition-colors duration-200 ${tool.accentText}`}
                >
                  {tool.name}
                </span>
              </div>
              <p className="text-zinc-300 font-medium text-sm">
                {tool.tagline}
              </p>
              <p className="text-zinc-500 text-sm leading-relaxed flex-1">
                {tool.description}
              </p>
              <span className="mt-1 text-sm font-medium text-zinc-400 group-hover:text-zinc-200 transition-colors duration-150 flex items-center gap-1">
                {tool.cta}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="group-hover:translate-x-0.5 transition-transform duration-150"
                  aria-hidden="true"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </span>
            </>
          );

          const baseClasses = `group relative flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 transition-all duration-200 ${tool.accentHover}`;

          return isSoon ? (
            // Not a link — not live yet; aria-disabled signals this to assistive tech
            <div
              key={tool.href}
              aria-disabled="true"
              aria-label={`${tool.name} — coming soon`}
              className={`${baseClasses} opacity-50 cursor-not-allowed`}
            >
              {cardBody}
            </div>
          ) : (
            <Link
              key={tool.href}
              href={tool.href}
              className={`${baseClasses} hover:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-orange-500/50`}
            >
              {cardBody}
            </Link>
          );
        })}
      </section>

      {/* Trust line */}
      <p className="text-zinc-500 text-xs text-center max-w-sm">
        Free to use &middot; No account required &middot; Nothing is stored
      </p>
    </main>
  );
}
