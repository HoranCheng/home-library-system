import type { Book } from "../../domain/book";
import type { LibraryState } from "../../store/schema";

export function getBookById(state: LibraryState, id: string): Book | undefined {
  return state.books.find((b) => b.id === id);
}
