import { FAQ_DATA } from "@/lib/faq-data";

/**
 * FAQ section for the homepage.
 *
 * Uses native <details>/<summary> for zero-JS accordion behaviour.
 * Google fully indexes content inside <details> — great for SEO.
 * Structured data (FAQPage JSON-LD) is injected in layout.tsx for rich snippets.
 */

export default function FAQ() {
  return (
    <section
      className="w-full max-w-xl mx-auto space-y-3"
      aria-label="Frequently asked questions"
    >
      <h2 className="text-zinc-300 font-semibold text-base">
        Why this tool?{" "}
        <span className="text-zinc-500 font-normal text-sm">/ FAQ</span>
      </h2>

      <div className="space-y-2">
        {FAQ_DATA.map(({ q, a }) => (
          <details
            key={q}
            className="
              group rounded-xl border border-zinc-800 bg-zinc-900/50
              open:border-orange-500/30 open:bg-zinc-900
              transition-colors duration-150
            "
          >
            <summary
              className="
                flex items-center justify-between gap-4
                cursor-pointer list-none px-4 py-3
                text-sm text-zinc-300 font-medium
                hover:text-white transition-colors duration-100
                [&::-webkit-details-marker]:hidden
              "
            >
              <span>{q}</span>
              {/* Chevron — rotates when open */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 text-zinc-500 group-open:rotate-180 transition-transform duration-200"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>

            <p className="px-4 pb-4 pt-1 text-sm text-zinc-400 leading-relaxed">
              {a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
