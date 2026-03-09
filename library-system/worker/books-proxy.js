/**
 * 毛毛图书管理系统 — Google Books API 代理
 * 部署到 Cloudflare Workers，API Key 安全存在 Worker 环境变量里
 *
 * 环境变量：
 *   GBOOKS_API_KEY — 你的 Google Books API Key
 *
 * 用法：
 *   GET https://your-worker.workers.dev/?q=isbn:9787108056184&maxResults=5
 *   Worker 会把请求转发到 Google Books API 并附上你的 key
 */

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

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    const searchParams = new URLSearchParams(url.search);

    // Must have a query
    if (!searchParams.has('q')) {
      return new Response(JSON.stringify({ error: 'Missing ?q= parameter' }), {
        status: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    // Build Google Books API URL
    const gbUrl = new URL('https://www.googleapis.com/books/v1/volumes');
    for (const [key, value] of searchParams) {
      gbUrl.searchParams.set(key, value);
    }
    // Inject the secret API key
    gbUrl.searchParams.set('key', env.GBOOKS_API_KEY || '');

    try {
      const resp = await fetch(gbUrl.toString(), {
        headers: { 'User-Agent': 'MaomaoLibrary/1.0' },
      });

      const body = await resp.text();
      return new Response(body, {
        status: resp.status,
        headers: {
          ...corsHeaders(origin),
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',  // 缓存 1 小时，减少 API 调用
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Upstream request failed' }), {
        status: 502,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }
  },
};
