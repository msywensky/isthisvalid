import type { EmailValidationResult } from "@/lib/email-validator";
import AffiliateNudge from "@/components/AffiliateNudge";
import KofiDonation from "@/components/KofiDonation";
import ScoreRing from "@/components/ScoreRing";
import { AFFILIATE_LINKS } from "@/lib/affiliate-links";
import {
  showsAffiliate,
  showsKofi,
  type ResultCardVariant,
} from "@/lib/result-card-variant";

interface Props {
  result: EmailValidationResult;
  /** Defaults to "standalone" — see ResultCardVariant. */
  variant?: ResultCardVariant;
}

type Sentiment = "valid" | "warn" | "invalid";

function getSentiment(result: EmailValidationResult): Sentiment {
  if (result.valid && result.score >= 70) return "valid";
  if (!result.checks.syntax || result.score < 30) return "invalid";
  return "warn";
}

const sentimentStyles: Record<
  Sentiment,
  { card: string; badge: string; icon: string; ring: string }
> = {
  valid: {
    card: "border-lime-500/50 bg-lime-950/40",
    badge: "bg-lime-600 text-white",
    icon: "✅",
    ring: "#84cc16",
  },
  warn: {
    card: "border-yellow-500/50 bg-yellow-950/40",
    badge: "bg-yellow-600 text-black",
    icon: "⚠️",
    ring: "#eab308",
  },
  invalid: {
    card: "border-rose-500/50 bg-rose-950/40",
    badge: "bg-rose-600 text-white",
    icon: "❌",
    ring: "#fb7185",
  },
};

const sentimentLabels: Record<Sentiment, string> = {
  valid: "Valid",
  warn: "Risky",
  invalid: "Invalid",
};

export default function ResultCard({ result, variant = "standalone" }: Props) {
  const sentiment = getSentiment(result);
  const styles = sentimentStyles[sentiment];
  const showKofi = showsKofi(variant);
  const showAffiliate = showsAffiliate(variant);

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
        <ScoreRing score={result.score} ringColor={styles.ring} />
      </div>

      {/* Email */}
      <p className="text-zinc-300 text-sm font-mono break-all">
        {result.email}
      </p>

      {/* Cheeky message */}
      <p className="text-white text-base font-medium">{result.message}</p>

      {/* Suggestion */}
      {result.suggestion && (
        <p className="text-sm text-amber-400">
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
          {result.source === "zerobounce"
            ? "ZeroBounce + local checks"
            : result.source === "emailable"
              ? "Emailable API + local checks"
              : "local checks"}
        </span>
      </p>

      {/* Affiliate nudge — only shown for risky or invalid results */}
      {showAffiliate && (sentiment === "warn" || sentiment === "invalid") && (
        <AffiliateNudge
          href={AFFILIATE_LINKS.zerobounce}
          eyebrow="Got a whole list to check?"
          headline="Verify bulk emails with ZeroBounce"
          body="ZeroBounce catches bad addresses, disposable providers, and spam traps at scale — before they damage your sender reputation."
          cta="Try ZeroBounce free →"
        />
      )}

      {/* Ko-fi donation — the composite view renders a single shared one */}
      {showKofi && <KofiDonation />}
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
