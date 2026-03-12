/**
 * receipt-proxy — Cloudflare Workers proxy for receipt-renamer
 *
 * Routes:
 *   POST /api/analyze        — Receipt image recognition via Gemini 2.0 Flash
 *   GET  /api/quota          — Query today's remaining quota for a user
 *   POST /api/admin/set-quota — Admin: set custom quota for a user
 *
 * Secrets (set via `wrangler secret put`):
 *   GEMINI_API_KEY
 *   ADMIN_SECRET
 *
 * KV Namespace:
 *   QUOTA_KV — stores daily usage and custom quota per user
 */

const DEFAULT_DAILY_LIMIT = 100;

// ─── CORS helpers ────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-secret',
};

function corsResponse(body, init = {}) {
  const status = init.status ?? 200;
  const headers = { 'Content-Type': 'application/json', ...CORS_HEADERS, ...(init.headers ?? {}) };
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });
}

function handleOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// ─── Date helper (UTC) ───────────────────────────────────────────────────────

function utcDateString(date = new Date()) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

// ─── KV helpers ──────────────────────────────────────────────────────────────

async function getUsed(kv, uid, date) {
  const val = await kv.get(`quota:${uid}:${date}`);
  return val ? parseInt(val, 10) : 0;
}

async function getLimit(kv, uid) {
  const val = await kv.get(`custom_quota:${uid}`);
  return val ? parseInt(val, 10) : DEFAULT_DAILY_LIMIT;
}

async function incrementUsed(kv, uid, date, current) {
  await kv.put(`quota:${uid}:${date}`, String(current + 1), { expirationTtl: 86400 });
}

// ─── Gemini API call ─────────────────────────────────────────────────────────

const RECEIPT_PROMPT = `You are a receipt data extractor for an Australian user. Analyze this image and extract structured data.

CRITICAL — is_receipt MUST default to true. Set is_receipt=false ONLY if the image is clearly NOT any kind of financial document. Specifically:

is_receipt = TRUE for ALL of these:
- Paper receipts (thermal, dot-matrix, inkjet, handwritten)
- Faded, crumpled, partial, or blurry receipts (do your best to extract data)
- Electronic/digital receipts (screenshots, emails, app confirmations)
- Tax invoices, invoices, bills, statements
- Payment confirmations (EFTPOS, credit card, PayPal, etc.)
- Fuel dockets, parking tickets, toll receipts
- Foreign language receipts
- ANY image that shows a transaction amount, merchant name, or itemized list

is_receipt = FALSE ONLY for:
- Photos of people, animals, scenery, food (not a receipt photo of food)
- Screenshots of non-financial apps (social media, games, etc.)
- Documents that are clearly not financial (letters, articles, books)
- Blank or completely unreadable images

When in doubt, ALWAYS set is_receipt=true and use a lower confidence score. It is far better to mark a non-receipt as a low-confidence receipt than to reject a real receipt.

EXTRACTION RULES:
- Dates: prefer DD/MM/YYYY (Australian). Output as YYYY-MM-DD. If no date visible, use today's date.
- Merchant: the SPECIFIC store/brand name. Examples: "Coles", "Woolworths", "7-Eleven", "McDonald's", "JB Hi-Fi", "Bunnings". NEVER use a generic word like "Supermarket", "Grocery", "Restaurant", "Petrol Station". If you can read the store name from the receipt, use it exactly (title case). If truly unreadable, use "Unknown Merchant".
- Amount: the TOTAL paid (after discounts, including GST). Number only, no currency symbol. If multiple totals shown, use the final "TOTAL" or "Amount Due".
- Currency: usually AUD unless clearly otherwise.
- Category: exactly ONE of: Grocery, Dining, Fuel, Medical, Hardware & Garden, Outdoor & Camping, Transport, Utilities, Entertainment, Shopping, Education, Insurance, Subscription, Other
- Confidence: 0-100 your certainty about ALL extracted fields combined. Even faded/partial receipts should get 30-60 confidence, not 0.
- items: list the first 5-10 line items if visible. Empty array if items not readable.

Respond ONLY with this JSON, no markdown, no backticks:
{"is_receipt":true,"date":"YYYY-MM-DD","merchant":"Specific Store Name","amount":0.00,"currency":"AUD","category":"Category","items":["item1","item2"],"confidence":85}`;

async function callGemini(apiKey, base64, mediaType, fileType) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  // Build the content part — image or PDF
  let inlinePart;
  if (fileType === 'pdf' || mediaType === 'application/pdf') {
    inlinePart = {
      inlineData: {
        mimeType: 'application/pdf',
        data: base64,
      },
    };
  } else {
    inlinePart = {
      inlineData: {
        mimeType: mediaType,
        data: base64,
      },
    };
  }

  const requestBody = {
    contents: [
      {
        parts: [
          inlinePart,
          { text: RECEIPT_PROMPT },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1000,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();

  // Extract text from Gemini response
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) {
    throw new Error('Gemini returned empty content');
  }

  // Parse JSON from the text
  const cleaned = text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`Gemini returned unparseable content: ${cleaned.slice(0, 100)}`);
  }
}

// ─── Route handlers ──────────────────────────────────────────────────────────

async function handleAnalyze(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return corsResponse({ error: 'invalid_json', message: '请求体必须是有效的 JSON' }, { status: 400 });
  }

  const { uid, base64, mediaType, fileType = 'image' } = body ?? {};

  if (!uid || !base64 || !mediaType) {
    return corsResponse(
      { error: 'missing_fields', message: '缺少必填字段：uid、base64、mediaType' },
      { status: 400 },
    );
  }

  const date = utcDateString();
  const [used, limit] = await Promise.all([
    getUsed(env.QUOTA_KV, uid, date),
    getLimit(env.QUOTA_KV, uid),
  ]);

  if (used >= limit) {
    return corsResponse(
      {
        error: 'daily_limit_reached',
        used,
        limit,
        message: '今日识别额度已用完',
      },
      { status: 429 },
    );
  }

  // Call Gemini
  let result;
  try {
    result = await callGemini(env.GEMINI_API_KEY, base64, mediaType, fileType);
  } catch (err) {
    return corsResponse(
      { error: 'gemini_error', message: err.message },
      { status: 502 },
    );
  }

  // Increment quota counter
  await incrementUsed(env.QUOTA_KV, uid, date, used);

  return corsResponse({
    ...result,
    _quota: {
      used: used + 1,
      limit,
      remaining: limit - (used + 1),
      date,
    },
  });
}

async function handleQuota(request, env) {
  const url = new URL(request.url);
  const uid = url.searchParams.get('uid');

  if (!uid) {
    return corsResponse({ error: 'missing_uid', message: '缺少 uid 参数' }, { status: 400 });
  }

  const date = utcDateString();
  const [used, limit] = await Promise.all([
    getUsed(env.QUOTA_KV, uid, date),
    getLimit(env.QUOTA_KV, uid),
  ]);

  return corsResponse({
    uid,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    date,
  });
}

async function handleAdminSetQuota(request, env) {
  const adminSecret = request.headers.get('x-admin-secret');
  if (!adminSecret || adminSecret !== env.ADMIN_SECRET) {
    return corsResponse({ error: 'unauthorized', message: '无效的管理员密钥' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return corsResponse({ error: 'invalid_json', message: '请求体必须是有效的 JSON' }, { status: 400 });
  }

  const { uid, limit } = body ?? {};

  if (!uid || typeof limit !== 'number' || limit < 0) {
    return corsResponse(
      { error: 'invalid_params', message: '需要 uid（字符串）和 limit（非负整数）' },
      { status: 400 },
    );
  }

  await env.QUOTA_KV.put(`custom_quota:${uid}`, String(Math.floor(limit)));

  return corsResponse({ success: true, uid, newLimit: Math.floor(limit) });
}

// ─── Main fetch handler ──────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const path = url.pathname;

    // Handle preflight
    if (method === 'OPTIONS') {
      return handleOptions();
    }

    // Route dispatch
    if (path === '/api/analyze' && method === 'POST') {
      return handleAnalyze(request, env);
    }

    if (path === '/api/quota' && method === 'GET') {
      return handleQuota(request, env);
    }

    if (path === '/api/admin/set-quota' && method === 'POST') {
      return handleAdminSetQuota(request, env);
    }

    // Temporary debug: test Gemini key status
    if (path === '/api/debug/gemini' && method === 'GET') {
      const key = env.GEMINI_API_KEY;
      if (!key) return corsResponse({ error: 'no_key', message: 'GEMINI_API_KEY not set' }, { status: 500 });
      const keyHint = key.slice(0, 8) + '...' + key.slice(-4);
      const testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
      try {
        const res = await fetch(testUrl);
        const data = await res.json();
        return corsResponse({ keyHint, status: res.status, ok: res.ok, models: data?.models?.map(m => m.name)?.slice(0, 5) ?? data });
      } catch (e) {
        return corsResponse({ keyHint, error: e.message });
      }
    }

    return corsResponse({ error: 'not_found', message: '路由不存在' }, { status: 404 });
  },
};
