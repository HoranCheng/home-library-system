/** Normalize arbitrary text for comparison: NFKC + lowercase + single-space collapse. */
export function normalizeText(v: string | undefined | null): string {
  if (!v) return "";
  return v
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Validate and normalize an ISBN string (10 or 13 digits).
 * Strips hyphens/spaces and upper-cases before validation.
 */
export function normalizeIsbn(v: string): { ok: true; value: string } | { ok: false; reason: string } {
  const cleaned = v.replace(/[-\s]/g, "").toUpperCase();
  if (cleaned.length !== 10 && cleaned.length !== 13) {
    return { ok: false, reason: "ISBN must be 10 or 13 chars" };
  }
  if (cleaned.length === 10) {
    if (!/^[0-9]{9}[0-9X]$/.test(cleaned)) {
      return { ok: false, reason: "ISBN-10 contains invalid chars" };
    }
    if (!isValidIsbn10(cleaned)) {
      return { ok: false, reason: "ISBN-10 checksum mismatch" };
    }
    return { ok: true, value: cleaned };
  }

  if (!/^[0-9]{13}$/.test(cleaned)) {
    return { ok: false, reason: "ISBN-13 contains invalid chars" };
  }
  if (!isValidIsbn13(cleaned)) {
    return { ok: false, reason: "ISBN-13 checksum mismatch" };
  }
  return { ok: true, value: cleaned };
}

/**
 * ISBN-10 check digit: sum of digit[i] * (10 - i) for i=0..9 must be divisible by 11.
 * The last digit may be 'X' representing 10.
 */
function isValidIsbn10(v: string): boolean {
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += (10 - i) * Number(v[i]);
  const check = v[9] === "X" ? 10 : Number(v[9]);
  sum += check;
  return sum % 11 === 0;
}

/**
 * ISBN-13 check digit: alternating weights 1 and 3 for the first 12 digits.
 * The 13th digit is (10 - (sum % 10)) % 10.
 */
function isValidIsbn13(v: string): boolean {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    sum += Number(v[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const expected = (10 - (sum % 10)) % 10;
  return expected === Number(v[12]);
}

export function buildFingerprint(title: string, firstAuthor: string, edition?: string): string {
  return [normalizeText(title), normalizeText(firstAuthor || ""), normalizeText(edition || "")].join("|");
}
