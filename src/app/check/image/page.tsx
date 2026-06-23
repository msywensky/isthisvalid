"use client";

import {
  useState,
  useRef,
  useEffect,
  type ChangeEvent,
  type DragEvent,
} from "react";
import CheckShell from "@/components/CheckShell";
import ImageResultCard from "@/components/ImageResultCard";
import ImageFAQ from "@/components/ImageFAQ";
import type { ImageDebunkResult } from "@/lib/image-debunker";
import { isAcceptedMimeType, MAX_IMAGE_BYTES } from "@/lib/image-debunker";

type Phase = "idle" | "preview" | "loading" | "result" | "error";

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/gif";
const MAX_MB = MAX_IMAGE_BYTES / (1024 * 1024);

const DETECTS = [
  ["🤖", "AI-Generated Images", "Photos created entirely by AI models"],
  ["😶‍🌫️", "Deepfakes", "Face-swaps and digital impersonation"],
  ["✂️", "Manipulated Content", "Splicing, cloning, and object removal"],
  ["📸", "Edited Documents", "Altered receipts, screenshots, and statements"],
] as const;

export default function ImageCheckPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<ImageDebunkResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Revoke blob URL on change or unmount — NOT on result transition
  useEffect(() => {
    const url = previewUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [previewUrl]);

  function selectFile(selected: File) {
    if (!isAcceptedMimeType(selected.type)) {
      setErrorMsg(
        "Unsupported file type. Please upload a JPEG, PNG, WebP, or GIF.",
      );
      setPhase("error");
      return;
    }
    if (selected.size > MAX_IMAGE_BYTES) {
      setErrorMsg(`File too large. Maximum size is ${MAX_MB} MB.`);
      setPhase("error");
      return;
    }
    // Setting a new previewUrl triggers the useEffect cleanup to revoke the old one
    setPreviewUrl(URL.createObjectURL(selected));
    setFile(selected);
    setErrorMsg("");
    setPhase("preview");
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) selectFile(selected);
    e.target.value = "";
  }

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

  async function handleSubmit() {
    if (!file || phase === "loading") return;
    setPhase("loading");
    setResult(null);

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/debunk/image", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Something went wrong. Please try again.");
        setPhase("error");
        return;
      }
      setResult(data as ImageDebunkResult);
      setPhase("result");
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
      setPhase("error");
    }
  }

  function handleReset() {
    // setPreviewUrl(null) triggers useEffect cleanup to revoke the old URL
    setPreviewUrl(null);
    setFile(null);
    setResult(null);
    setErrorMsg("");
    setPhase("idle");
  }

  return (
    <CheckShell
      icon="🖼️"
      label="Image Checker"
      headline={
        <>
          Real or <span className="text-emerald-400">faked</span>?
        </>
      }
      sub="Upload an image to detect deepfakes, AI generation, and digital manipulation. No signup required."
    >
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="sr-only"
        onChange={handleInputChange}
        aria-hidden="true"
        tabIndex={-1}
      />

      <section className="w-full max-w-xl space-y-6" aria-label="Image upload">
        {/* ── Drop zone (idle) ── */}
        {phase === "idle" && (
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload image — click or drag and drop"
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
              focus:outline-none focus:ring-2 focus:ring-emerald-400/60
              ${
                isDragging
                  ? "border-emerald-400 bg-emerald-950/30"
                  : "border-emerald-800/60 bg-zinc-900/40 hover:border-emerald-600/80 hover:bg-emerald-950/20"
              }
            `}
          >
            <span className="text-4xl" aria-hidden="true">
              🖼️
            </span>
            <div className="text-center space-y-1">
              <p className="text-zinc-200 font-medium text-sm">
                Drop an image here, or{" "}
                <span className="text-emerald-400 underline underline-offset-2">
                  browse
                </span>
              </p>
              <p className="text-zinc-500 text-xs">
                JPEG, PNG, WebP, GIF · max {MAX_MB} MB
              </p>
            </div>
          </div>
        )}

        {/* ── Preview ── */}
        {phase === "preview" && file && previewUrl && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-800/40 bg-zinc-900/60 p-4 space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Selected image preview"
                className="w-full rounded-xl object-contain max-h-64 bg-zinc-950"
              />
              <div className="flex items-center justify-between">
                <div className="min-w-0 mr-3">
                  <p className="text-sm text-zinc-300 font-medium truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="cursor-pointer text-xs text-zinc-400 hover:text-zinc-200 underline underline-offset-2 transition-colors shrink-0"
                >
                  Replace
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              className="
                w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700
                px-6 py-3 font-semibold text-white text-sm
                flex items-center justify-center gap-2
                transition-colors duration-150
                focus:outline-none focus:ring-2 focus:ring-emerald-400/60
              "
            >
              Analyze image →
            </button>
          </div>
        )}

        {/* ── Loading ── */}
        {phase === "loading" && (
          <div className="flex items-center justify-center gap-3 py-12 text-zinc-400 text-sm">
            <Spinner />
            <span>Analyzing image…</span>
          </div>
        )}

        {/* ── Result / Error ── */}
        <div aria-live="polite" aria-atomic="true" className="contents">
          {phase === "result" && result && (
            <div className="space-y-4">
              <ImageResultCard result={result} />
              <button
                onClick={handleReset}
                className="cursor-pointer text-sm text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors"
              >
                ← Check another image
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
              <button
                onClick={handleReset}
                className="cursor-pointer text-sm text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors"
              >
                ← Try again
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── What AI detects (shown when idle) ── */}
      {phase === "idle" && (
        <section
          className="w-full max-w-xl space-y-4 text-sm text-zinc-400"
          aria-label="What AI detects"
        >
          <h2 className="text-zinc-300 font-semibold text-base">
            What AI will detect
          </h2>
          <ul className="space-y-2">
            {DETECTS.map(([icon, name, detail]) => (
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

      <ImageFAQ />
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
