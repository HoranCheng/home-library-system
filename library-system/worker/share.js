/**
 * Public bookshelf sharing
 * 
 * POST /share/create   — Generate a share link (auth required)
 * DELETE /share/revoke  — Revoke a share link (auth required)
 * GET /share/:token     — Public: read-only bookshelf data
 * 
 * DB table needed:
 *   CREATE TABLE IF NOT EXISTS shares (
 *     token TEXT PRIMARY KEY,
 *     user_id TEXT NOT NULL,
 *     display_name TEXT DEFAULT '',
 *     created_at TEXT NOT NULL,
 *     expires_at TEXT,
 *     is_active INTEGER DEFAULT 1,
 *     view_count INTEGER DEFAULT 0
 *   );
 */

import { requireAuth } from './middleware.js';

function generateToken() {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789'; // no confusing chars
  let token = '';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (const b of bytes) token += chars[b % chars.length];
  return token;
}

export async function handleShare(request, env, path, corsHeaders) {
  const respond = (data, status = 200) => new Response(
    JSON.stringify(data),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );

  // ── POST /share/create — auth required ──
  if (path === '/share/create' && request.method === 'POST') {
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.sub;

    // Check if user already has an active share
    const existing = await env.DB.prepare(
      'SELECT token FROM shares WHERE user_id = ? AND is_active = 1'
    ).bind(userId).first();

    if (existing) {
      return respond({ token: existing.token, url: `/share/${existing.token}`, existing: true });
    }

    // Get user display name
    const user = await env.DB.prepare(
      'SELECT display_name FROM users WHERE id = ?'
    ).bind(userId).first();

    const token = generateToken();
    const now = new Date().toISOString();

    await env.DB.prepare(
      'INSERT INTO shares (token, user_id, display_name, created_at, is_active) VALUES (?, ?, ?, ?, 1)'
    ).bind(token, userId, user?.display_name || '', now).run();

    return respond({ token, url: `/share/${token}` });
  }

  // ── DELETE /share/revoke — auth required ──
  if (path === '/share/revoke' && request.method === 'DELETE') {
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.sub;

    await env.DB.prepare(
      'UPDATE shares SET is_active = 0 WHERE user_id = ? AND is_active = 1'
    ).bind(userId).run();

    return respond({ ok: true });
  }

  // ── GET /share/:token — public, no auth ──
  const shareMatch = path.match(/^\/share\/([a-z0-9]{6,12})$/);
  if (shareMatch && request.method === 'GET') {
    const token = shareMatch[1];

    const share = await env.DB.prepare(
      'SELECT * FROM shares WHERE token = ? AND is_active = 1'
    ).bind(token).first();

    if (!share) {
      return respond({ error: 'SHARE_NOT_FOUND', message: '分享链接不存在或已过期' }, 404);
    }

    // Increment view count (non-blocking)
    env.DB.prepare('UPDATE shares SET view_count = view_count + 1 WHERE token = ?').bind(token).run();

    // Fetch books (non-deleted only, public-safe fields)
    const result = await env.DB.prepare(
      `SELECT isbn, title, author, category, published_year, book_lang, cover_url, reading_status, favorite, status, created_at
       FROM books WHERE user_id = ? AND is_deleted = 0 ORDER BY created_at DESC`
    ).bind(share.user_id).all();

    const books = result.results.map(row => ({
      isbn: row.isbn,
      title: row.title,
      author: row.author,
      category: row.category,
      publishedYear: row.published_year,
      bookLang: row.book_lang,
      coverUrl: row.cover_url,
      readingStatus: row.reading_status,
      favorite: !!row.favorite,
      status: row.status,
      createdAt: row.created_at,
    }));

    return respond({
      displayName: share.display_name || '书友',
      bookCount: books.length,
      books,
      createdAt: share.created_at,
      viewCount: share.view_count + 1,
    });
  }

  return respond({ error: 'NOT_FOUND' }, 404);
}
