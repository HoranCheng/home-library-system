// ── Data storage layer ──
import { BOOKS_KEY, META_KEY, LOCATION_PRESETS_KEY, EXPORT_LAST_KEY, EXPORT_BOOK_COUNT_KEY } from './constants.js';

export function loadBooks() {
  try { return JSON.parse(localStorage.getItem(BOOKS_KEY) || '[]'); }
  catch { return []; }
}

export function loadActiveBooks() {
  return loadBooks().filter(b => !b._deleted);
}

export function loadMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY) || '{"schemaVersion":1,"updatedAt":"1970-01-01T00:00:00.000Z"}'); }
  catch { return { schemaVersion: 1, updatedAt: new Date(0).toISOString() }; }
}

export function saveBooks(books, syncManager = null) {
  const meta = { ...loadMeta(), schemaVersion: 1, updatedAt: new Date().toISOString() };
  localStorage.setItem(BOOKS_KEY, JSON.stringify(books));
  localStorage.setItem(META_KEY, JSON.stringify(meta));
  if (syncManager) syncManager.schedulePush();
}

export function loadLocationPresets() {
  try { return JSON.parse(localStorage.getItem(LOCATION_PRESETS_KEY) || '[]'); }
  catch { return []; }
}

export function rememberLocationPreset(value) {
  const v = String(value || '').trim();
  if (!v) return;
  const next = [v, ...loadLocationPresets().filter(item => item !== v)].slice(0, 8);
  localStorage.setItem(LOCATION_PRESETS_KEY, JSON.stringify(next));
}

// ── Backup tracking ──
export function recordExport(bookCount) {
  localStorage.setItem(EXPORT_LAST_KEY, new Date().toISOString());
  localStorage.setItem(EXPORT_BOOK_COUNT_KEY, String(bookCount));
}

export function getBackupStatus() {
  const lastExport = localStorage.getItem(EXPORT_LAST_KEY);
  const lastCount = parseInt(localStorage.getItem(EXPORT_BOOK_COUNT_KEY) || '0', 10);
  const currentCount = loadActiveBooks().length;
  const newSinceExport = currentCount - lastCount;
  const daysSinceExport = lastExport ? Math.floor((Date.now() - new Date(lastExport).getTime()) / 86400000) : null;
  return { lastExport, lastCount, currentCount, newSinceExport, daysSinceExport };
}
