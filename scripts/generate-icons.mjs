/**
 * Generates the PWA / home-screen icons in /public/icons.
 * Run with: npm run generate-icons
 *
 * Uses the same SVG → sharp → PNG pipeline as scripts/generate-og.mjs.
 * The artwork is the split diamond from src/components/SiteLogo.tsx (the 46×46
 * "md" variant), scaled into each canvas. Colours are re-declared here the same
 * way generate-og.mjs re-declares them — these scripts do not import from src/.
 *
 * If the logo in SiteLogo.tsx changes, update DIAMOND below and re-run.
 */

import sharp from "sharp";
import { mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../public/icons");

// Brand colours (matches Tailwind zinc/orange palette)
const C = {
  bg: "#09090b", // zinc-950 — matches manifest background_color/theme_color
  stroke: "#52525b", // zinc-600
  leftHalf: "#27272a", // zinc-800
  orange: "#f97316", // orange-500
  seam: "#09090b", // zinc-950
  white: "#ffffff",
};

/** The split diamond, in its native 46×46 coordinate space. */
const DIAMOND = `
  <path d="M23 7 L7 23 L23 39 L39 23 Z" stroke="${C.stroke}" stroke-width="1" stroke-linejoin="round" fill="none" />
  <path d="M23 7 L7 23 L23 39 Z" fill="${C.leftHalf}" />
  <path d="M23 7 L39 23 L23 39 Z" fill="${C.orange}" />
  <line x1="23" y1="7" x2="23" y2="39" stroke="${C.seam}" stroke-width="1.25" />
  <path d="M13 23 L16.5 26.5 L22 18.5" stroke="${C.orange}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  <path d="M26.5 19.5 L32 25.5 M26.5 25.5 L32 19.5" stroke="${C.white}" stroke-width="1.75" stroke-linecap="round" fill="none" />
`;

const VIEWBOX = 46;
/** The visible diamond spans x/y 7→39 inside that 46-unit box. */
const ARTWORK_SPAN = 32;

/**
 * Builds one icon.
 *
 * @param size      canvas size in px
 * @param coverage  fraction of the canvas the diamond itself should span.
 *                  Maskable icons must survive an aggressive circular crop, so
 *                  they use a smaller value to stay inside the safe zone.
 */
function buildSvg(size, coverage) {
  const scale = (coverage * size) / ARTWORK_SPAN;
  const offset = (size - VIEWBOX * scale) / 2;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${C.bg}" />
  <g transform="translate(${offset.toFixed(3)} ${offset.toFixed(3)}) scale(${scale.toFixed(6)})">
    ${DIAMOND}
  </g>
</svg>`;
}

const ICONS = [
  { file: "icon-192.png", size: 192, coverage: 0.72 },
  { file: "icon-512.png", size: 512, coverage: 0.72 },
  // Maskable: Android may crop to a circle. 0.6 keeps the diamond inside the
  // safe zone while the zinc-950 background bleeds to the edges.
  { file: "icon-maskable-512.png", size: 512, coverage: 0.6 },
  // iOS applies its own rounded-rect mask and does not use maskable icons.
  { file: "apple-touch-icon.png", size: 180, coverage: 0.68 },
];

mkdirSync(OUT_DIR, { recursive: true });

await Promise.all(
  ICONS.map(async ({ file, size, coverage }) => {
    const out = resolve(OUT_DIR, file);
    await sharp(Buffer.from(buildSvg(size, coverage)))
      .png({ compressionLevel: 9 })
      .toFile(out);
    console.log(`✅ ${file} (${size}×${size})`);
  }),
).catch((err) => {
  console.error("❌ Failed to generate icons:", err.message);
  process.exit(1);
});

console.log(`\nIcons written to: ${OUT_DIR}`);
