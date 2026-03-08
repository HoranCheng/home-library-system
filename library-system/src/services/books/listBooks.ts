import type { Book } from "../../domain/book";
import type { LibraryState } from "../../store/schema";

export function listBooks(state: LibraryState): Book[] {
  return [...state.books];
}
