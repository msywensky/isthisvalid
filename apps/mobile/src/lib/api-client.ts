/**
 * Thin client for the existing isthisvalid.com API routes. No business logic
 * lives here — every check is still scored/decided server-side (or, for the
 * instant local-phase preview, by @isthisvalid/core running on-device). This
 * just knows the base URL and how to POST JSON.
 */

// Expo inlines EXPO_PUBLIC_* at build time — see .env.development / .env.production.
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://isthisvalid.com";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new ApiError(
      (payload && typeof payload === "object" && "error" in payload
        ? String(payload.error)
        : null) ?? `Request failed with status ${res.status}`,
      res.status,
    );
  }

  return res.json() as Promise<T>;
}
