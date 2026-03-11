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

const ALLOWED_ORIGINS = [
  'https://horancheng.github.io',
  'https://horancheng.github.io/',
  'http://localhost',
  'http://127.0.0.1',
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));
}

function makeCorsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

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
      // ── Auth routes: /auth/* ──
      if (path.startsWith('/auth/')) {
        return await handleAuth(request, env, path, cors);
      }

      // ── Sync routes: /sync/* ──
      if (path.startsWith('/sync/')) {
        return await handleSync(request, env, path, cors);
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: 'INTERNAL_ERROR', message: err.message || 'Internal server error' }), {
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

    const searchParams = new URLSearchParams(url.search);

    if (!searchParams.has('q')) {
      return new Response(JSON.stringify({ error: 'Missing ?q= parameter' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Build Google Books API URL
    const gbUrl = new URL('https://www.googleapis.com/books/v1/volumes');
    for (const [key, value] of searchParams) {
      gbUrl.searchParams.set(key, value);
    }
    gbUrl.searchParams.set('key', env.GBOOKS_API_KEY || '');

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
          'Cache-Control': 'public, max-age=3600',
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
