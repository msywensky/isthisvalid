"use client";

import Link from "next/link";
import {
  QR_CONTENT_LABELS,
  QR_WIFI_WARNING,
  type NonUrlQrContent,
} from "@/lib/qr-content";
import KofiDonation from "@/components/KofiDonation";

interface Props {
  content: NonUrlQrContent;
}

const KIND_EMOJI: Record<NonUrlQrContent["kind"], string> = {
  tel: "📞",
  email: "📧",
  wifi: "📶",
  text: "📄",
};

export default function QrContentCard({ content }: Props) {
  return (
    <div className="w-full max-w-xl rounded-2xl border-2 border-cyan-500/50 bg-cyan-950/20 p-6 space-y-5">
      <div className="flex items-start gap-3 rounded-xl border border-cyan-800/50 bg-cyan-950/40 px-4 py-3">
        <span className="text-2xl mt-0.5 shrink-0" aria-hidden="true">
          {KIND_EMOJI[content.kind]}
        </span>
        <div className="min-w-0">
          <p className="font-bold text-lg leading-tight text-cyan-400">
            {QR_CONTENT_LABELS[content.kind]}
          </p>
          <p className="text-zinc-300 text-sm mt-0.5 leading-snug">
            This QR code does not link to a website — here&rsquo;s what it
            contains.
          </p>
        </div>
      </div>

      {content.kind === "tel" && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-400">
            This QR wants to dial a number:
          </p>
          <p className="rounded-lg bg-white/5 px-4 py-3 text-zinc-100 font-mono text-sm break-all">
            {content.phone}
          </p>
          <Link
            href="/check/phone"
            className="inline-flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
          >
            Check this number →
          </Link>
        </div>
      )}

      {content.kind === "email" && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-400">
            This QR wants to email an address:
          </p>
          <p className="rounded-lg bg-white/5 px-4 py-3 text-zinc-100 font-mono text-sm break-all">
            {content.email}
          </p>
          <Link
            href="/check/email"
            className="inline-flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
          >
            Validate this address →
          </Link>
        </div>
      )}

      {content.kind === "wifi" && (
        <div className="space-y-3">
          <div className="rounded-lg bg-white/5 px-4 py-3 space-y-1.5 text-sm">
            <p className="text-zinc-300">
              <span className="text-zinc-500">Network:</span>{" "}
              <span className="font-mono text-zinc-100">
                {content.ssid || "(unknown)"}
              </span>
            </p>
            <p className="text-zinc-300">
              <span className="text-zinc-500">Security:</span>{" "}
              <span className="font-mono text-zinc-100">
                {content.encryption}
              </span>
            </p>
            <p className="text-zinc-300">
              <span className="text-zinc-500">Hidden network:</span>{" "}
              <span className="font-mono text-zinc-100">
                {content.hidden ? "Yes" : "No"}
              </span>
            </p>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
            <span className="shrink-0 font-bold">⚠</span>
            <span>{QR_WIFI_WARNING}</span>
          </div>
        </div>
      )}

      {content.kind === "text" && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-400">
            This QR contains plain text, not a link:
          </p>
          <pre className="rounded-lg bg-white/5 px-4 py-3 text-zinc-100 text-sm whitespace-pre-wrap break-all font-mono">
            {content.text || "(empty)"}
          </pre>
        </div>
      )}

      <KofiDonation />
    </div>
  );
}
