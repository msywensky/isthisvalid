import type { PhoneValidationResult } from "@/lib/phone-validator";
import KofiDonation from "@/components/KofiDonation";

interface Props {
  result: PhoneValidationResult;
}

type Sentiment = "valid" | "warn" | "invalid";

function getSentiment(result: PhoneValidationResult): Sentiment {
  if (result.valid && result.score >= 70) return "valid";
  if (!result.checks.parseable || result.score < 30) return "invalid";
  return "warn";
}

function lineTypeLabel(lineType: string): string {
  switch (lineType) {
    case "MOBILE":
      return "Mobile";
    case "FIXED_LINE":
      return "Landline";
    case "FIXED_LINE_OR_MOBILE":
      return "Mobile or Landline";
    case "TOLL_FREE":
      return "Toll-Free";
    case "VOIP":
      return "VoIP";
    case "PREMIUM_RATE":
      return "Premium Rate";
    case "SHARED_COST":
      return "Shared Cost";
    case "PAGER":
      return "Pager";
    case "UAN":
      return "Universal Access";
    case "PERSONAL_NUMBER":
      return "Personal";
    case "VOICEMAIL":
      return "Voicemail";
    default:
      return lineType.replace(/_/g, " ");
  }
}

const sentimentStyles: Record<
  Sentiment,
  { card: string; badge: string; icon: string }
> = {
  valid: {
    card: "border-lime-500/50 bg-lime-950/40",
    badge: "bg-lime-600 text-white",
    icon: "✅",
  },
  warn: {
    card: "border-yellow-500/50 bg-yellow-950/40",
    badge: "bg-yellow-600 text-black",
    icon: "⚠️",
  },
  invalid: {
    card: "border-rose-500/50 bg-rose-950/40",
    badge: "bg-rose-600 text-white",
    icon: "❌",
  },
};

const sentimentLabels: Record<Sentiment, string> = {
  valid: "Valid",
  warn: "Suspicious",
  invalid: "Invalid",
};

export default function PhoneResultCard({ result }: Props) {
  const sentiment = getSentiment(result);
  const styles = sentimentStyles[sentiment];

  // Pull the Caribbean/NANP warning out for prominent placement.
  // It's filtered from the generic flags list to avoid showing twice.
  const nanpFlag = result.flags.find((f) => f.includes("Caribbean"));
  const otherFlags = result.flags.filter((f) => !f.includes("Caribbean"));
  return (
    <div
      className={`w-full max-w-xl mx-auto rounded-2xl border-2 p-6 space-y-5 ${styles.card} transition-all duration-300`}
      role="region"
      aria-label="Validation result"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="text-2xl">
            {styles.icon}
          </span>
          <span
            className={`text-sm font-bold uppercase tracking-wider px-3 py-1 rounded-full ${styles.badge}`}
          >
            {sentimentLabels[sentiment]}
          </span>
          {result.lineType && result.lineType !== "UNKNOWN" && (
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
              {lineTypeLabel(result.lineType)}
            </span>
          )}
        </div>
        <ScoreRing score={result.score} sentiment={sentiment} />
      </div>

      {/* Input echo */}
      <p className="text-zinc-300 text-sm font-mono break-all">
        {result.input}
      </p>

      {/* Label + message */}
      <div className="space-y-1">
        <p className="text-white text-base font-medium">{result.label}</p>
        <p className="text-zinc-400 text-sm">{result.message}</p>
      </div>

      {/* Caribbean/NANP one-ring scam callout — shown prominently, not buried in flags */}
      {nanpFlag && (
        <div className="rounded-xl border border-amber-500/50 bg-amber-950/40 px-4 py-3 flex gap-3">
          <span
            aria-hidden="true"
            className="text-amber-400 text-base mt-0.5 flex-shrink-0"
          >
            ⚠️
          </span>
          <p className="text-amber-300 text-sm leading-snug">{nanpFlag}</p>
        </div>
      )}

      {/* Formatted number details */}
      {result.checks.parseable && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          {result.phoneE164 && (
            <Detail label="E.164" value={result.phoneE164} />
          )}
          {result.internationalFormat && (
            <Detail label="International" value={result.internationalFormat} />
          )}
          {result.nationalFormat && result.countryName && (
            <Detail label="National" value={result.nationalFormat} />
          )}
          {result.countryName && (
            <Detail
              label="Country"
              value={`${result.countryCode} · ${result.countryName}`}
            />
          )}
          {result.location && (
            <Detail
              label={
                result.source === "local" ? "Area code region" : "Location"
              }
              value={result.location}
              note={
                result.source === "local"
                  ? "Based on area code — mobile numbers may differ"
                  : undefined
              }
            />
          )}
          {result.carrier && <Detail label="Carrier" value={result.carrier} />}
        </div>
      )}

      {/* Check breakdown */}
      <div className="grid grid-cols-2 gap-2">
        <CheckRow label="Parseable" pass={result.checks.parseable} />
        <CheckRow label="Valid format" pass={result.checks.validPattern} />
        <CheckRow label="Valid length" pass={result.checks.validLength} />
        <CheckRow
          label="Country detected"
          pass={result.checks.countryDetected}
        />
        {result.lineActive !== null && (
          <CheckRow
            label="Line active"
            pass={result.lineActive}
            className="col-span-2"
          />
        )}
      </div>

      {/* Flags */}
      {otherFlags.length > 0 && (
        <ul className="space-y-1">
          {otherFlags.map((flag) => (
            <li key={flag} className="text-xs text-yellow-400 flex gap-2">
              <span aria-hidden="true">⚠</span>
              <span>{flag}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Source badge */}
      <p className="text-xs text-zinc-500 text-right">
        Validated via{" "}
        <span className="text-zinc-400 font-medium">
          {result.source === "numverify"
            ? "Numverify + libphonenumber"
            : result.source === "abstract"
              ? "Abstract API + libphonenumber"
              : "libphonenumber (Google)"}
        </span>
      </p>

      {/* Ko-fi donation */}
      <KofiDonation />
    </div>
  );
}

function Detail({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-lg px-3 py-2 bg-zinc-800/60 space-y-0.5">
      <p className="text-zinc-500 text-[10px] uppercase tracking-wider">
        {label}
      </p>
      <p className="text-zinc-200 font-mono truncate">{value}</p>
      {note && <p className="text-zinc-500 text-[10px] italic">{note}</p>}
    </div>
  );
}

function CheckRow({
  label,
  pass,
  className = "",
}: {
  label: string;
  pass: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
        pass ? "bg-lime-900/30 text-lime-300" : "bg-rose-900/30 text-rose-300"
      } ${className}`}
    >
      <span aria-hidden="true">{pass ? "✓" : "✗"}</span>
      <span>{label}</span>
    </div>
  );
}

function ScoreRing({
  score,
  sentiment,
}: {
  score: number;
  sentiment: Sentiment;
}) {
  const radius = 20;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const colors: Record<Sentiment, string> = {
    valid: "#84cc16",
    warn: "#eab308",
    invalid: "#fb7185",
  };

  return (
    <div
      className="relative flex items-center justify-center"
      aria-label={`Score: ${score} out of 100`}
      title={`Confidence score: ${score}/100`}
    >
      <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke="#27272a"
          strokeWidth="6"
        />
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke={colors[sentiment]}
          strokeWidth="6"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <span className="absolute text-xs font-bold text-white">{score}</span>
    </div>
  );
}
