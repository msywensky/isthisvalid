/**
 * Color tokens mirroring the web app's Tailwind palette (see CLAUDE.md:
 * always-dark design, zinc-950 background, orange/amber accents, lime/
 * yellow/rose result sentiment). Hex values are Tailwind's stock palette —
 * kept as plain RN StyleSheet constants rather than pulled in via NativeWind,
 * since NativeWind v4 only supports Tailwind CSS v3 and this monorepo's web
 * app is on v4; sharing one Tailwind engine across both would need NativeWind
 * v5 (still an RC). Revisit once v5 is stable.
 */
export const Colors = {
  zinc950: "#09090b",
  zinc900: "#18181b",
  zinc800: "#27272a",
  zinc500: "#71717a",
  zinc400: "#a1a1aa",
  zinc300: "#d4d4d8",
  white: "#ffffff",

  // Brand orange — CheckShell's icon+label row on every tool screen (not a
  // per-tool accent).
  orange400: "#fb923c",

  // Email tool accent (CLAUDE.md: "amber-400/500, distinct from brand
  // orange"): 400 for text accents (e.g. the headline span), 500 for the CTA.
  amber400: "#fbbf24",
  amber500: "#f59e0b",

  lime300: "#bef264",
  lime600: "#65a30d",
  lime950: "#1a2e05",
  limeBorder: "rgba(132, 204, 22, 0.5)",
  // Matches web's CheckRow: bg-lime-900/30 (pass state)
  limeCheckBg: "rgba(54, 83, 20, 0.3)",

  yellow600: "#ca8a04",
  yellow950: "#422006",
  yellowBorder: "rgba(234, 179, 8, 0.5)",

  rose300: "#fda4af",
  rose400: "#fb7185",
  rose600: "#e11d48",
  rose950: "#4c0519",
  roseBorder: "rgba(244, 63, 94, 0.5)",
  // Matches web's CheckRow: bg-rose-900/30 (fail state)
  roseCheckBg: "rgba(136, 19, 55, 0.3)",
} as const;
