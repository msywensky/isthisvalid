/**
 * Canonical FAQ data — single source of truth used by:
 *  - src/components/FAQ.tsx (UI rendering)
 *  - src/app/layout.tsx (FAQPage JSON-LD structured data for Google rich snippets)
 */
export const FAQ_DATA: { q: string; a: string }[] = [
  {
    q: "Why not just use a regex?",
    a: "Because 'totally@valid.email' passes any regex and still bounces harder than a cheque written in crayon. We layer syntax, TLD verification, disposable-domain detection, and optional live mailbox checking on top — so you get an actual signal, not false confidence.",
  },
  {
    q: "Is my email stored or shared?",
    a: "Nope. The address you enter is processed in memory, a result is returned, and it's gone. We don't log it, store it, sell it, or add it to any list. There's no database in this stack.",
  },
  {
    q: "What's a disposable email address?",
    a: "A throwaway inbox you spin up in seconds — think Mailinator, Guerrilla Mail, or YOPmail. They're great for avoiding spam yourself, but terrible when someone uses one to sign up for your product and then ghosts you. We flag 3,500+ of these providers.",
  },
  {
    q: "What does the score (0–100) mean?",
    a: "It's our confidence that the address is genuinely deliverable. 100 = everything checks out, including live mailbox verification. 0 = please try again with a real one. Anything in between means we saw something worth a second look.",
  },
  {
    q: "A valid-looking email still failed — why?",
    a: "A few reasons: the domain might have a real TLD but no mail server, the mailbox might be full, or the mail server uses catch-all responses that make SMTP verification ambiguous. When in doubt, the result card will tell you exactly which check tripped.",
  },
  {
    q: "What's the difference between 'Valid' and 'Risky'?",
    a: "'Valid' means we're confident and everything passed. 'Risky' means the syntax is fine and the domain looks real, but something smells off — like a role address (admin@, noreply@) that might not have a human on the other end.",
  },
  {
    q: "Is this free? What's the catch?",
    a: "Completely free to use. We keep the lights on with advertising and the occasional affiliate link. The validation logic itself will never be paywalled — that'd defeat the whole point.",
  },
  {
    q: "Can I use this via an API?",
    a: "Not yet officially, but the POST /api/validate endpoint is open. Bulk checking and an API key system are on the roadmap. For now, go wild responsibly.",
  },
  {
    q: "Can this tool get it wrong?",
    a: "Yes — and we'd rather tell you than pretend otherwise. Catch-all mail servers accept any address regardless of whether a real inbox exists, making SMTP verification ambiguous. Newly created domains may lack MX records for a few hours. And some legitimate addresses look suspicious by our heuristics. The score and result card tell you exactly which checks tripped, so you can make an informed call rather than blindly trusting a pass or fail.",
  },
];
