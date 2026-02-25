export interface TextFaqEntry {
  question: string;
  answer: string;
}

export const TEXT_FAQ_DATA: TextFaqEntry[] = [
  {
    question: "How does the AI analysis work?",
    answer:
      "We send your message to Claude (Anthropic's AI model), which analyses the text for patterns associated with scams, phishing, and fraud — things like urgency language, impersonation, suspicious links, and advance-fee tactics. Claude returns a classification, risk score, and a list of specific red flags. No human reads your message; the analysis is fully automated.",
  },
  {
    question: "What types of messages can I check?",
    answer:
      "You can check SMS texts, email body text, WhatsApp or Messenger messages, or any written communication you suspect might be a scam. Paste the full message content — the more context you provide, the more accurate the analysis.",
  },
  {
    question: "Is my message stored or shared?",
    answer:
      "No. Your message is sent to the AI model for analysis and the result is returned to you. We do not log, store, or share the content of what you submit. See our privacy policy for full details.",
  },
  {
    question: "How accurate is it?",
    answer:
      "The tool is highly effective at detecting common scam patterns — urgency language, authority impersonation, suspicious links, and advance-fee fraud. However, no AI is perfect: sophisticated or novel scams may occasionally be missed, and legitimate messages that use urgent language may occasionally trigger a warning. Always use your own judgement alongside the result.",
  },
  {
    question: "What should I do if a message is flagged as a scam?",
    answer:
      "Do not click any links, call any numbers, or reply to the message. Block the sender and report it — in the UK forward texts to 7726, in the US contact the FTC at reportfraud.ftc.gov. If you've already responded or clicked a link, contact your bank immediately and change any passwords you may have entered.",
  },
  {
    question: "Can the AI miss a scam or give a false positive?",
    answer:
      "Yes — no detection tool is 100% accurate. A scam may be missed if it uses unusually sophisticated language or lacks classic red-flag patterns. A legitimate message may be flagged if it contains urgency language common in scams. Use the risk score and confidence level as your guide, and treat low-confidence results with extra scrutiny.",
  },
  {
    question: "What is smishing?",
    answer:
      "Smishing (SMS + phishing) is a scam delivered via text message. Common examples include fake parcel delivery notifications, fake bank fraud alerts, fake prize wins, and HMRC or IRS impersonation. They typically contain a link to a fraudulent website designed to steal your credentials or payment details.",
  },
  {
    question: "What are the most common signs of a scam message?",
    answer:
      "Key red flags include: unexpected urgency ('act within 24 hours'), requests for personal information or payment, suspicious links (shortened URLs or misspelled domains), impersonation of a trusted authority (your bank, HMRC, Amazon, Royal Mail), requests for gift cards or cryptocurrency, and poor grammar or strange formatting.",
  },
];
