"use client";

import { PHONE_FAQ_DATA } from "@/lib/phone-faq-data";

export default function PhoneFAQ() {
  return (
    <section
      className="w-full max-w-xl space-y-4"
      aria-labelledby="phone-faq-heading"
    >
      <h2
        id="phone-faq-heading"
        className="text-zinc-300 font-semibold text-base"
      >
        Frequently asked questions
      </h2>

      <div className="space-y-2">
        {PHONE_FAQ_DATA.map(({ question, answer }) => (
          <details
            key={question}
            className="group rounded-xl border border-zinc-800 bg-zinc-900/50 open:border-orange-500/30 transition-colors duration-150"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-zinc-200 marker:hidden list-none">
              <span>{question}</span>
              <span
                aria-hidden="true"
                className="flex-shrink-0 text-zinc-500 group-open:rotate-180 transition-transform duration-200"
              >
                ▾
              </span>
            </summary>
            <div className="px-5 pb-4 text-sm text-zinc-400 leading-relaxed">
              {answer}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
