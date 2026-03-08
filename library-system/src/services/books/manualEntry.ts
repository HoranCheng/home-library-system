import type { CreateBookInput } from "../../domain/book";

export function buildManualEntryDraft(partial?: { isbn?: string; title?: string; author?: string }): CreateBookInput {
  return {
    title: partial?.title ?? "",
    authors: partial?.author ? [partial.author] : [],
    isbn13: partial?.isbn,
    status: "to_be_sorted"
  };
}
