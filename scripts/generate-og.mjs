/**
 * Generates /public/og-image.png for isthisvalid.com
 * Run with: npm run generate-og
 *
 * Uses SVG → sharp → PNG pipeline. No browser required.
 * Output: 1200×630px (standard OG image size)
 */

import sharp from "sharp";
import { mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, "../public/og-image.png");

// Brand colours (matches Tailwind zinc/orange palette)
const C = {
  bg: "#09090b", // zinc-950
  card: "#18181b", // zinc-900
  cardBorder: "#27272a", // zinc-800
  white: "#ffffff",
  zinc400: "#a1a1aa",
  zinc500: "#71717a",
  orange: "#f97316", // orange-500
  green: "#4ade80", // green-400
  greenBg: "#052e16", // green-950
};

// Score ring geometry (cx=940, cy=295, r=88)
const CX = 940;
const CY = 295;
const R = 88;
const CIRC = 2 * Math.PI * R; // ≈ 552.92
const SCORE_PCT = 0.92; // 92/100
const DASH = CIRC * SCORE_PCT; // filled arc
const GAP = CIRC; // large enough gap so only one arc shows
// Start at 12 o'clock: dashoffset = circumference * 0.25
const OFFSET = CIRC * 0.25;

const svg = `<svg
  width="1200"
  height="630"
  viewBox="0 0 1200 630"
  xmlns="http://www.w3.org/2000/svg"
>
  <!-- Background -->
  <rect width="1200" height="630" fill="${C.bg}" />

  <!-- ─── Left: Branding ─── -->

  <!-- Orange accent bar above headline -->
  <rect x="80" y="168" width="52" height="5" rx="2.5" fill="${C.orange}" />

  <!-- Headline -->
  <text
    x="80" y="268"
    font-family="system-ui, -apple-system, Arial, sans-serif"
    font-size="78"
    font-weight="800"
    fill="${C.white}"
  >Is This Valid?</text>

  <!-- Subline -->
  <text
    x="80" y="328"
    font-family="system-ui, -apple-system, Arial, sans-serif"
    font-size="27"
    font-weight="400"
    fill="${C.zinc400}"
  >Free tools to verify emails, URLs, and more.</text>

  <!-- Divider line -->
  <rect x="80" y="440" width="560" height="1" fill="${C.cardBorder}" />

  <!-- Tool pills -->
  <text
    x="80" y="488"
    font-family="system-ui, -apple-system, Arial, sans-serif"
    font-size="20"
    fill="${C.zinc500}"
    letter-spacing="1"
  >Email  ·  URL  ·  Text  ·  Image</text>

  <!-- Domain -->
  <text
    x="80" y="556"
    font-family="system-ui, -apple-system, Arial, sans-serif"
    font-size="24"
    font-weight="600"
    fill="${C.orange}"
  >isthisvalid.com</text>

  <!-- ─── Right: Score card ─── -->

  <!-- Card background -->
  <rect
    x="755" y="110"
    width="370" height="410"
    rx="18"
    fill="${C.card}"
    stroke="${C.cardBorder}"
    stroke-width="1.5"
  />

  <!-- Score ring — track -->
  <circle
    cx="${CX}" cy="${CY}" r="${R}"
    fill="none"
    stroke="${C.cardBorder}"
    stroke-width="11"
  />

  <!-- Score ring — fill (orange arc, 92%) -->
  <circle
    cx="${CX}" cy="${CY}" r="${R}"
    fill="none"
    stroke="${C.orange}"
    stroke-width="11"
    stroke-linecap="round"
    stroke-dasharray="${DASH.toFixed(2)} ${GAP.toFixed(2)}"
    stroke-dashoffset="${OFFSET.toFixed(2)}"
  />

  <!-- Score number -->
  <text
    x="${CX}" y="${CY - 10}"
    font-family="system-ui, -apple-system, Arial, sans-serif"
    font-size="54"
    font-weight="800"
    fill="${C.white}"
    text-anchor="middle"
    dominant-baseline="middle"
  >92</text>

  <!-- /100 label -->
  <text
    x="${CX}" y="${CY + 44}"
    font-family="system-ui, -apple-system, Arial, sans-serif"
    font-size="15"
    fill="${C.zinc400}"
    text-anchor="middle"
  >/ 100</text>

  <!-- Safe badge -->
  <rect
    x="868" y="418"
    width="144" height="40"
    rx="20"
    fill="${C.greenBg}"
  />
  <text
    x="${CX}" y="444"
    font-family="system-ui, -apple-system, Arial, sans-serif"
    font-size="18"
    font-weight="600"
    fill="${C.green}"
    text-anchor="middle"
  >✓  Safe</text>

  <!-- URL check label -->
  <text
    x="${CX}" y="496"
    font-family="system-ui, -apple-system, Arial, sans-serif"
    font-size="14"
    fill="${C.zinc500}"
    text-anchor="middle"
  >URL Check</text>

</svg>`;

// Ensure /public exists
mkdirSync(resolve(__dirname, "../public"), { recursive: true });

sharp(Buffer.from(svg))
  .png({ compressionLevel: 9 })
  .toFile(OUT_PATH)
  .then(() => {
    console.log(`✅ OG image saved to: ${OUT_PATH}`);
    console.log(`   Size: 1200×630px`);
  })
  .catch((err) => {
    console.error("❌ Failed to generate OG image:", err.message);
    process.exit(1);
  });
