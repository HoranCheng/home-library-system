# 毛毛书房（MaoMao Library）独立评审报告

评审对象：
- 前端单文件 PWA：`library-system/preview/index.html`
- Worker：`library-system/worker/books-proxy.js`
- 认证：`library-system/worker/auth.js`
- 同步：`library-system/worker/sync.js`
- 加密：`library-system/worker/crypto.js`
- 中间件：`library-system/worker/middleware.js`
- DB Schema：`library-system/worker/schema.sql`
- 设计文档：`library-system/docs/DATABASE_DESIGN.md`
- 线上站点：`https://horancheng.github.io/home-library-system/`
- Worker：`https://maomao-books-proxy.henrycdev26.workers.dev`

---

## 一、总评

这是一个**产品方向很对、前端执行力很强、但安全边界和同步设计还没到“可放心上线多人多设备云同步”级别**的项目。

### 我的总判断
- 如果把它看作 **单机 / 本地优先的家庭藏书工具**：已经有明显吸引力，扫码体验、中文场景适配、首页信息架构都做得不错。
- 如果把它看作 **带账号体系和跨设备同步的正式产品**：现在还不够稳，尤其是 **CORS、XSS、同步冲突、删除传播、部署完整性** 这些地方，仍然有明显短板。

### 分项评级
- 1. 全流程测试：**B-**
- 2. 代码安全审计：**D**
- 3. UX / 可用性：**B**
- 4. UI / 布局 / 设计：**B+**
- 5. 架构：**C+**

---

## 二、优点先说

### 1) 产品定位是对的
- 中文家庭藏书管理 + ISBN 扫码，这个切口明确。
- 单文件 PWA 部署门槛低，适合快速迭代。
- 首页的“总藏书 / 已入库 / 待补充 / 在读中”很直接，符合家庭用户心智。

### 2) 前端细节打磨明显
几个体验点是加分项：
- 扫码成功后的震动和 freeze-frame 效果：`index.html:2919-2954`
- 6 秒无结果时给出补救提示：`index.html:2922-2926`, `2991-2995`
- 重复图书弹窗：`index.html:1526-1566`
- 保存成功庆祝弹窗：`index.html:1568-1600`
- 自动填充高亮：`index.html:2655-2667`
- 扫码时隐藏表单：`index.html:2893`, `2986`

这些不是“能用就行”的代码，说明作者确实在想真实使用场景。

### 3) 中文图书元数据处理很认真
- 分类翻译和垃圾分类过滤做得比一般 demo 好很多：`index.html:2261-2303`
- CJK 优先、避免拼音覆盖中文：`index.html:2430-2477`
- 两阶段 ISBN 查询（快路径 + 后台补全）思路正确：`index.html:2505-2637`

---

## 三、P0 / P1 / P2 问题清单（按严重度）

## P0（严重，建议优先修）

### P0-1：Worker 的 CORS 白名单校验有明显漏洞，恶意域名可伪装通过
**位置**：`worker/books-proxy.js:20-31`

```js
const ALLOWED_ORIGINS = [
  'https://horancheng.github.io',
  'https://horancheng.github.io/',
  'http://localhost',
  'http://127.0.0.1',
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));
}
```

这里用了 `startsWith()`，所以：
- `https://horancheng.github.io.evil.com`
- `http://localhost.evil.com`

都会被当成允许来源。

我实际验证了线上 Worker，返回头确实会回显恶意 Origin：
- `Origin: https://horancheng.github.io.evil.com`
- 响应头：`Access-Control-Allow-Origin: https://horancheng.github.io.evil.com`

这不是理论问题，是**已可利用**的问题。

**影响**：
- 恶意站点可在浏览器里直接调用你的 Worker
- 配合公开 Books 代理 / 未来认证接口，会扩大攻击面

**建议**：
- 必须改成 `new URL(origin).origin` 精确比对
- 本地开发也别用前缀匹配，单独允许 `http://localhost:xxxx`

---

### P0-2：前端存在真实 XSS 面，且 JWT 存在 localStorage，组合后风险升级为账号接管
**位置**：
- `index.html:884`
- `index.html:1753`
- `index.html:2029`
- `index.html:2047`
- 以及 token 存储：`index.html:650-658`

`makeNotice()` 直接拼 HTML：

```js
function makeNotice(kind, text) { return `<div class="notice ${kind}">${text}</div>`; }
```

但调用方并不总是转义，尤其这些地方：

```js
els.manualNotice.innerHTML = makeNotice('err', `保存失败：${e.message || '未知错误'}`);
els.settingsNotice.innerHTML = makeNotice('err', `校验失败：${e.message}`);
els.settingsNotice.innerHTML = makeNotice('err', `导入失败：${e.message}`);
```

如果异常消息里带 HTML，就会直接进 `innerHTML`。导入流程里 `e.message` 是可以被用户控制触发的；未来任何网络错误、第三方接口报错、被污染的数据内容，也可能借道进来。

而认证 token 存在 localStorage：

```js
localStorage.setItem(AUTH_TOKEN_KEY, token);
```

**风险组合**：
1. 页面注入 XSS
2. 读取 `lib:auth:token:v1`
3. 直接盗用 JWT
4. 调用 `/sync/*` 读取或覆盖用户云端书库

这就不是“小弹窗脏一下 UI”，而是**账户数据泄露 / 篡改**。

**建议**：
- `makeNotice()` 必须默认 escape 文本，只在极少数确定安全的场景允许 HTML
- 全面审查所有 `innerHTML = ...`
- 补 CSP（至少 `default-src 'self'; script-src 'self' https://unpkg.com ...` 这种方向）
- 认真考虑 token 不要长期裸放 localStorage，至少缩短 TTL + 做 refresh / rotate

---

### P0-3：线上 GitHub Pages 部署不完整，PWA 关键文件实际 404
**位置**：
- HTML 引用：`index.html:6-7`
- SW 注册：`index.html:3090-3091`
- 本地文件存在：`preview/sw.js`, `preview/manifest.json`
- 线上访问结果：`/home-library-system/sw.js`、`/home-library-system/manifest.json` 均 404

也就是说现在代码里写了：

```html
<link rel="manifest" href="./manifest.json">
```

```js
navigator.serviceWorker.register('./sw.js').catch(() => {});
```

但线上这两个文件都没有成功提供。

**影响**：
- PWA 安装体验不完整
- 离线缓存根本没生效
- 你以为有的能力，用户实际上拿不到

这是一个很典型的“本地 OK / 仓库里也有 / 线上实际挂了”的部署质量问题。

**建议**：
- 先修部署产物路径，再谈 PWA/offline
- 在 CI 或发布脚本里加 smoke test：部署后自动检查 `index.html`、`manifest.json`、`sw.js`、icon 是否 200

---

### P0-4：Google Books Worker 是公开可滥用代理，几乎没有防刷、防滥用、防配额耗尽措施
**位置**：`worker/books-proxy.js:67-105`

```js
for (const [key, value] of searchParams) {
  gbUrl.searchParams.set(key, value);
}
gbUrl.searchParams.set('key', env.GBOOKS_API_KEY || '');
```

问题有三层：
1. **参数全透传**：任何查询参数都原样带到上游
2. **无速率限制**：Books 代理完全没接 `checkRateLimit()`
3. **无输入约束**：没限制 `q` 长度、`maxResults`、`startIndex`

这意味着任何人都可以把你的 Worker 当公共 Google Books 转发器来用，消耗你的 API 配额。

**建议**：
- 对 `q`、`langRestrict`、`printType`、`maxResults` 做 allowlist
- `maxResults` 强制 clamp，比如最大 10
- 给代理接口加 IP 级或 token 级限流
- 建议为常见 ISBN 查询做 Worker Cache / KV 缓存

---

## P1（重要，建议尽快修）

### P1-1：云同步“删除传播”逻辑不完整，首次同步会把云端已删书重新推回去
**位置**：
- 前端 pull 总是全量：`index.html:690-697`
- Worker full pull 排除已删：`worker/sync.js:160-164`
- initial sync 紧接着 push 全量：`index.html:769-781`

前端写的是：

```js
// Always do a full pull (no incremental) to ensure completeness
const data = await apiFetch('/sync/pull', {
  method: 'POST',
  body: JSON.stringify({}),
});
```

而 Worker full pull：

```js
SELECT * FROM books WHERE user_id = ? AND is_deleted = 0 ORDER BY created_at DESC
```

这就意味着：
- 云端某本书已经软删除
- 新设备首次登录时，full pull 根本收不到 tombstone
- 本地旧数据还在
- 接着 `initialSync()` 又把所有本地书 `push()` 回云端

**结果**：云端删除会“复活”。

这是同步系统的逻辑 bug，不是边角问题。

**建议**：
- full pull 也要带 tombstone，或者至少带 `deletedIds`
- initial sync 不能简单地“pull 后 push 全量”，而要做显式 merge 决策

---

### P1-2：同步冲突已经由后端识别，但前端完全没处理，用户会误以为“已同步”
**位置**：
- 后端返回 conflicts：`worker/sync.js:91-105`, `154`
- 前端 push 后忽略 conflicts：`index.html:675-683`

后端已经有：

```js
if (existing && existing.updated_at > (book.updatedAt || '')) {
  conflicts.push({ id: book.id, serverUpdatedAt: existing.updated_at });
  continue;
}
```

但前端只拿 `accepted`：

```js
this._updateUI('synced', `已同步 ${resp.accepted || 0} 本书到云端`);
```

**问题**：
- 用户不知道有冲突
- 本地也没把 server newer 的版本拉回来
- 最终可能出现“本地看起来保存了，云端其实没接收”的错觉

**建议**：
- push 后如果 `conflicts.length > 0`，立刻再 pull 一次并提示用户
- 长期看应该做冲突 UI（至少“云端版本较新，已保留云端版本”）

---

### P1-3：认证中间件和限流中间件返回 401/429 时没有带 CORS 头，跨域失败时前端体验会很差
**位置**：
- `worker/middleware.js:18-23`
- `worker/middleware.js:45-59`

`requireAuth()` 返回：

```js
return new Response(JSON.stringify({ error: 'UNAUTHORIZED', message: '请先登录' }), {
  status: 401,
  headers: { 'Content-Type': 'application/json' },
});
```

`checkRateLimit()` 返回 429 也同样没把 `corsHeaders` 带进去。

**影响**：
- 浏览器端看到的是 CORS 错误，而不是明确的业务错误
- 前端 catch 到的错误信息会变得不可预测

**建议**：
- 中间件统一接收并附加 CORS headers
- 401/429/500 都要保持同样的 CORS 行为

---

### P1-4：Google OAuth 后端做了，前端却没有对应入口，整条用户流程是断的
**位置**：
- 后端有 `POST /auth/google`：`worker/auth.js:118-183`
- 前端设置页登录 UI只有邮箱密码：`index.html:1387-1410`
- 前端全文件没有实际 Google 登录逻辑（只有 `.auth-btn.google` 样式，没有功能）

这意味着文档和后端能力已经承诺了 Google 登录，但用户界面并没有这条路。

**影响**：
- “注册 / 登录 / Google 登录 / 跨设备同步”这条完整故事讲不圆
- 用户会以为产品支持 Google 登录，实际上不支持

**建议**：
- 要么补齐前端 GIS 流程
- 要么在本版本明确删掉文档/注释中的 Google 登录承诺

---

### P1-5：导入校验过浅，几乎只检查 `books` 和 `meta` 是否存在，容易导入脏数据 / 恶意数据
**位置**：`index.html:2022-2048`

当前校验基本等于：

```js
if (!Array.isArray(parsed.books)) throw new Error('缺少 books 数组');
if (!parsed.meta) throw new Error('缺少 meta 字段');
```

没有检查：
- 每本书字段类型
- 字段长度
- URL 合法性（如 `coverUrl`, `avatar_url`）
- `readingProgress` 范围
- `createdAt/updatedAt` 时间格式
- `metadataSources` 是否真是数组

**影响**：
- 容易导入畸形数据，污染本地状态
- 结合 XSS 面，异常消息/渲染路径会更危险

**建议**：
- 做 schema 级校验
- 最简单可以手写 validator，最好是明确白名单字段 + 长度限制

---

### P1-6：token 只有 24 小时 JWT，没有 refresh / revoke，退出登录只是清本地，失窃后 24 小时内仍有效
**位置**：
- JWT TTL：`worker/crypto.js:52`
- 登出：`index.html:819-822`
- 设计文档提到 `/auth/refresh`，但代码里没有：`DATABASE_DESIGN.md:168-175`

退出登录只是：

```js
auth.clear();
```

服务端没有 token 黑名单、没有 refresh 轮换，也没有设备会话管理。对于个人小项目不是不能接受，但如果你已经有账号和同步，这就该被视为**待补安全债**。

---

### P1-7：Service Worker 缓存策略过于粗糙，未来一旦上线会缓存所有 GET，可能缓存第三方请求和陈旧 HTML
**位置**：`preview/sw.js:1-7`

```js
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { ... cache.put(e.request, c); } return r; }).catch(() => caches.match(e.request)));
});
```

问题：
- 所有 GET 都缓存，没有区分本域 / 第三方
- `index.html` 会被旧版本覆盖，更新一致性差
- 没有版本化资源清单，也没有 stale-while-revalidate 之类的策略设计

目前线上 SW 还 404，所以这个问题暂时“没爆”，但一旦部署好了，它会变成真实问题。

---

## P2（体验和结构优化项）

### P2-1：登录与同步入口藏得太深
用户如果从首页一路用下来，不一定会意识到“设置页里还有账号同步”。对于要强调“跨设备同步”的产品，这个入口有点弱。

建议：
- 在设置页之外，首页或顶部给一个更明确的“未登录 / 已同步”提示
- 首次导出备份时顺手引导“登录可自动同步”

---

### P2-2：手动录入与扫码录入的边界还可以更清晰
现在 `home` 页里有 dashboard / entry 两套模式切换，逻辑上能理解，但状态比较多：
- page
- mode
- entryMode
- scannerIntent
- lastEntryMethod
- editingBookId

对代码维护成本偏高，对新用户也不是最直观。

如果后续再加“批量导入 / 拍封面 / OCR”，这里很容易继续膨胀。

---

### P2-3：搜索页筛选还不够强
现在搜索匹配：`title/author/isbn/category/status/location`（`index.html:1291-1296`），基础够用，但如果书越来越多，会想要：
- 只看在读 / 已读 / 想读
- 只看待整理
- 按位置筛选
- 按最近新增排序

---

### P2-4：无障碍做得还不够
UI 看着顺，但无障碍细节偏弱：
- 很多纯图标按钮缺 `aria-label`
- 弹窗 focus trap 没做
- 键盘导航支持一般
- toast / notice 没有 aria-live

对移动端普通用户影响不算最大，但如果要做成熟产品，这是迟早要补的。

---

## 四、按评审维度展开

## 1. 全流程测试（评级：B-）

### 1.1 首次访问
**优点**：
- 首屏很清楚，用户一眼能理解这是书房管理应用
- 未登录也能直接用，不会被账号墙挡住
- 空状态文案清晰

**问题**：
- 云同步能力存在，但入口在设置页，相对被动
- 如果用户从没进设置页，可能根本不知道有账号系统

### 1.2 扫码录书
**整体评价：是本产品最强的主流程。**

亮点：
- 启动摄像头失败时有 fallback 文案：`index.html:2867-2870`, `2967-2971`, `3025-3029`
- ROI 扫描和相机优选有认真做：`index.html:2708-2788`, `2879-2958`
- 成功后 freeze / haptic / success modal，反馈明确
- 重复图书处理比很多小工具成熟

问题：
- 对低端设备、旧 iPhone、权限拒绝后的恢复路径还不够“傻瓜式”
- 扫描视图状态过多，后续继续加功能时容易回归出 bug

### 1.3 手动录入
**评价：可用，但不是最顺。**

优点：
- 输入 ISBN 后自动查元数据
- 自动填充和“清空预填”是对的

问题：
- 对“没有 ISBN 的书”支持不够明确。虽然 technically 能手输标题作者保存，但 UI 心智还是太偏 ISBN。
- `validIsbn()` 允许空 ISBN（`index.html:1438-1440`），这本身没错，但表单提示没有把“无 ISBN 也可保存”讲清楚。

### 1.4 搜索 / 整理
**评价：能用，但还停留在“个人工具”的层级。**

优点：
- 搜索响应直接
- 整理页把待补充信息显式列出，挺实用

问题：
- 缺少更强的过滤器 / 排序器
- “全部入库 / 全部恢复待补充”是高影响操作，但交互较轻，没有二次确认，有误触风险：`index.html:1761-1771`

### 1.5 导出 / 导入
**导出：不错。**
- JSON / CSV 都有，符合家庭数据安全预期

**导入：危险。**
- 校验太浅
- 导入后直接覆盖本地，几乎没有版本/兼容性保护

### 1.6 注册 / 登录 / 云同步 / 多设备 / 登出
这是目前最薄弱的一组流程。

**注册 / 登录**
- 邮箱密码流程基本成立
- Google 登录后端有、前端没接完

**同步**
- 单人、单设备切换少量数据时，大概率能跑
- 真到多设备并发编辑、删除、离线回连，问题就出来了：删除复活、冲突无提示

**登出**
- 只是清本地 token，不是真正 session 管理

### 结论
- 单机主流程：好
- 云端主流程：还没打磨完

---

## 2. 代码安全审计（评级：D）

### 2.1 认证系统

#### PBKDF2
**位置**：`worker/crypto.js:6-35`

优点：
- 有随机盐：`generateSalt()`
- 有 timing-safe compare：`timingSafeEqual()`
- 迭代次数可记录到 DB：`hash_iterations`

问题：
- 100k PBKDF2 在 Worker 场景可以理解，但文档里对 600k/100k 的叙述前后不一致，容易误导：
  - 代码：`crypto.js:6`
  - schema：`schema.sql:11`
  - 文档：`DATABASE_DESIGN.md:59-62`, `281-289`
- 建议把“因为 Worker 限制，所以当前固定 100k”写清楚，并确保 schema / 文档 /代码一致。

#### JWT
**位置**：`worker/crypto.js:52-92`

优点：
- 有 exp / iat
- HMAC-SHA256 没问题

问题：
- 无 refresh、无 revoke、无 jti
- 被盗后 24h 内可持续用

#### Google OAuth
**位置**：`worker/crypto.js:109-157`, `worker/auth.js:118-183`

优点：
- 真做了服务端签名校验，不是“前端信了就算登录”
- 检查了 `iss` / `aud` / `exp`

问题：
- 没检查 `email_verified`
- 没把 Google 登录对应的前端流程补齐

严格说，`sub` 是主标识，`email_verified` 不是绝对必须；但如果你会用邮箱做账号关联（`auth.js:146-158`），那最好显式检查，避免边界场景出事。

### 2.2 Worker API / CORS / Rate limit

这是本项目安全最差的一块。

问题列表：
- CORS `startsWith()` 漏洞：`books-proxy.js:28-30`
- 代理无速率限制：`books-proxy.js:67-105`
- 认证限流只按 IP，容易误伤 NAT / 校园网，也容易被分布式绕过：`middleware.js:33-63`
- 401 / 429 未带 CORS 头：`middleware.js:18-23`, `45-59`

### 2.3 SQL 注入
这里反而是比较稳的。

**优点**：
- D1 查询都用了 `.bind(...)`
- 我没有看到明显字符串拼 SQL 的危险写法

**评级**：这部分 **A-**。

### 2.4 XSS / 前端注入
**是当前前端最大安全问题。**

不仅 `makeNotice()` 有问题，整个文件大量使用 `innerHTML`。多数地方做了 `escapeHtml()`，但不是全部统一，导致“个别漏点就能毁全局”。

建议原则：
- 文本默认 `textContent`
- 只有组件模板层才允许 `innerHTML`
- 如果必须 innerHTML，就保证所有动态值都 escape

---

## 3. UX / 可用性（评级：B）

### 优点
- 首屏信息密度合理
- 扫码动线清晰
- 成功反馈很有“完成感”
- “待补充”这个概念对家庭用户友好，不会逼着一次录完所有字段

### 主要问题
1. **账号 / 同步心智不足**
   - 有能力，但没被产品化讲清楚
2. **导入太技术化**
   - 仍然是贴 JSON，普通用户不会喜欢
3. **一些高影响动作太轻**
   - 全部入库 / 全部恢复待补充
4. **错误恢复路径不够强**
   - 例如网络差、云同步冲突、登录失效时，提示还不够产品化

---

## 4. UI 布局 / 视觉 / 响应式 / 可访问性（评级：B+）

### 做得好的地方
- 视觉语言统一，配色克制，不廉价
- 字体层级合理，书籍类产品用 `Noto Serif SC` 很合适：`index.html:13`
- 卡片、统计区、书架、底栏样式统一性不错
- 移动端优先思路明显

### 不足
- 一些按钮依然偏小，尤其搜索页的扫码按钮 36x36：`index.html:531`。勉强够，但不是舒服的触控尺寸。
- 颜色对比整体还行，但少数 muted 文本在浅背景上略淡。
- 可访问性标签不足。

### 结论
作为独立开发产品，UI 已经在平均线以上；问题更多是**成熟产品的细节债**，不是审美崩坏。

---

## 5. 架构（评级：C+）

### 5.1 单文件 PWA 架构
**优点**：
- 迭代极快
- 部署简单
- 适合个人项目前期探索

**缺点**：
- `index.html` 已经 3092 行，状态与 DOM 拼接耦合越来越重
- 任何一个渲染点 / 事件点回归，都很难局部验证
- 安全治理更难，因为 `innerHTML`、状态变量、网络调用都混在一起

我的判断是：**现在已经接近单文件模式的舒适上限了。**
继续堆功能，不是不行，但成本会上升得很快。

### 5.2 同步策略
设计文档写的是：
- 离线优先
- `updatedAt` newer wins
- 启动 pull、变更后 debounce push

方向没错，但现实实现还比较脆：
- push 传的是**全部书籍**，不是变更集：`index.html:675-678`
- pull 现在直接强制 full pull：`index.html:690-697`
- 删除 tombstone 传播不完整
- conflicts 有但没处理

这说明当前同步更像“轻量云备份”，还不是成熟的“多端同步引擎”。

### 5.3 offline-first 现状
理论上是 offline-first，实际上线上 SW/manifest 404，离线能力目前不成立。

所以架构叙事上要诚实一点：
- **本地数据优先**：成立
- **PWA 离线缓存完善**：暂未成立
- **多端可靠同步**：部分成立，但不稳

---

## 五、最值得立刻做的 8 件事（按优先顺序）

1. **修 CORS**：禁止 `startsWith()`，改精确 origin 比对
2. **封住 XSS**：让 `makeNotice()` 默认 escape；排查所有 `innerHTML`
3. **修部署**：让 `manifest.json`、`sw.js`、icons 在线上真能访问
4. **给 Books 代理加限流 + 参数白名单 + maxResults clamp**
5. **修同步删除传播**：full pull 必须能传 tombstone
6. **处理 conflicts**：至少前端要提示并回拉云端版本
7. **补齐或砍掉 Google 登录前端**：不要让文档和产品行为不一致
8. **加强导入 schema 校验**：避免脏数据 / 恶意数据进入本地

---

## 六、结论

### 我会怎么定义它当前的产品状态
- **本地版家庭书房工具**：已经很不错，甚至有点惊喜。
- **带账号同步的正式云产品**：现在还不能放心说“稳”。

### 最核心的一句话
**这个项目的问题，不在“做不出来”，而在“已经做出很多功能，但安全和同步还没跟上产品野心”。**

只要把我上面列的 P0 / P1 收掉，这个产品的可信度会提升一大截。

---

## 附：分项评分表

- 全流程测试：**B-**
  - 本地主流程强，云流程未闭环
- 代码安全审计：**D**
  - CORS、XSS、公开代理问题拉低总分
- UX / 可用性：**B**
  - 扫码与整理体验好，账号/同步心智不足
- UI / 布局 / 设计：**B+**
  - 视觉统一，移动端友好，细节仍可抠
- 架构：**C+**
  - 单文件前期优势明显，但已接近规模拐点
