"use client";

import { useEffect, useState } from "react";

const words = [
  { text: "real?", colorClass: "text-amber-400" },
  { text: "safe?", colorClass: "text-sky-400" },
  { text: "legit?", colorClass: "text-violet-400" },
  { text: "genuine?", colorClass: "text-teal-400" },
  { text: "authentic?", colorClass: "text-emerald-400" },
];

const DISPLAY_MS = 2200;
const FADE_MS = 350;

export default function HeroAnimatedWord() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % words.length);
        setVisible(true);
      }, FADE_MS);
    }, DISPLAY_MS + FADE_MS);

    return () => clearInterval(interval);
  }, []);

  const { text, colorClass } = words[index];

  return (
    <span
      className={`transition-opacity ${colorClass}`}
      style={{
        opacity: visible ? 1 : 0,
        transitionDuration: `${FADE_MS}ms`,
      }}
    >
      {text}
    </span>
  );
}
