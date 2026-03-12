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
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object") {
      return { ok: false, errors: ["Invalid schema shape: expected object at root"] };
    }
    if (!Array.isArray(parsed.books)) {
      return { ok: false, errors: ["Invalid schema shape: books must be an array"] };
    }
    if (!parsed.meta || typeof parsed.meta !== "object") {
      return { ok: false, errors: ["Invalid schema shape: meta must be an object"] };
    }
    if (typeof parsed.meta.schemaVersion !== "number") {
      return { ok: false, errors: ["meta.schemaVersion must be a number"] };
    }
    if (typeof parsed.meta.updatedAt !== "string") {
      return { ok: false, errors: ["meta.updatedAt must be a string"] };
    }

    const errors: string[] = [];
    (parsed.books as any[]).forEach((b, i) => {
      if (!b.id || typeof b.id !== "string") errors.push(`Book[${i}]: id must be a non-empty string`);
      if (!b.title || typeof b.title !== "string") errors.push(`Book[${i}]: title must be a non-empty string`);
      if (!Array.isArray(b.authors)) errors.push(`Book[${i}]: authors must be an array`);
      if (b.status && !["in_library", "to_be_sorted"].includes(b.status)) errors.push(`Book[${i}]: invalid status "${b.status}"`);
    });
    if (errors.length > 0) return { ok: false, errors };

    return { ok: true, errors: [], bookCount: parsed.books.length };
  } catch (e) {
    return { ok: false, errors: [`Invalid JSON${e instanceof Error ? `: ${e.message}` : ""}`] };
  }
}

function quote(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replaceAll('"', '""')}"`;
  return v;
}
