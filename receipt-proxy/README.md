# receipt-proxy

Cloudflare Workers 代理服务，为 [receipt-renamer](../receipt-renamer) PWA 提供：

- 🔑 持有 Gemini 2.0 Flash API Key（不暴露给前端）
- 🚦 每用户每日限流（默认 100 次/天）
- 🛠️ 管理员可为指定用户设置自定义额度
- 🌐 全接口支持 CORS

---

## 快速部署

### 前置条件

```bash
npm install -g wrangler
wrangler login
```

### 1. 安装依赖

```bash
cd receipt-proxy
npm install
```

### 2. 创建 KV Namespace

```bash
# 生产环境
wrangler kv:namespace create QUOTA_KV

# 预览/本地开发
wrangler kv:namespace create QUOTA_KV --preview
```

将输出的两个 `id` 分别填入 `wrangler.toml`：

```toml
[[kv_namespaces]]
binding = "QUOTA_KV"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"          # 生产 id
preview_id = "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"  # 预览 id
```

### 3. 设置 Secrets

```bash
wrangler secret put GEMINI_API_KEY
# 粘贴你的 Gemini API Key，回车确认

wrangler secret put ADMIN_SECRET
# 粘贴一个随机强密码（管理员操作需要此密钥）
```

### 4. 本地开发

```bash
npm run dev
# Worker 运行在 http://localhost:8787
```

### 5. 部署到 Cloudflare

```bash
npm run deploy
# 部署后会输出 Worker URL，如：
# https://receipt-proxy.<your-subdomain>.workers.dev
```

---

## 接口文档

所有接口均支持 CORS `*`。

---

### `POST /api/analyze`

识别收据图片，扣除当日额度。

**请求体（JSON）：**

```json
{
  "uid": "google_user_id_string",
  "base64": "<base64 encoded image or PDF>",
  "mediaType": "image/jpeg",
  "fileType": "image"
}
```

| 字段        | 类型   | 必填 | 说明                                          |
|-------------|--------|------|-----------------------------------------------|
| `uid`       | string | ✅   | Google 用户 ID（或 'anonymous'）               |
| `base64`    | string | ✅   | 文件的 base64 编码（不含 data: 前缀）          |
| `mediaType` | string | ✅   | MIME 类型，如 `image/jpeg`、`application/pdf` |
| `fileType`  | string | ❌   | `"image"`（默认）或 `"pdf"`                    |

**成功响应（200）：**

```json
{
  "date": "2024-01-15",
  "merchant": "Woolworths",
  "amount": 42.50,
  "currency": "AUD",
  "category": "Food & Dining",
  "items": ["Milk", "Bread"],
  "confidence": 92,
  "_quota": {
    "used": 3,
    "limit": 100,
    "remaining": 97,
    "date": "2024-01-15"
  }
}
```

**额度超限（429）：**

```json
{
  "error": "daily_limit_reached",
  "used": 100,
  "limit": 100,
  "message": "今日识别额度已用完"
}
```

---

### `GET /api/quota`

查询指定用户今日额度使用情况。

**Query 参数：**

| 参数  | 类型   | 说明           |
|-------|--------|----------------|
| `uid` | string | Google 用户 ID |

**示例：**

```
GET /api/quota?uid=abc123
```

**响应（200）：**

```json
{
  "uid": "abc123",
  "used": 3,
  "limit": 100,
  "remaining": 97,
  "date": "2024-01-15"
}
```

---

### `POST /api/admin/set-quota`

为指定用户设置自定义每日额度（永久生效，无过期）。

**请求头：**

```
x-admin-secret: <ADMIN_SECRET>
```

**请求体（JSON）：**

```json
{
  "uid": "google_user_id_string",
  "limit": 500
}
```

**响应（200）：**

```json
{
  "success": true,
  "uid": "google_user_id_string",
  "newLimit": 500
}
```

---

## 前端配置（receipt-renamer）

在 `receipt-renamer` 项目的 `.env.production`（或 `.env.local`）中添加：

```env
VITE_AI_PROXY_URL=https://receipt-proxy.<your-subdomain>.workers.dev
```

同时确保前端在 Google 登录后将用户 UID 存入 localStorage：

```js
localStorage.setItem('receipt_google_uid', user.uid);
```

前端 `ai.js` 会自动检测 `VITE_AI_PROXY_URL`：
- 有代理 URL → 调代理（Gemini 2.0 Flash，API Key 不暴露）
- 无代理 URL → 走旧版 Anthropic 直连（需要 `VITE_ANTHROPIC_API_KEY`）

---

## KV 数据结构

| Key                        | Value  | TTL      | 说明                       |
|----------------------------|--------|----------|----------------------------|
| `quota:{uid}:{YYYY-MM-DD}` | 数字   | 86400 秒 | 用户当日已用次数           |
| `custom_quota:{uid}`       | 数字   | 永久     | 用户自定义每日限额（可选） |

---

## 环境变量

| 名称            | 说明                              | 设置方式                    |
|-----------------|-----------------------------------|-----------------------------|
| `GEMINI_API_KEY` | Google Gemini API Key            | `wrangler secret put`       |
| `ADMIN_SECRET`  | 管理员接口验证密钥                | `wrangler secret put`       |
