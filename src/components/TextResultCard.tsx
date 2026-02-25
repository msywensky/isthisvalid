"use client";

import type { TextDebunkResult, TextClassification } from "@/lib/text-debunker";
import AffiliateNudge from "@/components/AffiliateNudge";
import { AFFILIATE_LINKS } from "@/lib/affiliate-links";

type Props = { result: TextDebunkResult };

const CLASS_CONFIG: Record<
  TextClassification,
  {
    label: string;
    emoji: string;
    ringColor: string;
    badgeColor: string;
    badgeBg: string;
  }
> = {
  scam: {
    label: "Scam Detected",
    emoji: "🚨",
    ringColor: "#ef4444",
    badgeColor: "text-red-400",
    badgeBg: "bg-red-950/40 border-red-800/50",
  },
  smishing: {
    label: "Smishing Detected",
    emoji: "🎣",
    ringColor: "#ef4444",
    badgeColor: "text-red-400",
    badgeBg: "bg-red-950/40 border-red-800/50",
  },
  spam: {
    label: "Spam",
    emoji: "📢",
    ringColor: "#eab308",
    badgeColor: "text-yellow-400",
    badgeBg: "bg-yellow-950/40 border-yellow-800/50",
  },
  suspicious: {
    label: "Suspicious",
    emoji: "⚠️",
    ringColor: "#eab308",
    badgeColor: "text-yellow-400",
    badgeBg: "bg-yellow-950/40 border-yellow-800/50",
  },
  legit: {
    label: "Looks Legit",
    emoji: "✅",
    ringColor: "#4ade80",
    badgeColor: "text-green-400",
    badgeBg: "bg-green-950/30 border-green-800/40",
  },
};

export default function TextResultCard({ result }: Props) {
  const cfg = CLASS_CONFIG[result.classification];

  // Display score: higher = safer (inverse of riskScore)
  const displayScore = 100 - result.riskScore;

  // SVG ring geometry
  const R = 52;
  const CIRC = 2 * Math.PI * R;
  const fill = (displayScore / 100) * CIRC;
  const OFFSET = CIRC * 0.25; // start at 12 o'clock

  return (
    <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 space-y-5">
      {/* Classification header */}
      <div
        className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${cfg.badgeBg}`}
      >
        <span className="text-2xl mt-0.5 shrink-0" aria-hidden="true">
          {cfg.emoji}
        </span>
        <div className="min-w-0">
          <p className={`font-bold text-lg leading-tight ${cfg.badgeColor}`}>
            {cfg.label}
          </p>
          <p className="text-zinc-300 text-sm mt-0.5 leading-snug">
            {result.summary}
          </p>
        </div>
      </div>

      {/* Score ring + AI confidence */}
      <div className="flex items-center gap-6">
        {/* Ring */}
        <div className="relative shrink-0" aria-hidden="true">
          <svg width="120" height="120" viewBox="0 0 120 120">
            {/* Track */}
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke="#27272a"
              strokeWidth="9"
            />
            {/* Fill arc */}
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke={cfg.ringColor}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${fill.toFixed(2)} ${CIRC.toFixed(2)}`}
              strokeDashoffset={OFFSET.toFixed(2)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-extrabold text-white">
              {displayScore}
            </span>
            <span className="text-[11px] text-zinc-500">/ 100</span>
          </div>
        </div>

        {/* Confidence bar */}
        <div className="flex-1 space-y-2">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">
            AI Confidence
          </p>
          <div
            className="w-full bg-zinc-800 rounded-full h-2"
            role="meter"
            aria-valuenow={result.confidence}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`AI confidence: ${result.confidence}%`}
          >
            <div
              className="h-2 rounded-full bg-violet-500 transition-all duration-500"
              style={{ width: `${result.confidence}%` }}
            />
          </div>
          <p className="text-sm text-zinc-300">
            <span className="font-semibold text-white">
              {result.confidence}%
            </span>{" "}
            confident
          </p>
        </div>
      </div>

      {/* Red flags */}
      {result.flags.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">
            Red Flags Detected
          </p>
          <ul className="space-y-1.5" aria-label="Red flags">
            {result.flags.map((flag, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-zinc-300"
              >
                <span
                  className="text-red-400 mt-0.5 shrink-0 font-bold"
                  aria-hidden="true"
                >
                  ✗
                </span>
                {flag}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* If legit and no flags, show a positive note */}
      {result.flags.length === 0 && result.safe && (
        <div className="flex items-center gap-2 text-sm text-green-400">
          <span aria-hidden="true">✓</span>
          No specific red flags detected
        </div>
      )}

      {/* Explanation */}
      <div className="space-y-1">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">
          Analysis
        </p>
        <p className="text-sm text-zinc-300 leading-relaxed">
          {result.explanation}
        </p>
      </div>

      {/* Source badge */}
      <div className="flex items-center gap-1.5 pt-1 border-t border-zinc-800">
        <span className="text-xs text-zinc-600">Powered by</span>
        <span className="rounded-md bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 font-mono">
          Claude Sonnet · AI Analysis
        </span>
      </div>

      {/* Affiliate nudge — only shown when the message is not safe */}
      {!result.safe && (
        <AffiliateNudge
          href={AFFILIATE_LINKS.nordvpn}
          eyebrow={
            result.classification === "scam" ||
            result.classification === "smishing"
              ? "You may have been targeted"
              : "Stay safer online"
          }
          headline="NordVPN shields your connection from scammers"
          body="Scammers exploit unsecured connections. NordVPN encrypts your traffic and blocks known phishing domains before they load."
          cta="Try NordVPN →"
        />
      )}
    </div>
  );
}
