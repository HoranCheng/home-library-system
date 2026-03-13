// ── Auth state management ──
import { AUTH_TOKEN_KEY, AUTH_USER_KEY, SYNC_LAST_KEY, API_BASE } from './constants.js';

export const auth = {
  token: localStorage.getItem(AUTH_TOKEN_KEY) || null,
  user: (() => { try { return JSON.parse(localStorage.getItem(AUTH_USER_KEY)); } catch { return null; } })(),
  isLoggedIn() { return !!this.token && !!this.user; },
  setSession(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  },
  clear() {
    this.token = null;
    this.user = null;
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(SYNC_LAST_KEY);
  },
};

// API helper with auth header
export async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`;
  const resp = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${resp.status}`);
  }
  return resp.json();
}

export async function authRegister(email, password, displayName) {
  const data = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, display_name: displayName })
  });
  auth.setSession(data.token, data.user);
  return data;
}

export async function authLogin(email, password) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  auth.setSession(data.token, data.user);
  return data;
}

export function authLogout() {
  auth.clear();
}
