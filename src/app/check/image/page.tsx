import CheckShell from "@/components/CheckShell";

export default function ImageCheckPage() {
  return (
    <CheckShell
      icon="🖼️"
      label="Image Checker"
      badge="Soon"
      headline={
        <>
          Real or <span className="text-emerald-400">faked</span>?
        </>
      }
      sub="AI vision to detect deepfakes, manipulated screenshots, and out-of-context photos."
    >
      <section className="w-full max-w-xl" aria-label="Coming soon">
        <div className="rounded-2xl border border-emerald-800/40 bg-emerald-950/20 px-8 py-10 flex flex-col items-center text-center gap-5">
          <span className="text-5xl" aria-hidden="true">
            🚧
          </span>
          <div className="space-y-2">
            <h2 className="text-white font-semibold text-xl">
              Image analysis is coming soon
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-sm">
              We&apos;re building an AI vision pipeline to detect deepfakes,
              manipulated screenshots, fake receipts, and out-of-context photos.
            </p>
          </div>
          <ul className="text-left text-sm text-zinc-500 space-y-2 w-full max-w-xs">
            {[
              ["🤖", "Deepfake & AI-generated face detection"],
              ["✂️", "Cloning, splicing & object removal"],
              ["📸", "Edited DMs, bank statements & receipts"],
              ["🌍", "Real photos used in false context"],
              ["📋", "EXIF metadata anomalies"],
            ].map(([icon, label]) => (
              <li key={label} className="flex items-center gap-2">
                <span aria-hidden="true">{icon}</span>
                <span>{label}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-zinc-600">
            In the meantime, try our{" "}
            <a
              href="/check/url"
              className="text-sky-400 hover:text-sky-300 underline underline-offset-2"
            >
              URL checker
            </a>{" "}
            or{" "}
            <a
              href="/check/email"
              className="text-orange-400 hover:text-orange-300 underline underline-offset-2"
            >
              email validator
            </a>
            .
          </p>
        </div>
      </section>
    </CheckShell>
  );
}
