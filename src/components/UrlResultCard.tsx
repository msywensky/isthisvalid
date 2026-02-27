"use client";

import { UrlValidationResult } from "@/lib/url-validator";
import AffiliateNudge from "@/components/AffiliateNudge";
import { AFFILIATE_LINKS } from "@/lib/affiliate-links";

interface Props {
  result: UrlValidationResult;
}

// Sentiment thresholds — stricter than email (URL ≥80 = Safe)
function getSentiment(score: number) {
  if (score >= 80)
    return {
      label: "Safe",
      bg: "bg-lime-400/15",
      text: "text-lime-400",
      ring: "#a3e635",
    };
  if (score >= 50)
    return {
      label: "Suspicious",
      bg: "bg-yellow-400/15",
      text: "text-yellow-400",
      ring: "#facc15",
    };
  return {
    label: "Dangerous",
    bg: "bg-rose-500/15",
    text: "text-rose-400",
    ring: "#f43f5e",
  };
}

function CheckRow({
  label,
  pass,
  className = "",
}: {
  label: string;
  pass: boolean | undefined | null;
  className?: string;
}) {
  if (pass === undefined || pass === null) return null;

  const icon = pass ? (
    <span className="text-lime-400 text-lg font-bold leading-none">✓</span>
  ) : (
    <span className="text-rose-400 text-lg font-bold leading-none">✗</span>
  );

  return (
    <div
      className={`flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm ${className}`}
    >
      {icon}
      <span className="text-zinc-300">{label}</span>
    </div>
  );
}

export function UrlResultCard({ result }: Props) {
  const s = getSentiment(result.score);
  const checks = result.checks;

  // SVG score ring
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (result.score / 100) * circumference;

  const hasFlags = result.flags.length > 0;
  const hasSafeBrowsing = checks.safeBrowsing !== null;
  const hasResolves = checks.resolves !== null;
  const hasRdap = checks.notNewlyRegistered !== null;
  const safeBrowsingFailed = result.safeBrowsingError === true;

  // Source badge text
  const sourceText = hasSafeBrowsing
    ? "Safe Browsing + RDAP + local checks"
    : hasRdap
      ? "RDAP + local checks"
      : "local checks";

  return (
    <div className="mt-8 w-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      {/* Header row — score ring + sentiment */}
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        {/* Score ring */}
        <div className="relative shrink-0">
          <svg width="100" height="100" className="-rotate-90">
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="#3f3f46"
              strokeWidth="10"
            />
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={s.ring}
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 0.6s ease" }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center rotate-0 text-2xl font-bold text-white">
            {result.score}
          </span>
        </div>

        {/* Verdict block */}
        <div className="flex flex-col gap-2">
          <span
            className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-sm font-semibold ${s.bg} ${s.text}`}
          >
            {s.label}
          </span>
          <p className="text-sm text-zinc-300 leading-relaxed max-w-md">
            {result.message}
          </p>
          <p className="text-xs text-zinc-500">
            Checked via <span className="italic">{sourceText}</span>
          </p>
        </div>
      </div>

      {/* Safe Browsing degraded warning */}
      {safeBrowsingFailed && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
          <span className="shrink-0 font-bold">⚠</span>
          <span>
            Google Safe Browsing check could not be completed. This result is
            based on local checks only — exercise extra caution before visiting
            this URL.
          </span>
        </div>
      )}

      {/* Check grid */}
      <div className="mt-6 grid grid-cols-2 gap-2">
        <CheckRow label="Parseable URL" pass={checks.parseable} />
        <CheckRow label="Valid scheme (https/http)" pass={checks.validScheme} />
        <CheckRow label="Not an IP address" pass={checks.notIpAddress} />
        <CheckRow label="No embedded credentials" pass={checks.noUserInfo} />
        <CheckRow label="Not a link shortener" pass={checks.notShortener} />
        <CheckRow
          label="No suspicious keywords"
          pass={checks.noSuspiciousKeywords}
        />
        <CheckRow label="No punycode encoding" pass={checks.notPunycode} />
        <CheckRow label="Valid TLD" pass={checks.validTld} />
        <CheckRow label="No brand impersonation" pass={checks.noBrandSquat} />
        <CheckRow
          label="Normal subdomain depth"
          pass={checks.notExcessiveSubdomains}
        />
        <CheckRow
          label="Low-risk TLD"
          pass={checks.notSuspiciousTld}
        />
        <CheckRow label="No typosquatting" pass={checks.notTyposquat} />
        <CheckRow label="Normal domain structure" pass={checks.notHighEntropy} />
        <CheckRow label="Normal hyphen usage" pass={checks.notExcessiveHyphens} />
        {hasRdap && (
          <CheckRow
            label="Established domain (≥30 days)"
            pass={checks.notNewlyRegistered}
          />
        )}
        {hasResolves && (
          <CheckRow
            label="URL resolves (live server)"
            pass={checks.resolves}
            className="col-span-2"
          />
        )}
        {hasSafeBrowsing && (
          <CheckRow
            label="Google Safe Browsing: clean"
            pass={checks.safeBrowsing}
            className="col-span-2"
          />
        )}
      </div>

      {/* Redirect notice */}
      {result.redirectedTo && (
        <div className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-xs text-zinc-400">
          Redirects to:{" "}
          <span className="break-all text-zinc-300">{result.redirectedTo}</span>
        </div>
      )}

      {/* Flags list */}
      {hasFlags && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Issues detected
          </p>
          <div className="flex flex-wrap gap-2">
            {result.flags.map((flag) => (
              <span
                key={flag}
                className="rounded-full bg-rose-500/15 px-3 py-1 text-xs text-rose-300"
              >
                {flag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Affiliate nudge — only shown for suspicious or dangerous URLs */}
      {result.score < 80 && (
        <AffiliateNudge
          href={AFFILIATE_LINKS.nordvpn}
          eyebrow="Stay safer online"
          headline="Block threats before they reach you"
          body="NordVPN encrypts your traffic and blocks malicious sites automatically — no link-checking required."
          cta="Try NordVPN →"
        />
      )}
    </div>
  );
}
