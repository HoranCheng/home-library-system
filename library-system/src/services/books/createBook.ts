import type { Book, CreateBookInput } from "../../domain/book";
import { dedupeByFingerprint, dedupeByIsbn } from "../../domain/dedupe";
import { normalizeIsbn } from "../../domain/normalize";
import type { LibraryState } from "../../store/schema";

export type CreateBookResult =
  | { ok: true; book: Book }
  | { ok: false; code: "DUPLICATE_CANDIDATE"; candidates: Book[] }
  | { ok: false; code: "INVALID_ISBN"; reason: string };

/**
 * Validates input and creates a new Book object.
 * Does NOT mutate state — the caller is responsible for appending the
 * returned book to state.books and persisting.
 */
export function createBook(state: LibraryState, input: CreateBookInput): CreateBookResult {
  let isbn10 = input.isbn10;
  let isbn13 = input.isbn13;

  for (const candidate of [isbn10, isbn13]) {
    if (candidate) {
      const n = normalizeIsbn(candidate);
      if (!n.ok) return { ok: false, code: "INVALID_ISBN", reason: n.reason };
      if (n.value.length === 10) isbn10 = n.value;
      if (n.value.length === 13) isbn13 = n.value;
    }
  }

  const strong = dedupeByIsbn(state.books, isbn10).concat(dedupeByIsbn(state.books, isbn13));
  if (strong.length) return { ok: false, code: "DUPLICATE_CANDIDATE", candidates: Array.from(new Set(strong)) };

  const soft = dedupeByFingerprint(state.books, input.title, input.authors[0] ?? "", input.edition);
  if (soft.length) return { ok: false, code: "DUPLICATE_CANDIDATE", candidates: soft };

  const now = new Date().toISOString();
  const book: Book = {
    ...input,
    isbn10,
    isbn13,
    id: input.id ?? crypto.randomUUID(),
    createdAt: now,
    updatedAt: now
  };
  return { ok: true, book };
}
