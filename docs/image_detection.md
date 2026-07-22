# Plan: Real-or-Fake Image Detection Tool (deepflag.ai)

## Context

The `/check/image` page currently ships as a "Coming soon" stub (`src/app/check/image/page.tsx`) and the homepage tile carries a `Soon` badge (`src/app/page.tsx:62`). This plan turns the stub into a fully working fifth tool that mirrors the existing four-pipeline architecture: file upload → API detection (deepflag.ai) → result with score, classification, and explanation.

The text/SMS scam tool is the closest analog (LLM-style external API, daily cost cap, SHA-256-keyed Redis cache, identical result-card UX), so this plan reuses its patterns end-to-end. The user wants:

- **File upload only** (no URL paste tab) — most suspicious images live on the user's device.
- **deepflag.ai** as the detection provider — `POST /api/v1/detect/image`, multipart/form-data with field `file`, auth via `X-API-Key`.
- **SHA-256 cache** keyed on the image bytes (privacy-safe — bytes never persisted).
- **Ko-fi only** on the result card; no affiliate nudge.

## Rules

### NON-DESTRUCTIVE BEHAVIOR ONLY

- DO NOT DELETE ANY SOURCE FILES
- DO NOT EXECUTE ANY GIT COMMANDS

### DRY principle

- Do not duplicate logic

### Each Step

- Before each step, review the code to be changed thoroughly
- You are an expert Typescript / React developer, code like it
- Step is not completed until tests are created.
- Update the document with your changes. If any issues are found during the step, document as well.

### Upon completion

- Do a full code review of all changes.
- If any issues are found, add to the document and fix them.

## Decisions

| Decision            | Choice                                               | Reason                                                                                                                                                                                                                                                                            |
| ------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Submission UX       | File upload, drag-and-drop + click                   | Confirmed with user.                                                                                                                                                                                                                                                              |
| Max file size       | 4 MB                                                 | Vercel serverless body limit is 4.5 MB; leaves headroom. Validated client- and server-side.                                                                                                                                                                                       |
| Accepted MIME types | `image/jpeg`, `image/png`, `image/webp`, `image/gif` | Common screenshot/photo formats.                                                                                                                                                                                                                                                  |
| Cache TTL           | 24 h (`86_400 s`)                                    | Matches text-tool TTL — balances cost reduction with freshness if deepflag updates models.                                                                                                                                                                                        |
| Cache key           | `itv:image:{sha256(bytes)}`                          | Aligns with the dominant `itv:{tool}:{hash}` pattern used by `smtp-cache.ts` and `phone-cache.ts`. Bytes hashed server-side; raw image never persisted.                                                                                                                           |
| Daily LLM-style cap | 20/day per IP, separate bucket                       | Same shape as `checkDailyTextLimit`, separate bucket so image and text don't share a quota.                                                                                                                                                                                       |
| Affiliate           | None — Ko-fi only                                    | Confirmed with user.                                                                                                                                                                                                                                                              |
| Color accent        | `emerald`                                            | Already established in the stub and homepage tile.                                                                                                                                                                                                                                |
| Safe risk threshold | `SAFE_RISK_THRESHOLD = 50`                           | Matches the text tool. A lower value (40) was considered but rejected: a false positive on a real photo (e.g., a journalist's authentic photo marked as fake) is just as harmful as a false negative, so we default to the text-tool threshold rather than skewing toward "fake". |

## Provider API contract (deepflag.ai)

Confirmed via `https://api.deepflag.ai/openapi.json`:

- `POST https://api.deepflag.ai/api/v1/detect/image`
- Auth: header `X-API-Key: <key>`
- Body: `multipart/form-data` with single field `file` (binary)
- Response 200:
  ```jsonc
  {
    "id": "string",
    "content_type": "string",
    "verdict": "string",                 // free-form, NOT enum-bound
    "confidence": number,                // assume 0–1; coerce to 0–100
    "scores": {
      "ai_probability": number,          // 0–1
      "human_probability": number        // 0–1
    },
    "analysis": { /* free-form object */ },
    "flagged_segments": [] | null,
    "created_at": "ISO datetime"
  }
  ```
- 422 on schema validation failure.

Because `verdict` is not enum-bound, we normalize it ourselves to `"deepfake" | "ai-generated" | "authentic" | "uncertain"` based on keyword matching + score thresholds, then build our own user-facing `riskScore`/`safe` derivation.

## Recommended implementation order

Build in dependency order so the project compiles at each step:

1. `src/lib/image-debunker.ts` — types and pure logic; no I/O, no imports from new files
2. `src/lib/deepflag-client.ts` — imports only Node built-ins and env vars
3. Edit `src/lib/rate-limit.ts` — add `checkDailyImageLimit`
4. `src/app/api/debunk/image/route.ts` — depends on all three above
5. `src/components/ImageResultCard.tsx` — depends on `ImageDebunkResult` type
6. `src/lib/image-faq-data.ts` + `src/components/ImageFAQ.tsx`
7. `src/app/check/image/layout.tsx`
8. `src/app/check/image/page.tsx` — depends on result card and debunker types
9. Edit `src/app/page.tsx` — drop "Soon" badge
10. Tests (`__tests__/image-debunker.test.ts` then `__tests__/debunk-image-route.test.ts`)
11. Docs edits (README, `.env.example`, `CLAUDE.md`, `ARCHITECTURE.md`, `DEVELOPER_GUIDE.md`)

## Files to create

### Backend

1. **`src/lib/deepflag-client.ts`** — provider wrapper, mirrors `src/lib/llm-client.ts`.
   - `isDeepflagConfigured(): boolean`
   - `callDeepflag(bytes: ArrayBuffer | Uint8Array, mimeType: string, filename: string): Promise<DeepflagRawResponse | null>`
     - Reads `DEEPFLAG_API_KEY` once at module load; returns `null` if absent.
     - Builds `FormData`, posts to deepflag with 30 s `AbortSignal.timeout`.
     - Retries `MAX_RETRIES = 3` with exponential backoff: `RETRY_BASE_MS = 1_000` (1 s → 2 s → 4 s, same formula as `llm-client.ts`: `delayMs = RETRY_BASE_MS * 2 ** attempt`). Retry condition is broader than the Claude client's strict 529-only rule because the deepflag OpenAPI doesn't document its transient-error codes: retry on **HTTP 429, 500, 502, 503, 504, and network/timeout errors**; bail immediately on 4xx ≠ 429 (those are caller errors and won't recover). Document this assumption in a top-of-file comment so future-us tightens it once we see real-world failures.
     - Throws on non-retryable errors (the route handler catches and returns 502).
   - `getDeepflagModelLabel(): string` — returns `"DeepFlag AI Detection"` (overridable via `DEEPFLAG_MODEL_LABEL` env). Naming mirrors the existing `getModelLabel()` in `llm-client.ts`.

2. **`src/lib/image-debunker.ts`** — pure logic, no I/O. Exports:
   - `type ImageClassification = "deepfake" | "ai-generated" | "authentic" | "uncertain"`
   - `interface ImageDebunkResult` — parallels `TextDebunkResult`: `classification`, `confidence`, `riskScore`, `safe`, `summary`, `flags`, `explanation`, `source: "deepflag"` (literal type, not generic string), `modelLabel`.
   - `SAFE_RISK_THRESHOLD = 50` (matches text tool — see Decisions table)
   - `DANGEROUS_IMAGE_CLASSIFICATIONS = new Set(["deepfake", "ai-generated"])`
   - `ACCEPTED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]`
   - `MAX_IMAGE_BYTES = 4 * 1024 * 1024`
   - `DeepflagRawResponseSchema` (Zod) — validates the raw API response _before_ normalization, mirroring the way `DebunkResponseSchema` validates Claude output. Schema:
     ```ts
     z.object({
       id: z.string(),
       content_type: z.string(),
       verdict: z.string(),
       confidence: z.number().min(0).max(1).nullable().optional(),
       scores: z
         .object({
           ai_probability: z.number().min(0).max(1),
           human_probability: z.number().min(0).max(1),
         })
         .optional(),
       analysis: z.record(z.unknown()).optional(),
       flagged_segments: z.array(z.unknown()).nullable().optional(),
       created_at: z.string().optional(),
     });
     ```
     This catches deepflag API contract drift early. The route returns 502 if `safeParse` fails.
   - `normalizeDeepflagResponse(raw): ImageDebunkResult` — pure transform, unit-testable. Handles defensively:
     - **Verdict-string mapping** (case-insensitive substring match, checked in precedence order — `"ai-generated"` is evaluated first and wins any multi-keyword match):
       1. `"ai"` / `"synthetic"` / `"generated"` → `"ai-generated"`
       2. `"deepfake"` / `"manipulated"` / `"forged"` → `"deepfake"`
       3. `"human"` / `"real"` / `"authentic"` / `"genuine"` → `"authentic"`
       4. everything else (including unknown/empty) → `"uncertain"`
     - **`riskScore` derivation** (before coercion): `Math.max(0, Math.min(100, Math.round((ai_probability - human_probability) * 100)))`. A result of 0 means the model is fully convinced the image is human-captured; 100 means fully convinced it is AI. Clamp to `[0, 100]` because the subtraction can go negative for clearly authentic images.
       - If `scores` is missing, fall back to `Math.round((confidence ?? 0) * 100)` as a proxy; coercion handles consistency.
       - If both `scores` and `confidence` are missing → `riskScore = 50`, `classification = "uncertain"`.
     - **`confidence`** is scaled from 0–1 → 0–100 and included in `ImageDebunkResult` as-is (coerced to 0 with a "Low confidence" flag if `null`/undefined).
     - **`flags[]`** — modelled on the text tool's approach of extracting specific named signals:
       - `"AI generation probability: {X}%"` when `ai_probability * 100 ≥ 70`
       - `"Human probability: {X}%"` when `human_probability * 100 ≥ 70` (authentic lean)
       - `"Low detection confidence: {X}%"` when `confidence * 100 < 30`
       - `"Possible deepfake manipulation"` when classification is `"deepfake"`
       - `"Inconclusive result — use with caution"` when classification is `"uncertain"`
       - Empty array `[]` when classification is `"authentic"` and no anomalies
     - **`summary`** — one-sentence plain-English verdict based on classification:
       - `"deepfake"` → `"This image shows signs of deepfake manipulation."`
       - `"ai-generated"` → `"This image appears to have been generated by AI."`
       - `"authentic"` → `"This image appears to be authentic."`
       - `"uncertain"` → `"Detection results are inconclusive — treat with caution."`
     - **`explanation`** — 2–3 sentences. Start with a classification-driven template, incorporate `analysis` field content when present (convert to a readable string via `JSON.stringify(raw.analysis)` appended as: `" Additional analysis: ${...}"`), then append confidence stats. Example for `"ai-generated"`: `"The image shows statistical patterns consistent with AI generation tools. [analysis content if present.] Detection confidence: {X}%."`
     - **`analysis` field** — pulled into `explanation` as described above. Do not expose it raw; stringify and append only.
   - `coerceImageRiskScore(classification, riskScore): number` — explicit cross-field coercion analogous to `coerceRiskScore()` in the text tool. Enforces:
     - `deepfake` or `ai-generated` → riskScore floored at 60.
     - `authentic` → riskScore capped at 40.
     - `uncertain` → riskScore clamped to 40–70 band (fence-sitting).
       Called as the last step of `normalizeDeepflagResponse`. Without this, a verdict of "deepfake" with a low ai_probability would render with a green ring — confusing.

3. **`src/app/api/debunk/image/route.ts`** — POST handler, mirrors `src/app/api/debunk/text/route.ts` step for step:
   1. `checkRateLimit(ip)` (existing 20/min sliding window) → 429 with `Retry-After`.
   2. `isDeepflagConfigured()` guard → 503 if not.
   3. **Parse FormData (no Zod on the raw body — Zod can't validate `multipart/form-data` directly)**:
      - `const form = await request.formData()` (try/catch → 400 on malformed body).
      - `const file = form.get("file")`.
      - Guard: `if (!file || !(file instanceof Blob)) return 422 "missing or invalid file field"`.
      - Validate `file.type` (the parsed MIME from the multipart part — **not** the file extension) against `ACCEPTED_IMAGE_MIME_TYPES` → 422 on mismatch. This is what makes `.txt`-renamed-to-`.jpg` get rejected.
      - Validate `file.size <= MAX_IMAGE_BYTES` → 422 on oversize.
   4. Read bytes once: `const bytes = new Uint8Array(await file.arrayBuffer())`. Compute `sha256(bytes)` (`createHash("sha256").update(bytes).digest("hex")`).
   5. Cache lookup: `redis.get<ImageDebunkResult>("itv:image:" + hash)` → if hit, return with `X-Cache: HIT` header. **Critical: this happens before the daily cap so cached requests are free.**
   6. `checkDailyImageLimit(ip)` (new — added to `rate-limit.ts`) → 429 if exceeded.
   7. `callDeepflag(bytes, file.type, file.name)`. Catch errors → 502; null result → 503.
   8. **Validate raw deepflag response** with `DeepflagRawResponseSchema.safeParse(raw)` → 502 with `console.error` if it fails (catches API contract drift).
   9. `normalizeDeepflagResponse(parsed.data)` → `ImageDebunkResult` (which already includes `coerceImageRiskScore` and `safe = riskScore < SAFE_RISK_THRESHOLD && !DANGEROUS_IMAGE_CLASSIFICATIONS.has(classification)`).
   10. Fire-and-forget `redis.set(key, result, { ex: 86_400 })`.
   11. Return JSON with headers `X-Cache: MISS`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`.

4. **Edits to `src/lib/rate-limit.ts`**:
   - Add `_dailyImageLimiter = Ratelimit.fixedWindow(20, "1 d")` with prefix `"itv:daily:image"` (separate bucket from `"itv:daily:text"`).
   - Add `checkDailyImageLimit(identifier): Promise<LimitResult>` — identical implementation to `checkDailyTextLimit`; only the limiter variable and log prefix differ. `LimitResult` is already defined in that file — do not redefine it.

### Frontend

5. **`src/app/check/image/page.tsx`** — replace the stub entirely. Client component (`"use client"`).
   - State: `phase: "idle" | "preview" | "loading" | "result" | "error"`, `file: File | null`, `previewUrl: string | null`, `result: ImageDebunkResult | null`, `errorMsg: string`.
   - Layout: `<CheckShell icon="🖼️" label="Image Checker" headline=… sub=…>` with no `badge` (the "Soon" goes away).
   - Drop-zone region: dashed emerald border, click-to-pick or drag-and-drop. Hidden `<input type="file" accept="image/jpeg,image/png,image/webp,image/gif">`.
   - On select: validate MIME and size client-side (reuses `ACCEPTED_IMAGE_MIME_TYPES`, `MAX_IMAGE_BYTES` exported from `image-debunker.ts`). Reject with inline error. Otherwise create `URL.createObjectURL(file)` for preview, set `phase = "preview"`.
   - Preview state: thumbnail + filename + size + "Replace" + "Analyze image" buttons.
   - On submit: build `FormData`, append `file`, POST to `/api/debunk/image`. Same error/loading/result state machine as the text page.
   - **Blob URL lifecycle** (corrected): the preview URL must outlive `phase = "result"` because the result card may also display the same thumbnail. Revoke `URL.createObjectURL` only when:
     - the component unmounts (cleanup function in a `useEffect` whose dep is `previewUrl`),
     - the user clicks "Replace" and a new file is chosen (revoke previous URL before creating the new one),
     - the user clicks "Check another image" (resets state).
       Do **not** revoke on transition into `phase = "result"`.
   - To keep the blob URL lifecycle simple, **the result-card thumbnail is deferred to a follow-up PR**. The page still creates the preview during selection (so the user sees what they're about to submit), but the result card will render without the thumbnail in v1.

6. **`src/app/check/image/layout.tsx`** — add metadata + FAQPage JSON-LD, mirroring `src/app/check/text/layout.tsx` exactly. Required fields:
   - `title: "Image Deepfake & AI Detection"`
   - `description`: 150–160 char SEO description, e.g. _"Free deepfake and AI-generated image detector. Upload a photo or screenshot — we'll tell you if it's authentic or manipulated. No signup, no nonsense."_
   - `keywords: ["deepfake detector", "AI image detection", "fake photo checker", "is this image real", "deepfake checker"]`
   - `openGraph` with title/description/url
   - `alternates.canonical: "${SITE_URL}/check/image"`
   - JSON-LD `<Script>` with `@type: "FAQPage"` built from `IMAGE_FAQ_DATA` — copy the structure from `src/app/check/text/layout.tsx` lines 38–54.

7. **`src/components/ImageResultCard.tsx`** — mirrors `src/components/TextResultCard.tsx`:
   - Classification → emoji/color map (`deepfake` red, `ai-generated` rose, `uncertain` amber, `authentic` lime).
   - SVG score ring (radius 52, 120×120), display value `100 - riskScore` (so high = safer, matching the text card's convention).
   - Confidence bar.
   - Flags list (`flags[]`).
   - Explanation paragraph.
   - "DeepFlag · AI Detection" source badge.
   - **No affiliate nudge.** Ko-fi only: `import KofiDonation from "@/components/KofiDonation"` and render `<KofiDonation />` at the bottom.
   - **Thumbnail in result card is deferred** to a follow-up PR (see page.tsx note above).

8. **`src/lib/image-faq-data.ts`** + **`src/components/ImageFAQ.tsx`** — same shape as `text-faq-data.ts` + `TextFAQ.tsx`, emerald accent.

   `image-faq-data.ts` should export `IMAGE_FAQ_DATA` as an array of `{ question: string; answer: string }` with the following entries:

   ```ts
   [
     {
       question: "What does 'deepfake' mean?",
       answer:
         "A deepfake is an AI-manipulated image or video where a person's face, body, or surroundings have been digitally altered using machine learning. Modern deepfakes can be extremely convincing — imperceptible to the naked eye — which is why automated pixel-level analysis is needed to detect them.",
     },
     {
       question: "How accurate is AI image detection?",
       answer:
         "Our tool uses DeepFlag's detection engine to analyse pixel-level patterns, compression artifacts, and statistical anomalies associated with AI generation. While effective against current tools, no detector is perfect — highly sophisticated images or heavily post-processed photos may occasionally be missed. Use the confidence score as your guide: a low-confidence result should be treated as a rough indicator, not a conclusion.",
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
         "Completely free, no account required. Running detection calls costs us money every time you submit, so if you find this useful, the Ko-fi link at the bottom of the result goes a long way. No ads, no signup, no catch.",
     },
   ];
   ```

### Edits to existing files

9. **`src/app/page.tsx`** — `tools[]` entry for image: drop `accentBadge: "Soon"`, change `cta` from `"Coming soon"` to `"Check image"`. Card becomes a live `<Link>` automatically because of the `isSoon` branch (`page.tsx:97`, `:144`).

10. **`README.md`** — add the image tool to the feature list. Add `DEEPFLAG_API_KEY` to the env-var section.

11. **`.env.example`** — add the following block (after the `NUMVERIFY_API_KEY` entry, following the same comment style as existing entries):

    ```
    # ── Image deepfake / AI detection (deepflag.ai) ──────────────────────────────
    # Required for the image detection tool.
    # Sign up at https://deepflag.ai to get your API key.
    DEEPFLAG_API_KEY=
    ```

12. **`CLAUDE.md`** — add a fifth pipeline section describing image flow and its critical invariants (cache hit bypasses daily cap, raw bytes never persisted, MIME + size enforced server-side).

13. **`ARCHITECTURE.md`** + **`DEVELOPER_GUIDE.md`** — short paragraph each.

### Tests

14. **`__tests__/image-debunker.test.ts`** — pure-function tests for `normalizeDeepflagResponse` and `coerceImageRiskScore`:
    - verdict "deepfake"/"fake"/"manipulated" → `classification: "deepfake"` and `riskScore ≥ 60`.
    - verdict "human"/"real"/"authentic" with `ai_probability < 0.2` → `classification: "authentic"` and `riskScore ≤ 40`.
    - mixed scores trigger `"uncertain"`.
    - **unknown verdict string** (e.g., `"unknown"`, empty string, `"qux"`) → maps to `"uncertain"`, riskScore in the 40–70 fence-sitting band.
    - `confidence` and `ai_probability` correctly scaled from 0–1 → 0–100.
    - `safe` boundary: `riskScore` 49 → `safe: true`, 50 → `safe: false` (matches text-debunker's `<` boundary).
    - **Defensive cases**: `confidence: null`, missing `scores`, missing `analysis` — all produce a valid `ImageDebunkResult` without throwing.
    - **Coercion test**: a deepflag response with verdict "deepfake" but `ai_probability: 0.1` (low) → final riskScore is floored at 60 by `coerceImageRiskScore` (prevents green-ring + red-classification contradiction).
    - **ai-generated precedence test**: verdict `"ai-generated authentic"` → `classification: "ai-generated"` (not `"authentic"`).
    - **riskScore formula test**: `ai_probability: 0.8`, `human_probability: 0.2` → pre-coercion riskScore = 60. `ai_probability: 0.1`, `human_probability: 0.9` → pre-coercion riskScore = 0 (clamped, not negative).

15. **`__tests__/debunk-image-route.test.ts`** — mirrors `debunk-text-route.test.ts` (716 lines):
    - happy path (cache miss → 200 with body + `X-Cache: MISS`)
    - cache hit → 200 with `X-Cache: HIT`
    - **cache hit bypasses daily limit** — `checkDailyImageLimit` not called when cached
    - cache miss calls daily limit before deepflag
    - 429 on per-minute and per-day limits
    - 503 when `isDeepflagConfigured()` is false
    - 422 on missing file (no `file` field), wrong MIME (`image/svg+xml`, `text/plain`), oversized file (`MAX_IMAGE_BYTES + 1`)
    - 422 explicitly for `.txt`-renamed-to-`.jpg`: assemble a `Blob` whose `type` is `"text/plain"` even though the filename ends `.jpg`, confirm it's rejected (validating that we use `file.type`, not extension).
    - 502 on deepflag throw / malformed JSON / Zod schema mismatch on raw response (the new `DeepflagRawResponseSchema.safeParse` failure path).
    - non-fatal Redis read failure (graceful continue).
    - retry behaviour: deepflag returns 503 once, then 200 → result returned, no error surfaced.
    - **test helper**: builds a `NextRequest` whose body is a real `FormData` with a minimal valid JPEG buffer. The buffer **must include JPEG magic bytes** (`0xFF 0xD8 0xFF 0xE0`) at offset 0 so that `file.type` is accepted as `"image/jpeg"` when constructing the `Blob`. A 16-byte buffer with the correct magic bytes header is sufficient — we only need `arrayBuffer()` to succeed and `sha256` to compute. Example:
      ```ts
      const FAKE_JPEG = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x00, 0x00, 0x01,
      ]);
      const blob = new Blob([FAKE_JPEG], { type: "image/jpeg" });
      ```
    - `getDeepflagModelLabel()` test: default return value is `"DeepFlag AI Detection"` — no override path needed.

## Verification

- **Pre-flight: confirm Next.js bodySizeLimit.** Read `next.config.js` / `next.config.mjs` and any `route.ts` `export const config` to make sure no global Route Handler body size limit is set below 4.5 MB. App Router Route Handlers don't apply the legacy `api.bodyParser.sizeLimit` (that's Pages Router only), but a `serverActions.bodySizeLimit` or per-route config could surprise us. If any limit is set, raise it for `/api/debunk/image` only or document the cap.
- **Unit tests**: `npm test -- image` passes (≈40 new tests added; total moves from 403 → ~440).
- **Type/build**: `npm run build` is the source of truth for TS errors — must be 0 errors.
- **Lint**: `npm run lint` clean.
- **Manual end-to-end (dev mode)**:
  1. Set `DEEPFLAG_API_KEY` in `.env.local`.
  2. `npm run dev`, browse to `http://localhost:3000/check/image`.
  3. Drop a known AI-generated image (e.g., a Stable Diffusion sample) → expect `classification: "ai-generated"` or `"deepfake"`, riskScore ≥ 60, `safe: false`, ko-fi visible, no affiliate nudge.
  4. Drop a real photo → expect `classification: "authentic"`, riskScore < 40, `safe: true`.
  5. Submit the same image twice → second response carries `X-Cache: HIT` (DevTools network tab) and is sub-100ms.
  6. Drop a 5 MB file → client-side rejection with friendly error before upload.
  7. Drop a `.txt` renamed to `.jpg` (wrong MIME) → server-side 422.
  8. With `DEEPFLAG_API_KEY` removed from env → page still loads but submit returns 503 with friendly error.
- **Privacy spot-check**: `redis-cli KEYS "itv:image:*"` shows only hashes; `GET` returns the result JSON, never bytes.
- **Homepage**: image tile is now a real link (no opacity, no "Soon" badge).

## Critical invariants (don't regress)

- **Cache lookup happens before daily limit check.** Repeated lookups of the same image must be free.
- **Raw bytes never persisted.** Only the SHA-256 hash is part of the cache key.
- **Server-side MIME check uses `file.type` (parsed from the multipart part), not the filename extension.** This is what blocks `.txt`-renamed-to-`.jpg`. Both client and server enforce MIME + size — never trust the client alone.
- **`getDeepflag*()` returns null on missing key**, route returns 503 — graceful degradation matches the rest of the codebase.
- **`safe` formula uses `<` not `<=`** for `SAFE_RISK_THRESHOLD` (matches text-debunker).
- **Raw deepflag response is validated by Zod (`DeepflagRawResponseSchema`) before normalization.** Catches API contract drift early; route returns 502 on parse failure.
- **`coerceImageRiskScore` runs as the last step of normalization.** Without it, classification and riskScore can contradict (red-classification + green-ring), which would confuse users and undermine the result card's visual signal.
- **Blob URL is revoked on unmount, file replacement, and reset — not on result.**
- **`"ai-generated"` wins over all other verdict keyword matches** (checked first in the substring-match cascade).
- **riskScore before coercion = `Math.max(0, Math.min(100, Math.round((ai_probability - human_probability) * 100)))`.** Negative values (authentic images) clamp to 0; `coerceImageRiskScore` then lifts the floor to match classification.

## Out of scope

- EXIF metadata extraction (mentioned on the stub page) — separate pipeline; can ship later.
- URL-paste alternative (user explicitly chose file-only).
- Affiliate slot (user said Ko-fi only).
- Bulk / batch checks.
- Result-card thumbnail (deferred for blob-URL lifecycle simplicity).

## Feedback resolution (`docs/image_detection_feedback.txt`)

Incorporated from initial review:

1. **Cache key prefix** changed `itv:cache:image:` → `itv:image:` to align with the dominant `itv:{tool}:{hash}` convention used by the smtp/phone caches.
2. **`coerceImageRiskScore`** is now an explicit, testable function (not just a description inside `normalizeDeepflagResponse`).
3. **`SAFE_RISK_THRESHOLD`** changed from 40 → 50 to match text. The "false-positive cost is lower for images" rationale didn't hold.
4. **`DeepflagRawResponseSchema`** (Zod) validates the raw provider response before normalization, mirroring the text route's `DebunkResponseSchema`. Route returns 502 on schema mismatch.
5. **FormData validation** is now spelled out: `formData.get("file")` → `instanceof Blob` check → `file.type` (parsed MIME, **not** extension) → `file.size`. Test list explicitly covers `.txt`-renamed-to-`.jpg`.
6. **Retry strategy** broadened from 429/503-only to 429/5xx/network/timeout, with a top-of-file comment documenting the assumption (deepflag's transient codes aren't documented).
7. **Blob URL lifecycle** corrected: revoke on unmount, file replacement, reset — never on result. Result-card thumbnail is deferred to keep the lifecycle simple.
8. **`layout.tsx` description** added to the metadata spec.
9. **Verification** now starts with a pre-flight check of `next.config.*` for any body-size-limit surprises.
10. **`source: "deepflag"`** is now a literal type, not a generic string.

Incorporated from junior-dev Q&A:

11. **`riskScore` formula** specified: `Math.max(0, Math.min(100, Math.round((ai_probability - human_probability) * 100)))`. `confidence` displayed separately (scaled 0–1 → 0–100).
12. **Retry backoff** specified: `RETRY_BASE_MS = 1_000`, same `2 ** attempt` formula as `llm-client.ts`.
13. **`flags[]` content** specified: named signal strings mirroring the text tool's pattern; empty array for clean authentic results.
14. **`summary` / `explanation`** specified: classification-driven templates; `analysis` field stringified into `explanation`.
15. **Verdict precedence** specified: `"ai-generated"` checked first, wins any multi-keyword match.
16. **`analysis` field** pulled into `explanation` (not exposed raw).
17. **Test JPEG buffer** must include valid JPEG magic bytes (`FF D8 FF E0`); 16-byte buffer sufficient.
18. **Recommended implementation order** added (pure logic → client → rate-limit edit → route → UI → tests → docs).
19. **Ko-fi component path** specified: `src/components/KofiDonation.tsx`.
20. **Full FAQ content** written out in `image-faq-data.ts` section (7 entries).
21. **`checkDailyImageLimit`** mirrors `checkDailyTextLimit` exactly; `LimitResult` already exported from `rate-limit.ts`.

Minor suggestions (not adopted):

- Renaming `getDeepflagModelLabel()` to `getDeepflagModel()`. The existing helper in `llm-client.ts` is named `getModelLabel()`, so `getDeepflagModelLabel()` is the consistent parallel.

---

## Implementation Notes (2026-05-04)

### Files created

- `src/lib/image-debunker.ts` — pure logic, types, Zod schema, normalisation, coercion
- `src/lib/deepflag-client.ts` — deepflag.ai HTTP client with exponential backoff retry
- `src/app/api/debunk/image/route.ts` — POST handler
- `src/components/ImageResultCard.tsx` — result card (no affiliate nudge, Ko-fi only)
- `src/components/ImageFAQ.tsx` — collapsible FAQ (emerald accent)
- `src/lib/image-faq-data.ts` — 7 FAQ entries
- `src/app/check/image/layout.tsx` — metadata + FAQPage JSON-LD
- `src/app/check/image/page.tsx` — upload page (stub replaced)
- `__tests__/image-debunker.test.ts` — 54 pure-function tests
- `__tests__/debunk-image-route.test.ts` — 29 route tests

### Files modified

- `src/lib/rate-limit.ts` — added `_dailyImageLimiter` + `checkDailyImageLimit`
- `src/app/page.tsx` — image tile: `accentBadge: null`, `cta: "Check image"`

### Issues found and resolved during implementation

1. **`z.record(z.unknown())` → Zod v4 requires two arguments** — fixed to `z.record(z.string(), z.unknown())`.
2. **`new Blob([bytes])` TypeScript error** — `Uint8Array<ArrayBufferLike>` is not assignable to `BlobPart` in strict mode. Fixed by explicitly extracting `.buffer as ArrayBuffer` from `Uint8Array` before passing to `Blob` constructor.

### Final test counts (initial DeepFlag implementation)

- Total: 486 tests (403 original + 83 new)
- New breakdown: 54 image-debunker unit tests + 29 route integration tests
- Build: 0 TypeScript errors
- Lint: 0 errors on new files (2 pre-existing issues in unrelated files)

---

## Provider Migration: DeepFlag → SightEngine (2026-05-05)

### Reason

Switched detection provider from deepflag.ai to SightEngine (`genai` model).

### API differences

|             | DeepFlag                                                                    | SightEngine                            |
| ----------- | --------------------------------------------------------------------------- | -------------------------------------- |
| Auth        | `X-API-Key` header                                                          | `api_user` + `api_secret` form fields  |
| File field  | `file`                                                                      | `media`                                |
| Model param | n/a                                                                         | `models: "genai"`                      |
| Response    | `verdict` string + `confidence` + `scores.ai_probability/human_probability` | `type.ai_generated` (single 0–1 score) |
| Endpoint    | `POST /api/v1/detect/image`                                                 | `POST /1.0/check.json`                 |

### Normalization changes

SightEngine returns a single `ai_generated` score. Classification is derived purely from thresholds (no keyword matching):

- `>= 0.7` → `"ai-generated"`
- `>= 0.4` → `"uncertain"`
- `< 0.4` → `"authentic"`

`"deepfake"` is retained in `ImageClassification` and `DANGEROUS_IMAGE_CLASSIFICATIONS` for future use but is not returned by the SightEngine genai model.

`confidence` is derived as `Math.round(Math.abs(aiScore - 0.5) * 200)` — certainty of the verdict (0% = maximally ambiguous at 0.5, 100% = certain at 0 or 1).

`riskScore` (before coercion) = `Math.round(aiScore * 100)`.

### Files changed

- **Created**: `src/lib/sightengine-client.ts` — new HTTP client (`api_user`/`api_secret`, `media` field, `models=genai`)
- **Rewritten**: `src/lib/image-debunker.ts` — `SightengineRawResponseSchema`, `SightengineRawResponse`, `normalizeSightengineResponse`; `source: "sightengine"`
- **Updated**: `src/app/api/debunk/image/route.ts` — imports `sightengine-client`, uses new schema/normalize functions
- **Updated**: `__tests__/image-debunker.test.ts` — 45 tests against new single-score API
- **Updated**: `__tests__/debunk-image-route.test.ts` — mocks `sightengine-client`, uses SightEngine response fixtures
- **Updated**: `.env.example` — `SIGHTENGINE_API_USER=`, `SIGHTENGINE_API_SECRET=`

`src/lib/deepflag-client.ts` is retained (not deleted per plan rules) but no longer imported.

### Env vars

- Remove `DEEPFLAG_API_KEY` from `.env.local`
- Add `SIGHTENGINE_API_USER` and `SIGHTENGINE_API_SECRET` (from sightengine.com dashboard)

### Final test counts

- Total: 479 tests passing (main project, excluding stale worktree tests)
- Build: 0 TypeScript errors
