# 数据库设计 — 毛毛图书管理系统

## 当前状态：localStorage（MVP）

当前数据存储在浏览器 `localStorage` 中，适合个人使用。

## 数据模型

### Book（图书）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string (UUID) | ✅ | 唯一标识 |
| isbn | string | ❌ | ISBN-10 或 ISBN-13 |
| title | string | ✅ | 书名 |
| author | string | ✅ | 作者（多人用逗号分隔） |
| category | string | ❌ | 分类（如：小说、科幻、计算机） |
| readingStatus | enum | ✅ | '要读' / '在读' / '读完' |
| status | enum | ✅ | 'in_library' / 'to_be_sorted' |
| publishedYear | string | ❌ | 出版年份（YYYY） |
| location | string | ❌ | 存放位置（如：客厅书架） |
| description | string | ❌ | 内容简介（≤280字） |
| notes | string | ❌ | 用户笔记 |
| coverUrl | string | ❌ | 封面图片 URL |
| bookLang | string | ❌ | 语言代码（zh/en/ja 等） |
| metadataSources | string | ❌ | 来源（Open Library / Google Books） |
| createdAt | ISO8601 | ✅ | 添加时间 |
| updatedAt | ISO8601 | ✅ | 最后更新时间 |

### Meta（元数据）

| 字段 | 类型 | 说明 |
|------|------|------|
| schemaVersion | number | 当前为 1 |
| updatedAt | ISO8601 | 最后数据变更时间 |

### LocationPresets（位置预设）

| 字段 | 类型 | 说明 |
|------|------|------|
| values | string[] | 最近使用的位置，最多 8 个 |

## 存储键名

| Key | 内容 |
|-----|------|
| `lib:books:v1` | Book[] JSON |
| `lib:meta:v1` | Meta JSON |
| `lib:location-presets:v1` | string[] JSON |
| `lib:home:mode:v1` | 'dashboard' / 'entry' |
| `lib:page:v1` | 当前页面标识 |
| `lib:entry:v1` | 录入模式 |

## 未来迁移路径（App Store 版本）

### Phase 1: SQLite（Capacitor + SQLite Plugin）

当 App 上架后，推荐迁移到 SQLite：

```sql
CREATE TABLE books (
  id TEXT PRIMARY KEY,
  isbn TEXT,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  category TEXT DEFAULT '',
  reading_status TEXT DEFAULT '要读' CHECK(reading_status IN ('要读','在读','读完')),
  status TEXT DEFAULT 'to_be_sorted' CHECK(status IN ('in_library','to_be_sorted')),
  published_year TEXT,
  location TEXT,
  description TEXT,
  notes TEXT,
  cover_url TEXT,
  book_lang TEXT,
  metadata_sources TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_books_isbn ON books(isbn);
CREATE INDEX idx_books_title ON books(title);
CREATE INDEX idx_books_category ON books(category);
CREATE INDEX idx_books_status ON books(status);
CREATE INDEX idx_books_reading ON books(reading_status);

CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE location_presets (
  value TEXT PRIMARY KEY,
  used_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Phase 2: CloudKit / iCloud Sync（可选）

如果需要多设备同步，可接入 CloudKit：
- 使用 `@capacitor-community/cloudkit` 插件
- 或自建 API + Supabase/Firebase

## 迁移策略

localStorage → SQLite 迁移流程：
1. App 首次启动检测 localStorage 是否有旧数据
2. 如有，自动迁移到 SQLite
3. 迁移完成后清除 localStorage
4. 写入 meta 表 `migration_completed: true`
