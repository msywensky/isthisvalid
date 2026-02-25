/**
 * Canonical URL FAQ data — single source of truth used by:
 *  - src/components/UrlFAQ.tsx (UI rendering)
 *  - src/app/check/url/layout.tsx (FAQPage JSON-LD structured data for Google rich snippets)
 */
export const URL_FAQ_DATA: { q: string; a: string }[] = [
  {
    q: "Why not just see if the link looks weird?",
    a: "Because phishing URLs are designed to look normal. Attackers register domains like 'paypal-secure-login.com', use Punycode to swap letters for lookalikes, or hide destinations behind link shorteners. A quick eyeball check misses all of that — pattern matching doesn't.",
  },
  {
    q: "Is the URL I paste stored or logged?",
    a: "No. The URL is checked in memory, a result is returned, and it's discarded. We don't log requests, build a database of checked URLs, or share anything with third parties beyond what's needed for the Google Safe Browsing lookup.",
  },
  {
    q: "What is Google Safe Browsing?",
    a: "It's a free threat-intelligence service from Google that maintains constantly updated lists of malware distribution sites, phishing pages, and unwanted-software hosts. When you check a URL here, we query that list on your behalf — the same database Chrome and Firefox use to block dangerous pages in real time.",
  },
  {
    q: "What does the score (0–100) mean?",
    a: "It's our confidence that the URL is safe to visit. 100 means every check passed cleanly. 0 means something is seriously wrong — like a Safe Browsing hit or an IP-address host with no domain. Anything in between reflects how many signals raised a concern.",
  },
  {
    q: "A legitimate URL scored low — why?",
    a: "A few common causes: the domain is brand-new and hasn't resolved yet, it uses a URL shortener (we can't see where it leads), it contains words that match phishing patterns in another context, or the HEAD request timed out on our end. The result card tells you exactly which checks tripped.",
  },
  {
    q: "What's a Punycode homograph attack?",
    a: "Attackers register domains using Unicode characters that look identical to Latin letters — for example, the Cyrillic 'а' instead of the Latin 'a'. Browsers display them as readable text, but the actual domain is completely different. We flag any domain containing 'xn--' encoding (the Punycode marker) as a warning sign.",
  },
  {
    q: "Does this follow redirects?",
    a: "No — deliberately. We check the URL you give us, not its final destination. Following redirect chains would make link shorteners look clean when they might redirect to malware. The shortener detection flag tells you we can't vouch for the destination at all.",
  },
  {
    q: "Is this free? What's the catch?",
    a: "Completely free. We keep the lights on with advertising. The URL checking logic will never be paywalled — that'd make it useless exactly when you need it most.",
  },
  {
    q: "Can this tool miss a dangerous URL?",
    a: "Yes — and we think you should know that upfront. No URL checker catches everything. Brand-new phishing domains (registered hours before a campaign) won't appear in any threat database yet. Sophisticated attackers use clean infrastructure specifically to avoid reputation filters. This tool is a strong first signal, not a guarantee of safety. If something feels off — an unexpected email, an unsolicited link, a 'too good to be true' offer — trust your instincts regardless of what any tool says.",
  },
];
