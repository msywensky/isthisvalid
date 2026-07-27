export type QrContent =
  | { kind: "url"; url: string; raw: string }
  | { kind: "tel"; phone: string; raw: string }
  | { kind: "email"; email: string; raw: string }
  | {
      kind: "wifi";
      ssid: string;
      encryption: string;
      hidden: boolean;
      raw: string;
    }
  | { kind: "text"; text: string; raw: string };

const BARE_DOMAIN_RE =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9-]+)+(\/\S*)?$/i;

/**
 * Classifies raw QR payload text into a discriminated union.
 * Order matters: schemes are matched before the bare-domain fallback, and
 * anything that isn't recognisably a URL (including javascript:/data: URIs)
 * falls through to "text" so we never hand a dangerous scheme to the URL
 * checker or auto-act on it.
 */
export function classifyQrContent(raw: string): QrContent {
  const trimmed = raw.trim();

  if (trimmed === "") {
    return { kind: "text", text: "", raw };
  }

  if (/^tel:/i.test(trimmed)) {
    return { kind: "tel", phone: trimmed.slice(4).trim(), raw };
  }

  if (/^mailto:/i.test(trimmed)) {
    const rest = trimmed.slice(7);
    const email = rest.split("?")[0].trim();
    return { kind: "email", email, raw };
  }

  if (/^wifi:/i.test(trimmed)) {
    return classifyWifi(trimmed, raw);
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return { kind: "url", url: trimmed, raw };
  }

  if (BARE_DOMAIN_RE.test(trimmed)) {
    return { kind: "url", url: trimmed, raw };
  }

  return { kind: "text", text: trimmed, raw };
}

function classifyWifi(trimmed: string, raw: string): QrContent {
  const body = trimmed.slice(5); // strip "WIFI:"
  const fields = parseWifiFields(body);

  return {
    kind: "wifi",
    ssid: fields.S ?? "",
    encryption: fields.T ?? "nopass",
    hidden: fields.H?.toLowerCase() === "true",
    raw,
  };
}

/**
 * Parses WIFI:T:<enc>;S:<ssid>;P:<pass>;H:<bool>;; fields.
 * Deliberately omits P (password) from the returned map — callers must
 * never surface or store the wifi password.
 */
function parseWifiFields(body: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let key = "";
  let value = "";
  let inKey = true;

  for (let i = 0; i < body.length; i++) {
    const char = body[i];

    if (char === "\\" && i + 1 < body.length) {
      // Escaped separator — keep the literal next character
      value += body[i + 1];
      i++;
      continue;
    }

    if (inKey && char === ":") {
      inKey = false;
      continue;
    }

    if (char === ";") {
      if (key && key.toUpperCase() !== "P") {
        fields[key.toUpperCase()] = value;
      }
      key = "";
      value = "";
      inKey = true;
      continue;
    }

    if (inKey) {
      key += char;
    } else {
      value += char;
    }
  }

  return fields;
}
