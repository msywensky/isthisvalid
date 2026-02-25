/**
 * Full list of disposable / temporary email domains sourced from
 * https://github.com/disposable-email-domains/disposable-email-domains
 * (3 500+ entries, updated regularly).
 *
 * Loaded once at module init; Set lookups are O(1).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _domainList: string[] = require("disposable-email-domains");
export const DISPOSABLE_DOMAINS = new Set<string>(_domainList);
