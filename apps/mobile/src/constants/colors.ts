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
  zinc200: "#e4e4e7",
  white: "#ffffff",

  // Brand orange — CheckShell's icon+label row on every tool screen (not a
  // per-tool accent). 500/600 are the quick-check CTA's solid/pressed fill,
  // matching web's bg-orange-500 active:bg-orange-600.
  orange400: "#fb923c",
  orange500: "#f97316",
  orange600: "#ea580c",
  zinc700: "#3f3f46",

  // Email tool accent (CLAUDE.md: "amber-400/500, distinct from brand
  // orange"): 400 for text accents (e.g. the headline span), 500 for the CTA.
  amber400: "#fbbf24",
  amber500: "#f59e0b",

  // Per-tool home-screen card accents — match web's page.tsx tool list
  // (Phone: teal, Text: violet, Email: amber above, URL: sky, Image: emerald).
  teal400: "#2dd4bf",
  violet400: "#a78bfa",
  // Text tool CTA (bg-violet-500 active:bg-violet-600 on web's TextCheckPage).
  violet500: "#8b5cf6",
  violet600: "#7c3aed",
  sky400: "#38bdf8",
  emerald400: "#34d399",

  lime300: "#bef264",
  lime600: "#65a30d",
  lime950: "#1a2e05",
  limeBorder: "rgba(132, 204, 22, 0.5)",
  // Matches web's CheckRow: bg-lime-900/30 (pass state)
  limeCheckBg: "rgba(54, 83, 20, 0.3)",

  yellow400: "#facc15",
  yellow600: "#ca8a04",
  yellow950: "#422006",
  yellowBorder: "rgba(234, 179, 8, 0.5)",
  // Matches web's TextResultCard: bg-yellow-950/40 (spam/suspicious badge)
  yellowCheckBg: "rgba(133, 77, 14, 0.3)",

  rose300: "#fda4af",
  rose400: "#fb7185",
  rose600: "#e11d48",
  rose950: "#4c0519",
  roseBorder: "rgba(244, 63, 94, 0.5)",
  // Matches web's CheckRow: bg-rose-900/30 (fail state)
  roseCheckBg: "rgba(136, 19, 55, 0.3)",
} as const;

/** Turns a "#rrggbb" token into an "rgba(r, g, b, alpha)" string. */
export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
