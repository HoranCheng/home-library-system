import { createBook } from "../services/books/createBook";
import { buildManualEntryDraft } from "../services/books/manualEntry";
import { loadState, saveState } from "../store/storage";

export function createFromManual(partial?: { isbn?: string; title?: string; author?: string }) {
  const state = loadState();
  const draft = buildManualEntryDraft(partial);
  const result = createBook(state, draft);
  if (result.ok) saveState(state);
  return result;
}

export function getLibrarySummary() {
  const state = loadState();
  return {
    total: state.books.length,
    toBeSorted: state.books.filter((b) => b.status === "to_be_sorted").length,
    inLibrary: state.books.filter((b) => b.status === "in_library").length
  };
}
