export function normalizeText(v: string): string {
  return v
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function normalizeIsbn(v: string): { ok: true; value: string } | { ok: false; reason: string } {
  const cleaned = v.replace(/[-\s]/g, "").toUpperCase();
  if (cleaned.length !== 10 && cleaned.length !== 13) {
    return { ok: false, reason: "ISBN must be 10 or 13 chars" };
  }
  if (!/^[0-9X]+$/.test(cleaned)) {
    return { ok: false, reason: "ISBN contains invalid chars" };
  }
  return { ok: true, value: cleaned };
}

export function buildFingerprint(title: string, firstAuthor: string, edition?: string): string {
  return [normalizeText(title), normalizeText(firstAuthor || ""), normalizeText(edition || "")].join("|");
}
