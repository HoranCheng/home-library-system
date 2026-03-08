import type { LibraryState } from "./schema";
import { DEFAULT_STATE, STORAGE_KEYS } from "./schema";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function hasStorage(): boolean {
  return typeof globalThis !== "undefined" && !!(globalThis as any).localStorage;
}

export function loadState(storage?: StorageLike): LibraryState {
  const s = storage ?? (hasStorage() ? (globalThis as any).localStorage : undefined);
  if (!s) return DEFAULT_STATE;
  try {
    const booksRaw = s.getItem(STORAGE_KEYS.books);
    const metaRaw = s.getItem(STORAGE_KEYS.meta);
    return {
      books: booksRaw ? JSON.parse(booksRaw) : [],
      meta: metaRaw ? JSON.parse(metaRaw) : DEFAULT_STATE.meta
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveState(state: LibraryState, storage?: StorageLike): void {
  const s = storage ?? (hasStorage() ? (globalThis as any).localStorage : undefined);
  if (!s) return;
  s.setItem(STORAGE_KEYS.books, JSON.stringify(state.books));
  s.setItem(STORAGE_KEYS.meta, JSON.stringify({ ...state.meta, updatedAt: new Date().toISOString() }));
}
