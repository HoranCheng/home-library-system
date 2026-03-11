# Claude Opus 4.6 全面扫描发现 — 2026-03-11

## 安全问题

### S1: CSP 允许 `unsafe-inline` 使 XSS 防护大打折扣（P1）
**位置**: `index.html:11`
CSP 里 `script-src 'self' 'unsafe-inline'`。因为是单文件 app，所有 JS 都是 inline 的，所以 `unsafe-inline` 必须存在。但这意味着 CSP 对 XSS 的防护非常有限——如果有注入点，攻击者的 inline script 也会被允许。

**当前风险**: 有限。`makeNotice` 已经 escape 了，但这是架构性限制。
**建议**: 长期考虑把 JS 提取成外部文件，使用 nonce-based CSP。近期不需要动。

### S2: `coverUrl` 在多处直接用于 `img src` 没有协议校验（P1）
**位置**: `index.html:1052` (`coverHtml`), `1615` (`showSuccessModal`), `1815` (`showBookDetail`)
`coverUrl` 来自 API（Google Books/OpenLibrary/Bookcover）或用户导入。虽然导入时已经加了 `isSafeUrl` 校验，但通过 API 拿到的 `coverUrl` 没有校验。如果某个 API 返回 `javascript:` URL，会直接进 `img src`。

**实际风险**: 低。`img src="javascript:..."` 在现代浏览器不会执行。但 `data:text/html,...` 配合 `onerror` 理论上可能有风险。
**建议**: 在 `coverUrl()` 函数里加协议校验。

### S3: `bookcover.longitood.com` 第三方 API 不在 CSP `connect-src` 里（P2）
**位置**: `index.html:11`, 使用处: `1700`, `3165`
CSP 的 `connect-src` 只列了 `'self'`、Worker URL 和 Google API。但代码里直接 fetch 了 `bookcover.longitood.com`、`openlibrary.org`、`api.crossref.org`。

**影响**: 这些 fetch 可能被 CSP 阻止！这是一个功能 bug。
**修复**: CSP `connect-src` 需要加上这三个域。

### S4: 删除书籍时只从本地删除，不发送 tombstone（P1）
**位置**: `index.html:1898-1903`
```js
const books = loadBooks().filter(b => b.id !== id);
saveBooks(books);
```
用户在前端删除一本书时，直接从数组里移除了。`saveBooks` 会触发 `syncManager.schedulePush()`，但 push 发送的是当前所有 books——删掉的书不在里面。服务端不会知道这本书被删了。

**后果**: 
1. 其他设备 pull 时还会拿到这本书
2. 下次 pull 时这本书又会出现在本地

**这是一个和之前"删除复活"同源的 bug，只是方向相反。**

**修复**: 删除时不应该移除书，而应该标记 `_deleted: true, updatedAt: now`，然后 push。渲染时过滤掉 `_deleted` 的书。

### S5: auth.user 的 `avatar_url` 直接插入 innerHTML 没有 escape（P2）
**位置**: `index.html:1444`
```js
const avatarInner = u.avatar_url
  ? `<img src="${escapeHtml(u.avatar_url)}" alt="">`
  : ...
```
这里用了 `escapeHtml`，OK。但如果 `avatar_url` 是一个 `javascript:` URI，虽然被 escape 了不会在属性里生效，但值得注意。实际上这里是安全的。

## 功能 Bug

### B1: `全部入库` 和 `全部恢复待补充` 没有确认对话框（P1）
**位置**: `index.html:1767-1776`
这是批量操作，会修改所有书的 status。没有 `confirm()` 确认。一次误触就全部改了。

**修复**: 加 `confirm()`。

### B2: 导入数据会完全覆盖本地数据，不做合并（P1）
**位置**: `index.html:2145-2150`
```js
localStorage.setItem(BOOKS_KEY, JSON.stringify(result.books));
localStorage.setItem(META_KEY, JSON.stringify(result.meta));
```
如果用户已经有 50 本书，导入一个只有 10 本的备份，本地的 50 本全没了。应该至少警告更清楚，或者提供"合并"选项。

**当前**: confirm 里写了"即将用导入数据覆盖"，算是有提示。但 UX 上不够安全。
**建议**: P2 优先级加一个"合并导入（保留现有+添加新的）"选项。

### B3: Token 过期后 `apiFetch` 的错误处理不够友好（P1）
**位置**: `index.html:660-664`
```js
if (!resp.ok) throw { status: resp.status, ...data };
```
当 JWT 过期（8 小时后），所有 sync 操作会抛 401。前端 `push` 和 `pull` 捕获 401 时做了 `auth.clear(); render()`。但用户看到的可能是突然回到登录界面，没有提示"登录已过期，请重新登录"。

**修复**: 在 `auth.clear()` 时显示一条提示。

### B4: `metadataSources` 字段存储不一致（P2）
**位置**: 存储时 `index.html:1720` 是字符串 `"Google Books / Open Library"`，但 `validateAndSanitizeImport` 里检查 `Array.isArray`。服务端 `sync.js:49` 做了 `JSON.stringify(book.metadataSources || [])`。如果前端传的是字符串，服务端存的就是 `"\"Google Books / Open Library\""`（双重字符串化）。

**修复**: 统一成数组格式。

### B5: 搜索页搜索"已入库"或"待补充"会匹配所有对应书籍，但无法搜索"已读完"（P2）
**位置**: `index.html:1347-1352`
搜索匹配的是 `statusLabel`（"待补充"/"已入库"）和 `readLabel`（"要读"/"在读"/"读完"），但用户可能输入"已读"或"已读完"而不是"读完"。

**建议**: 小改进，搜索时也匹配常见同义词。

## UI/UX 问题

### U1: 密码输入框的 placeholder 说"至少 8 位，包含字母和数字"，但注册表单没有实时校验反馈（P2）
**位置**: `index.html:1467`
用户输入密码后，只有提交时才知道格式不对。应该有实时的强度提示或格式提示。

### U2: 登录错误后，切换到注册模式，错误消息会被清空，但密码输入框内容保留（P2）
这可能会让用户困惑——他们在登录模式输了错密码，切到注册模式后密码还在。

### U3: 书房名称（"XX的书房"）在未登录时固定为"毛毛的书房"（P2）
**位置**: `index.html:1178`
如果用户是第一次用、还没注册，看到"毛毛的书房"可能会困惑——"毛毛是谁？"。

**建议**: 未登录时显示"我的书房"，登录后显示用户昵称。

### U4: 退出登录确认框的措辞可以更好（P2）
**位置**: `index.html:1449`
当前: "确定退出登录？本地数据不会丢失。"
建议补充: "下次需要重新登录才能同步。"

### U5: 同步状态 UI 在页面刷新后丢失（P2）
同步状态显示依赖 DOM 元素 `syncStatusDot` 和 `syncStatusLabel`，这些在 `render()` 中通过 settings 的 `innerHTML` 重建。如果用户不在 settings 页，同步状态就不可见。

**建议**: 考虑在顶栏或全局位置显示同步状态。

### U6: `全部入库` 和 `全部恢复待补充` 按钮没有 loading 状态（P2）
批量操作可能触发大量 sync push。按钮应该在操作期间禁用。

## 架构/代码质量

### A1: `innerHTML` 仍然大量使用（技术债）
以下位置使用 `innerHTML` 拼接动态内容。虽然大部分都正确使用了 `escapeHtml`，但如果未来改动不小心遗漏，就会重新引入 XSS：

关键渲染点（已 escape，但仍是风险面）：
- `render()` 函数中的所有 `innerHTML` 赋值
- `showBookDetail()` 的详情模态框
- `showDuplicateModal()` 的重复提示
- `showSuccessModal()` 的成功提示

**当前状态**: 安全。但这是持续的维护负担。

### A2: 没有前端路由机制，使用 localStorage 存 page/mode 状态（低风险）
刷新页面后会恢复到之前的 page/mode。这实际上是一个 feature，但也意味着用户不能用浏览器后退键。

### A3: CSP connect-src 不完整是功能 bug（同 S3）
需要把 `bookcover.longitood.com`、`openlibrary.org`、`api.crossref.org` 加进去。

## 总结：按优先级排序

### 立即修（本轮）
1. **S4: 前端删除不发 tombstone** — 这是一个真实同步 bug
2. **S3/A3: CSP connect-src 不完整** — 会阻断封面和书目查询
3. **B1: 全部入库/全部恢复缺少确认框** — 误操作风险
4. **B3: Token 过期无友好提示** — 用户体验断裂

### 近期
5. **S2: coverUrl 协议校验** — 低风险但应该做
6. **B4: metadataSources 类型不一致** — 数据格式问题
7. **U3: 未登录时书房名** — "毛毛"不通用

### 可推迟
8. 其他 UI/UX 小项
9. innerHTML 系统性替换（大工程）
