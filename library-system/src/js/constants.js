// ── Storage Keys ──
export const BOOKS_KEY = 'lib:books:v1';
export const META_KEY = 'lib:meta:v1';
export const MODE_KEY = 'lib:home:mode:v1';
export const PAGE_KEY = 'lib:page:v1';
export const ENTRY_KEY = 'lib:entry:v1';
export const LOCATION_PRESETS_KEY = 'lib:location-presets:v1';
export const SORT_MODE_KEY = 'lib:sort-mode:v1';
export const AUTH_TOKEN_KEY = 'lib:auth:token:v1';
export const AUTH_USER_KEY = 'lib:auth:user:v1';
export const SYNC_LAST_KEY = 'lib:sync:last:v1';
export const EXPORT_LAST_KEY = 'lib:export:last:v1';
export const EXPORT_BOOK_COUNT_KEY = 'lib:export:count:v1';

// ── API ──
export const GBOOKS_PROXY = 'https://maomao-books-proxy.henrycdev26.workers.dev';
export const API_BASE = GBOOKS_PROXY;

// ── Category Colors ──
export const CAT_COLORS = {
  '小说': '#8B6F4E', '文学': '#7A6F62', '历史': '#6B7B5E', '哲学': '#8E7B6B',
  '科学': '#5B7B8E', '心理学': '#7B6B8E', '经济': '#6E8B7B', '社会': '#8B7B6E',
  '艺术': '#7B8B6E', '教育': '#6E7B8B', '政治': '#8B6E7B', '传记': '#7B8E6E',
  '科技': '#5E8B7B', '旅行': '#6B8E7B', '烹饪': '#8E7B5E', '健康': '#5E8B6B',
  '宗教': '#7B6E8E', '法律': '#6E7B7B', '商业': '#7B7B6E', '设计': '#8B6B7B',
  '漫画': '#6B7B8B', '童书': '#7B8B8B', '诗歌': '#8B8B6B', '戏剧': '#6B8B7B',
};

// ── Category Defaults ──
export const DEFAULT_CATS = [
  '小说', '文学', '历史', '哲学', '科学', '心理学', '经济', '社会',
  '艺术', '教育', '传记', '科技', '漫画', '童书'
];

// ── Wander ──
export const WANDER_DECOS = ['📖','📚','🔖','📕','📗','📘','📙','✨','🌙','☕','🍃','🌸','🌿','🎋','💫','🦋'];
export const WANDER_SUMMARY_MAX = 70;
