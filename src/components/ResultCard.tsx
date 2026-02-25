import type { EmailValidationResult } from "@/lib/email-validator";

interface Props {
  result: EmailValidationResult;
}

type Sentiment = "valid" | "warn" | "invalid";

function getSentiment(result: EmailValidationResult): Sentiment {
  if (result.valid && result.score >= 70) return "valid";
  if (!result.checks.syntax || result.score < 30) return "invalid";
  return "warn";
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
  warn: "Risky",
  invalid: "Invalid",
};

export default function ResultCard({ result }: Props) {
  const sentiment = getSentiment(result);
  const styles = sentimentStyles[sentiment];

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
        </div>
        <ScoreRing score={result.score} sentiment={sentiment} />
      </div>

      {/* Email */}
      <p className="text-zinc-300 text-sm font-mono break-all">
        {result.email}
      </p>

      {/* Cheeky message */}
      <p className="text-white text-base font-medium">{result.message}</p>

      {/* Suggestion */}
      {result.suggestion && (
        <p className="text-sm text-orange-400">
          💡 Did you mean <strong>{result.suggestion}</strong>?
        </p>
      )}

      {/* Check breakdown */}
      <div className="grid grid-cols-2 gap-2">
        <CheckRow label="Syntax" pass={result.checks.syntax} />
        <CheckRow label="Valid TLD" pass={result.checks.validTld} />
        <CheckRow label="Not Disposable" pass={result.checks.notDisposable} />
        <CheckRow label="Not Role-based" pass={result.checks.notRole} />
        {result.checks.hasMx !== null && (
          <CheckRow
            label="Mail server (MX)"
            pass={result.checks.hasMx}
            className="col-span-2"
          />
        )}
        {result.checks.apiDeliverable !== null && (
          <CheckRow
            label="Mailbox reachable"
            pass={result.checks.apiDeliverable}
            className="col-span-2"
          />
        )}
      </div>

      {/* Source badge */}
      <p className="text-xs text-zinc-500 text-right">
        Validated via{" "}
        <span className="text-zinc-400 font-medium">
          {result.source === "emailable"
            ? "Emailable API + local checks"
            : "local checks"}
        </span>
      </p>
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
    valid: "#84cc16", // lime-400
    warn: "#eab308", // yellow-400
    invalid: "#fb7185", // rose-400
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
