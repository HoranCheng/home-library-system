import type { CreateBookInput } from "../../domain/book";

const MAX_TITLE_LENGTH = 200;
const MAX_AUTHOR_LENGTH = 100;

/** Collapse multiple whitespace and trim. */
function sanitize(v: string, maxLen: number): string {
  return v.trim().replace(/\s+/g, " ").slice(0, maxLen);
}

export function buildManualEntryDraft(partial?: { isbn?: string; title?: string; author?: string }): CreateBookInput {
  const title = sanitize(partial?.title ?? "", MAX_TITLE_LENGTH);
  if (!title) {
    throw new Error("title is required");
  }

  const author = sanitize(partial?.author ?? "", MAX_AUTHOR_LENGTH);
  const isbn = partial?.isbn?.trim();
  const isbnCompact = isbn?.replace(/[-\s]/g, "");

  return {
    title,
    authors: author ? [author] : [],
    isbn10: isbnCompact?.length === 10 ? isbn : undefined,
    isbn13: isbnCompact?.length === 13 ? isbn : undefined,
    status: "to_be_sorted"
  };
}
