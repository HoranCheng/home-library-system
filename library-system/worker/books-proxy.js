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
  async fetch(request, env) {
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
        response = await handleSync(request, env, path, cors);
        return withCors(response, cors);
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Internal server error' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // ── Google Books proxy: GET / ──
    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Rate limit the proxy
    const { checkRateLimit } = await import('./middleware.js');
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
