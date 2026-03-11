# 毛毛书房 审计报告（私下阅读版）

日期：2026-03-10
范围：`preview/index.html`、`worker/books-proxy.js`、PWA/Pages 部署、第三方依赖、竞品与产品方向

---

## 一句话结论

整体判断：**现在适合继续做个人/小范围测试，不适合直接当“稳态、可公开传播的正式产品”大规模放量。**

最大风险不在“用户资产被直接盗走”，而在以下几类：

1. **Worker API key / quota 被别人滥用** → 可能导致 API 配额耗尽、以后若开计费可能产生费用
2. **部署链不完整** → 线上 PWA 关键资源实际 404（manifest / sw / icons），影响稳定性与安装体验
3. **存在可利用的 XSS 注入点**（主要来自导入数据 / 书名等进入 `innerHTML`）
4. **前端单文件架构已变得很大** → 后续维护、回归测试、隐性 bug 风险在升高
5. **对第三方公开 API 依赖较重** → 一旦限流、变更、网络慢，体验会明显退化

---

## 审计范围与方法

### 代码检查
- `preview/index.html`
- `worker/books-proxy.js`
- `preview/sw.js`
- `preview/manifest.json`
- `.github/workflows/pages.yml`

### 实测/验证
- 跑了现有测试：**57/57 通过**
- 检查了线上站点响应头与资源存在性
- 检查了 Worker 的 CORS 行为
- 检查了 Google Books / Open Library / Bookcover 的真实返回

---

## 二、最高优先级问题（建议先修）

## P0-1：Worker 的 CORS 白名单判断有漏洞，可被伪造域名绕过

**文件**：`worker/books-proxy.js`

```js
function isAllowedOrigin(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));
}
```

### 问题
你现在用的是 `startsWith()`。
这意味着下面这种恶意来源也会被当成合法：

- `https://horancheng.github.io.evil.com`

我已经验证过，Worker 会回：

- `Access-Control-Allow-Origin: https://horancheng.github.io.evil.com`

### 风险
- 恶意网站可以在浏览器里直接调用你的代理
- 滥用你的 Google Books API key 配额
- 如果以后 Worker / API 有计费，存在**真实费用风险**

### 修复建议
- 改成 **严格 Origin 精确匹配**，不要 `startsWith`
- 本地开发场景也要精确到完整 origin，例如：
  - `http://localhost:4173`
  - `http://127.0.0.1:4173`
- 另外建议把 `Origin` 为空时默认拒绝，而不是回默认站点 origin

---

## P0-2：Worker 是“公开代理”，别人直接 curl 也能打，不只是 CORS 问题

**文件**：`worker/books-proxy.js`

### 问题
CORS 只能限制浏览器前端，**挡不住服务端脚本 / curl / bot**。
你的 Worker 现在任何人都可以直接访问：

```txt
https://maomao-books-proxy.henrycdev26.workers.dev/?q=...
```

### 风险
- API key 配额被打爆
- 产品元数据查询整体瘫痪
- 未来若启用付费计划，可能出现费用损失

### 修复建议
至少做其中两层：

1. **Cloudflare Rate Limiting / WAF**
2. Worker 内限制：
   - 只允许白名单参数
   - `maxResults` 上限强制裁剪（例如最多 5）
   - 只允许查询 Google Books 合法字段（如 `q`, `langRestrict`, `maxResults`, `startIndex`, `projection`, `printType`, `orderBy`）
3. **Cache API / edge cache** 减少真实打到 Google 的次数
4. 更进一步：增加一个轻量签名机制 / app token（如果未来公开更广）

---

## P0-3：线上 PWA 关键资源实际没有部署成功（404）

### 已验证的线上结果
以下地址当前是 **404**：

- `/manifest.json`
- `/sw.js`
- `/icon-192.svg`
- `/icon-512.svg`

### 根因
GitHub Pages workflow 只同步了：
- `index.html`
- `vendor/`

但没同步：
- `manifest.json`
- `sw.js`
- icons

### 影响
- PWA 安装体验不完整 / 基本不可用
- Service Worker 注册失败（虽然你 catch 了，所以用户看不到报错，但功能没生效）
- 图标缺失
- “已上线 PWA”的产品感知与实际状态不一致

### 修复建议
更新 Pages workflow，把这些文件一起同步：
- `library-system/preview/manifest.json -> docs/manifest.json`
- `library-system/preview/sw.js -> docs/sw.js`
- `library-system/preview/icon-192.svg -> docs/icon-192.svg`
- `library-system/preview/icon-512.svg -> docs/icon-512.svg`
- 以及其他静态资源目录统一复制

---

## P0-4：存在 XSS 注入点，恶意导入数据可执行 HTML/脚本片段

**文件**：`preview/index.html`

### 关键点
`makeNotice()` 直接把 `text` 拼进 `innerHTML`：

```js
function makeNotice(kind, text) { return `<div class="notice ${kind}">${text}</div>`; }
```

但有些调用把**未转义的用户/外部数据**传进去，例如：

```js
els.manualNotice.innerHTML = makeNotice('ok', `已更新：${title}${...}`);
els.manualNotice.innerHTML = makeNotice('err', `保存失败：${e.message || '未知错误'}`);
els.settingsNotice.innerHTML = makeNotice('err', `校验失败：${e.message}`);
els.settingsNotice.innerHTML = makeNotice('err', `导入失败：${e.message}`);
```

### 为什么危险
如果有人导入一个恶意 JSON，书名设成：

```html
<img src=x onerror=alert(1)>
```

就可能在某些提示场景里被直接插入 DOM。

### 风险等级
- 对“你自己离线自用”来说，不是最高概率
- 但对“公开网页 + 可导入外部 JSON”来说，这是**真实的前端注入风险**

### 修复建议
二选一：

1. **makeNotice 内统一 escape**
2. 或者所有动态文本传入前全部 `escapeHtml()`

推荐第一种：
- `makeNotice(kind, text)` 默认把 `text` 当纯文本处理
- 若真的要支持富文本，单独做 `makeNoticeHtml()`

---

## 三、高优先级问题（建议近期修）

## P1-1：Service Worker 缓存策略过粗，会缓存“所有 GET 请求”

**文件**：`preview/sw.js`

```js
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) {
      const c = r.clone();
      caches.open(CACHE).then(cache => cache.put(e.request, c));
    }
    return r;
  }).catch(() => caches.match(e.request)));
});
```

### 问题
它会尝试缓存所有 GET，包括：
- HTML
- 字体
- 第三方资源
- 未来如果加更多接口，也会一起进缓存

### 风险
- 缓存内容不可控
- 升级后 stale 资源难排查
- 占用缓存空间
- 第三方资源缓存策略与你自己的产品意图不一致

### 修复建议
改成 **白名单缓存**：
- 仅缓存站内静态资源（html/css/js/icons/vendor）
- 外部 API 走 network-only 或单独策略
- 缓存版本号管理更明确

---

## P1-2：没有 CSP（Content Security Policy）

### 问题
页面没有 CSP。

### 风险
如果未来再出现一个 XSS 点，攻击面会被放大。
另外你页面里有：
- inline script
- external fonts

如果以后再接入第三方脚本，会更危险。

### 修复建议
先上一个务实版本：
- `default-src 'self'`
- `img-src 'self' data: https:`
- `connect-src 'self' https://maomao-books-proxy... https://openlibrary.org https://covers.openlibrary.org https://bookcover.longitood.com https://api.crossref.org`
- `font-src 'self' https://fonts.gstatic.com`
- `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
- `script-src 'self' 'unsafe-inline'`

后续再逐步去掉 inline script。

---

## P1-3：第三方元数据依赖过多，失败时体验容易抖动

### 当前依赖
- Google Books
- Open Library
- Bookcover
- Crossref

### 风险
- 任意一个接口慢/挂/限流，都会造成：
  - 录入慢
  - 信息不完整
  - 用户误判为“扫码失败”
- 这些都不是你可控的 SLA

### 修复建议
- 每个外部请求加 `AbortController` 超时（例如 2.5s / 4s）
- 给每一层 source 打分并做更稳的 merge
- 把“拿不到分类”和“拿不到标题作者”分级处理
- 做结果缓存（ISBN -> metadata）

---

## P1-4：部署链分叉，preview / docs / root docs 存在混乱风险

### 问题
当前存在多个“像正式产物”的目录：
- `library-system/preview`
- `library-system/docs`
- repo 根 `docs`

而 Pages workflow 又只同步部分文件。

### 风险
- 本地测试正常，线上不是同一套东西
- 修了 A 目录，漏了 B 目录
- 容易出现“你以为上线了，实际没上”的情况

### 修复建议
统一一个原则：
- **只有一个 source of truth**（建议 `library-system/preview/`）
- 构建脚本一次性完整复制到最终发布目录
- 别再手动 cp 单个文件

---

## P1-5：导入 JSON 校验较浅，容易被脏数据/极端数据拖垮

### 问题
当前导入只校验：
- `books` 是数组
- `meta` 存在

但没有校验：
- 单本字段类型
- 长度上限
- 书名/作者/notes/description 是否过大
- 是否存在异常 URL / 异常对象结构

### 风险
- UI 卡顿
- localStorage quota exceeded
- 渲染异常
- 注入面扩大

### 修复建议
导入时做 schema 校验：
- `title/author/category/location` 长度限制
- `description/notes` 上限
- `coverUrl` 只允许 `https:` / `data:`（若你愿意）
- 非法字段直接丢弃

---

## 四、中优先级问题（结构 / 可靠性 / 设计）

## P2-1：`index.html` 已经接近“大型单文件应用”，维护成本上升

### 现状
逻辑、样式、数据、扫描、搜索、导入导出、PWA、元数据整合几乎都堆在一个 HTML 文件里。

### 风险
- 以后每次改动都容易带回归 bug
- 很难拆分测试
- 新人/未来的你读起来会越来越吃力

### 建议拆分
至少拆成：
- `storage.js`
- `metadata.js`
- `scanner.js`
- `ui-render.js`
- `detail-modal.js`
- `styles.css`

你未必要上框架，但**模块化**已经值得做。

---

## P2-2：没有真正的 e2e 浏览器测试

### 现状
现有测试 57/57 通过，这是好事。
但更偏单元/烟雾，不足以覆盖：
- 摄像头流程
- PWA 安装
- 实际部署资源 404
- iPhone Safari 行为

### 建议
补最少量 Playwright / browser smoke：
- 首页可打开
- manifest / sw / icons 存在
- 扫码入口能打开（mock camera）
- 导入/导出 JSON
- 搜索/详情弹窗

---

## P2-3：外部字体会引入隐私与合规成本

### 问题
你使用 Google Fonts：
- `fonts.googleapis.com`
- `fonts.gstatic.com`

### 风险
公开站点会把用户 IP 暴露给第三方。
如果以后你做正式公开产品，尤其面向海外，需要在隐私说明里写清楚。

### 建议
- 直接自托管字体
- 或对外公开前补隐私说明

---

## P2-4：封面 / 元数据第三方 URL 会暴露用户访问行为

### 风险
每次渲染封面，会向外部请求：
- Open Library covers
- Bookcover
- Google Books thumbnails

### 含义
不是“资金被盗”那种风险，而是：
- 第三方知道有人在访问这本书
- 能看到用户 IP / UA / 时间

### 建议
如果以后做成正式公开产品：
- 封面也可以考虑经你自己的 Worker 代理 / 缓存
- 或写清楚隐私说明

---

## P2-5：Worker 未限制参数集合，理论上可被用来放大请求

### 问题
当前把 query string 原样转发给 Google Books：

```js
for (const [key, value] of searchParams) {
  gbUrl.searchParams.set(key, value);
}
```

### 风险
攻击者可传奇怪参数、超大 `maxResults`、无意义字段，增加上游消耗。

### 建议
白名单参数 + 强制上限：
- `maxResults <= 5`
- `startIndex <= 某个上限`
- 其他字段直接丢弃

---

## 五、当前没看到的严重问题（这部分是好消息）

以下我**暂时没发现明显高危问题**：

1. **没有把 API key 暴露在前端源码里**
2. 核心渲染处很多地方已经用了 `escapeHtml()`，说明你已经在防注入
3. 本地数据都在浏览器 localStorage，默认不是“服务器集中泄露”模型
4. 没有看到明显的账号体系 / 支付体系 / 密码体系，因此也没有典型账号盗取面
5. 现阶段更像“离线优先单机工具”，这天然降低了很多后端攻击面

所以：

> **短期内最大的财产风险不是“别人偷你的钱”，而是“别人打爆你的 API 配额 / 让功能瘫痪 / 未来产生第三方 API 费用”。**

---

## 六、产品设计与合规视角

## 你做得好的地方

### 1）定位非常清楚：
不是“社交读书”，而是“快速把家里的实体书录入并管起来”。

这个方向对用户来说非常具体：
- 有任务闭环
- 有成就感
- 扫描 → 入库 → 看到书架

### 2）移动端优先是对的
用户真实场景就是站在书架前拿手机扫。
不是先坐到电脑前再录。

### 3）你比很多竞品更在意中文场景
这很重要。
多数国外竞品对中文 ISBN / 中文分类 / 中文书名体验不够稳。
你已经在修：
- 中文优先
- 不自动乱翻译
- CJK 优先于拼音
- 分类中文化

这是你的核心差异化之一。

### 4）扫码链路已经有“产品感”了
你不是只有“功能能用”，还加了：
- 智能镜头
- 闪光灯
- 连续扫码
- 重复弹窗
- 成功弹窗
- 6 秒提示

这会直接决定用户愿不愿意持续录完整个书架。

---

## 你做得还不够好的地方

### 1）“录入正确率”还没达到产品护城河级别
对这类产品来说，**最关键 KPI 不是页面美观，而是：扫 100 本，有多少本一次就对。**

只要：
- 分类怪
- 中文变拼音
- 册数丢了
- 标题副标题乱了

用户会立即失去信任。

### 2）PWA / 发布链路还没真正产品化
现在更像“能访问的网页”，还不是完整的“安装型产品”。

### 3）数据安全仍然偏脆弱
目前核心数据只在 localStorage：
- 换浏览器没了
- 清缓存可能没了
- 没自动云备份

对“花几小时录完一整个书架”的用户来说，这种风险很真实。

### 4）编辑流还比较临时
“回填录入表单”对 MVP 合理，但长期会显得不够丝滑。
应该逐渐变成：
- 详情页编辑
- drawer / card / modal 编辑
- 局部改动不打断主流程

---

## 七、市场调研：类似产品有哪些

结合检索结果，最接近你的竞品大致分四类。

## A. 个人藏书编目型（最像你）

### 1）CLZ Books
- 强项：扫描快、资料全、收藏管理成熟、商业化成熟
- 弱项：订阅制、中文场景不一定强
- 启发：它证明“收藏管理”是可以持续付费的赛道

### 2）BookBuddy
- 强项：iOS 体验成熟、字段多、借阅/位置管理完整
- 弱项：更像传统 catalog app，产品气质没你现在这么轻快

### 3）Libib
- 强项：免费额度高、支持多媒体、云同步
- 弱项：更偏“数据库”，不够为中文家庭书架优化

### 4）LibraryThing
- 强项：元数据强、社区强、专业感强
- 弱项：对普通用户不够轻，产品门槛更高

### 5）Handy Library / Book Tracker / BiblioBay
- 强项：针对家庭藏书、条码导入直接
- 弱项：中文与本地化未必占优

## B. 社交读书型
- Goodreads
- 藏书馆

这类产品重点不是“把家里的实体书快速盘清”，而是：
- 社交
- 书评
- 阅读记录
- 推荐

你的路径和它们不同，不建议一开始学它们。

## C. 中文/本地化轻量工具
检索里还出现一些中文向工具，如：
- 书非借
- 私家书藏
- Bookshelf（开源 Android）
- MyBookshelf

这些产品说明：
- 中文用户对“家庭图书管理”确实有需求
- 但很多产品不够现代、不够扫得爽、不够产品化

这反而是机会。

## D. 面向机构/采购/盘点工具
- 番薯借阅图书管理系统
- 图采 / 盘点类产品

这些更偏 B 端，不是你当前主战场。

---

## 八、你的差异化优势（我认为最值得继续放大的）

## 1）中文实体书家庭场景
这是你最天然的优势。

如果你把下面几件事做到极致：
- 中文 ISBN 命中率
- 中文标题/作者稳定正确
- 中文分类自然
- 多册/卷/部识别好
- iPhone 扫码顺手

你就已经和很多国外竞品拉开差距了。

## 2）“录入爽感”而不是“数据库感”
大部分竞品像管理工具，你现在更像“能让人停不下来的收纳产品”。
这个方向是对的。

## 3）超轻量、免注册、开箱即用
这是非常强的传播点：
- 打开网页就能用
- 不用注册
- 不用配 key
- 不用学复杂系统

## 4）未来可走 Web → PWA → iOS App 的自然路径
你已经有 Capacitor iOS 方向，这条路很合理。

---

## 九、未来最值得发展的方向

## 第一阶段：把“录入正确率 + 稳定性”做到产品级
这比加新功能更重要。

### 应该优先做
1. 元数据 merge 继续打磨
2. 多册/副标题/版本识别
3. 分类清洗
4. 失败兜底（手动修改更顺滑）
5. 部署/PWA链路修正
6. Worker 防滥用

> 先把“录一本书几乎不出错”做到极致。

## 第二阶段：把“整理与找书”做强
- 更好的搜索去重
- 位置体系（房间 / 书架 / 层）
- 批量编辑
- 快速盘点模式
- 缺信息图书工作台

## 第三阶段：把“数据安全”做出来
- 自动备份
- 一键导出
- iCloud / 云同步（可选）
- 本地数据库（SQLite）

## 第四阶段：可选商业化/扩展
### 可能方向
1. **高级版 / Pro**
   - 云同步
   - 多设备
   - 智能封面修复
   - AI 书架识别
   - 批量盘点

2. **收藏家方向**
   - 购入价格
   - 版本/版次
   - 估值
   - 缺卷提醒

3. **家庭共享方向**
   - 多人家庭书架
   - 借阅记录
   - 谁拿走了哪本书

4. **书房管理系统方向**
   - 书架地图
   - 房间/柜子/层级视图
   - 盘点模式

我个人判断：

> **最有前途的，不是做成 Goodreads 2.0，而是做成“中文家庭实体书管理里最好用的那一个”。**

---

## 十、建议优先级路线图

## 立刻修（本周）
- [P0] Worker 严格 origin 校验
- [P0] Worker 限流 / 参数白名单 / maxResults 上限
- [P0] Pages workflow 同步 manifest/sw/icons
- [P0] 修掉 `makeNotice()` 注入风险

## 很快修（1~2 周）
- [P1] fetch 超时控制
- [P1] service worker 改白名单缓存
- [P1] 加 CSP
- [P1] 导入 schema 校验
- [P1] 做一个线上 smoke checklist

## 接下来（2~4 周）
- [P2] 拆模块
- [P2] 真机回归测试脚本
- [P2] 编辑流 drawer/card 化
- [P2] 数据备份/恢复体验加强

---

## 最后结论

如果站在产品人的角度：

> 这产品方向是对的，而且你已经抓住了最关键的那个瞬间：**扫码入库这件事正在变得爽。**

如果站在工程/安全角度：

> 目前最大的真实风险不是“黑客立刻入侵你账户”，而是：
> **公开代理被滥用、PWA 发布链不完整、以及前端仍有少量注入面。**

所以我的判断很明确：

- **值得继续做，而且有差异化潜力**
- 但在公开扩散前，先把上面 4 个 P0 修掉
