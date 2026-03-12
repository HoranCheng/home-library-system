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

    const { books = [], locationPresets } = body;
    let accepted = 0;
    const conflicts = [];
    const now = new Date().toISOString();

    // Upsert books
    for (const book of books) {
      if (!book.id) continue;

      const existing = await env.DB.prepare(
        'SELECT updated_at FROM books WHERE id = ? AND user_id = ?'
      ).bind(book.id, userId).first();

      if (existing && existing.updated_at > (book.updatedAt || '')) {
        // Server version is newer — conflict
        conflicts.push({ id: book.id, serverUpdatedAt: existing.updated_at });
        continue;
      }

      const row = bookToRow(book, userId);

      if (existing) {
        await env.DB.prepare(
          `UPDATE books SET isbn=?, title=?, author=?, category=?, reading_status=?, reading_progress=?,
           published_year=?, location=?, description=?, notes=?, book_lang=?, cover_url=?,
           metadata_sources=?, status=?, created_at=?, updated_at=?, is_deleted=?, favorite=?
           WHERE id=? AND user_id=?`
        ).bind(
          row.isbn, row.title, row.author, row.category, row.reading_status, row.reading_progress,
          row.published_year, row.location, row.description, row.notes, row.book_lang, row.cover_url,
          row.metadata_sources, row.status, row.created_at, row.updated_at, row.is_deleted, row.favorite,
          row.id, userId
        ).run();
      } else {
        await env.DB.prepare(
          `INSERT INTO books (id, user_id, isbn, title, author, category, reading_status, reading_progress,
           published_year, location, description, notes, book_lang, cover_url, metadata_sources, status,
           created_at, updated_at, is_deleted, favorite)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          row.id, userId, row.isbn, row.title, row.author, row.category, row.reading_status, row.reading_progress,
          row.published_year, row.location, row.description, row.notes, row.book_lang, row.cover_url,
          row.metadata_sources, row.status, row.created_at, row.updated_at, row.is_deleted, row.favorite
        ).run();
      }
      accepted++;
    }

    // Sync location presets (replace all)
    if (Array.isArray(locationPresets)) {
      await env.DB.prepare('DELETE FROM location_presets WHERE user_id = ?').bind(userId).run();
      for (let i = 0; i < locationPresets.length; i++) {
        await env.DB.prepare(
          'INSERT INTO location_presets (user_id, value, sort_order) VALUES (?, ?, ?)'
        ).bind(userId, locationPresets[i], i).run();
      }
    }

    // Update sync meta
    await env.DB.prepare(
      `INSERT INTO sync_meta (user_id, last_sync_at) VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET last_sync_at = ?`
    ).bind(userId, now, now).run();

    return respond({ accepted, conflicts, serverUpdatedAt: now });
  }

  // ── POST /sync/pull ──
  if (path === '/sync/pull' && request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch {
      body = {};
    }

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

    // Location presets
    const presetsResult = await env.DB.prepare(
      'SELECT value FROM location_presets WHERE user_id = ? ORDER BY sort_order ASC'
    ).bind(userId).all();
    const locationPresets = presetsResult.results.map(r => r.value);

    const now = new Date().toISOString();
    return respond({ books, locationPresets, syncedAt: now });
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
