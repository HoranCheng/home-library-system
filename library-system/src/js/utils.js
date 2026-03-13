// ── Utility functions ──

export function escapeHtml(v) {
  const s = String(v ?? '');
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function makeId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `${ts}-${rand}`;
}

export function makeNotice(kind, text) {
  return `<div class="notice ${kind}">${escapeHtml(text)}</div>`;
}

export function hapticScan() {
  if (navigator.vibrate) navigator.vibrate(40);
}

export function hapticSaved() {
  if (navigator.vibrate) navigator.vibrate([50, 60, 90]);
}

export function normalizeReadingStatus(v) {
  const s = String(v || '').trim();
  return (s === '读过' || s === 'read' || s === '已读') ? '读过' : '';
}

/**
 * Fetch with AbortController timeout (default 8s)
 */
export function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// ── ISBN conversion ──

export function isbn13to10(isbn13) {
  const digits = isbn13.replace(/[^0-9]/g, '');
  if (digits.length !== 13 || !digits.startsWith('978')) return null;
  const body = digits.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (10 - i) * parseInt(body[i], 10);
  const check = (11 - (sum % 11)) % 11;
  return body + (check === 10 ? 'X' : String(check));
}

export function isbn10to13(isbn10) {
  const digits = isbn10.replace(/[^0-9Xx]/g, '');
  if (digits.length !== 10) return null;
  const body = '978' + digits.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += (i % 2 === 0 ? 1 : 3) * parseInt(body[i], 10);
  const check = (10 - (sum % 10)) % 10;
  return body + String(check);
}

// ── Pinyin ──

const PINYIN_BOUNDS = [
  ['A','啊'],['B','芭'],['C','擦'],['D','搭'],['E','蛾'],['F','发'],['G','噶'],['H','哈'],
  ['J','击'],['K','喀'],['L','垃'],['M','妈'],['N','拿'],['O','哦'],['P','啪'],['Q','期'],
  ['R','然'],['S','撒'],['T','塌'],['W','挖'],['X','昔'],['Y','压'],['Z','匝']
];

export function getPinyinInitial(ch) {
  if (/[a-zA-Z]/.test(ch)) return ch.toUpperCase();
  if (!/[\u4e00-\u9fff]/.test(ch)) return '#';
  for (let i = PINYIN_BOUNDS.length - 1; i >= 0; i--) {
    if (ch.localeCompare(PINYIN_BOUNDS[i][1], 'zh-CN') >= 0) return PINYIN_BOUNDS[i][0];
  }
  return '#';
}

export function getSortKey(title) {
  const s = String(title || '').trim();
  if (!s) return '#';
  const ch = s[0];
  if (/[a-zA-Z]/.test(ch)) return ch.toUpperCase();
  const py = getPinyinInitial(ch);
  return py || '#';
}

export function sortByTitle(arr) {
  const LETTER_ORDER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#';
  return arr.slice().sort((a, b) => {
    const ga = getSortKey(a.title), gb = getSortKey(b.title);
    const ia = LETTER_ORDER.indexOf(ga), ib = LETTER_ORDER.indexOf(gb);
    if (ia !== ib) return ia - ib;
    return String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN-u-co-pinyin');
  });
}

// ── Fisher-Yates shuffle ──
export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
