# Smart Universal Input + PWA Share Target

## Context

IsThisValid.com is a hub-and-spoke site: `/` is a tool picker and each of the six
validators lives at its own `/check/*` route. That structure assumes the visitor
already knows which tool they need — but the real-world artifact people arrive
with is a **scam SMS containing a link and a callback number**, which today
requires three separate manual checks across three pages.

Two gaps follow from that:

1. **No entry point for "I don't know what this is."** Nothing detects what the
   user pasted, and nothing connects the pipelines to each other — a text can be
   classified "legit" while the link inside it is a typosquat, and the site will
   never say so.
2. **The mobile path is desktop-shaped.** The primary use case happens on a
   phone, in the Messages app, but the flow is: leave Messages → open a browser →
   type the domain → paste. There is no manifest, no installability, no share
   target (verified: zero matches for `manifest`, `service.?worker`, `next-pwa`,
   `share_target` across the repo).

**Outcome:** one box on the homepage that accepts anything and routes it, fanning
out sub-checks on links found inside pasted messages; and an installable PWA
whose share target lets someone send a suspicious text straight from their
Messages app into that box.

**Decisions already made (do not re-litigate):**

- Smart box goes in the homepage hero **above** the existing tool grid; the grid stays.
- URL sub-checks run **automatically** (free/fast); phone sub-checks are **on-demand** (paid quota).
- Share target is **text-only** — no service worker. Images keep using the normal upload flow.
- Single combined PR.
- Include the `Permissions-Policy` camera fix.

## Rules

- No destructive behaviour. Do not delete files.
- No git commands
- Update the plan as you go. Document code changes.
- Code review required after each feature section is coded. Document findings.
- Final code review at the end of the plan. Document all findings. Correct all issues found.

---

## Feature A: Smart universal input

### A1. New pure lib — `src/lib/input-router.ts`

DOM-free and sync, so it is unit-testable under the repo's node-only Jest config.

```ts
export type DetectedInput =
  | { kind: "email"; value: string; raw: string }
  | { kind: "url"; value: string; raw: string }
  | { kind: "phone"; value: string; raw: string }
  | { kind: "text"; value: string; raw: string };

export function detectInputKind(raw: string): DetectedInput;
export function extractUrls(text: string): string[];
export function extractPhones(text: string): string[];
```

**Precedence order** — the whole correctness surface lives here, so implement it
as an explicit ordered chain with a comment per rule:

1. Empty / whitespace-only → `text`
2. **Dangerous schemes first** — `javascript:`, `data:`, `file:`, `vbscript:` → `text`.
   Never `url`. This mirrors the property `classifyQrContent` already guarantees
   and must be regression-tested identically.
3. `mailto:` → `email` (strip `?subject=` like `qr-content.ts` does); `tel:` → `phone`
4. **Phone-shape test before the prose test** — if the trimmed input contains
   only digits, `+`, and separators `-.()\s`, and has 7–15 digits → `phone`.
   This is what stops `"+1 555 123 4567"` being read as prose because it has spaces.
5. Contains internal whitespace or a newline → `text` (prose)
6. Single token containing `@` matching email shape → `email` (so `support@paypal.com`
   is an email, not a bare domain)
7. Explicit `http://` / `https://` → `url`
8. IPv4 literal (four dot-separated octets) → `url`
9. Bare domain (label(s) + alphabetic TLD ≥2) → `url`
10. Fallback → `text`

Rule 8 exists because a bare-domain regex requiring an alphabetic TLD rejects
`192.168.1.1`, which would otherwise fall through to the phone rule and be
validated as an 11-digit number.

**Prose extraction** — do not attempt a perfect regex. Use a permissive candidate
regex, then **filter through the existing local validators**, which are pure,
sync, and free:

- `extractUrls`: match `https?://\S+` and bare-domain-looking tokens, strip trailing
  punctuation `.,;:!?)]}'"`, dedupe case-insensitively, then keep only candidates
  where `validateUrlLocal(c).checks.parseable` is true.
- `extractPhones`: match E.164 and NANP-ish digit runs, then keep only candidates
  where `validatePhoneLocal(c).checks.parseable && .valid`.

`validateUrlLocal` (`src/lib/url-validator.ts:494`) and `validatePhoneLocal`
(`src/lib/phone-validator.ts:340`) are already exported and do no network I/O.

**Leave `src/lib/qr-content.ts` untouched.** It is a _whole-payload_ classifier
with a different contract (`wifi`/`tel`/`mailto` schemes), it is regression-tested,
and `useQrScanner` depends on its exact union. Refactoring it to share code with a
prose-aware detector risks a shipped feature for no user-visible gain. The
duplicated dangerous-scheme guard is a deliberate, tested duplication — note it
in a comment in both files pointing at each other.

### A2. Orchestration — client-side, no new API route

**Justification.** The pipelines are not extractable: the network helpers
(`resolveMx`, `checkResolves`, `checkDomainAge`, `checkSafeBrowsing`,
`isPrivateHost`) are module-private to their `route.ts` files, and the entire
text-debunk LLM pipeline (`SYSTEM_PROMPT`, `DebunkResponseSchema`,
`coerceRiskScore`, `cacheKey`) is private to
`src/app/api/debunk/text/route.ts` — `src/lib/text-debunker.ts` holds only types
and two constants. A server-side aggregator would have to duplicate ~150 lines
including the LLM prompt, creating two sources of truth for invariants that
`CLAUDE.md` explicitly treats as regression-critical.

Client-side orchestration reuses all five endpoints verbatim: no new API surface,
no new env vars, no duplicated prompt, and the primary result can paint before
sub-checks finish. The rate-limit cost is identical either way.

**New hook — `src/hooks/useSmartCheck.ts`**, modelled on `useQrScanner.ts`
(the established precedent for extracting a whole state machine out of a page).

```ts
type SubCheck =
  | { id: string; target: string; kind: "url"; status: "pending" }
  | {
      id: string;
      target: string;
      kind: "url";
      status: "done";
      data: UrlValidationResult;
    }
  | {
      id: string;
      target: string;
      kind: "url";
      status: "error";
      message: string;
    }
  | { id: string; target: string; kind: "phone"; status: "idle" } // on-demand
  | { id: string; target: string; kind: "phone"; status: "pending" }
  | {
      id: string;
      target: string;
      kind: "phone";
      status: "done";
      data: PhoneValidationResult;
    }
  | {
      id: string;
      target: string;
      kind: "phone";
      status: "error";
      message: string;
    };

export function useSmartCheck(): {
  phase: "idle" | "loading" | "result" | "error";
  detected: DetectedInput | null;
  primary: PrimaryResult | null; // discriminated by kind
  subChecks: SubCheck[];
  errorMsg: string;
  run(raw: string): Promise<void>;
  runPhoneCheck(id: string): Promise<void>;
  reset(): void;
};
```

**Fan-out policy** — `src/lib/rate-limit.ts` `checkRateLimit` is a **20/min
sliding window under one Redis prefix (`itv:rl`) shared by all five routes**,
keyed on raw IP. Fan-out spends from that same budget, so:

- The primary check always runs **alone, first**.
- Sub-checks only run when `detected.kind === "text"`.
- **Hard cap: the first 3 unique URLs**, auto-checked via `Promise.allSettled`.
  Worst case is 4 of the 20/min budget. If more are found, render them as
  unchecked chips with a note.
- **Phones: max 3 rendered as buttons**, `status: "idle"` until clicked.
- Each sub-check owns its own error state. A 429 or 502 on a sub-check renders
  an inline row ("Couldn't check this link — rate limited") and **never** touches
  the primary card.
- Deduplicate targets before dispatch.

Endpoint contracts to respect: `/api/debunk/text` requires **10–5000 chars**
(short prose will 422 — surface that as a friendly "too short to analyse" rather
than a raw error); `/api/validate-url` max 2048; `/api/validate-phone` 5–25;
`/api/validate` max 254.

### A3. UI

**`src/components/SmartInput.tsx`** (new, `"use client"`) — the hero box.
`src/app/page.tsx` stays a **server component** and simply renders `<SmartInput />`
between the hero `<section>` and the tool grid.

**Privacy-safe handoff — never a query string.** Pasted texts contain names and
account numbers; a query string leaks into browser history, and `Referrer-Policy`
is only `strict-origin-when-cross-origin`. Instead:

- `SmartInput` writes the value to `sessionStorage` under `itv_smart_input`
  (matching the existing `itv_` convention in `CookieConsent.tsx:6`, wrapped in
  try/catch for private browsing), then `router.push("/check/any")`.
- `/check/any` reads it in a mount `useEffect`, **immediately `removeItem`s it**,
  and auto-runs. If absent or blocked, the page just renders its own empty input.

**`src/app/check/any/page.tsx`** (new, `"use client"`) — uses `CheckShell` with
`icon="🔍"`, `label="Smart Check"`, headline `Is this <span className="text-orange-400">real</span>?`.
Accent is **orange** (the hub/brand colour) — deliberately not one of the six tool
accents, since this is the generalist. Follows the `State` discriminated-union
pattern from `check/url/page.tsx`, wrapping content in `w-full max-w-xl`
(`CheckShell` supplies no width). Include `AdSenseBanner` `slot="top"` and a
`slot="mid"` gated on results, matching email/url/phone.

Layout: detected-kind chip ("Detected: a link") → primary result card → an
"Also found in this message" section → `AdSenseBanner` mid → "How it works" →
reuse of the relevant FAQ.

**`src/app/check/any/layout.tsx`** (new) — metadata + `alternates.canonical`.
Follow the newer text/image/qr layout style (local `SITE_URL` const, keywords,
`openGraph`).

**Solving the duplicated `<KofiDonation/>`.** All six result cards embed
`<KofiDonation/>` as their final child, and three embed their own
`<AffiliateNudge>`. Stacking cards would render several Ko-fi bars.

Add **one** optional prop to the four cards used in the composite
(`ResultCard`, `UrlResultCard`, `PhoneResultCard`, `TextResultCard`):

```ts
variant?: "standalone" | "nested"   // default "standalone"
```

In `"nested"`: skip `<KofiDonation/>`, skip `<AffiliateNudge>`, and drop
`UrlResultCard`'s `mt-8`. Defaulting to `"standalone"` leaves all six existing
call sites byte-identical in behaviour. The composite view renders exactly one
`<KofiDonation/>` at the bottom, and lets only the **primary** card show an
affiliate nudge.

Cards are otherwise reused verbatim — they are pure, single-prop, stateless.
Watch the import styles: `UrlResultCard` is a **named** export; the rest are default.

**Do not** attempt to de-duplicate the pre-existing `Spinner` (×5), `CheckRow`
(×3), or `ScoreRing` (×4) in this PR. It is real debt but unrelated scope.

---

## Feature B: PWA + text share target

### B1. Manifest — static `public/manifest.json`

**Not** `src/app/manifest.ts`. Next 16.1.6 types
`MetadataRoute.Manifest["share_target"]["params"]["files"]` as the DOM `File`
type rather than the spec's `{name, accept}[]`
(`node_modules/next/dist/lib/metadata/types/manifest-types.d.ts:52`). Even
text-only, the static file avoids fighting a wrong type and keeps the share
target readable.

```json
{
  "name": "IsThisValid — Scam & Verification Checker",
  "short_name": "IsThisValid",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#09090b",
  "theme_color": "#09090b",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "share_target": {
    "action": "/share",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": { "title": "title", "text": "text", "url": "url" }
  }
}
```

Reference it from `src/app/layout.tsx` via `metadata.manifest: "/manifest.json"`,
and add `metadata.icons` (including `apple-touch-icon`) plus
`metadata.appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "IsThisValid" }`.
`viewport.themeColor` is already `#09090b` — leave it.

### B2. Icons — `scripts/generate-icons.mjs`

Model directly on the working `scripts/generate-og.mjs` (SVG string → `sharp` →
PNG; `sharp` is already a devDependency). Transcribe the split-diamond paths from
`src/components/SiteLogo.tsx:99-146` — the 46×46 `md` variant, scaled — exactly as
`generate-og.mjs` already re-declares brand colours.

Outputs (committed to the repo like `og-image.png`):

| File                                 | Size    | Notes                                                                |
| ------------------------------------ | ------- | -------------------------------------------------------------------- |
| `public/icons/icon-192.png`          | 192×192 | diamond on `#09090b`                                                 |
| `public/icons/icon-512.png`          | 512×512 | same                                                                 |
| `public/icons/icon-maskable-512.png` | 512×512 | diamond at ~60% scale inside the maskable safe zone, `#09090b` bleed |
| `public/icons/apple-touch-icon.png`  | 180×180 |                                                                      |

Add `"generate-icons": "node scripts/generate-icons.mjs"` to `package.json` scripts.

### B3. Share receiver — `src/app/share/route.ts`

A POST Route Handler at **`/share`, deliberately not under `/api/`**:
`src/proxy.ts` matches `/api/:path*` and 403s browser requests from unrecognised
origins. An OS-initiated share POST has an unreliable `Origin`, so keeping the
receiver outside that matcher avoids a 403 that would be painful to debug.

Flow:

1. `await req.formData()` → read `text`, `url`, `title`.
2. Compose one payload: prefer `text`; append `url` if present and not already in
   `text`; fall back to `title`. **Truncate to 4000 chars** (cookie limit is ~4 KB;
   `/api/debunk/text` caps at 5000 anyway).
3. Set cookie `itv_share`: `httpOnly: false` (the client must read it),
   `sameSite: "lax"`, `path: "/"`, `maxAge: 60`, `secure` in production.
4. `303` redirect to `/share/handoff`.

**`src/app/share/handoff/page.tsx`** (client) — reads `itv_share` from
`document.cookie`, **immediately expires it**, writes the value to
`sessionStorage` under `itv_smart_input`, and `router.replace("/check/any")`.
Renders only a spinner. The 303 + separate handoff page is what keeps a POST
navigation from leaving a re-postable entry in history.

CSP note: no changes needed. `form-action 'self'` covers a same-origin POST, and
nothing new is fetched cross-origin.

**iOS limitations — be honest in the docs.** iOS/Safari does **not** support the
Web Share Target API at all. On iOS the manifest still buys an installable
home-screen app with a standalone display mode and a proper icon, but "Share →
IsThisValid" will not appear in the share sheet. Android/Chrome gets the full
flow. Do not describe this as cross-platform in user-facing copy.

### B4. Camera Permissions-Policy fix

`next.config.ts:53` sets `camera=()`. An **empty allowlist disables the feature in
the top-level document too**, not just cross-origin iframes — so
`useQrScanner.ts:211`'s `getUserMedia` call is almost certainly failing in
production today. Change to:

```
camera=(self), microphone=(), geolocation=(), interest-cohort=()
```

Verify on a deployed preview (`getUserMedia` requires HTTPS, so this cannot be
confirmed on plain `localhost:3000` in all browsers).

---

## Files touched

**New**

- `src/lib/input-router.ts`
- `src/hooks/useSmartCheck.ts`
- `src/components/SmartInput.tsx`
- `src/app/check/any/page.tsx`, `src/app/check/any/layout.tsx`
- `src/app/share/route.ts`, `src/app/share/handoff/page.tsx`
- `public/manifest.json`, `public/icons/*` (4 PNGs)
- `scripts/generate-icons.mjs`
- `__tests__/input-router.test.ts`

**Modified**

- `src/app/page.tsx` — render `<SmartInput />` (stays a server component)
- `src/app/layout.tsx` — `metadata.manifest`, `metadata.icons`, `appleWebApp`
- `next.config.ts` — `camera=(self)`
- `src/app/sitemap.ts` — add `/check/any` (priority 0.9)
- `package.json` — `generate-icons` script
- `ResultCard.tsx`, `UrlResultCard.tsx`, `PhoneResultCard.tsx`, `TextResultCard.tsx`
  — add `variant?: "standalone" | "nested"` (default preserves current behaviour)
- `src/app/privacy/page.tsx` — document the 60-second functional `itv_share` cookie
  and the `itv_smart_input` sessionStorage key

---

## Testing

Jest is `testEnvironment: "node"` with **no jsdom**, so component tests are not
possible — keep all logic worth testing in `src/lib/input-router.ts`.

**`__tests__/input-router.test.ts`** — follow the existing
`describe`/passing-case/failing-case style of `qr-content.test.ts`:

`detectInputKind` —

- each kind: `user@example.com`, `https://example.com`, `example.com`, `+1 555 123 4567`, prose
- **Security regressions (mirror `qr-content.test.ts`):** `javascript:alert(1)`,
  `data:text/html;base64,...`, `file:///etc/passwd`, `vbscript:msgbox` → all `kind: "text"`, never `"url"`
- Ambiguity: `support@paypal.com` → `email` not `url`; `1234567890` → `phone`;
  `192.168.1.1` → `url` not `phone`; `+1 555 123 4567` → `phone` despite spaces
- `mailto:a@b.com?subject=hi` → `email` with subject stripped; `tel:+15551234567` → `phone`
- Empty string and whitespace-only → `text`

`extractUrls` / `extractPhones` —

- a realistic smishing SMS containing one link and one number
- trailing punctuation stripped (`Visit example.com.` → `example.com`)
- deduplication, including case-insensitive
- junk candidates rejected by the `validateUrlLocal` / `validatePhoneLocal` filter
- a message with zero entities → `[]` (not `null`)
- more than 3 URLs → extraction returns all; assert the **cap is applied in the hook**, so
  keep the cap constant exported from the lib and assert its value

Then: `npm run build` (0 errors — the source of truth for TS), `npm test`,
`npm run lint`.

**Manual verification**

1. `npm run dev` → paste each of the 4 input kinds into the homepage box; confirm
   correct routing and that the URL bar never contains the pasted text.
2. Paste a smishing SMS with 2 links + 1 number → text verdict renders first,
   up to 3 link cards fill in, phone shows an unclicked button.
3. Confirm exactly **one** Ko-fi bar and **one** affiliate nudge in the composite.
4. Temporarily set `UPSTASH_REDIS_REST_*` to force 429s → confirm sub-check
   failures render inline and the primary card survives.
5. Deploy a preview → Chrome DevTools → Application → Manifest (no errors, icons
   resolve, share target listed); install on an Android device and share a text
   from Messages; re-test the QR camera to confirm the Permissions-Policy fix.

---

## Docs to update (mandatory — `CLAUDE.md` treats staleness as a bug)

- **`CLAUDE.md`** — new "Smart Universal Input" pipeline section (precedence order
  and the 3-URL fan-out cap are invariants); note the shared 20/min budget; update
  the test count from 493 to the actual post-change number.
- **`ARCHITECTURE.md`** — new pipeline section, File Structure listing, Route Map
  (`/check/any`, `/share`, `/share/handoff`), SEO checklist (manifest/PWA), test counts.
- **`README.md`** — features list + the honest iOS share-target caveat.
- **`.env.example`** — no change (this PR adds no env vars).

---

## Risks & rollback

| Risk                                            | Mitigation                                                                                                                                                                          |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Detector misroutes input                        | Precedence is one ordered chain in one pure file with heavy unit tests; a wrong guess is recoverable — the result page shows the detected kind and offers "check as something else" |
| Fan-out exhausts the shared 20/min limiter      | Hard cap of 3 auto URL checks; phones on-demand; sub-check 429s degrade to inline rows                                                                                              |
| Composite view regresses the six existing pages | `variant` defaults to `"standalone"`; every current call site is untouched                                                                                                          |
| Share cookie leaks message content              | `maxAge: 60`, deleted on first read, `sameSite: "lax"`, never written to a query string; documented in the privacy policy                                                           |
| `camera=(self)` widens a security header        | Narrowest change that permits same-origin use; `microphone`/`geolocation` stay fully disabled                                                                                       |

**Rollback:** every piece is additive except two one-line edits (`next.config.ts`
and `src/app/page.tsx`). Reverting the commit removes the routes, the manifest,
and the homepage box with no data migration and no env-var cleanup.

---

## Implementation order

1. `src/lib/input-router.ts` + `__tests__/input-router.test.ts` — pure, test-first
2. `src/hooks/useSmartCheck.ts` — orchestration and fan-out policy
3. `variant` prop on the four result cards (verify the six existing pages are unchanged)
4. `src/app/check/any/{page,layout}.tsx` — composite view
5. `src/components/SmartInput.tsx` + wire into `src/app/page.tsx`; add to `sitemap.ts`
6. `scripts/generate-icons.mjs` → generate and commit icons
7. `public/manifest.json` + `layout.tsx` metadata
8. `src/app/share/route.ts` + `src/app/share/handoff/page.tsx`
9. `next.config.ts` camera fix
10. Privacy policy, `CLAUDE.md`, `ARCHITECTURE.md`, `README.md`
11. `npm run build && npm test && npm run lint`, then feature branch → PR (never push to main)

> **Rule conflict, resolved in favour of this document:** step 11's "feature
> branch → PR" is superseded by the **No git commands** rule above. All code is
> written and verified in the working tree; branching, committing, and opening
> the PR are left to the repo owner.

---

# Implementation Log

## Feature A — Smart universal input — ✅ complete

### Code changes

**New**

| File                             | What it does                                                                                                                           |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/input-router.ts`        | `detectInputKind`, `extractUrls`, `extractPhones`, `MAX_AUTO_URL_CHECKS = 3`, `MAX_PHONE_SUGGESTIONS = 3`. Pure, DOM-free, no network. |
| `src/lib/smart-input-handoff.ts` | `SMART_INPUT_KEY`, `SHARE_COOKIE`, `stashSmartInput()`, `takeSmartInput()` — read-once sessionStorage handoff.                         |
| `src/lib/result-card-variant.ts` | `ResultCardVariant` + `showsKofi()` / `showsAffiliate()` helpers.                                                                      |
| `src/hooks/useSmartCheck.ts`     | Client-side orchestration, fan-out policy, per-sub-check error isolation.                                                              |
| `src/components/SmartInput.tsx`  | Homepage hero box with live kind hint.                                                                                                 |
| `src/app/check/any/page.tsx`     | Composite view: detected chip, primary card, sub-check rows.                                                                           |
| `src/app/check/any/layout.tsx`   | Metadata + canonical.                                                                                                                  |
| `__tests__/input-router.test.ts` | 52 tests.                                                                                                                              |

**Modified**

- `src/app/page.tsx` — renders `<SmartInput />` above the grid; grid keeps an
  "…or pick a specific tool:" lead-in. Still a server component.
- `src/app/sitemap.ts` — `/check/any` added at priority 0.9.
- `ResultCard.tsx`, `UrlResultCard.tsx`, `PhoneResultCard.tsx`,
  `TextResultCard.tsx` — optional `variant` prop.

### Deviations from the plan (deliberate)

1. **Precedence rule order corrected.** The plan listed phone-shape as rule 4
   and the IPv4 literal as rule 8, but also required `192.168.1.1` → `url`.
   Those contradict: `192.168.1.1` is only digits and dots, and dots are phone
   separators, so the phone rule would have claimed it first (9 digits, inside
   the 7–15 window). **IPv4 is now tested before phone shape.** The plan's own
   test case is what surfaced this.
2. **`variant` has three values, not two.** With only
   `"standalone" | "nested"`, the composite view suppressed the affiliate nudge
   on _every_ card including the primary — but the plan explicitly wanted "only
   the **primary** card show an affiliate nudge". Added `"primary"`: keeps the
   nudge, drops the Ko-fi bar. `"standalone"` is still the default, so all five
   existing call sites are behaviourally unchanged.
3. **Bare-domain extraction uses a TLD allowlist** (`EXTRACTABLE_TLDS`).
   Filtering candidates through `validateUrlLocal` alone was not enough: its
   `validTld` check is only "≥2 characters", so ordinary prose with a missing
   space after a full stop ("Package delayed.Also confirm") parsed as a domain
   on the TLD `.Also` and would have spent a real call from the shared 20/min
   budget. Explicit `http(s)://` links bypass the allowlist entirely, so an
   exotic-TLD scam link is still caught whenever it is written as a URL.
4. **Emails and URLs are masked before scanning.** Without this,
   `support@paypal.com` also yielded the bare domain `paypal.com` as a "link",
   and digits inside a tracking URL were read as a callback number.
5. **Fan-out runs even when the primary check fails.** A 503 from
   `/api/debunk/text` (no `ANTHROPIC_API_KEY`) or a too-short/too-long message
   still leaves the embedded links worth checking, so the sub-checks proceed and
   render beneath the error. The plan only specified the success path.

### Code review findings

| #   | Severity | Finding                                                                                                                                                              | Resolution                                                                                                                                                                                      |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-1 | High     | Composite view suppressed the affiliate nudge on the primary card too, contradicting the plan and dropping a revenue surface from the new page.                      | Fixed — added the `"primary"` variant.                                                                                                                                                          |
| A-2 | Medium   | `stashSmartInput()` failure was ignored, so with sessionStorage blocked the user silently landed on an empty box with their paste gone.                              | Fixed — `SmartInput` now shows an inline notice with a link to `/check/any` and does not navigate. Deliberately **not** falling back to a query string.                                         |
| A-3 | Medium   | `runPhoneCheck` read the target by assigning to a captured variable inside a `setState` updater — impure, and double-invoked under StrictMode.                       | Fixed — sub-checks are now read/written through `subChecksRef` via a pure `applySubChecks` helper.                                                                                              |
| A-4 | Medium   | `setState` called synchronously in the `/check/any` mount effect (`react-hooks/set-state-in-effect`) — a new lint error.                                             | Fixed — the handoff read stays in the effect (it must run post-mount, or the static prerender and the client HTML desync), the state updates are deferred to a `setTimeout(…, 0)` with cleanup. |
| A-5 | Low      | `UrlResultCard`'s unconditional `mt-8` double-spaced stacked cards.                                                                                                  | Fixed — gated behind an explicit `ownSpacing` for `"standalone"` only.                                                                                                                          |
| A-6 | Low      | Stale in-flight sub-checks could write into a newer submission's results.                                                                                            | Already handled — `runIdRef` + `isCurrent()` guard on every write; row ids are namespaced by run.                                                                                               |
| A-7 | Info     | `ResultCard` and `PhoneResultCard` both hard-code `aria-label="Validation result"`, so a composite view exposes several identically-named regions to screen readers. | **Not fixed** — pre-existing in both components, and changing it means another prop. Noted as follow-up debt; does not block.                                                                   |
| A-8 | Info     | Sub-checks start only after the primary resolves, so links inside a message wait on the ~30 s LLM call.                                                              | **By design** — "the primary check always runs alone, first" is the plan's rate-limit protection. Left as specified.                                                                            |

### Verification

- `npx tsc --noEmit` — clean
- `npm run build` — compiled, `/check/any` prerendered static
- `npm test` — 545 passed (493 existing + 52 new)
- `npm run lint` — 1 error remaining, **pre-existing** in
  `src/components/CookieConsent.tsx:28` (same `set-state-in-effect` rule, file
  untouched by this work), plus 5 pre-existing warnings in
  `src/lib/phone-cache.ts`. No new errors or warnings introduced.

---

## Feature B — PWA + text share target — ✅ complete

### Code changes

**New**

| File                                            | What it does                                                                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/generate-icons.mjs`                    | SVG → sharp → PNG, transcribing the `SiteLogo` diamond. `coverage` param sizes the artwork per icon.                               |
| `public/icons/*.png`                            | 192, 512, maskable-512, apple-touch-180 — generated and committed like `og-image.png`.                                             |
| `public/manifest.json`                          | Static manifest: icons, two shortcuts, text-only `share_target` → `/share`.                                                        |
| `src/app/share/route.ts`                        | POST receiver + `composeSharedText`; base64 cookie, 303 to the handoff. Plus a GET that redirects direct visitors to `/check/any`. |
| `src/app/share/handoff/page.tsx` + `layout.tsx` | Cookie → sessionStorage bridge; `noindex`.                                                                                         |
| `__tests__/share-route.test.ts`                 | 17 tests.                                                                                                                          |

**Modified**

- `src/app/layout.tsx` — `metadata.manifest`, `metadata.icons`, `appleWebApp`.
- `next.config.ts` — `camera=()` → `camera=(self)`.
- `package.json` — `generate-icons` script.
- `src/app/privacy/page.tsx` — `itv_smart_input` and `itv_share` rows added to the cookies/storage table, in plain language.

### Deviations from the plan (deliberate)

1. **The share payload is base64-encoded into the cookie.** The plan didn't
   specify an encoding. Raw text broke on cookie delimiters, and live testing
   showed Next percent-encodes the value on the way out — so the client decodes
   `atob(decodeURIComponent(raw))`, which is correct whether or not the
   serialiser encoded it. Regression-tested with semicolons, `=`, and emoji.
2. **Payload cap is 3000 chars, not 4000**, and the encoder shrinks the text in
   a loop until the base64 fits under 3500. Base64 inflates by 4/3 and UTF-8
   multi-byte characters inflate further, so a flat 4000-char cap could exceed
   the ~4 KB cookie limit.
3. **Added `GET /share`** redirecting to `/check/any`. Not in the plan; without
   it, anyone who taps a bare `/share` link gets a bare 405.
4. **Added two manifest `shortcuts`** (Smart Check, QR) — free long-press value
   on an installed app.
5. **Added `__tests__/share-route.test.ts`.** The plan listed only
   `input-router.test.ts`, but `composeSharedText` has real branching logic
   (which field wins, when the URL is appended) and the cookie encoding is
   exactly the sort of thing that breaks silently.

### Code review findings

| #   | Severity     | Finding                                                                                                                                                                                                                                                                                                                                                                       | Resolution                                                                                                                                             |
| --- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B-1 | **Critical** | **The sessionStorage handoff silently dropped the pasted value** — `/check/any` opened with an empty box. StrictMode double-invokes the mount effect; the first pass consumed the destructive `takeSmartInput()` read and its cleanup cancelled the pending timer, so the second pass found nothing. **Found by browser testing, not by the type-checker or the unit tests.** | Fixed — the first read is cached in `handedRef` (`undefined` = not yet read, `null` = read and empty). Re-verified end to end.                         |
| B-2 | High         | Raw text in the cookie would break on `;` and `=`, and Next percent-encodes cookie values, so a naive client read would be corrupted.                                                                                                                                                                                                                                         | Fixed — base64 on write, `atob(decodeURIComponent(...))` on read. Covered by round-trip tests including emoji and delimiters.                          |
| B-3 | Medium       | A 4000-char payload can exceed the ~4 KB cookie limit once base64 and UTF-8 inflation are applied; the cookie would be silently dropped.                                                                                                                                                                                                                                      | Fixed — 3000-char cap plus a shrink loop targeting 3500 base64 chars. Regression-tested with 3000 multi-byte characters.                               |
| B-4 | Medium       | `GET /share` returned 405 for anyone opening the URL directly.                                                                                                                                                                                                                                                                                                                | Fixed — 303 to `/check/any`.                                                                                                                           |
| B-5 | Low          | `composeSharedText` was exported from a `route.ts` but untested.                                                                                                                                                                                                                                                                                                              | Fixed — 17 tests added, following the existing `debunk-text-route.test.ts` precedent.                                                                  |
| B-6 | Low          | `SmartInput`'s storage-blocked warning never cleared once shown, so it persisted while the user retyped.                                                                                                                                                                                                                                                                      | Fixed — cleared on the next edit.                                                                                                                      |
| B-7 | Info         | `manifest.json` `shortcuts` have no per-shortcut icons.                                                                                                                                                                                                                                                                                                                       | **Not fixed** — optional in the spec; Chrome falls back to the app icon. Cosmetic.                                                                     |
| B-8 | Info         | Icon artwork is transcribed from `SiteLogo.tsx` rather than imported, so the two can drift.                                                                                                                                                                                                                                                                                   | **Accepted** — matches the existing `generate-og.mjs` precedent (scripts don't import from `src/`). Called out in a header comment and in `CLAUDE.md`. |

### Verification (live, against `npm run dev`)

| Check                                                     | Result                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `POST /share` with a real multipart body                  | 303 → `/share/handoff`; `Set-Cookie: itv_share=…; Max-Age=60; SameSite=lax`, no `HttpOnly` |
| Cookie payload decoded                                    | Text + appended URL, exactly as composed                                                   |
| Full chain in Chrome (form POST → handoff → `/check/any`) | Landed pre-filled and auto-ran; detected "a message"; fan-out found the link               |
| After the chain: `document.cookie` / `sessionStorage`     | Both empty — cookie expired on read, handoff key deleted on read                           |
| URL bar throughout                                        | Never contained the message; no query string at any step                                   |
| `/manifest.json` + all four icons                         | 200, correct content types; icons visually verified                                        |
| `document.featurePolicy.allowsFeature("camera")`          | `true` (was blocked by `camera=()`); microphone `false`, geolocation `false`               |

The camera check was done programmatically rather than by starting the scanner,
so the fix is confirmed without switching on the user's camera.

---

## Final code review

Full pass over every new and changed file after both features were complete.

### Issues found and corrected

All findings above (A-1…A-6, B-1…B-6) were fixed in place. The final pass
surfaced no further defects. Items deliberately left alone:

| Item                                                                         | Why it was left                                                                                                                                                                                           |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Duplicate `aria-label="Validation result"` regions in a composite view (A-7) | Pre-existing in `ResultCard`/`PhoneResultCard`; fixing it means another prop on shipped components. Follow-up debt.                                                                                       |
| Sub-checks wait for the primary LLM call (A-8)                               | The plan's explicit rate-limit protection: "the primary check always runs alone, first."                                                                                                                  |
| `Spinner` (×6 now), `CheckRow` (×3), `ScoreRing` (×4) duplication            | The plan explicitly rules this out of scope. `/check/any` adds a sixth `Spinner` rather than starting a `components/ui/` refactor mid-PR.                                                                 |
| 1 lint error + 5 lint warnings                                               | All pre-existing: `CookieConsent.tsx:28` (`set-state-in-effect`) and `phone-cache.ts` unused-var warnings. Neither file was touched. Fixing `CookieConsent` is unrelated scope.                           |
| `detectInputKind("tel:abc")` yields `kind: "phone"` with junk                | An explicit `tel:` scheme is the user asserting it is a phone. Short values are caught by the pre-flight guard; longer junk is rejected by the API. Not worth special-casing.                             |
| A pasted date like `2026.01.15` classifies as a phone                        | Digits and dots only, 8 digits — it satisfies the phone rule. Recoverable: the result page shows the detected kind, and the user can rephrase. Not worth adding a date heuristic to the precedence chain. |

### Things specifically re-verified in the final pass

- **Regex `lastIndex` safety.** The prose scanners are module-level `/g` regexes.
  `matchAll` clones the regex and `String.replace` resets `lastIndex` to 0, so no
  state leaks between calls. Every whole-string regex (`IPV4_RE`,
  `PHONE_SHAPE_RE`, `EMAIL_SHAPE_RE`, `BARE_DOMAIN_RE`, `DANGEROUS_SCHEME_RE`) is
  non-global, so `.test()` is stateless.
- **All five pre-existing card call sites pass no `variant`**, so they default to
  `"standalone"`. Confirmed in the browser: `/check/url` still renders `mt-8` and
  exactly one affiliate nudge.
- **Stale-run guards.** `runIdRef` + `isCurrent()` gate every async write in both
  `run` and `runPhoneCheck`; sub-check row ids are namespaced by run id.
- **Nothing sensitive is ever put in a URL.** Verified live for the homepage
  handoff and the share-target chain.
- **`/share` and `/share/handoff` are absent from `sitemap.ts`**, and the handoff
  page is `noindex, nofollow`.

### Final gate

| Command         | Result                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------- |
| `npm run build` | ✅ Compiled successfully; 23 routes; `/check/any` and `/share/handoff` static, `/share` dynamic |
| `npm test`      | ✅ **562 passed**, 10 suites (493 existing + 52 input-router + 17 share-route)                  |
| `npm run lint`  | ✅ No new problems (1 error + 5 warnings, all pre-existing and in untouched files)              |
| `npx prettier`  | ✅ All changed files formatted (the pre-commit hook could not run — "No git commands")          |

### Not done (blocked by the rules)

- **No branch, commit, or PR.** The "No git commands" rule overrides the plan's
  step 11. Everything is in the working tree, ready for the repo owner to commit.
- **Deployed-preview checks** from the plan's manual list — installing on a real
  Android device, sharing from Messages, and Chrome DevTools → Application →
  Manifest — still need a preview deployment. The share POST, the cookie, the
  handoff chain, the manifest, the icons, and the camera policy were all verified
  locally instead.
