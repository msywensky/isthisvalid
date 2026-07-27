"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type ChangeEvent,
} from "react";
import { classifyQrContent, type QrContent } from "@/lib/qr-content";
import type { UrlValidationResult } from "@/lib/url-validator";

export type QrMode = "choose" | "camera" | "upload";
export type QrPhase =
  | "idle"
  | "scanning"
  | "decoding"
  | "checking"
  | "result-url"
  | "result-other"
  | "error";

type JsQRModule = typeof import("jsqr");
type JsQRFn = JsQRModule["default"];

const FRAME_INTERVAL_MS = 80; // throttle decode work to ~12.5 fps

/**
 * Owns the QR decode pipeline — camera capture, image upload, jsQR decoding,
 * content classification, and routing URL content through /api/validate-url.
 * Returns state plus the DOM refs the caller must attach to its
 * <input>/<video>/<canvas> elements; the caller only handles rendering.
 */
export function useQrScanner() {
  const [mode, setMode] = useState<QrMode>("choose");
  const [phase, setPhase] = useState<QrPhase>("idle");
  const [urlResult, setUrlResult] = useState<UrlValidationResult | null>(null);
  const [content, setContent] = useState<QrContent | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const lastFrameRef = useRef(0);
  const jsQRRef = useRef<JsQRFn | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Camera light must never stay on after the user leaves the page.
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  function handleError(msg: string) {
    setErrorMsg(msg);
    setPhase("error");
  }

  function decodeImageData(
    imageData: ImageData,
    opts: { inversionAttempts: "attemptBoth" | "dontInvert" },
  ): string | null {
    const code = jsQRRef.current?.(
      imageData.data,
      imageData.width,
      imageData.height,
      opts,
    );
    return code?.data ?? null;
  }

  function syncCanvasSize(
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
  ) {
    canvas.width = width;
    canvas.height = height;
  }

  function ensureCtx(canvas: HTMLCanvasElement) {
    ctxRef.current ??= canvas.getContext("2d", { willReadFrequently: true });
    return ctxRef.current;
  }

  async function handleDecoded(raw: string) {
    const parsed = classifyQrContent(raw);
    if (parsed.kind === "url") {
      setPhase("checking");
      try {
        const res = await fetch("/api/validate-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: parsed.url }),
        });
        const data = await res.json();
        if (!res.ok) {
          return handleError(data.error ?? "Couldn't check that link.");
        }
        setUrlResult(data as UrlValidationResult);
        setPhase("result-url");
      } catch {
        return handleError("Network error. Please try again.");
      }
    } else {
      setContent(parsed);
      setPhase("result-other");
    }
  }

  async function decodeFromFile(file: File) {
    setPhase("decoding");
    setErrorMsg("");
    if (!jsQRRef.current) {
      jsQRRef.current = (await import("jsqr")).default;
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = canvasRef.current;
      if (!canvas)
        return handleError("Couldn't read the image. Please try again.");
      const ctx = ensureCtx(canvas);
      if (!ctx)
        return handleError("Couldn't read the image. Please try again.");
      syncCanvasSize(canvas, img.naturalWidth, img.naturalHeight);
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const raw = decodeImageData(data, { inversionAttempts: "attemptBoth" });
      if (!raw) {
        return handleError(
          "No QR code found in that image — try a clearer, closer photo.",
        );
      }
      await handleDecoded(raw);
    } catch {
      return handleError(
        "Couldn't read that image. Please try a different file.",
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function selectFile(file: File) {
    setMode("upload");
    void decodeFromFile(file);
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) selectFile(selected);
    e.target.value = "";
  }

  function tick(timestamp: number) {
    rafRef.current = requestAnimationFrame(tick);

    if (timestamp - lastFrameRef.current < FRAME_INTERVAL_MS) return;
    lastFrameRef.current = timestamp;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      return;
    }
    const ctx = ensureCtx(canvas);
    if (!ctx) return;
    syncCanvasSize(canvas, video.videoWidth, video.videoHeight);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const raw = decodeImageData(data, { inversionAttempts: "dontInvert" });
    if (raw) {
      stopCamera();
      void handleDecoded(raw);
      return;
    }
  }

  function cameraErrorMessage(err: unknown): string {
    const name = err instanceof DOMException ? err.name : "";
    if (name === "NotAllowedError") {
      return "Camera permission was blocked — you can still upload an image instead.";
    }
    if (name === "NotFoundError") {
      return "No camera found — try uploading an image instead.";
    }
    return "Couldn't access the camera — try uploading an image instead.";
  }

  async function startCamera() {
    setMode("camera");
    setPhase("scanning");
    setErrorMsg("");
    try {
      if (!jsQRRef.current) {
        jsQRRef.current = (await import("jsqr")).default;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return handleError("Couldn't start the camera preview.");
      video.srcObject = stream;
      await video.play();
      lastFrameRef.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      return handleError(cameraErrorMessage(err));
    }
  }

  function switchToUpload() {
    stopCamera();
    setMode("upload");
    setPhase("idle");
    setErrorMsg("");
  }

  function handleReset() {
    stopCamera();
    setMode("choose");
    setPhase("idle");
    setUrlResult(null);
    setContent(null);
    setErrorMsg("");
  }

  return {
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
  };
}
