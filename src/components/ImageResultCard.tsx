"use client";

import type {
  ImageDebunkResult,
  ImageClassification,
} from "@/lib/image-debunker";
import KofiDonation from "@/components/KofiDonation";

type Props = { result: ImageDebunkResult };

const CLASS_CONFIG: Record<
  ImageClassification,
  {
    label: string;
    emoji: string;
    ringColor: string;
    badgeColor: string;
    badgeBg: string;
    cardClass: string;
  }
> = {
  "ai-generated": {
    label: "AI-Generated",
    emoji: "🤖",
    ringColor: "#f43f5e",
    badgeColor: "text-rose-400",
    badgeBg: "bg-rose-950/40 border-rose-800/50",
    cardClass: "border-rose-500/50 bg-rose-950/40",
  },
  uncertain: {
    label: "Uncertain",
    emoji: "⚠️",
    ringColor: "#eab308",
    badgeColor: "text-yellow-400",
    badgeBg: "bg-yellow-950/40 border-yellow-800/50",
    cardClass: "border-yellow-500/50 bg-yellow-950/40",
  },
  authentic: {
    label: "Appears Authentic",
    emoji: "✅",
    ringColor: "#4ade80",
    badgeColor: "text-lime-400",
    badgeBg: "bg-lime-950/30 border-lime-800/40",
    cardClass: "border-lime-500/50 bg-lime-950/40",
  },
};

export default function ImageResultCard({ result }: Props) {
  const cfg = CLASS_CONFIG[result.classification];
  const displayScore = 100 - result.riskScore;

  const R = 52;
  const CIRC = 2 * Math.PI * R;
  const fill = (displayScore / 100) * CIRC;
  const OFFSET = CIRC * 0.25;

  return (
    <div
      className={`w-full max-w-xl rounded-2xl border-2 p-6 space-y-5 transition-all duration-300 ${cfg.cardClass}`}
    >
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

      {/* Score ring + confidence */}
      <div className="flex items-center gap-6">
        <div className="relative shrink-0" aria-hidden="true">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke="#27272a"
              strokeWidth="9"
            />
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

        <div className="flex-1 space-y-2">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">
            Detection Confidence
          </p>
          <div
            className="w-full bg-zinc-800 rounded-full h-2"
            role="meter"
            aria-valuenow={result.confidence}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Detection confidence: ${result.confidence}%`}
          >
            <div
              className="h-2 rounded-full bg-emerald-500 transition-all duration-500"
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

      {/* Flags */}
      {result.flags.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">
            Detection Signals
          </p>
          <ul className="space-y-1.5" aria-label="Detection signals">
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

      {result.flags.length === 0 && result.safe && (
        <div className="flex items-center gap-2 text-sm text-lime-400">
          <span aria-hidden="true">✓</span>
          No manipulation signals detected
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
        <span className="text-xs text-zinc-400">Powered by</span>
        <span className="rounded-md bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 font-mono">
          {result.modelLabel ?? "AI Detection"} · AI Detection
        </span>
      </div>

      {/* Ko-fi — no affiliate nudge */}
      <KofiDonation />
    </div>
  );
}
