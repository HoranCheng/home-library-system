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

export class StorageWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageWriteError";
  }
}

export function saveState(state: LibraryState, storage?: StorageLike): void {
  const s = storage ?? (hasStorage() ? (globalThis as any).localStorage : undefined);
  if (!s) return;

  const nextBooks = JSON.stringify(state.books);
  const nextMeta = JSON.stringify({ ...state.meta, updatedAt: new Date().toISOString() });
  const prevBooks = s.getItem(STORAGE_KEYS.books);
  const prevMeta = s.getItem(STORAGE_KEYS.meta);

  try {
    s.setItem(STORAGE_KEYS.books, nextBooks);
    s.setItem(STORAGE_KEYS.meta, nextMeta);
  } catch (error: any) {
    try {
      if (prevBooks === null) {
        s.setItem(STORAGE_KEYS.books, JSON.stringify(DEFAULT_STATE.books));
      } else {
        s.setItem(STORAGE_KEYS.books, prevBooks);
      }
      if (prevMeta === null) {
        s.setItem(STORAGE_KEYS.meta, JSON.stringify(DEFAULT_STATE.meta));
      } else {
        s.setItem(STORAGE_KEYS.meta, prevMeta);
      }
    } catch {
      // best-effort rollback only
    }

    const message = error?.name === "QuotaExceededError"
      ? "本地存储空间已满，未能保存数据"
      : "写入本地存储失败";
    throw new StorageWriteError(message);
  }
}
