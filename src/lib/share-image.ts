/**
 * BROWSER ONLY — uses canvas, createImageBitmap and navigator. Not a shim and
 * not in packages/core, since it can't run in Node or React Native.
 *
 * Builds the image that the image tool's "Share result" button shares: a
 * re-encoded copy of the checked image with the verdict strip drawn *below* it.
 * The canvas re-encode is also what strips EXIF (GPS location, device, time) —
 * never share the user's original File.
 */
import type { Sentiment } from "@/lib/result-verdict";
import type { ImageStrip } from "@/lib/share-text";

/** Same hex values as the cards' lime-500 / yellow-500 / rose-400. */
export const SENTIMENT_HEX: Record<Sentiment, string> = {
  safe: "#84cc16",
  warn: "#eab308",
  danger: "#fb7185",
};

const MAX_EDGE = 1600;
const ACCENT_BAR = 10;
const FONT_FAMILY = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

/** True only where navigator.share can carry a file (most mobile browsers). */
export function canShareFiles(): boolean {
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  try {
    return navigator.canShare({
      files: [new File([], "x.jpg", { type: "image/jpeg" })],
    });
  } catch {
    return false;
  }
}

/** Largest font size ≤ `size` at which `text` fits in `maxWidth`. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  size: number,
  weight: string,
  maxWidth: number,
): void {
  let s = size;
  ctx.font = `${weight} ${s}px ${FONT_FAMILY}`;
  while (s > 10 && ctx.measureText(text).width > maxWidth) {
    s -= 1;
    ctx.font = `${weight} ${s}px ${FONT_FAMILY}`;
  }
}

export async function composeShareImage(
  source: Blob,
  strip: ImageStrip,
): Promise<File> {
  // "from-image" applies EXIF orientation, so phone photos aren't sideways.
  // Animated GIFs decode to their first frame.
  const bmp = await createImageBitmap(source, {
    imageOrientation: "from-image",
  });
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    const width = Math.round(bmp.width * scale);
    const imageHeight = Math.round(bmp.height * scale);
    const stripHeight = Math.round(Math.max(120, width * 0.14));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = imageHeight + stripHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");

    ctx.drawImage(bmp, 0, 0, width, imageHeight);

    // Strip below the image — never over it, so nothing in the photo is hidden.
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, imageHeight, width, stripHeight);
    ctx.fillStyle = SENTIMENT_HEX[strip.sentiment];
    ctx.fillRect(0, imageHeight, ACCENT_BAR, stripHeight);

    const padX = ACCENT_BAR + Math.round(stripHeight * 0.2);
    const maxTextWidth = width - padX - Math.round(stripHeight * 0.2);
    ctx.textBaseline = "middle";

    fitFont(
      ctx,
      strip.headline,
      Math.round(stripHeight * 0.24),
      "700",
      maxTextWidth,
    );
    ctx.fillStyle = "#ffffff";
    ctx.fillText(strip.headline, padX, imageHeight + stripHeight * 0.38);

    fitFont(
      ctx,
      strip.detail,
      Math.round(stripHeight * 0.15),
      "400",
      maxTextWidth,
    );
    ctx.fillStyle = "#a1a1aa";
    ctx.fillText(strip.detail, padX, imageHeight + stripHeight * 0.68);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    if (!blob) throw new Error("Canvas encode failed");
    return new File([blob], "isthisvalid-result.jpg", { type: "image/jpeg" });
  } finally {
    bmp.close();
  }
}
