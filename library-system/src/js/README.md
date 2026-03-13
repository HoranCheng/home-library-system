# Module Structure Plan

## Extraction Order (from most independent to most coupled)

### Phase A — Pure utilities (no DOM, no side effects)
- [x] `constants.js` — All keys, colors, config values
- [x] `utils.js` — escapeHtml, makeId, ISBN conversion, pinyin, sorting, shuffle, fetchWithTimeout
- [x] `storage.js` — loadBooks, saveBooks, loadMeta, backup tracking

### Phase B — Business logic (DOM-aware but extractable)  
- [ ] `auth.js` — Auth state, login/register/logout, JWT management
- [ ] `sync.js` — SyncManager class, push/pull/merge
- [ ] `api.js` — fillBookMetaByIsbn, parseGoogleBooks, parseOpenLibrary, mergeResults, translateCategory
- [ ] `scanner.js` — BarcodeDetector, zxing fallback, pickBestCamera, ROI canvas, torch

### Phase C — UI components (tightly coupled to DOM)
- [ ] `render.js` — Main render(), dashboard, bookshelf, search, organize, settings
- [ ] `entry.js` — Entry form, clearDraftFields, saveBook, duplicate modal, success modal
- [ ] `detail.js` — Book detail modal, edit flow
- [ ] `wander.js` — Wander carousel, renderWander, navigation, favorites
- [ ] `nav.js` — Ghost nav, FAB, alpha scrubber, page routing

### Phase D — Entry point
- [ ] `main.js` — Wire everything together, init, event listeners, migrations

## Migration Strategy
1. Extract module → add `export` to functions
2. In index.html, add `<script type="module" src="./js/main.js"></script>`  
3. main.js imports and re-exports to window.* for backward compat during migration
4. Gradually remove inline `<script>` content
5. Once fully migrated, remove old inline code
6. Update Vite config, build, test
