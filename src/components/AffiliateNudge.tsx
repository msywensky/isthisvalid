interface Props {
  href: string;
  eyebrow: string;
  headline: string;
  body: string;
  cta: string;
}

/**
 * Subtle post-result affiliate recommendation.
 *
 * Shown only when contextually relevant (risky/failed results).
 * Always includes a visible "Affiliate" disclosure label.
 * Link opens in a new tab with noopener/nofollow attributes.
 */
export default function AffiliateNudge({
  href,
  eyebrow,
  headline,
  body,
  cta,
}: Props) {
  return (
    <div
      className="rounded-xl border border-zinc-700/40 bg-zinc-800/30 px-4 py-3 space-y-1.5"
      role="complementary"
      aria-label="Sponsored recommendation"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">
          {eyebrow}
        </p>
        <span className="shrink-0 text-[10px] text-zinc-600 uppercase tracking-wider border border-zinc-700 rounded px-1.5 py-0.5">
          Affiliate
        </span>
      </div>
      <p className="text-sm font-semibold text-zinc-200">{headline}</p>
      <p className="text-xs text-zinc-500 leading-relaxed">{body}</p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="inline-flex items-center gap-1 text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors"
      >
        {cta}
        <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}
