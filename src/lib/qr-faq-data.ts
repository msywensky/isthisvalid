export interface QrFaqEntry {
  question: string;
  answer: string;
}

export const QR_FAQ_DATA: QrFaqEntry[] = [
  {
    question: "Is my image or camera feed sent to your servers?",
    answer:
      "No. The QR code is decoded entirely in your browser — whether you upload an image or use your camera, the pixel data never leaves your device. Only if the decoded content turns out to be a URL do we check that link against our URL safety checker.",
  },
  {
    question: "What is quishing?",
    answer:
      "Quishing (QR phishing) is when scammers replace or overlay a legitimate QR code — on a parking meter, restaurant table, poster, or invoice — with one that leads to a phishing site or malware download. Because you can't read a QR code with your eyes, it's easy to scan one without knowing where it actually leads.",
  },
  {
    question: "Can a QR code itself contain a virus?",
    answer:
      "A QR code is just encoded text — it can't execute code on its own. The danger is what that text tells your phone to do next: open a malicious link, connect to an untrusted Wi-Fi network, or dial a premium-rate number. That's exactly what this tool lets you inspect before you act on it.",
  },
  {
    question:
      "You scanned a Wi-Fi or phone number QR — why didn't you check it?",
    answer:
      "For URLs, we run a full safety check automatically. For other content types — Wi-Fi credentials, phone numbers, email addresses, plain text — we decode and display them so you can decide, with links to our phone and email checkers if you want a deeper look. We never auto-connect to a network or auto-dial a number.",
  },
  {
    question: "Does the camera scanner work on desktop?",
    answer:
      "Yes, if your device has a camera and you grant permission. Live scanning requires a secure connection (HTTPS or localhost) — this site is served over HTTPS, so it works out of the box. If your camera is blocked or unavailable, you can always upload a photo of the QR code instead.",
  },
  {
    question: "Is this free? What's the catch?",
    answer:
      "Completely free, no account required, no images stored. If you find it useful, the Ko-fi link at the bottom of the result is appreciated but never required.",
  },
];
