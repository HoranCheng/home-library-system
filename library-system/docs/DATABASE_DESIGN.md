# 毛毛书房 — 用户系统 & 云同步 数据库设计

> 目标：支持平台账号注册 + Google 登录，多设备书库同步
> 技术栈：Cloudflare Worker + D1 (SQLite) + Web Crypto API
> 日期：2026-03-11

---

## 1. 架构概览

```
┌─────────────┐     HTTPS      ┌──────────────────┐      ┌─────────┐
│  PWA 前端   │ ◄────────────► │  Cloudflare Worker │ ───► │  D1 DB  │
│ index.html  │   JWT Bearer   │  (API 层)         │      │ (SQLite)│
└─────────────┘                └──────────────────┘      └─────────┘
                                      │
                                      ▼
                              Google OAuth 验证
```

**原则：**
- 密码永不明文存储，使用 PBKDF2-SHA256 + 随机盐
- JWT 做无状态会话，Worker 不存 session
- 前端保持离线优先，云端做增量同步
- 冲突策略：`updatedAt` 较新者胜

---

## 2. D1 数据库 Schema

### 2.1 用户表 `users`

```sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY,          -- UUID v4
  email         TEXT UNIQUE,               -- 登录邮箱（平台账号必填，Google 登录可选）
  display_name  TEXT NOT NULL DEFAULT '',  -- 显示名称
  avatar_url    TEXT DEFAULT '',           -- 头像 URL

  -- 密码认证（仅平台账号）
  password_hash TEXT,                      -- PBKDF2-SHA256 输出，Base64 编码
  password_salt TEXT,                      -- 随机盐，Base64 编码（16 字节）
  hash_iterations INTEGER DEFAULT 600000,  -- PBKDF2 迭代次数（OWASP 2023 推荐 ≥600k）

  -- Google OAuth（仅 Google 登录）
  google_sub    TEXT UNIQUE,               -- Google 用户 ID（sub claim）
  google_email  TEXT,                      -- Google 邮箱（仅展示用）

  -- 账号状态
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1 -- 0 = 停用
);

-- 索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_sub ON users(google_sub);
```

**密码安全说明：**
- Cloudflare Workers 原生支持 Web Crypto API
- 使用 `crypto.subtle.deriveBits()` 做 PBKDF2-SHA256
- 每个用户独立随机盐（`crypto.getRandomValues()`）
- 迭代次数 100,000 次（Cloudflare Workers 运行时上限；OWASP 推荐 600k 但 Workers 最高支持 100k）
- **绝不存储明文密码**

### 2.2 书籍表 `books`

```sql
CREATE TABLE books (
  id               TEXT NOT NULL,           -- 书籍 UUID（前端 makeId() 生成）
  user_id          TEXT NOT NULL,           -- 所属用户
  isbn             TEXT DEFAULT '',
  title            TEXT NOT NULL DEFAULT '',
  author           TEXT DEFAULT '',
  category         TEXT DEFAULT '',
  reading_status   TEXT DEFAULT 'want',     -- want / reading / done
  reading_progress INTEGER DEFAULT 0,
  published_year   TEXT DEFAULT '',
  location         TEXT DEFAULT '',         -- 存放位置
  description      TEXT DEFAULT '',
  notes            TEXT DEFAULT '',
  book_lang        TEXT DEFAULT '',
  cover_url        TEXT DEFAULT '',
  metadata_sources TEXT DEFAULT '[]',       -- JSON 数组
  status           TEXT DEFAULT 'to_be_sorted', -- in_library / to_be_sorted
  created_at       TEXT NOT NULL,           -- 前端时间戳（ISO 8601）
  updated_at       TEXT NOT NULL,           -- 前端时间戳，用于冲突解决
  is_deleted        INTEGER DEFAULT 0,       -- 软删除标记

  PRIMARY KEY (id, user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX idx_books_user ON books(user_id);
CREATE INDEX idx_books_user_updated ON books(user_id, updated_at);
CREATE INDEX idx_books_isbn ON books(user_id, isbn);
```

**字段映射（localStorage → D1）：**

| 前端字段 | 数据库列 | 说明 |
|---|---|---|
| `id` | `id` | UUID，前端生成 |
| `isbn` | `isbn` | |
| `title` | `title` | |
| `author` | `author` | |
| `category` | `category` | |
| `readingStatus` | `reading_status` | snake_case 转换 |
| `readingProgress` | `reading_progress` | |
| `publishedYear` | `published_year` | |
| `location` | `location` | |
| `description` | `description` | |
| `notes` | `notes` | |
| `bookLang` | `book_lang` | |
| `coverUrl` | `cover_url` | |
| `metadataSources` | `metadata_sources` | JSON 字符串 |
| `status` | `status` | |
| `createdAt` | `created_at` | |
| `updatedAt` | `updated_at` | |
| _(新增)_ | `is_deleted` | 云端软删除 |

### 2.3 位置预设表 `location_presets`

```sql
CREATE TABLE location_presets (
  user_id    TEXT NOT NULL,
  value      TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,      -- 排序（最近使用 = 最小值）
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  PRIMARY KEY (user_id, value),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 2.4 同步元数据表 `sync_meta`

```sql
CREATE TABLE sync_meta (
  user_id        TEXT PRIMARY KEY,
  schema_version INTEGER DEFAULT 1,
  last_sync_at   TEXT,              -- 上次成功同步时间
  device_count   INTEGER DEFAULT 1,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## 3. API 设计

### 3.1 认证端点

```
POST /auth/register        注册平台账号
POST /auth/login            邮箱密码登录
POST /auth/google           Google ID Token 登录
POST /auth/logout           登出（前端清 token 即可，服务端暂无 revoke）
GET  /auth/me               获取当前用户信息
```

#### 注册 `POST /auth/register`
```json
// 请求
{ "email": "user@example.com", "password": "...", "displayName": "毛毛" }

// 响应 200
{ "token": "eyJ...", "user": { "id": "...", "email": "...", "displayName": "..." } }

// 响应 409
{ "error": "EMAIL_EXISTS", "message": "该邮箱已注册" }
```

**密码要求：**
- 最少 8 位
- 至少包含字母 + 数字
- 服务端校验（不信任前端）

#### Google 登录 `POST /auth/google`
```json
// 请求（前端用 Google Sign-In 拿到 ID Token）
{ "idToken": "eyJ..." }

// 服务端验证流程：
// 1. 用 Google 公钥验证 JWT 签名
// 2. 检查 iss, aud, exp
// 3. 提取 sub（Google 用户 ID）
// 4. 查找或创建用户
// 5. 返回自己的 JWT
```

### 3.2 同步端点

```
POST /sync/push             推送本地变更到云端
POST /sync/pull             拉取云端数据到本地
GET  /sync/status           获取同步状态
```

#### 推送 `POST /sync/push`
```json
// 请求（增量推送，只传有变化的书）
{
  "lastSyncAt": "2026-03-10T12:00:00Z",
  "books": [
    { "id": "uuid-1", "title": "...", "updatedAt": "2026-03-11T01:00:00Z", ... },
    { "id": "uuid-2", "_deleted": true, "updatedAt": "2026-03-11T01:05:00Z" }
  ],
  "locationPresets": ["书房", "客厅", "卧室"]
}

// 响应（返回冲突和服务端更新）
{
  "accepted": 2,
  "conflicts": [],
  "serverUpdatedAt": "2026-03-11T01:05:00Z"
}
```

#### 拉取 `POST /sync/pull`
```json
// 请求
{ "lastSyncAt": "2026-03-10T12:00:00Z" }

// 响应（只返回 lastSyncAt 之后变更的数据）
{
  "books": [ ... ],
  "locationPresets": ["书房", "客厅", "卧室"],
  "syncedAt": "2026-03-11T01:05:00Z"
}
```

### 3.3 书籍 CRUD（可选，同步端点已覆盖）

```
GET    /books               获取所有书籍
POST   /books               添加书籍
PUT    /books/:id            更新书籍
DELETE /books/:id            删除书籍（软删除）
```

---

## 4. 安全设计

### 4.1 密码存储流程

```
注册时：
  salt = crypto.getRandomValues(new Uint8Array(16))     // 16 字节随机盐
  key  = crypto.subtle.importKey('raw', passwordBytes, 'PBKDF2', ...)
  hash = crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
    key, 256
  )
  存储: password_hash = base64(hash), password_salt = base64(salt)

登录时：
  用同样的 salt + iterations 重新计算 hash
  timingSafeEqual(计算结果, 存储的 hash)   // 防时序攻击
```

### 4.2 JWT 结构

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "iat": 1741651200,
  "exp": 1741737600       // 24 小时过期
}
```

- 签名算法：HS256
- 密钥存在 Worker Secret（`JWT_SECRET`）
- 前端存 `localStorage`（`lib:auth:token:v1`）

### 4.3 安全检查清单

- [x] 密码 PBKDF2-SHA256 + 随机盐，≥600k 迭代
- [x] 绝不返回 password_hash / password_salt 给前端
- [x] Google ID Token 服务端验证签名
- [x] JWT 有过期时间
- [x] 所有数据端点要求 Bearer Token
- [x] CORS 限制已有来源（延用现有白名单）
- [x] 速率限制：注册/登录 5次/分钟/IP
- [x] SQL 参数化查询（D1 bind 参数），防注入
- [ ] 可选：邮箱验证流程
- [ ] 可选：密码重置流程

---

## 5. 同步策略

### 5.1 离线优先

```
localStorage（主）──► 云端 D1（备份 + 同步）
       │                    │
       │  push (debounce)   │
       ├───────────────────►│
       │                    │
       │  pull (启动时)     │
       │◄───────────────────┤
```

1. **未登录**：行为与现在完全一致（纯 localStorage）
2. **已登录**：
   - 启动时 pull 云端数据 → 合并到本地
   - 每次数据变化 → debounce 2s → push 到云端
   - 冲突用 `updatedAt` 时间戳解决（较新者胜）

### 5.2 首次登录合并

用户可能已经有本地数据（未登录时录入的书）。首次登录时：

1. 拉取云端数据（可能为空）
2. 本地数据与云端合并（按 `id` 去重）
3. 冲突按 `updatedAt` 解决
4. 合并结果同时写入本地 + 推送云端
5. 弹窗告知："已同步 X 本书到云端"

---

## 6. wrangler.toml 变更

```toml
name = "maomao-books-proxy"
main = "books-proxy.js"
compatibility_date = "2024-01-01"

# D1 数据库绑定
[[d1_databases]]
binding = "DB"
database_name = "maomao-library"
database_id = "<创建后填入>"

# 环境变量（通过 wrangler secret put 设置）
# GBOOKS_API_KEY    — Google Books API Key（已有）
# JWT_SECRET        — JWT 签名密钥（新增）
# GOOGLE_CLIENT_ID  — Google OAuth Client ID（新增）
```

---

## 7. 文件结构变更

```
worker/
├── books-proxy.js          # 现有，保持不变
├── wrangler.toml           # 更新 D1 绑定
├── auth.js                 # 新增：认证逻辑（注册/登录/Google）
├── sync.js                 # 新增：同步逻辑（push/pull）
├── crypto.js               # 新增：密码哈希 + JWT 工具函数
├── schema.sql              # 新增：D1 建表语句
└── middleware.js            # 新增：JWT 验证中间件

preview/
└── index.html              # 更新：添加登录 UI + 同步逻辑
```

---

## 8. 实施计划

### Phase 1：后端基础（Worker + D1）
1. 创建 D1 数据库
2. 实现 `crypto.js`（密码哈希 + JWT）
3. 实现认证端点（注册 / 登录 / Google）
4. 实现同步端点（push / pull）
5. 单元测试

### Phase 2：前端集成
1. 登录 / 注册 UI（设置页新增"账号"区域）
2. Google Sign-In 集成
3. 同步管理器（SyncManager 类）
4. 离线队列 + 自动同步
5. 首次登录数据合并

### Phase 3：polish
1. 邮箱验证（可选）
2. 密码重置（可选）
3. 同步状态指示器（顶栏小图标）
4. 冲突可视化（罕见情况）
