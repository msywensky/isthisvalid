/**
 * AdSenseBanner — monetization placeholder.
 *
 * TO ACTIVATE ADSENSE:
 * 1. Add your publisher ID to .env.local:
 *      NEXT_PUBLIC_ADSENSE_ID=ca-pub-XXXXXXXXXXXXXXXXX
 * 2. Replace the placeholder div below with:
 *      <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXXX" crossOrigin="anonymous" />
 *      <ins className="adsbygoogle" style={{ display: 'block' }} data-ad-client="ca-pub-XXXXXXX" data-ad-slot="XXXXXXX" data-ad-format="auto" data-full-width-responsive="true" />
 * 3. <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
 */

interface Props {
  slot?: "top" | "mid" | "bottom";
  className?: string;
}

const ADSENSE_ID = process.env.NEXT_PUBLIC_ADSENSE_ID;

export default function AdSenseBanner({
  slot = "bottom",
  className = "",
}: Props) {
  // If AdSense not configured, don't render anything
  if (!ADSENSE_ID) {
    return null;
  }

  // ── When AdSense is configured ──────────────────────────────────────────
  // TODO: replace with actual AdSense <ins> tag per instructions above
  return (
    <div
      className={`w-full rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 flex items-center justify-center py-6 text-zinc-600 text-xs ${className}`}
      aria-label="Advertisement"
      data-ad-slot={slot}
    >
      [AdSense — {slot}]
    </div>
  );
}
