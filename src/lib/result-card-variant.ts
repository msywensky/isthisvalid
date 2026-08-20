/**
 * How a result card is being displayed.
 *
 * - "standalone" (default) — the card is the page's single result. It renders
 *   its own Ko-fi bar and, where applicable, its own affiliate nudge. Every
 *   single-tool /check/* page uses this, so behaviour there is unchanged.
 * - "primary" — the headline card of a composite view (/check/any). Keeps its
 *   affiliate nudge, drops the Ko-fi bar so the composite can render one shared
 *   bar at the bottom.
 * - "nested" — a supporting card stacked below the primary one. Drops both, so
 *   a message with three links doesn't produce four Ko-fi bars and four nudges.
 *
 * Outer spacing is the container's job in both composite variants.
 */
export type ResultCardVariant = "standalone" | "primary" | "nested";

/** Only a standalone card renders its own Ko-fi bar. */
export function showsKofi(variant: ResultCardVariant): boolean {
  return variant === "standalone";
}

/** Supporting cards in a composite view suppress affiliate nudges. */
export function showsAffiliate(variant: ResultCardVariant): boolean {
  return variant !== "nested";
}
