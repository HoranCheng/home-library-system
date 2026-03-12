import type { LibraryState } from "./schema";
import { DEFAULT_STATE, STORAGE_KEYS } from "./schema";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function hasStorage(): boolean {
  return typeof globalThis !== "undefined" && !!(globalThis as any).localStorage;
}

/** Returns the platform localStorage or null when unavailable (e.g. SSR / tests). */
export function getStorageAdapter(override?: StorageLike): StorageLike | null {
  if (override) return override;
  return hasStorage() ? (globalThis as any).localStorage : null;
}

export function loadState(storage?: StorageLike): LibraryState {
  const s = getStorageAdapter(storage);
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
  const s = getStorageAdapter(storage);
  if (!s) return;

  const nextBooks = JSON.stringify(state.books);
  const nextMeta = JSON.stringify({ ...state.meta, updatedAt: new Date().toISOString() });

  // Snapshot current values for rollback (fall back to defaults if never written)
  const prevBooks = s.getItem(STORAGE_KEYS.books) ?? JSON.stringify(DEFAULT_STATE.books);
  const prevMeta = s.getItem(STORAGE_KEYS.meta) ?? JSON.stringify(DEFAULT_STATE.meta);

  try {
    s.setItem(STORAGE_KEYS.books, nextBooks);
  } catch (error: any) {
    // books write failed — storage unchanged, no rollback needed
    throw new StorageWriteError(
      error?.name === "QuotaExceededError" ? "本地存储空间已满，未能保存数据" : "写入本地存储失败"
    );
  }

  try {
    s.setItem(STORAGE_KEYS.meta, nextMeta);
  } catch (error: any) {
    // meta write failed but books already written — rollback books
    try {
      s.setItem(STORAGE_KEYS.books, prevBooks);
    } catch {
      console.error("Storage rollback failed — books and meta may be inconsistent");
    }
    throw new StorageWriteError(
      error?.name === "QuotaExceededError" ? "本地存储空间已满，未能保存数据" : "写入本地存储失败"
    );
  }
}
