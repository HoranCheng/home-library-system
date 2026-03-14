/**
 * 毛毛图书管理系统 — Cloudflare Worker
 *
 * 功能：
 *   1. Google Books API 代理 (GET /?q=...)
 *   2. 用户认证 (POST /auth/*)
 *   3. 数据同步 (POST /sync/*)
 *
 * 环境变量（通过 wrangler secret put 设置）：
 *   GBOOKS_API_KEY  — Google Books API Key
 *   JWT_SECRET      — JWT 签名密钥
 *   GOOGLE_CLIENT_ID — Google OAuth Client ID
 *
 * D1 绑定：
 *   DB — maomao-library 数据库
 */

import { handleAuth } from './auth.js';
import { handleSync } from './sync.js';
import { handleShare } from './share.js';
import { handleBookCache } from './book-cache.js';
import { handleDouban } from './douban.js';
import { checkRateLimit } from './middleware.js';

/** Exact-match CORS origin allowlist (no prefix matching) */
const ALLOWED_ORIGINS = new Set([
  'https://horancheng.github.io',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8080',
]);

const DEFAULT_ORIGIN = 'https://horancheng.github.io';

/** Parse and strictly match origin against allowlist */
export function isAllowedOrigin(origin) {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    return ALLOWED_ORIGINS.has(parsed.origin);
  } catch { return false; }
}

/** Build CORS headers — shared across all routes */
export function makeCorsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin : DEFAULT_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

/** Wrap a Response to ensure it always has CORS headers */
function withCors(response, cors) {
  const newHeaders = new Headers(response.headers);
  for (const [k, v] of Object.entries(cors)) {
    newHeaders.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/** Google Books proxy: allowed query params and limits */
const GBOOKS_ALLOWED_PARAMS = new Set(['q', 'maxResults', 'langRestrict', 'printType', 'orderBy']);
const GBOOKS_MAX_RESULTS_CAP = 10;
const GBOOKS_MAX_Q_LENGTH = 200;

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const cors = makeCorsHeaders(origin);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      let response;

      // ── Auth routes: /auth/* ──
      if (path.startsWith('/auth/')) {
        response = await handleAuth(request, env, path, cors);
        return withCors(response, cors);
      }

      // ── Sync routes: /sync/* ──
      if (path.startsWith('/sync/')) {
        const limited = await checkRateLimit(request, env, { key: 'sync-route', limit: 120, windowSec: 60 });
        if (limited) return withCors(limited, cors);
        response = await handleSync(request, env, path, cors);
        return withCors(response, cors);
      }

      // ── Share routes: /share/* ──
      if (path.startsWith('/share/')) {
        const limited = await checkRateLimit(request, env, { key: path.startsWith('/share/') && request.method === 'GET' ? 'share-read' : 'share-write', limit: request.method === 'GET' ? 120 : 20, windowSec: 60 });
        if (limited) return withCors(limited, cors);
        response = await handleShare(request, env, path, cors);
        return withCors(response, cors);
      }

      // ── Douban route: GET /douban/:isbn ──
      if (request.method === 'GET' && path.startsWith('/douban/')) {
        const isbn = path.split('/douban/')[1]?.replace(/[^0-9Xx]/g, '') || '';
        if (!isbn || (isbn.length !== 10 && isbn.length !== 13)) {
          return new Response(JSON.stringify({ error: 'Invalid ISBN' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
        }
        const limited = await checkRateLimit(request, env, { key: 'douban-proxy', limit: 20, windowSec: 60 });
        if (limited) return withCors(limited, cors);
        response = await handleDouban(request, env, isbn, cors);
        return withCors(response, cors);
      }

      // ── Book cache routes: /cache/* ──
      if (path.startsWith('/cache/')) {
        if (request.method !== 'GET') {
          const limited = await checkRateLimit(request, env, { key: 'book-cache-write', limit: 30, windowSec: 60 });
          if (limited) return withCors(limited, cors);
        }
        response = await handleBookCache(request, env, path, cors);
        return withCors(response, cors);
      }

      // ── Feedback route: /feedback ──
      if (path === '/feedback' && request.method === 'POST') {
        const limited = await checkRateLimit(request, env, { key: 'feedback-write', limit: 10, windowSec: 60 });
        if (limited) return withCors(limited, cors);
        const body = await request.json();
        const message = String(body?.message || '').trim();
        if (!message) {
          return new Response(JSON.stringify({ error: 'MESSAGE_REQUIRED' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
        }
        try {
          const now = new Date().toISOString();
          await env.DB.prepare('INSERT INTO feedback (message, user_agent, book_count, created_at) VALUES (?, ?, ?, ?)')
            .bind(message.slice(0, 2000), String(body?.userAgent || '').slice(0, 500), Number(body?.bookCount || 0), now)
            .run();
          return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
        } catch (err) {
          return new Response(JSON.stringify({ error: 'FEEDBACK_NOT_CONFIGURED', message: 'feedback table missing' }), { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } });
        }
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Internal server error' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // ── Cover image proxy: GET /cover/:isbn ──
    if (request.method === 'GET' && path.startsWith('/cover/')) {
      const isbn = path.split('/cover/')[1]?.replace(/[^0-9Xx]/g, '') || '';
      if (!isbn || (isbn.length !== 10 && isbn.length !== 13)) {
        return new Response(JSON.stringify({ error: 'Invalid ISBN' }), {
          status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      // Rate limit covers
      const coverLimited = await checkRateLimit(request, env, { key: 'cover-proxy', limit: 60, windowSec: 60 });
      if (coverLimited) return withCors(coverLimited, cors);

      // Check Cloudflare Cache API first
      const cacheKey = new Request(`${url.origin}/cover/${isbn}`, request);
      const cache = caches.default;
      let cached = await cache.match(cacheKey);
      if (cached) return withCors(cached, cors);

      let imageResponse = null;

      // 1) Open Library
      try {
        const olResp = await fetch(`https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`, { headers: { 'User-Agent': 'MaomaoLibrary/1.0' } });
        if (olResp.ok && (olResp.headers.get('content-type') || '').startsWith('image/')) {
          const buf = await olResp.arrayBuffer();
          if (buf.byteLength > 1000) {
            imageResponse = new Response(buf, { status: 200, headers: { 'Content-Type': olResp.headers.get('content-type') || 'image/jpeg' } });
          }
        }
      } catch {}

      // 2) Google Books thumbnail fallback
      if (!imageResponse) {
        try {
          const gbUrl = new URL('https://www.googleapis.com/books/v1/volumes');
          gbUrl.searchParams.set('q', `isbn:${isbn}`);
          gbUrl.searchParams.set('maxResults', '3');
          if (env.GBOOKS_API_KEY) gbUrl.searchParams.set('key', env.GBOOKS_API_KEY);
          const gbResp = await fetch(gbUrl.toString(), { headers: { 'User-Agent': 'MaomaoLibrary/1.0' } });
          if (gbResp.ok) {
            const gbData = await gbResp.json();
            const items = Array.isArray(gbData?.items) ? gbData.items : [];
            for (const item of items) {
              const thumb = item?.volumeInfo?.imageLinks?.thumbnail || item?.volumeInfo?.imageLinks?.smallThumbnail || '';
              const normalized = String(thumb).replace(/^http:/, 'https:').replace('&edge=curl', '').replace('zoom=1', 'zoom=2');
              if (!normalized) continue;
              const imgResp = await fetch(normalized, { headers: { 'User-Agent': 'MaomaoLibrary/1.0' } });
              if (imgResp.ok && (imgResp.headers.get('content-type') || '').startsWith('image/')) {
                imageResponse = imgResp;
                break;
              }
            }
          }
        } catch {}
      }

      // 3) Bookcover API
      if (!imageResponse) {
        try {
          const srcResp = await fetch(`https://bookcover.longitood.com/bookcover/${isbn}`, { headers: { 'User-Agent': 'MaomaoLibrary/1.0' } });
          if (srcResp.ok) {
            const data = await srcResp.json();
            const coverUrl = data?.url;
            if (coverUrl && coverUrl.startsWith('http')) {
              const imgResp = await fetch(coverUrl, { headers: { 'User-Agent': 'MaomaoLibrary/1.0' } });
              if (imgResp.ok && (imgResp.headers.get('content-type') || '').startsWith('image/')) {
                imageResponse = imgResp;
              }
            }
          }
        } catch {}
      }

      if (!imageResponse) {
        return new Response(JSON.stringify({ error: 'Cover not found' }), {
          status: 404, headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      // Build cached response (7 days)
      const coverResponse = new Response(imageResponse.body, {
        status: 200,
        headers: {
          ...cors,
          'Content-Type': imageResponse.headers.get('content-type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=604800',
        },
      });

      // Store in CF cache (non-blocking via ctx.waitUntil)
      if (ctx && ctx.waitUntil) {
        ctx.waitUntil(cache.put(cacheKey, coverResponse.clone()));
      } else {
        cache.put(cacheKey, coverResponse.clone()).catch(() => {});
      }

      return coverResponse;
    }

    // ── Google Books proxy: GET / ──
    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Rate limit the proxy
    const proxyLimited = await checkRateLimit(request, env, { key: 'books-proxy', limit: 30, windowSec: 60 });
    if (proxyLimited) return withCors(proxyLimited, cors);

    const searchParams = new URLSearchParams(url.search);

    if (!searchParams.has('q')) {
      return new Response(JSON.stringify({ error: 'Missing ?q= parameter' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Validate & sanitize query
    const q = searchParams.get('q') || '';
    if (q.length > GBOOKS_MAX_Q_LENGTH) {
      return new Response(JSON.stringify({ error: 'Query too long', message: `查询最长 ${GBOOKS_MAX_Q_LENGTH} 字符` }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Build Google Books API URL with param whitelist
    const gbUrl = new URL('https://www.googleapis.com/books/v1/volumes');
    for (const [key, value] of searchParams) {
      if (!GBOOKS_ALLOWED_PARAMS.has(key)) continue; // Skip unknown params
      if (key === 'maxResults') {
        gbUrl.searchParams.set(key, String(Math.min(Math.max(1, parseInt(value) || 5), GBOOKS_MAX_RESULTS_CAP)));
      } else {
        gbUrl.searchParams.set(key, value);
      }
    }
    // Enforce maxResults if not set
    if (!gbUrl.searchParams.has('maxResults')) {
      gbUrl.searchParams.set('maxResults', '5');
    }
    gbUrl.searchParams.set('key', env.GBOOKS_API_KEY || '');

    // Determine cache TTL: ISBN queries get longer cache
    const isIsbnQuery = /^isbn:\d/.test(q);
    const cacheTtl = isIsbnQuery ? 86400 : 3600; // 24h for ISBN, 1h for text

    try {
      const resp = await fetch(gbUrl.toString(), {
        headers: { 'User-Agent': 'MaomaoLibrary/1.0' },
      });

      const body = await resp.text();
      return new Response(body, {
        status: resp.status,
        headers: {
          ...cors,
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${cacheTtl}`,
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Upstream request failed' }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
  },
};
