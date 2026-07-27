"use client";

import { useState, type DragEvent } from "react";
import CheckShell from "@/components/CheckShell";
import { UrlResultCard } from "@/components/UrlResultCard";
import QrContentCard from "@/components/QrContentCard";
import QrFAQ from "@/components/QrFAQ";
import { useQrScanner } from "@/hooks/useQrScanner";
import type { QrContent } from "@/lib/qr-content";

const HOW_IT_WORKS = [
  [
    "🔒",
    "Decoded on your device",
    "The image or camera frame never leaves your browser",
  ],
  [
    "🔗",
    "URLs get the full check",
    "Links are run through our URL safety checker automatically",
  ],
  [
    "🚫",
    "Nothing runs automatically",
    "Wi-Fi, phone, and email QR codes are shown, never auto-actioned",
  ],
] as const;

export default function QrCheckPage() {
  const {
    mode,
    phase,
    urlResult,
    content,
    errorMsg,
    inputRef,
    videoRef,
    canvasRef,
    startCamera,
    switchToUpload,
    handleReset,
    selectFile,
    handleInputChange,
  } = useQrScanner();

  const [isDragging, setIsDragging] = useState(false);

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) selectFile(dropped);
  }

  const isChoosing = mode === "choose" && phase === "idle";
  const nonUrlContent =
    content && content.kind !== "url"
      ? (content as Exclude<QrContent, { kind: "url" }>)
      : null;

  return (
    <CheckShell
      icon="🔳"
      label="QR Code"
      headline={
        <>
          Safe to <span className="text-cyan-400">scan</span>?
        </>
      }
      sub="Upload a QR code image or scan one live with your camera — see exactly where it leads before you trust it."
    >
      {/* Hidden file input, shared by the dropzone and the "Upload" choice button */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleInputChange}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Hidden canvas used by both the upload and camera decode paths */}
      <canvas ref={canvasRef} className="hidden" />

      <section
        className="w-full max-w-xl space-y-6"
        aria-label="QR code scanner"
      >
        {/* ── Choose input method ── */}
        {isChoosing && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => void startCamera()}
              className="
                flex flex-col items-center justify-center gap-2 rounded-2xl
                border-2 border-cyan-800/60 bg-zinc-900/40 px-6 py-8 cursor-pointer
                transition-colors duration-150 hover:border-cyan-600/80 hover:bg-cyan-950/20
                focus:outline-none focus:ring-2 focus:ring-cyan-400/60
              "
            >
              <span className="text-3xl" aria-hidden="true">
                📷
              </span>
              <span className="text-zinc-200 font-medium text-sm">
                Scan with camera
              </span>
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="
                flex flex-col items-center justify-center gap-2 rounded-2xl
                border-2 border-cyan-800/60 bg-zinc-900/40 px-6 py-8 cursor-pointer
                transition-colors duration-150 hover:border-cyan-600/80 hover:bg-cyan-950/20
                focus:outline-none focus:ring-2 focus:ring-cyan-400/60
              "
            >
              <span className="text-3xl" aria-hidden="true">
                🖼️
              </span>
              <span className="text-zinc-200 font-medium text-sm">
                Upload an image
              </span>
            </button>
          </div>
        )}

        {/* ── Camera preview ── */}
        {mode === "camera" && phase === "scanning" && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-cyan-800/40 bg-zinc-900/60 p-4 space-y-3">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full rounded-xl bg-zinc-950"
              />
              <p className="text-center text-xs text-zinc-500">
                Point your camera at a QR code — it&rsquo;ll be detected
                automatically.
              </p>
            </div>
            <button
              type="button"
              onClick={switchToUpload}
              className="cursor-pointer text-sm text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
            >
              Stop &amp; upload an image instead
            </button>
          </div>
        )}

        {/* ── Upload dropzone ── */}
        {mode === "upload" && phase === "idle" && (
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload QR code image — click or drag and drop"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              flex flex-col items-center justify-center gap-4 rounded-2xl
              border-2 border-dashed px-8 py-12 cursor-pointer
              transition-colors duration-150 select-none
              focus:outline-none focus:ring-2 focus:ring-cyan-400/60
              ${
                isDragging
                  ? "border-cyan-400 bg-cyan-950/30"
                  : "border-cyan-800/60 bg-zinc-900/40 hover:border-cyan-600/80 hover:bg-cyan-950/20"
              }
            `}
          >
            <span className="text-4xl" aria-hidden="true">
              🔳
            </span>
            <div className="text-center space-y-1">
              <p className="text-zinc-200 font-medium text-sm">
                Drop a QR code image here, or{" "}
                <span className="text-cyan-400 underline underline-offset-2">
                  browse
                </span>
              </p>
              <p className="text-zinc-500 text-xs">JPEG, PNG, WebP, GIF</p>
            </div>
          </div>
        )}

        {/* ── Decoding / checking ── */}
        {(phase === "decoding" || phase === "checking") && (
          <div className="flex items-center justify-center gap-3 py-12 text-zinc-400 text-sm">
            <Spinner />
            <span>
              {phase === "decoding" ? "Reading QR code…" : "Checking link…"}
            </span>
          </div>
        )}

        {/* ── Results / Error ── */}
        <div aria-live="polite" aria-atomic="true" className="contents">
          {phase === "result-url" && urlResult && (
            <div className="space-y-4">
              <UrlResultCard result={urlResult} />
              <button
                onClick={handleReset}
                className="cursor-pointer text-sm text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
              >
                ← Scan another code
              </button>
            </div>
          )}

          {phase === "result-other" && nonUrlContent && (
            <div className="space-y-4">
              <QrContentCard content={nonUrlContent} />
              <button
                onClick={handleReset}
                className="cursor-pointer text-sm text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
              >
                ← Scan another code
              </button>
            </div>
          )}

          {phase === "error" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-red-800/50 bg-red-950/20 px-6 py-5">
                <p className="text-red-400 font-semibold text-sm">
                  ⚠️ {errorMsg}
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={handleReset}
                  className="cursor-pointer text-sm text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
                >
                  ← Try again
                </button>
                <button
                  onClick={() => inputRef.current?.click()}
                  className="cursor-pointer text-sm text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
                >
                  Upload an image instead
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── How it works (shown while choosing) ── */}
      {isChoosing && (
        <section
          className="w-full max-w-xl space-y-4 text-sm text-zinc-400"
          aria-label="How it works"
        >
          <h2 className="text-zinc-300 font-semibold text-base">
            How it works
          </h2>
          <ul className="space-y-2">
            {HOW_IT_WORKS.map(([icon, name, detail]) => (
              <li key={name} className="flex items-start gap-3">
                <span aria-hidden="true">{icon}</span>
                <span>
                  <strong className="text-zinc-200">{name}</strong> — {detail}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <QrFAQ />
    </CheckShell>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
