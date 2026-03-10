/**
 * 认证路由处理器
 * POST /auth/register  — 邮箱密码注册
 * POST /auth/login     — 邮箱密码登录
 * POST /auth/google    — Google ID Token 登录
 * GET  /auth/me        — 获取当前用户信息
 */

import {
  generateSalt, hashPassword, verifyPassword,
  signJwt, verifyGoogleIdToken, generateUUID
} from './crypto.js';
import { requireAuth, checkRateLimit } from './middleware.js';

// 密码规则
const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_REGEX = /^(?=.*[a-zA-Z])(?=.*\d).+$/;

/** 校验邮箱格式 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** 从用户行中剔除敏感字段 */
function sanitizeUser(row) {
  if (!row) return null;
  const { password_hash, password_salt, hash_iterations, ...safe } = row;
  return safe;
}

/** 处理认证请求 */
export async function handleAuth(request, env, path, corsHeaders) {
  const respond = (data, status = 200) => new Response(
    JSON.stringify(data),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );

  // ── POST /auth/register ──
  if (path === '/auth/register' && request.method === 'POST') {
    // 速率限制
    const limited = await checkRateLimit(request, env, { key: 'register', limit: 5, windowSec: 300 });
    if (limited) return limited;

    let body;
    try { body = await request.json(); } catch {
      return respond({ error: 'INVALID_JSON', message: '请求格式错误' }, 400);
    }

    const { email, password, displayName } = body || {};

    // 校验
    if (!email || !isValidEmail(email)) {
      return respond({ error: 'INVALID_EMAIL', message: '请输入有效的邮箱地址' }, 400);
    }
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      return respond({ error: 'WEAK_PASSWORD', message: `密码至少 ${MIN_PASSWORD_LENGTH} 位` }, 400);
    }
    if (!PASSWORD_REGEX.test(password)) {
      return respond({ error: 'WEAK_PASSWORD', message: '密码需包含字母和数字' }, 400);
    }

    // 检查邮箱是否已注册
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase()).first();
    if (existing) {
      return respond({ error: 'EMAIL_EXISTS', message: '该邮箱已注册' }, 409);
    }

    // 创建用户
    const id = generateUUID();
    const salt = generateSalt();
    const hash = await hashPassword(password, salt);
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO users (id, email, display_name, password_hash, password_salt, hash_iterations, created_at, updated_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, email.toLowerCase(), displayName || '', hash, salt, 600000, now, now, now).run();

    // 初始化同步元数据
    await env.DB.prepare(
      'INSERT INTO sync_meta (user_id, schema_version, last_sync_at) VALUES (?, 1, ?)'
    ).bind(id, now).run();

    const token = await signJwt({ sub: id, email: email.toLowerCase() }, env.JWT_SECRET);
    const user = { id, email: email.toLowerCase(), display_name: displayName || '', avatar_url: '' };

    return respond({ token, user });
  }

  // ── POST /auth/login ──
  if (path === '/auth/login' && request.method === 'POST') {
    const limited = await checkRateLimit(request, env, { key: 'login', limit: 10, windowSec: 60 });
    if (limited) return limited;

    let body;
    try { body = await request.json(); } catch {
      return respond({ error: 'INVALID_JSON', message: '请求格式错误' }, 400);
    }

    const { email, password } = body || {};
    if (!email || !password) {
      return respond({ error: 'MISSING_FIELDS', message: '请输入邮箱和密码' }, 400);
    }

    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE email = ? AND is_active = 1'
    ).bind(email.toLowerCase()).first();

    if (!user || !user.password_hash) {
      return respond({ error: 'INVALID_CREDENTIALS', message: '邮箱或密码错误' }, 401);
    }

    const valid = await verifyPassword(password, user.password_hash, user.password_salt, user.hash_iterations);
    if (!valid) {
      return respond({ error: 'INVALID_CREDENTIALS', message: '邮箱或密码错误' }, 401);
    }

    // 更新登录时间
    await env.DB.prepare(
      'UPDATE users SET last_login_at = ? WHERE id = ?'
    ).bind(new Date().toISOString(), user.id).run();

    const token = await signJwt({ sub: user.id, email: user.email }, env.JWT_SECRET);
    return respond({ token, user: sanitizeUser(user) });
  }

  // ── POST /auth/google ──
  if (path === '/auth/google' && request.method === 'POST') {
    const limited = await checkRateLimit(request, env, { key: 'google-auth', limit: 10, windowSec: 60 });
    if (limited) return limited;

    let body;
    try { body = await request.json(); } catch {
      return respond({ error: 'INVALID_JSON', message: '请求格式错误' }, 400);
    }

    const { idToken } = body || {};
    if (!idToken) {
      return respond({ error: 'MISSING_TOKEN', message: '缺少 Google ID Token' }, 400);
    }

    // 验证 Google ID Token
    const googlePayload = await verifyGoogleIdToken(idToken, env.GOOGLE_CLIENT_ID);
    if (!googlePayload) {
      return respond({ error: 'INVALID_TOKEN', message: 'Google 验证失败' }, 401);
    }

    const { sub: googleSub, email: googleEmail, name: googleName, picture } = googlePayload;

    // 查找已有用户（通过 google_sub）
    let user = await env.DB.prepare('SELECT * FROM users WHERE google_sub = ?').bind(googleSub).first();

    if (!user) {
      // 检查是否有同邮箱的平台账号 → 关联
      if (googleEmail) {
        user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(googleEmail.toLowerCase()).first();
        if (user) {
          // 关联 Google 账号到已有平台账号
          await env.DB.prepare(
            'UPDATE users SET google_sub = ?, google_email = ?, avatar_url = COALESCE(NULLIF(avatar_url, ""), ?), updated_at = ? WHERE id = ?'
          ).bind(googleSub, googleEmail, picture || '', new Date().toISOString(), user.id).run();
          user.google_sub = googleSub;
        }
      }
    }

    if (!user) {
      // 创建新用户
      const id = generateUUID();
      const now = new Date().toISOString();
      await env.DB.prepare(
        `INSERT INTO users (id, email, display_name, avatar_url, google_sub, google_email, created_at, updated_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, googleEmail ? googleEmail.toLowerCase() : null, googleName || '', picture || '', googleSub, googleEmail || '', now, now, now).run();

      await env.DB.prepare(
        'INSERT INTO sync_meta (user_id, schema_version, last_sync_at) VALUES (?, 1, ?)'
      ).bind(id, now).run();

      user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
    }

    // 更新登录时间
    await env.DB.prepare(
      'UPDATE users SET last_login_at = ? WHERE id = ?'
    ).bind(new Date().toISOString(), user.id).run();

    const token = await signJwt({ sub: user.id, email: user.email }, env.JWT_SECRET);
    return respond({ token, user: sanitizeUser(user) });
  }

  // ── GET /auth/me ──
  if (path === '/auth/me' && request.method === 'GET') {
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) return authResult;

    const user = await env.DB.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').bind(authResult.sub).first();
    if (!user) {
      return respond({ error: 'USER_NOT_FOUND', message: '用户不存在' }, 404);
    }

    return respond({ user: sanitizeUser(user) });
  }

  return respond({ error: 'NOT_FOUND', message: '未知的认证端点' }, 404);
}
