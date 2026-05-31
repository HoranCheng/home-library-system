/**
 * 同步路由处理器
 * POST /sync/push   — 推送本地变更到云端
 * POST /sync/pull   — 拉取云端数据到本地
 * GET  /sync/status — 获取同步状态
 */

import { requireAuth } from './middleware.js';

/** camelCase → snake_case 字段映射 */
const FIELD_MAP = {
  readingStatus: 'reading_status',
  readingProgress: 'reading_progress',
  publishedYear: 'published_year',
  bookLang: 'book_lang',
  coverUrl: 'cover_url',
  metadataSources: 'metadata_sources',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

const REVERSE_MAP = Object.fromEntries(Object.entries(FIELD_MAP).map(([k, v]) => [v, k]));
const MAX_BOOKS_PER_PUSH = 500;
const MAX_STATEMENTS_PER_BATCH = 40;

/** 前端 book → 数据库行 */
function bookToRow(book, userId) {
  return {
    id: book.id,
    user_id: userId,
    isbn: book.isbn || '',
    title: book.title || '',
    author: book.author || '',
    category: book.category || '',
    reading_status: book.readingStatus || '',
    reading_progress: book.readingProgress || 0,
    favorite: book.favorite ? 1 : 0,
    published_year: book.publishedYear || '',
    location: book.location || '',
    description: book.description || '',
    notes: book.notes || '',
    book_lang: book.bookLang || '',
    cover_url: book.coverUrl || '',
    metadata_sources: JSON.stringify(book.metadataSources || []),
    status: book.status || 'to_be_sorted',
    created_at: book.createdAt || new Date().toISOString(),
    updated_at: book.updatedAt || new Date().toISOString(),
    is_deleted: book._deleted ? 1 : 0,
  };
}

/** 数据库行 → 前端 book */
function rowToBook(row) {
  return {
    id: row.id,
    isbn: row.isbn,
    title: row.title,
    author: row.author,
    category: row.category,
    readingStatus: row.reading_status,
    readingProgress: row.reading_progress,
    favorite: !!row.favorite,
    publishedYear: row.published_year,
    location: row.location,
    description: row.description,
    notes: row.notes,
    bookLang: row.book_lang,
    coverUrl: row.cover_url,
    metadataSources: tryParseJson(row.metadata_sources, []),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.is_deleted ? { _deleted: true } : {}),
  };
}

function tryParseJson(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

async function runPushBatches(env, bookStatements, locationStatements, syncMetaStatement) {
  const allStatements = [...bookStatements, ...locationStatements, syncMetaStatement];
  if (allStatements.length <= MAX_STATEMENTS_PER_BATCH) {
    await env.DB.batch(allStatements);
    return;
  }

  for (let i = 0; i < bookStatements.length; i += MAX_STATEMENTS_PER_BATCH) {
    await env.DB.batch(bookStatements.slice(i, i + MAX_STATEMENTS_PER_BATCH));
  }

  if (locationStatements.length) {
    if (locationStatements.length === MAX_STATEMENTS_PER_BATCH) {
      await env.DB.batch(locationStatements);
      await env.DB.batch([syncMetaStatement]);
    } else {
      await env.DB.batch([...locationStatements, syncMetaStatement]);
    }
    return;
  }

  await env.DB.batch([syncMetaStatement]);
}

/** 处理同步请求 */
export async function handleSync(request, env, path, corsHeaders) {
  const respond = (data, status = 200) => new Response(
    JSON.stringify(data),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );

  // All sync endpoints require auth
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;
  const userId = authResult.sub;

  // ── POST /sync/push ──
  if (path === '/sync/push' && request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch {
      return respond({ error: 'INVALID_JSON', message: '请求格式错误' }, 400);
    }

    const books = Array.isArray(body?.books) ? body.books : [];
    const { locationPresets } = body || {};
    if (books.length > MAX_BOOKS_PER_PUSH) {
      return respond({ error: 'TOO_MANY_BOOKS', message: `单次最多推送 ${MAX_BOOKS_PER_PUSH} 本书，请分片上传` }, 400);
    }
    if (Array.isArray(locationPresets) && locationPresets.length + 1 > MAX_STATEMENTS_PER_BATCH) {
      return respond({ error: 'TOO_MANY_LOCATION_PRESETS', message: '位置预设过多，请减少后重试' }, 400);
    }

    try {

    let accepted = 0;
    const conflicts = [];
    const now = new Date().toISOString();
    const bookStatements = [];
    const locationStatements = [];

    const bookIds = [...new Set(books.map(book => book?.id).filter(Boolean))];
    const existingBooks = new Map();

    if (bookIds.length) {
      const placeholders = bookIds.map(() => '?').join(',');
      const result = await env.DB.prepare(
        `SELECT id, updated_at FROM books WHERE user_id = ? AND id IN (${placeholders})`
      ).bind(userId, ...bookIds).all();

      for (const row of result.results || []) {
        existingBooks.set(row.id, row.updated_at);
      }
    }

    // Upsert books
    for (const book of books) {
      if (!book.id) continue;

      const existingUpdatedAt = existingBooks.get(book.id);

      if (existingUpdatedAt && existingUpdatedAt > (book.updatedAt || '')) {
        // Server version is newer — conflict
        conflicts.push({ id: book.id, serverUpdatedAt: existingUpdatedAt });
        continue;
      }

      const row = bookToRow(book, userId);

      if (existingUpdatedAt) {
        bookStatements.push(env.DB.prepare(
          `UPDATE books SET isbn=?, title=?, author=?, category=?, reading_status=?, reading_progress=?,
           published_year=?, location=?, description=?, notes=?, book_lang=?, cover_url=?,
           metadata_sources=?, status=?, created_at=?, updated_at=?, is_deleted=?, favorite=?
           WHERE id=? AND user_id=? AND updated_at <= ?`
        ).bind(
          row.isbn, row.title, row.author, row.category, row.reading_status, row.reading_progress,
          row.published_year, row.location, row.description, row.notes, row.book_lang, row.cover_url,
          row.metadata_sources, row.status, row.created_at, row.updated_at, row.is_deleted, row.favorite,
          row.id, userId, row.updated_at
        ));
      } else {
        bookStatements.push(env.DB.prepare(
          `INSERT INTO books (id, user_id, isbn, title, author, category, reading_status, reading_progress,
           published_year, location, description, notes, book_lang, cover_url, metadata_sources, status,
           created_at, updated_at, is_deleted, favorite)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          row.id, userId, row.isbn, row.title, row.author, row.category, row.reading_status, row.reading_progress,
          row.published_year, row.location, row.description, row.notes, row.book_lang, row.cover_url,
          row.metadata_sources, row.status, row.created_at, row.updated_at, row.is_deleted, row.favorite
        ));
      }
      existingBooks.set(row.id, row.updated_at);
      accepted++;
    }

    // Sync location presets (replace all)
    if (Array.isArray(locationPresets)) {
      locationStatements.push(env.DB.prepare('DELETE FROM location_presets WHERE user_id = ?').bind(userId));
      for (let i = 0; i < locationPresets.length; i++) {
        locationStatements.push(env.DB.prepare(
          'INSERT INTO location_presets (user_id, value, sort_order) VALUES (?, ?, ?)'
        ).bind(userId, locationPresets[i], i));
      }
    }

    // Update sync meta
    const syncMetaStatement = env.DB.prepare(
      `INSERT INTO sync_meta (user_id, last_sync_at) VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET last_sync_at = ?`
    ).bind(userId, now, now);

    await runPushBatches(env, bookStatements, locationStatements, syncMetaStatement);

    return respond({ accepted, conflicts, serverUpdatedAt: now });

    } catch (err) {
      const msg = String(err?.message || err || 'unknown');
      console.error('[Sync push] DB error:', msg, err?.stack);

      if (/no such column|no such table|has no column/i.test(msg)) {
        return respond({
          error: 'SCHEMA_MISMATCH',
          message: '服务端数据库 schema 需要升级，请等待管理员处理',
          detail: msg.slice(0, 200),
        }, 500);
      }
      return respond({
        error: 'SYNC_PUSH_FAILED',
        message: '同步上传失败，本地数据已保留，可稍后重试',
        detail: msg.slice(0, 200),
      }, 500);
    }
  }

  // ── POST /sync/pull ──
  if (path === '/sync/pull' && request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch {
      body = {};
    }

    try {
      const { lastSyncAt } = body;
      let books;

      if (lastSyncAt) {
        // Incremental: books updated after lastSyncAt (including tombstones)
        const result = await env.DB.prepare(
          'SELECT * FROM books WHERE user_id = ? AND updated_at > ? ORDER BY updated_at ASC'
        ).bind(userId, lastSyncAt).all();
        books = result.results.map(rowToBook);
      } else {
        // Full pull: ALL books including tombstones (so client can reconcile deletes)
        const result = await env.DB.prepare(
          'SELECT * FROM books WHERE user_id = ? ORDER BY created_at DESC'
        ).bind(userId).all();
        books = result.results.map(rowToBook);
      }

      // Location presets — gracefully degrade if the table is missing
      let locationPresets = [];
      try {
        const presetsResult = await env.DB.prepare(
          'SELECT value FROM location_presets WHERE user_id = ? ORDER BY sort_order ASC'
        ).bind(userId).all();
        locationPresets = presetsResult.results.map(r => r.value);
      } catch (presetErr) {
        console.warn('[Sync pull] location_presets unavailable:', presetErr?.message);
        // Continue without presets — books are the critical payload
      }

      const now = new Date().toISOString();
      return respond({ books, locationPresets, syncedAt: now });
    } catch (err) {
      const msg = String(err?.message || err || 'unknown');
      console.error('[Sync pull] DB error:', msg, err?.stack);

      if (/no such column|no such table|has no column/i.test(msg)) {
        return respond({
          error: 'SCHEMA_MISMATCH',
          message: '服务端数据库 schema 需要升级，请等待管理员处理',
          detail: msg.slice(0, 200),
        }, 500);
      }
      return respond({
        error: 'SYNC_PULL_FAILED',
        message: '从云端拉取数据失败，请稍后重试',
        detail: msg.slice(0, 200),
      }, 500);
    }
  }

  // ── GET /sync/status ──
  if (path === '/sync/status' && request.method === 'GET') {
    const meta = await env.DB.prepare(
      'SELECT * FROM sync_meta WHERE user_id = ?'
    ).bind(userId).first();

    const bookCount = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM books WHERE user_id = ? AND is_deleted = 0'
    ).bind(userId).first();

    return respond({
      lastSyncAt: meta?.last_sync_at || null,
      schemaVersion: meta?.schema_version || 1,
      bookCount: bookCount?.count || 0,
    });
  }

  return respond({ error: 'NOT_FOUND', message: '未知的同步端点' }, 404);
}
