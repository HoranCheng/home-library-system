/**
 * Worker 中间件：JWT 认证 + 速率限制
 */

import { verifyJwt } from './crypto.js';

/** 从 Authorization header 提取并验证 JWT */
export async function authenticate(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;

  const token = auth.slice(7);
  const payload = await verifyJwt(token, env.JWT_SECRET);
  return payload; // null if invalid/expired
}

/** 要求认证的中间件包装器 — returns Response (error) or user object */
export async function requireAuth(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    // Note: CORS headers are added by withCors() in the main handler
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED', message: '请先登录' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return user;
}

/**
 * 简易速率限制（基于 IP，使用 D1 做计数）
 * 生产环境建议用 Cloudflare Rate Limiting 规则替代
 */
export async function checkRateLimit(request, env, { key, limit = 5, windowSec = 60 } = {}) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateKey = `${key}:${ip}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - windowSec;

  try {
    // Clean old entries and count recent
    await env.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(now).run();

    const result = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM rate_limits WHERE key = ? AND created_at > ?'
    ).bind(rateKey, windowStart).first();

    if (result && result.count >= limit) {
      return new Response(JSON.stringify({
        error: 'RATE_LIMITED',
        message: `请求过于频繁，请 ${windowSec} 秒后再试`,
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(windowSec),
        },
      });
    }

    // Record this attempt
    await env.DB.prepare(
      'INSERT INTO rate_limits (key, created_at, expires_at) VALUES (?, ?, ?)'
    ).bind(rateKey, now, now + windowSec).run();

    return null; // Not limited
  } catch {
    // If rate limit table doesn't exist or errors, allow through
    return null;
  }
}
