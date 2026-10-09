/** Escape text for safe insertion into HTML as text, not markup. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** JSON embed that cannot break out of a <script> tag. */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function clipString(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max);
}

export function redactError(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/sk_(?:live|test)_[A-Za-z0-9]+/g, "[redacted-stripe-key]")
    .replace(/jv_(?:live|test)_[A-Za-z0-9]+/g, "[redacted-jev-key]")
    .replace(/TYPESAFE_API_KEY[=:\s]+\S+/gi, "TYPESAFE_API_KEY=[redacted]");
}

export function safeExternalUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === "instagram.com" ||
      host.endsWith(".instagram.com") ||
      host === "instagr.am"
    ) {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}
