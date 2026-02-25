/**
 * SiteLogo — split-diamond wordmark badge for IsThisValid.com.
 *
 * Left  half (dark)   — orange ✓ checkmark (valid)
 * Right half (orange) — white  ✗ X mark    (invalid)
 *
 * size="md" (default) — hero / hub page
 * size="sm"           — compact header / nav bar
 */

interface SiteLogoProps {
  className?: string;
  size?: "sm" | "md";
}

export default function SiteLogo({
  className = "",
  size = "md",
}: SiteLogoProps) {
  const isSmall = size === "sm";
  return (
    <div
      className={`inline-flex items-center gap-2 select-none ${className}`}
      aria-label="IsThisValid.com"
    >
      <DiamondIcon small={isSmall} />

      {/* Wordmark */}
      <span
        className={`font-bold tracking-tight leading-none ${
          isSmall ? "text-base" : "text-xl"
        }`}
      >
        <span className="text-white">IsThisValid</span>
        <span className="text-orange-400">.com</span>
      </span>
    </div>
  );
}

/* ── Split diamond ──────────────────────────────────────────────────────── */

function DiamondIcon({ small = false }: { small?: boolean }) {
  /*
   * md (46×46): corners top(23,7) right(39,23) bottom(23,39) left(7,23)
   * sm (30×30): corners top(15,4) right(26,15) bottom(15,26) left(4,15)
   */
  if (small) {
    return (
      <span className="relative flex items-center justify-center w-8 h-8 shrink-0">
        <svg
          width="30"
          height="30"
          viewBox="0 0 30 30"
          fill="none"
          aria-hidden="true"
        >
          {/* Outer stroke */}
          <path
            d="M15 4 L4 15 L15 26 L26 15 Z"
            stroke="#52525b"
            strokeWidth="0.75"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Left half */}
          <path d="M15 4 L4 15 L15 26 Z" fill="#27272a" />
          {/* Right half */}
          <path d="M15 4 L26 15 L15 26 Z" fill="#f97316" />
          {/* Centre seam */}
          <line
            x1="15"
            y1="4"
            x2="15"
            y2="26"
            stroke="#09090b"
            strokeWidth="0.9"
          />
          {/* ✓ Checkmark — orange, left half */}
          <path
            d="M8.5 15 L10.75 17.25 L14.35 12"
            stroke="#f97316"
            strokeWidth="1.15"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* ✗ X mark — white, right half */}
          <path
            d="M17.25 12.75 L20.875 16.625 M17.25 16.625 L20.875 12.75"
            stroke="white"
            strokeWidth="1.15"
            strokeLinecap="round"
          />
        </svg>
      </span>
    );
  }

  return (
    <span className="relative flex items-center justify-center w-12 h-12 shrink-0">
      <svg
        width="46"
        height="46"
        viewBox="0 0 46 46"
        fill="none"
        aria-hidden="true"
      >
        {/* Outer stroke */}
        <path
          d="M23 7 L7 23 L23 39 L39 23 Z"
          stroke="#52525b"
          strokeWidth="1"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Left half */}
        <path d="M23 7 L7 23 L23 39 Z" fill="#27272a" />
        {/* Right half */}
        <path d="M23 7 L39 23 L23 39 Z" fill="#f97316" />
        {/* Centre seam */}
        <line
          x1="23"
          y1="7"
          x2="23"
          y2="39"
          stroke="#09090b"
          strokeWidth="1.25"
        />
        {/* ✓ Checkmark — orange, left half */}
        <path
          d="M13 23 L16.5 26.5 L22 18.5"
          stroke="#f97316"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* ✗ X mark — white, right half */}
        <path
          d="M26.5 19.5 L32 25.5 M26.5 25.5 L32 19.5"
          stroke="white"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
