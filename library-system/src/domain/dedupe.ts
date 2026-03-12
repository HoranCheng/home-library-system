import type { Book } from "./book";
import { buildFingerprint } from "./normalize";

export function dedupeByIsbn(books: Book[], isbn?: string): Book[] {
  if (!isbn) return [];
  return books.filter((b) => b.isbn10 === isbn || b.isbn13 === isbn);
}

export function dedupeByFingerprint(books: Book[], title: string, firstAuthor: string, edition?: string): Book[] {
  const fp = buildFingerprint(title, firstAuthor, edition);
  return books.filter((b) => buildFingerprint(b.title, b.authors?.[0] ?? "", b.edition) === fp);
}
