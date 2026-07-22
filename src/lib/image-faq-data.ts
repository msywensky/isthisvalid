export interface ImageFaqEntry {
  question: string;
  answer: string;
}

export const IMAGE_FAQ_DATA: ImageFaqEntry[] = [
  {
    question: "What does 'deepfake' mean?",
    answer:
      "A deepfake is an AI-manipulated image or video where a person's face, body, or surroundings have been digitally altered using machine learning. Modern deepfakes can be extremely convincing — imperceptible to the naked eye — which is why automated pixel-level analysis is needed to detect them.",
  },
  {
    question: "How accurate is AI image detection?",
    answer:
      "Our tool analyses pixel-level patterns, compression artifacts, and statistical anomalies associated with AI generation. While effective against current tools, no detector is perfect — highly sophisticated images or heavily post-processed photos may occasionally be missed. Use the confidence score as your guide: a low-confidence result should be treated as a rough indicator, not a conclusion.",
  },
  {
    question: "Do you store my image?",
    answer:
      "No. Your image is never stored on our servers. We read the bytes in memory, compute a one-way SHA-256 fingerprint for caching the result, and discard the image data immediately. The hash cannot be reversed — the original image cannot be recovered from it.",
  },
  {
    question: "What file types are supported?",
    answer:
      "We accept JPEG, PNG, WebP, and GIF files up to 4 MB. If your image is larger, try resizing or compressing it first — detection accuracy is not significantly affected by moderate compression.",
  },
  {
    question: "Why was my image flagged as AI-generated?",
    answer:
      "Common triggers include overly smooth skin texture, unusual lighting consistency, subtle facial asymmetry from blending, or statistical patterns in the pixel data that differ from camera-captured images. If you believe the result is incorrect, you can try re-uploading a higher-quality version of the image or checking the confidence score — a low confidence value means the result is far from certain.",
  },
  {
    question: "What if I disagree with the result?",
    answer:
      "AI detection is probabilistic — the result reflects the likelihood that an image was AI-generated, not a definitive verdict. The confidence score tells you how certain the system is. A low confidence score means the result should be treated as a rough guide. We recommend using it alongside other context: where the image came from, whether it was shared on a suspicious site, and whether metadata (EXIF data) looks plausible.",
  },
  {
    question: "Is this free? What's the catch?",
    answer:
      "Completely free, no account required. Running detection calls costs us money, so if you find this useful, the Ko-fi link at the bottom of the result goes a long way. No ads, no signup, no catch.",
  },
];
