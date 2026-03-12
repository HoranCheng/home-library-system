import { createBook } from "../services/books/createBook";
import { buildManualEntryDraft } from "../services/books/manualEntry";
import { validateImportJson } from "../services/data/backup";
import { loadState, saveState } from "../store/storage";
import type { LibraryState } from "../store/schema";

export function createFromManual(
  partial?: { isbn?: string; title?: string; author?: string },
  storage?: Pick<Storage, "getItem" | "setItem">
) {
  const state = loadState(storage);
  const draft = buildManualEntryDraft(partial);
  const result = createBook(state, draft);
  if (result.ok) {
    state.books.push(result.book);
    saveState(state, storage);
  }
  return result;
}

export function getLibrarySummary(storage?: Pick<Storage, "getItem" | "setItem">) {
  const state = loadState(storage);
  return {
    total: state.books.length,
    toBeSorted: state.books.filter((b) => b.status === "to_be_sorted").length,
    inLibrary: state.books.filter((b) => b.status === "in_library").length
  };
}

export type ImportStateResult =
  | { ok: true; bookCount: number }
  | { ok: false; errors: string[] };

export function importState(raw: string, storage?: Pick<Storage, "getItem" | "setItem">): ImportStateResult {
  const validation = validateImportJson(raw);
  if (!validation.ok) return { ok: false, errors: validation.errors };
  const parsed = JSON.parse(raw) as LibraryState;
  saveState(parsed, storage);
  return { ok: true, bookCount: parsed.books.length };
}
