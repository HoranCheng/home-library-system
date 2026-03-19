# 封面系统架构文档

> 维护前必读。封面系统是 library-system 中复杂度最高的部分，三层逻辑交互。

---

## 概览

封面系统由三层组成，按执行时机分：

```
数据层（isStoredCoverDirty）→ 显示层（coverUrl/coverProxyUrl）→ 渲染层（onCoverLoad）
```

## 第一层：数据层 — dirty cover 检测

**函数：** `isStoredCoverDirty(book)`
**位置：** preview/index.html ~第 1575 行
**执行时机：** 每次需要判断封面是否可用时调用

**判定规则（任一命中即为 dirty）：**
1. `coverUrl` 为空或空白
2. URL 不安全（非 http/https）
3. Google Books placeholder（volume ID 以 ACAAJ 结尾）
4. Google Books zoom=1 低质量缩略图（非豆瓣来源）
5. Open Library `/b/isbn/` 类旧链接（非豆瓣来源）

**关键约束：**
- 不要轻易扩充规则，历史上多次因为过度判定导致好封面被误杀
- 豆瓣来源的封面即使匹配 Google/OL 模式也保留（置信度高）

---

## 第二层：显示层 — URL 选择

**函数：** `coverUrl(book)` + `coverProxyUrl(book)` + `coverFallbackUrl(book)`
**位置：** preview/index.html ~第 1590 行

**逻辑：**
```
coverUrl(book):
  1. 如果 book.coverUrl 存在且不是 dirty → 直接用它（stored-cover-first）
  2. 否则 → 用 proxy URL（GBOOKS_PROXY/cover/{isbn}）

coverFallbackUrl(book):
  - 提供一个备选 URL，在 onerror 时替换
  - 如果主 URL 是 stored → fallback 是 proxy
  - 如果主 URL 是 proxy → fallback 是 stored
  - 边界情况：如果 stored 已被清空（onCoverLoad 清过），fallback 为空，最终显示占位符，不会循环请求
```

**关键约束：**
- **stored-cover-first** 是核心策略，2026-03-15 花了很大代价修回来
- 绝对不能让 proxy URL 优先于已存储的好封面

---

## 第三层：渲染层 — 运行时过滤

**函数：** `onCoverLoad(img)`
**位置：** preview/index.html ~第 1610 行
**执行时机：** img 的 onload 事件（图片加载完成后）

**检测规则（按优先级）：**
1. **1x1 GIF** — Open Library 的空图（w≤2, h≤2）
2. **128x196 Google placeholder** — "image not available" 灰色占位图（需 `looksGoogle`：通过 `books.google` 或 `books.googleusercontent` 正则匹配 img.src 或 data-fallback-src）
3. **小尺寸 Google 图** — w≤200 的 Google 托管封面
4. **通用小图** — w≤60, h≤90 的任何来源

**命中后行为：**
1. 如果 book 的 `coverUrl` 非空 → 清空它（写入 localStorage）
2. 调用 `swapToCoverFallbackOrPlaceholder(img)` 切换到 fallback 或占位符

**关键约束：**
- 只在 `coverUrl` 非空时才写 localStorage，避免循环写入
- modal 视图里 img 没有 `data-id` 祖先，`closest('[data-id]')` 返回 null，跳过写入（可接受）
- 不要把规则放太宽，会误杀合法的低分辨率封面

---

## 封面修复流程

**函数：** `_fetchBestCoverCandidateForBook(book, options)`
**位置：** preview/index.html ~第 3308 行
**触发方式：** 设置页"补齐缺失封面"按钮（手动）

**查询顺序：**
1. 豆瓣读书（中文 ISBN 优先）
2. Google Books
3. Open Library（ISBN 查询）
4. Bookcover API
5. **ISBN 全部失败 + 书仍 dirty →** Open Library title+author fallback（高置信度阈值）

**安全规则：**
- 已有好封面不覆盖（`shouldReplace = currentDirty || candidate.score > currentScore`）
- 候选与现有相同时跳过
- 每本书记录 `coverRefreshedAt`，7 天内不重复检查（从写入时间算）
- 手动点"补齐缺失封面"时，`force` 参数可绕过 7 天限制

---

## 共享 Helper 函数

全部在全局作用域（2026-03-15 从局部提升，解决了 `Can't find variable` 崩溃）：

| 函数 | 用途 |
|------|------|
| 函数 | 用途 | 主要调用者 |
|------|------|-----------|
| `isGBPlaceholderUrl(url)` | 检测 Google Books 占位 URL | isStoredCoverDirty, tryRecoveredCover |
| `isGoogleHostedCoverUrl(url)` | 检测 Google 托管 URL | isStoredCoverDirty, onCoverLoad |
| `isOpenLibraryCoverUrl(url)` | 检测 Open Library URL | isStoredCoverDirty |
| `normalizeGoogleCoverUrl(url)` | 标准化 Google 封面 URL | extractGoogleImageLinks |
| `extractGoogleImageLinks(data)` | 从 GB API 响应提取图片链接 | extractAnyCover, fillBookMetaByIsbn |
| `pickBestGoogleCover(data, opts)` | 选最佳 Google 封面 | extractAnyCover |
| `extractAnyCover(data, opts)` | 从任意 API 响应提取封面 | _fetchBestCoverCandidateForBook, fillBookMetaByIsbn |
| `bestOpenLibraryCoverCandidate(data, opts)` | OL title+author 搜索候选 | _fetchBestCoverCandidateForBook |
| `pickBestOpenLibraryCover(data, opts)` | 选最佳 OL 封面 | _fetchBestCoverCandidateForBook, fillBookMetaByIsbn |

---

## 已知残留问题

4 本书公开源确实无高质量封面：
- 台北人 `9787549559886` — 候选图本身是坏图
- 夜晚的潜水艇 `9787542669964` — 同上
- The Choice Guide to Baby Products `9781920705107` — 公开源无图
- Rituals `9780473390907` — 公开源无图

这些书的 coverUrl 会被 onCoverLoad 清空，显示为书名首字占位符，属于预期行为。

---

## 修改封面系统前的检查清单

1. [ ] 理解三层的执行顺序和交互关系
2. [ ] 确认改动不会破坏 stored-cover-first 策略
3. [ ] 确认 dirty 规则不会误杀好封面
4. [ ] 跑 `npm test`（64 个测试全过）
5. [ ] 实际测试：有封面的书是否正常显示？dirty 书是否正确 fallback？
6. [ ] 封面相关改动 commit 前让 Beta 审查
