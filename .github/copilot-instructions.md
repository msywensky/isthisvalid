# GitHub Copilot — Workspace Instructions

This file gives Copilot context about **isthisvalid.com** so suggestions match the
project's architecture, conventions, and constraints.

---

## Project Overview

isthisvalid.com is a free, no-signup, multi-tool verification hub:

| Tool        | Route          | API Route                | Status           |
| ----------- | -------------- | ------------------------ | ---------------- |
| Email check | `/check/email` | `POST /api/validate`     | Production       |
| URL check   | `/check/url`   | `POST /api/validate-url` | Production       |
| Text/SMS    | `/check/text`  | `POST /api/debunk/text`  | Production       |
| Image       | `/check/image` | —                        | Stub/coming soon |

Business model: Google AdSense + contextual affiliate links (ZeroBounce, NordVPN).
Hosted on Vercel. Zero user accounts, zero persistent PII.

---

## CRITICAL: Git Workflow

**`main` = PRODUCTION. Direct pushes to `main` are forbidden.**

Every change — including docs, chores, and formatting — must:

1. Start on a feature branch (`feat/`, `fix/`, `chore/`, `docs/`)
2. Be committed to that branch
3. Go through a PR
4. Be approved before merging

```bash
# Correct workflow every time
git checkout -b feat/my-feature
# ... make changes ...
git add <files>
git commit -m "feat: description"
git push -u origin feat/my-feature
gh pr create --base main --head feat/my-feature --title "..." --body "..."
# Wait for approval — do NOT merge yourself unless asked
```

The pre-commit hook (husky + lint-staged) runs Prettier automatically on staged
files before every commit. Never manually reformat a file without committing the
result — it creates orphan formatting diffs.

---

## Tech Stack

| Technology         | Version   | Role                                                |
| ------------------ | --------- | --------------------------------------------------- |
| Next.js            | 16.1.6    | Framework — App Router, RSC, API routes             |
| React              | 19.2.3    | UI                                                  |
| TypeScript         | ^5        | Language — strict mode throughout                   |
| Tailwind CSS       | v4        | Styling — always-dark (zinc-950), utility-first     |
| Zod                | v4.3.6    | Runtime request/response validation                 |
| @upstash/ratelimit | 2.0.8     | Serverless rate limiting (sliding + fixed window)   |
| @upstash/redis     | 1.36.2    | Redis client (REST-based, works in Edge/serverless) |
| @anthropic-ai/sdk  | 0.78.0    | Anthropic Claude API wrapper                        |
| Jest + ts-jest     | 30.x      | Unit testing (333 tests, all pass)                  |
| Prettier + husky   | 3.x / 9.x | Code formatting enforced via pre-commit hook        |

---

## Architecture Patterns

### Pipeline / Merge Pattern

All validators use progressive enrichment: cheap local checks first, then
progressively paid/slow APIs. Each stage returns an immutable result — merge
functions enrich it. Never mutate a result in-place.

```typescript
// Correct: each stage enriches a copy
const local = validateUrlLocal(url);
const withHead = applyHeadResult(local, resolves);
const withRdap = applyRdapResult(withHead, isOld);
const final = applySafeBrowsingResult(withRdap, isFlagged);
```

### Early Exit on Failure

Bail out before calling paid APIs when the result is already clear:

- Email: exit if syntax invalid, exit if no MX records
- URL: exit if unparseable, exit if score < 50 (skip Safe Browsing)
- Text: cache hit → return immediately (don't consume daily quota)

### Graceful No-Op When Keys Absent

Every external dependency must degrade gracefully:

- `getRedis()` returns `null` — all callers must handle null
- `getSmtpProvider()` returns `null` — route continues with local+MX result
- `isLlmConfigured()` returns false — route returns 503 cleanly
- Rate limiters are no-ops when `UPSTASH_REDIS_REST_URL` is absent

### SHA-256 Cache Keying

Raw PII (email, message text) is never stored in Redis. Always hash first:

```typescript
// Email cache key
`itv:smtp:${sha256(email.toLowerCase())}`;
// Text cache key
sha256(message.toLowerCase().replace(/\s+/g, " ").trim());
```

### Fire-and-Forget Cache Writes

Never `await` cache writes in the hot path — they add latency for no user benefit:

```typescript
void setCachedSmtpResult(email, merged); // correct — fire-and-forget
await setCachedSmtpResult(email, merged); // wrong — adds ~50ms latency
```

---

## Environment Variables

| Variable                               | Required?     | Default                         | Notes                                            |
| -------------------------------------- | ------------- | ------------------------------- | ------------------------------------------------ |
| `ANTHROPIC_API_KEY`                    | Text tool     | Tool returns 503 if absent      | Set a monthly spend cap in Anthropic console     |
| `ANTHROPIC_MODEL`                      | No            | `claude-sonnet-4-20250514`      | Override to `claude-haiku-4-5-20251001` for dev  |
| `ANTHROPIC_MAX_TOKENS`                 | No            | `1024`                          | Set to `300` to reduce cost during testing       |
| `UPSTASH_REDIS_REST_URL`               | Rate limiting | No-op if absent                 | Required for rate limits + caching in production |
| `UPSTASH_REDIS_REST_TOKEN`             | Rate limiting | No-op if absent                 | Paired with URL above                            |
| `GOOGLE_SAFE_BROWSING_API_KEY`         | URL tool      | Safe Browsing skipped if absent | 10,000 req/day free                              |
| `ZEROBOUNCE_API_KEY`                   | Email SMTP    | Local+MX only if absent         | 100 free checks/month, preferred provider        |
| `EMAILABLE_API_KEY`                    | Email SMTP    | Ignored if ZeroBounce present   | 250 one-time free, fallback only                 |
| `NEXT_PUBLIC_ADSENSE_ID`               | No            | Ads hidden if blank             | Leave blank until AdSense approved               |
| `NEXT_PUBLIC_ZEROBOUNCE_AFFILIATE_URL` | No            | Placeholder shown               | Set when affiliate link obtained                 |
| `NEXT_PUBLIC_NORDVPN_AFFILIATE_URL`    | No            | Placeholder shown               | Set when affiliate link obtained                 |

When adding a new env var:

1. Add it to `.env.example` with a comment explaining its purpose
2. Add it to the Vercel project dashboard (Settings → Environment Variables)
3. Update the env vars table in `ARCHITECTURE.md` and `DEVELOPER_GUIDE.md`

---

## Key Files — Responsibilities

### `src/lib/email-validator.ts`

Pure synchronous email analysis. No network calls. Exports:

- `validateEmailLocal(email)` → `EmailValidationResult`
- `applyMxResult(result, hasMx)` → `EmailValidationResult`
- `mergeSmtpResult(result, smtp)` → `EmailValidationResult`

**Critical invariants:**

- Typo domain (e.g. `gmail.con`) → score capped at ≤65. Only lifted by `apiDeliverable === true`, NOT by `hasMx === true` alone.
- `valid` formula in `mergeSmtpResult` must include `local.checks.validTld` — do not remove it.
- Role addresses (`admin@`, `noreply@`, etc.) are `valid: true` but penalised in score. This is intentional.

### `src/lib/url-validator.ts`

Local URL analysis + merge helpers. Exports:

- `validateUrlLocal(url)` → `UrlValidationResult`
- `applyHeadResult`, `applySafeBrowsingResult`, `applyRdapResult`, `applyRedirectResult`
- `getRegisteredDomain`, `checkBrandSquat`, `checkTyposquat` (`@internal`)

**Scoring order matters:** All bonuses (e.g. resolve +5) are applied BEFORE caps
(e.g. typosquat cap ≤79). Never reorder score operations — it creates bypass bugs.

### `src/lib/llm-client.ts`

Thin Anthropic SDK wrapper. Model and max tokens read from env vars at module load.

- `callClaude(system, user, maxTokens?, timeoutMs?)` — returns `string | null`
- `isLlmConfigured()` — safe guard for routes
- `getModelLabel()` — derives human-readable name from model string for UI display

### `src/app/api/debunk/text/route.ts`

Text/SMS scam detection. Pipeline order is intentional and must not be reordered:

1. Per-minute rate limit
2. LLM configured check
3. Zod validation
4. **Cache lookup** ← hits return here; daily spend cap not consumed
5. Per-day spend cap ← only reached on cache miss
6. Strip `[MSG]`/`[/MSG]` from user input (delimiter injection guard)
7. Call Claude with AbortSignal.timeout(30_000)
8. Parse + Zod validate Claude JSON
9. `coerceRiskScore()` — enforce classification/score consistency
10. Cache write (fire-and-forget)
11. Return result

### `src/lib/text-debunker.ts`

Shared types for the text tool:

- `SAFE_RISK_THRESHOLD = 50` — exported constant; use this, not the magic number 50
- `DANGEROUS_CLASSIFICATIONS` — Set of `{"scam", "smishing"}`; use for safe guard

### `src/lib/smtp-cache.ts`

Redis cache for SMTP results (7-day TTL). Only caches results with `source !== "local"`.

### `src/lib/rate-limit.ts`

Upstash rate limiting. Also exports `getRedis()` — the shared Redis singleton used
by smtp-cache and the text route.

---

## Code Conventions

### Naming

- Files: `kebab-case.ts` in lib/; `page.tsx` / `route.ts` / `layout.tsx` for App Router
- Types/interfaces: `PascalCase` (`EmailValidationResult`, `UrlValidationResult`)
- Functions: `camelCase` (`validateEmailLocal`, `applyHeadResult`)
- Module-level constants (Sets, Maps, thresholds): `SCREAMING_SNAKE_CASE` (`ROLE_PREFIXES`, `SAFE_RISK_THRESHOLD`)
- React components: `PascalCase` file and export (`CheckShell.tsx`)

### Error Handling

- API routes never throw to the framework — catch everything and return `NextResponse.json({ error: "..." }, { status: NNN })`
- Lib functions return `null` on failure (not throw) for recoverable cases
- Redis errors are always caught and `console.warn`ed — never fatal

### TypeScript

- Strict mode is always on
- Use `Record<string, unknown>` not `Record<string, any>` unless you have a good reason
- `void expression` to explicitly discard a return value (e.g. `void setCachedSmtpResult(...)`)
- Use `.issues` not `.errors` on `ZodError` — `.errors` is undefined at runtime in Zod v4

### Testing

- All tests are pure unit tests — no network, no Redis, no filesystem
- External dependencies are mocked via `jest.mock`
- Follow the existing `describe`/`test` pattern
- For each new validator check: add passing case, failing case, score assertion, flag assertion, message assertion
- Bug regression tests go in a `describe("[Bug N regression]")` block

### Zod

- Use `z.object(...)` + `.safeParse()` in API routes — never `.parse()` (throws)
- Use `.issues` not `.errors` on `ZodError`
- The `DebunkResponseSchema` in the text route validates Claude's JSON output — if Claude changes its response format, update this schema

### Formatting

- Prettier is configured in `.prettierrc` (2-space, double quotes, trailing commas, 80-char)
- The pre-commit hook runs Prettier automatically — never format files manually without committing

---

## Testing Commands

```bash
npm test                              # Run all suites
npx jest __tests__/url-validator.test.ts  # Single file
npx jest -t "typosquat"              # Tests matching a pattern
npm run test:coverage                 # Generate lcov report
npx tsc --noEmit                     # Type-check without building
npm run build                        # Full production build (source of truth for TS errors)
```

Current test count: **333 / 333** (150 email + 113 URL + 45 text + 15 smtp-cache + 10 other)

---

## Common Gotchas

| Symptom                                 | Likely cause                                                                                                            |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Score is 100 for a `.con` typo address  | Typo cap escaped in `applyMxResult` or `mergeSmtpResult`                                                                |
| `valid: true` on a garbage-TLD address  | `validTld` missing from `mergeSmtpResult`'s valid formula                                                               |
| Typosquat URL scores 84 instead of ≤79  | Score bonus applied AFTER cap — reorder so caps come last                                                               |
| Text tool returns 502                   | Claude returned malformed JSON — check `DebunkResponseSchema`                                                           |
| Text tool returns "not configured"      | `ANTHROPIC_API_KEY` missing or blank                                                                                    |
| Rate limit fires in local dev           | `UPSTASH_REDIS_*` vars set — clear them or use a dev Redis DB                                                           |
| SMTP cache never hits                   | Email normalisation mismatch, TTL expired, or `source === "local"`                                                      |
| Safe Browsing returns 401               | API key not enabled for "Safe Browsing API" in Google Cloud Console                                                     |
| `ZodError.errors` is undefined          | Use `.issues` — `.errors` alias removed in Zod v4                                                                       |
| `disposable-email-domains` import fails | It's a CJS/ESM hybrid — use the `disposable-domains.ts` wrapper, don't import directly                                  |
| Claude model 404                        | Check the Anthropic model name — format is `claude-{variant}-{version}-{date}`, NOT `claude-{version}-{variant}-{date}` |

---

## UI / Component Conventions

- **Always-dark** design — never introduce light-mode conditionals
- Brand colour: `orange-500` (`#f97316`) for CTAs, `orange-400` for links/accents
- Score results: `lime-500` (safe), `yellow-500` (suspicious), `rose-500` (dangerous)
- Email tool accent: `amber-400/500` (warm gold — distinct from brand orange)
- Body/secondary text: `zinc-400` — do not use `zinc-500` (fails WCAG AA contrast)
- `CheckShell` is a server component — keep it free of `useState`/`useEffect`
- Affiliate nudges use `AffiliateNudge.tsx` — shown only on risky/unsafe results, always labelled "Affiliate"

---

## Adding a New Feature — Checklist

1. Create feature branch (`feat/my-feature`) from `main`
2. Write code + tests
3. Run `npm run build` (0 errors), `npm test` (all pass), `npm run lint` (0 errors)
4. Add any new env vars to `.env.example` and Vercel dashboard
5. Update `ARCHITECTURE.md`, `DEVELOPER_GUIDE.md`, `README.md` if the change is significant
6. Open PR — do not merge without approval
