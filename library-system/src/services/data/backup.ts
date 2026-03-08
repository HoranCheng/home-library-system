import type { LibraryState } from "../../store/schema";

export type ImportValidation = {
  ok: boolean;
  errors: string[];
  bookCount?: number;
};

export function exportJson(state: LibraryState): string {
  return JSON.stringify(state, null, 2);
}

export function exportCsv(state: LibraryState): string {
  const header = ["id", "title", "authors", "isbn13", "isbn10", "edition", "status", "createdAt", "updatedAt"];
  const rows = state.books.map((b) => [
    b.id,
    quote(b.title),
    quote((b.authors ?? []).join("|")),
    b.isbn13 ?? "",
    b.isbn10 ?? "",
    quote(b.edition ?? ""),
    b.status,
    b.createdAt,
    b.updatedAt
  ]);
  return [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export function validateImportJson(raw: string): ImportValidation {
  try {
    const parsed = JSON.parse(raw) as LibraryState;
    if (!parsed || !Array.isArray(parsed.books) || !parsed.meta) {
      return { ok: false, errors: ["Invalid schema shape"] };
    }
    const bad = parsed.books.find((b) => !b.id || !b.title || !Array.isArray(b.authors));
    if (bad) return { ok: false, errors: ["Book item missing required fields"] };
    return { ok: true, errors: [], bookCount: parsed.books.length };
  } catch {
    return { ok: false, errors: ["Invalid JSON"] };
  }
}

function quote(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replaceAll('"', '""')}"`;
  return v;
}
