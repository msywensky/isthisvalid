interface ScoreRingProps {
  score: number;
  ringColor: string;
  /** Defaults to zinc-800 (#27272a). URL's ring uses zinc-700 (#3f3f46) instead. */
  trackColor?: string;
}

const SIZE = 56;
const CENTER = SIZE / 2;
const RADIUS = 20;
const STROKE_WIDTH = 6;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Shared 0–100 score ring used by every result card (Email, Phone, URL,
 * Text, Image) — a small 56×56 ring, radius 20, starting at 12 o'clock via
 * `-rotate-90`. Callers own their own score/sentiment → color mapping and
 * just pass the resolved hex through `ringColor`.
 */
export default function ScoreRing({
  score,
  ringColor,
  trackColor = "#27272a",
}: ScoreRingProps) {
  const offset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;

  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      aria-label={`Score: ${score} out of 100`}
      title={`Confidence score: ${score}/100`}
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="-rotate-90"
      >
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke={trackColor}
          strokeWidth={STROKE_WIDTH}
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke={ringColor}
          strokeWidth={STROKE_WIDTH}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <span className="absolute text-xs font-bold text-white">{score}</span>
    </div>
  );
}
