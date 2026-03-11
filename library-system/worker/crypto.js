/**
 * 密码哈希 + JWT 工具函数
 * 使用 Web Crypto API（Cloudflare Workers 原生支持）
 */

const ITERATIONS = 100000; // Cloudflare Workers 上限（OWASP 推荐 600k，但 Workers 运行时限制 100k）
const HASH_ALGO = 'SHA-256';
const SALT_BYTES = 16;
const HASH_BITS = 256;

// ── 密码哈希 ──

/** 生成随机盐 */
export function generateSalt() {
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  return bufToBase64(salt);
}

/** 用 PBKDF2 哈希密码 */
export async function hashPassword(password, saltB64, iterations = ITERATIONS) {
  const encoder = new TextEncoder();
  const salt = base64ToBuf(saltB64);

  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );

  const hashBuf = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: HASH_ALGO },
    keyMaterial, HASH_BITS
  );

  return bufToBase64(new Uint8Array(hashBuf));
}

/** 验证密码（timing-safe） */
export async function verifyPassword(password, storedHash, storedSalt, iterations = ITERATIONS) {
  const computed = await hashPassword(password, storedSalt, iterations);
  return timingSafeEqual(computed, storedHash);
}

/** 常量时间字符串比较 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) {
    // Still do the comparison to keep timing constant
    b = a;
  }
  let result = a.length === b.length ? 0 : 1;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ── JWT ──

const JWT_EXPIRY = 24 * 60 * 60; // 24 hours in seconds

/** 签发 JWT */
export async function signJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + JWT_EXPIRY };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );

  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  const encodedSig = bufToBase64Url(new Uint8Array(sig));

  return `${signingInput}.${encodedSig}`;
}

/** 验证并解析 JWT */
export async function verifyJwt(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, encodedSig] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );

  const sigBuf = base64UrlToBuf(encodedSig);
  const valid = await crypto.subtle.verify('HMAC', key, sigBuf, new TextEncoder().encode(signingInput));
  if (!valid) return null;

  const payload = JSON.parse(base64UrlDecode(encodedPayload));

  // Check expiry
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) return null;

  return payload;
}

// ── Google ID Token 验证 ──

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
let cachedCerts = null;
let certsExpiry = 0;

/** 获取 Google 公钥（带缓存） */
async function getGoogleCerts() {
  const now = Date.now();
  if (cachedCerts && now < certsExpiry) return cachedCerts;

  const resp = await fetch(GOOGLE_CERTS_URL);
  const jwks = await resp.json();

  // Cache for 6 hours
  cachedCerts = jwks.keys;
  certsExpiry = now + 6 * 60 * 60 * 1000;
  return cachedCerts;
}

/** 验证 Google ID Token */
export async function verifyGoogleIdToken(idToken, clientId) {
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;

  const header = JSON.parse(base64UrlDecode(parts[0]));
  const payload = JSON.parse(base64UrlDecode(parts[1]));

  // Check claims
  if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') return null;
  if (payload.aud !== clientId) return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;

  // Verify signature with Google's public key
  const certs = await getGoogleCerts();
  const cert = certs.find(k => k.kid === header.kid);
  if (!cert) return null;

  const key = await crypto.subtle.importKey(
    'jwk', cert, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
  );

  const sigBuf = base64UrlToBuf(parts[2]);
  const signingInput = `${parts[0]}.${parts[1]}`;
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', key, sigBuf, new TextEncoder().encode(signingInput)
  );

  return valid ? payload : null;
}

// ── UUID ──

export function generateUUID() {
  return crypto.randomUUID();
}

// ── Base64 工具 ──

function bufToBase64(buf) {
  let binary = '';
  for (const byte of buf) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBuf(b64) {
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf;
}

function base64UrlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

function bufToBase64Url(buf) {
  return bufToBase64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuf(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return base64ToBuf(str);
}
