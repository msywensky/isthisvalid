/**
 * NANP area-code → US state (or territory) lookup.
 *
 * Data lives in src/data/us-area-codes.json.
 * To refresh the data, run:  node scripts/update-area-codes.mjs
 *
 * NOTE: Due to number portability (since 1996), this reflects the geographic
 * assignment of the area code, NOT necessarily the subscriber's current location.
 * Mobile numbers in particular may be used far from the area code's origin region.
 */
import areaCodeData from "../data/us-area-codes.json";

const AREA_CODE_MAP = areaCodeData.codes as Record<string, string>;

/**
 * Returns the US state (or territory) for a given 3-digit area code string,
 * or null if the area code is not in the NANP US table.
 */
export function getStateByAreaCode(areaCode: string): string | null {
  return AREA_CODE_MAP[areaCode] ?? null;
}

/**
 * Returns the area-code–based location for a US phone number in E.164 format,
 * or null if the country is not US, the number is invalid, or the area code is
 * not in our table.
 *
 * @param countryCode ISO 3166-1 alpha-2 code (e.g. "US")
 * @param nationalNumber The national significant number string (digits only, no formatting)
 */
export function getAreaCodeLocation(
  countryCode: string | null,
  nationalNumber: string | null,
): string | null {
  if (countryCode !== "US" || !nationalNumber) return null;
  const areaCode = nationalNumber.replace(/\D/g, "").slice(0, 3);
  if (areaCode.length < 3) return null;
  return getStateByAreaCode(areaCode);
}
