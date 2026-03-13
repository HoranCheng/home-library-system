// ── Sync Manager ──
import { SYNC_LAST_KEY } from './constants.js';
import { loadBooks, loadActiveBooks, saveBooks, loadMeta } from './storage.js';
import { auth, apiFetch } from './auth.js';

export class SyncManager {
  constructor() {
    this._pushTimer = null;
    this._pushing = false;
    this._status = 'idle'; // idle | synced | syncing | error
    this._onStatusChange = null;
  }

  setStatusCallback(fn) { this._onStatusChange = fn; }

  _updateUI(status) {
    this._status = status;
    if (this._onStatusChange) this._onStatusChange(status);
  }

  schedulePush(delayMs = 3000) {
    if (!auth.isLoggedIn()) return;
    clearTimeout(this._pushTimer);
    this._pushTimer = setTimeout(() => this.push(), delayMs);
  }

  async push() {
    if (!auth.isLoggedIn() || this._pushing) return;
    this._pushing = true;
    this._updateUI('syncing');
    try {
      const books = loadBooks();
      const meta = loadMeta();
      const lastSync = localStorage.getItem(SYNC_LAST_KEY) || '1970-01-01T00:00:00.000Z';

      // Only send books modified since last sync
      const changed = books.filter(b => String(b.updatedAt || '') > lastSync);
      if (changed.length === 0) {
        this._updateUI('synced');
        this._pushing = false;
        return;
      }

      const data = await apiFetch('/sync/push', {
        method: 'POST',
        body: JSON.stringify({ books: changed, meta })
      });

      localStorage.setItem(SYNC_LAST_KEY, new Date().toISOString());
      this._updateUI('synced');
    } catch (e) {
      console.warn('Sync push failed:', e);
      this._updateUI('error');
    }
    this._pushing = false;
  }

  async pull() {
    if (!auth.isLoggedIn()) return;
    this._updateUI('syncing');
    try {
      const lastSync = localStorage.getItem(SYNC_LAST_KEY) || '1970-01-01T00:00:00.000Z';
      const data = await apiFetch('/sync/pull', {
        method: 'POST',
        body: JSON.stringify({ since: lastSync })
      });

      if (data.books && data.books.length > 0) {
        const localBooks = loadBooks();
        const localMap = new Map(localBooks.map(b => [b.id, b]));

        for (const remote of data.books) {
          const local = localMap.get(remote.id);
          if (!local || String(remote.updatedAt || '') > String(local.updatedAt || '')) {
            localMap.set(remote.id, remote);
          }
        }

        saveBooks([...localMap.values()]);
      }

      localStorage.setItem(SYNC_LAST_KEY, new Date().toISOString());
      this._updateUI('synced');
      return data.books?.length || 0;
    } catch (e) {
      console.warn('Sync pull failed:', e);
      this._updateUI('error');
      return 0;
    }
  }

  async fullSync() {
    await this.pull();
    await this.push();
  }

  get status() { return this._status; }
}
