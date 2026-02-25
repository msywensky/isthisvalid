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
 *
 * For affiliate links, replace the CTA section below with your referral links.
 * Good fits for isthisvalid.com:
 *  - NordVPN / ExpressVPN (privacy angle)
 *  - 1Password / Bitwarden (password managers)
 *  - ProtonMail (privacy email)
 *  - Namecheap / Porkbun (domain registrar)
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
  // If AdSense not configured, show a branded affiliate placeholder instead
  if (!ADSENSE_ID) {
    return <AffiliatePlaceholder slot={slot} className={className} />;
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

function AffiliatePlaceholder({
  slot,
  className,
}: {
  slot: string;
  className: string;
}) {
  if (slot === "top") return null; // Don't render a placeholder above the fold

  // Affiliate CTA — swap these URLs for your actual referral links
  const affiliates = [
    {
      name: "ProtonMail",
      tagline: "Private email worth validating.",
      url: "https://proton.me/?ref=YOUR_REF",
      cta: "Try free →",
      color: "text-orange-400",
    },
    {
      name: "1Password",
      tagline: "Stop reusing passwords.",
      url: "https://1password.com/?ref=YOUR_REF",
      cta: "Start trial →",
      color: "text-blue-400",
    },
  ];

  return (
    <aside
      className={`w-full max-w-xl mx-auto rounded-xl border border-zinc-800 bg-zinc-900/60 px-5 py-4 ${className}`}
      aria-label="Sponsored recommendations"
    >
      <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3 font-medium">
        Sponsored
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        {affiliates.map((a) => (
          <a
            key={a.name}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="flex-1 flex flex-col gap-1 group"
          >
            <span
              className={`font-semibold text-sm group-hover:underline ${a.color}`}
            >
              {a.name}
            </span>
            <span className="text-xs text-zinc-400">{a.tagline}</span>
            <span className={`text-xs font-medium mt-1 ${a.color}`}>
              {a.cta}
            </span>
          </a>
        ))}
      </div>
    </aside>
  );
}
