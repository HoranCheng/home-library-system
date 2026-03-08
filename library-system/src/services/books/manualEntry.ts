import type { CreateBookInput } from "../../domain/book";

export function buildManualEntryDraft(partial?: { isbn?: string; title?: string; author?: string }): CreateBookInput {
  const title = partial?.title?.trim() ?? "";
  if (!title) {
    throw new Error("title is required");
  }

  const isbn = partial?.isbn?.trim();
  const isbnCompact = isbn?.replace(/[-\s]/g, "");

  return {
    title,
    authors: partial?.author?.trim() ? [partial.author.trim()] : [],
    isbn10: isbnCompact && isbnCompact.length === 10 ? isbn : undefined,
    isbn13: isbnCompact && (isbnCompact.length === 13 || (isbnCompact.length !== 10 && isbnCompact.length !== 13)) ? isbn : undefined,
    status: "to_be_sorted"
  };
}
