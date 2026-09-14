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

async function handleResponse<T>(res: Response): Promise<T> {
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

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

/**
 * POSTs a multipart/form-data body — used by the image checker to upload a
 * picked file. RN's fetch accepts `{ uri, name, type }` in place of a real
 * File/Blob for a FormData entry (there's no File constructor on-device).
 */
export async function postFormData<T>(
  path: string,
  form: FormData,
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    body: form,
  });
  return handleResponse<T>(res);
}
