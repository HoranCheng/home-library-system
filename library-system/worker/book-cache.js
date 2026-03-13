/**
 * Community book metadata cache
 * 
 * When a user saves a book, its metadata is cached in D1.
 * Other users looking up the same ISBN get an instant hit.
 * 
 * DB table:
 *   CREATE TABLE IF NOT EXISTS book_cache (
 *     isbn TEXT PRIMARY KEY,
 *     title TEXT NOT NULL,
 *     author TEXT DEFAULT '',
 *     category TEXT DEFAULT '',
 *     published_year TEXT DEFAULT '',
 *     book_lang TEXT DEFAULT '',
 *     cover_url TEXT DEFAULT '',
 *     description TEXT DEFAULT '',
 *     metadata_sources TEXT DEFAULT '[]',
 *     contributed_by TEXT DEFAULT 'anonymous',
 *     created_at TEXT NOT NULL,
 *     updated_at TEXT NOT NULL,
 *     hit_count INTEGER DEFAULT 0
 *   );
 */

export async function handleBookCache(request, env, path, corsHeaders) {
  const respond = (data, status = 200) => new Response(
    JSON.stringify(data),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );

  // ── GET /cache/:isbn — public lookup ──
  const lookupMatch = path.match(/^\/cache\/(\d{10}|\d{13})$/);
  if (lookupMatch && request.method === 'GET') {
    const isbn = lookupMatch[1];
    
    const cached = await env.DB.prepare(
      'SELECT * FROM book_cache WHERE isbn = ?'
    ).bind(isbn).first();

    if (!cached) {
      return respond({ found: false }, 404);
    }

    // Increment hit count (non-blocking)
    env.DB.prepare('UPDATE book_cache SET hit_count = hit_count + 1 WHERE isbn = ?').bind(isbn).run();

    return respond({
      found: true,
      book: {
        isbn: cached.isbn,
        title: cached.title,
        author: cached.author,
        category: cached.category,
        publishedYear: cached.published_year,
        bookLang: cached.book_lang,
        coverUrl: cached.cover_url,
        description: cached.description,
        metadataSources: JSON.parse(cached.metadata_sources || '[]'),
      }
    });
  }

  // ── POST /cache/contribute — save a book to community cache ──
  if (path === '/cache/contribute' && request.method === 'POST') {
    try {
      const body = await request.json();
      const isbn = String(body.isbn || '').replace(/[^0-9Xx]/g, '');
      
      if (!isbn || (isbn.length !== 10 && isbn.length !== 13)) {
        return respond({ error: 'INVALID_ISBN' }, 400);
      }

      if (!body.title?.trim()) {
        return respond({ error: 'TITLE_REQUIRED' }, 400);
      }

      const now = new Date().toISOString();
      
      // Upsert: only update if the new data has more fields filled
      const existing = await env.DB.prepare('SELECT * FROM book_cache WHERE isbn = ?').bind(isbn).first();
      
      if (existing) {
        // Count filled fields to decide if update is worthwhile
        const existingScore = [existing.title, existing.author, existing.category, existing.published_year, existing.book_lang, existing.cover_url, existing.description]
          .filter(v => v && v.trim()).length;
        const newScore = [body.title, body.author, body.category, body.publishedYear, body.bookLang, body.coverUrl, body.description]
          .filter(v => v && String(v).trim()).length;
        
        if (newScore <= existingScore) {
          return respond({ ok: true, action: 'skip', message: 'Existing entry has equal or better data' });
        }

        await env.DB.prepare(
          `UPDATE book_cache SET title=?, author=?, category=?, published_year=?, book_lang=?, cover_url=?, description=?, metadata_sources=?, updated_at=? WHERE isbn=?`
        ).bind(
          body.title.trim().slice(0, 500),
          (body.author || '').trim().slice(0, 300),
          (body.category || '').trim().slice(0, 100),
          (body.publishedYear || '').toString().slice(0, 10),
          (body.bookLang || '').trim().slice(0, 10),
          (body.coverUrl || '').trim().slice(0, 1000),
          (body.description || '').trim().slice(0, 2000),
          JSON.stringify((body.metadataSources || []).slice(0, 10)),
          now,
          isbn
        ).run();

        return respond({ ok: true, action: 'updated' });
      }

      // Insert new
      await env.DB.prepare(
        `INSERT INTO book_cache (isbn, title, author, category, published_year, book_lang, cover_url, description, metadata_sources, contributed_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        isbn,
        body.title.trim().slice(0, 500),
        (body.author || '').trim().slice(0, 300),
        (body.category || '').trim().slice(0, 100),
        (body.publishedYear || '').toString().slice(0, 10),
        (body.bookLang || '').trim().slice(0, 10),
        (body.coverUrl || '').trim().slice(0, 1000),
        (body.description || '').trim().slice(0, 2000),
        JSON.stringify((body.metadataSources || []).slice(0, 10)),
        'community',
        now, now
      ).run();

      return respond({ ok: true, action: 'created' });
    } catch (e) {
      return respond({ error: 'INVALID_BODY', message: e.message }, 400);
    }
  }

  // ── GET /cache/stats — public stats ──
  if (path === '/cache/stats' && request.method === 'GET') {
    const count = await env.DB.prepare('SELECT COUNT(*) as count FROM book_cache').first();
    return respond({ totalBooks: count?.count || 0 });
  }

  return respond({ error: 'NOT_FOUND' }, 404);
}
