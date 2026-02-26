/**
 * Full list of disposable / temporary email domains merged from two sources:
 *
 *   1. disposable-email-domains (npm) — ~3,500 entries
 *      https://github.com/disposable-email-domains/disposable-email-domains
 *
 *   2. mailchecker (npm) — ~55,000 entries
 *      https://github.com/FGRibreau/mailchecker
 *
 * Loaded once at module init; Set lookups are O(1).
 * Union of both lists gives ~57,000+ unique entries.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _domainList: string[] = require("disposable-email-domains");
import { blacklist as mailCheckerBlacklist } from "mailchecker";

export const DISPOSABLE_DOMAINS = new Set<string>([
  ..._domainList,
  ...mailCheckerBlacklist(),
]);
