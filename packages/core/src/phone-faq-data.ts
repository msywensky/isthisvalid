export interface PhoneFaqEntry {
  question: string;
  answer: string;
}

export const PHONE_FAQ_DATA: PhoneFaqEntry[] = [
  {
    question: "What formats does the checker accept?",
    answer:
      "You can enter numbers in E.164 format (+14155552671), international format (+1 415 555 2671), or national format (415-555-2671). US numbers can be entered without the +1 country code. For non-US numbers, always include the country code (e.g. +44 for the UK).",
  },
  {
    question: "What does 'VoIP' mean and why is it suspicious?",
    answer:
      "VoIP (Voice over Internet Protocol) numbers are provisioned online rather than through a traditional phone network. Services like Google Voice, Twilio, and Skype allow anyone to get a number with any area code without being physically located there. Scammers use VoIP numbers to spoof local numbers, hide their real location, and quickly discard and replace numbers when flagged. A VoIP result doesn't mean the caller is a scammer — legitimate businesses use VoIP too — but it does mean the caller's location cannot be confirmed.",
  },
  {
    question: "What is a premium-rate number?",
    answer:
      "Premium-rate numbers charge above-standard rates billed to the caller. In the US there are three main types to watch out for: 900 numbers (the most recognised — 1-900-XXX-XXXX); 976 exchange numbers (local 7-digit premium lines historically used for adult content, horoscopes, and chat lines, billed through your local carrier); and Caribbean NANP area codes such as 809, 876, 473, 664, 649, 767, 784, 868, and 869. That last group is the sneakiest — they use the +1 country code so they look like ordinary US calls, but they connect internationally and can cost several dollars per minute. In the UK, 09 numbers are the equivalent. All of these are commonly used in 'one-ring' scams where the scammer calls, hangs up immediately, and hopes you call back.",
  },
  {
    question:
      "Why does the checker show the area code region instead of my city?",
    answer:
      "Without a carrier API lookup, location is estimated from the area code's assigned region — not the subscriber's actual location. This is particularly unreliable for mobile numbers, which can be used anywhere in the country regardless of their original area code. When carrier enrichment is active (shown in the source badge), the location shown is the one reported by the carrier API and is more accurate.",
  },
  {
    question: "Can I check numbers from any country?",
    answer:
      "Yes. The checker uses Google's libphonenumber library, which covers numbering plans for every country using the ITU-T standard. Include the country code (e.g. +44 for the UK, +61 for Australia) for non-US numbers. US and Canadian numbers can be entered without a country code.",
  },
  {
    question:
      "Why does the result show 'Mobile or Landline' instead of a specific type?",
    answer:
      "Some number ranges are assigned to both mobile and landline lines, so it's impossible to tell the type from the number alone — this is common in the US and Canada. When a carrier lookup is available (shown in the source badge at the bottom of the result), the checker resolves this to the actual line type using live carrier data.",
  },
  {
    question: "Is the carrier information always accurate?",
    answer:
      "Carrier data reflects the number's registered network, which may not match the subscriber's current network if the number has been ported (transferred to a different carrier). The free tier of the carrier APIs used does not provide porting information, so the carrier shown is always the original registered carrier. The 'Line active' check reflects whether the number is currently reachable, not whether it belongs to a legitimate owner.",
  },
  {
    question: "Is this free? What's the catch?",
    answer:
      "Completely free — no account, no per-lookup limit on your end. Carrier API calls cost us money, so if this saved you from a one-ring callback scam, consider hitting the ☕ at the bottom of the results. No paywalls, no nonsense.",
  },
  {
    question: "Can this tell me if a number is a scammer?",
    answer:
      "Not definitively — there is no universal live scam database. However, certain number types (VoIP, premium-rate) are significantly overrepresented in scam traffic, and the checker flags these clearly. For a definitive scam check, cross-reference the number on community-reporting sites like 800notes.com or WhoCalledMe.",
  },
];
