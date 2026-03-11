# Receipt Renamer 审计报告（私有副本）

**项目：** receipt-renamer + receipt-proxy  
**日期：** 2026-03-10  
**说明：** 此文件为私有审计副本，不应进入公开仓库。

---

## 1. Executive Summary

### 总判断

这个产品现在的状态可以概括为：

- **产品方向：对**
- **用户体验：很多关键判断是对的**
- **技术架构：MVP 合理**
- **安全壳层：还不够硬**

### 最大风险

当前最值得优先处理的，不是识别效果，而是：

1. **Worker 可被滥用，直接造成 Gemini API 成本损失**
2. **Quota 机制可以被绕过**
3. **前端缓存与 token 持久化存在隐私 / 安全放大风险**
4. **Drive / Sheets 之间缺少一致性保障，可能导致账目静默缺失**

### 适合当前定位

- 适合继续快速迭代
- 适合你自己和少量熟人内测
- **不建议在修掉高危项之前放量公开传播**

---

## 2. 审计范围

### 实际检查内容

#### 前端主要文件
- `src/App.jsx`
- `src/services/google.js`
- `src/services/ai.js`
- `src/services/processor.js`
- `src/services/imageCache.js`
- `src/services/pendingQueue.js`
- `src/views/SetupView.jsx`
- `src/views/ScanView.jsx`
- `src/views/ReviewView.jsx`
- `src/views/ConfigView.jsx`
- `public/sw.js`
- `src/main.jsx`

#### Worker
- `receipt-proxy/src/index.js`
- `receipt-proxy/wrangler.toml`
- `receipt-proxy/README.md`

#### 线上暴露面
- `https://horancheng.github.io/receipt-renamer/`
- `https://receipt-proxy.henrycdev26.workers.dev/api/analyze`
- `https://receipt-proxy.henrycdev26.workers.dev/api/quota`
- `https://receipt-proxy.henrycdev26.workers.dev/api/debug/gemini`

#### 本地验证
- 前端构建通过
- 前端测试存在失败 / 漂移
- Worker 无测试脚本

---

## 3. 风险总表（按优先级）

| 等级 | 问题 | 风险类型 | 影响 |
|---|---|---|---|
| Critical | Worker 信任前端传入 `uid` | 安全 / 成本 | 可伪造身份、绕过配额、烧 API 费用 |
| Critical | Worker 允许任意站点跨域调用 | 安全 / 滥用 | 变成公开可刷的 AI 代理 |
| Critical | Worker 无请求体大小 / MIME 限制 | 可用性 / 成本 | 可被超大 payload / PDF / 图片滥用 |
| High | Quota 计数非原子 | 成本 / 稳定性 | 并发绕过额度 |
| High | Debug 接口仍公开 | 信息泄露 | 给攻击者情报 |
| High | 前端保留危险直连 AI fallback | 配置风险 | 误部署时泄露付费 API key |
| High | Google token 持久化在浏览器存储 | 安全 / 隐私 | 一旦 XSS/扩展泄露，Drive 权限暴露 |
| High | 自动命名仍在部分路径使用 category 而非 merchant | 业务正确性 | 核心承诺未完全兑现 |
| Medium | Service worker 过度缓存 | 隐私 / 稳定性 | 可能缓存私有内容、登出后残留 |
| Medium | sign out / reset 未彻底清空本地图片缓存 | 隐私 | 共享设备残留收据图片 |
| Medium | Sheets 写入失败被静默吞掉 | 数据一致性 | Drive 成功但表格漏记 |
| Medium | 大文件 base64 转换重内存 | 稳定性 | 手机卡死 / 崩溃 |
| Medium | remember me 状态流不完整 | 体验 / 状态一致性 | 登录行为不稳定 |
| Low | 测试漂移 | 工程质量 | 回归 bug 容易漏 |
| Low | 文档与实现有漂移 | 维护性 | 后续自坑 |
| Low | 页面禁缩放等细节 | 可访问性 | 影响无障碍和阅读体验 |

---

## 4. 详细发现

### Critical

#### C-1 Worker 信任前端裸传 `uid`
- 结果：可伪造用户、绕过 quota、代烧费用。
- 建议：用 Google ID token / Worker 验签后再得到 `sub`。

#### C-2 Worker 允许任意 Origin 跨域访问
- 结果：任何网页都能把你的 Worker 当公共 API 用。
- 建议：加 Origin allowlist。

#### C-3 Worker 无请求大小 / MIME 限制
- 结果：可被超大 payload、恶意文件拖慢或刷费。
- 建议：限制 MIME、大小、文件类型。

### High

#### H-1 Quota 计数非原子
- 结果：并发超发，统计不准。
- 建议：Durable Objects / 原子计数。

#### H-2 Debug 接口公开
- 结果：暴露 key hint、模型可用性等情报。
- 建议：删除或只允许管理员访问。

#### H-3 浏览器直连 AI fallback 危险
- 结果：误配置时可能把付费 key 打进前端。
- 建议：生产环境 fail closed。

#### H-4 Google access token 持久化在浏览器
- 结果：XSS / 扩展 / 共享设备时风险放大。
- 建议：优先内存存储 + CSP。

#### H-5 自动命名仍部分使用 category
- 结果：核心业务逻辑与产品承诺不一致。
- 建议：统一 merchant 命名。

### Medium

#### M-1 Service worker 缓存过宽
- 结果：可能缓存私有内容、残留登出后数据。
- 建议：只缓存 same-origin 静态资源。

#### M-2 sign out / reset 未清空本地敏感缓存
- 结果：共享设备可能残留小票图片。
- 建议：统一清空 image cache / pending queue / alerts。

#### M-3 Sheets 写入失败静默吞掉
- 结果：Drive 成功但表格漏记。
- 建议：加 outbox / retry / UI 提示。

#### M-4 base64 转换过于吃内存
- 结果：大文件下手机卡顿或崩溃。
- 建议：限制尺寸 + 优化转换链路。

#### M-5 remember me 状态流不完整
- 结果：登录恢复行为不稳定。
- 建议：统一到 config 单一真相源。

### Low

#### L-1 测试漂移
- 建议优先补 processor / review / quota / 清缓存测试。

#### L-2 文档与实现漂移
- 建议整理为 docs/ARCHITECTURE.md、SECURITY.md、ROADMAP.md。

#### L-3 无障碍和缩放细节
- 建议放开页面缩放、加强可读性和触控容错。

---

## 5. 市场与产品判断

### 你做得好的地方
- 切口对：不是单纯 OCR，而是“识别后变成可管理资产”
- 数据 ownership 强：文件在用户自己的 Google Drive
- 异步拍照体验正确
- Review queue 思路成熟
- 中文体验好

### 当前不足
- 第二价值层不够强（洞察、税务、保修、退货）
- 多设备状态不完整
- merchant intelligence 还需增强

### 竞品
- Expensify
- Smart Receipts
- Shoeboxed
- SparkReceipt
- Dext
- Veryfi

### 未来方向
1. 个人票据管家
2. 澳洲 freelancer / 小商户税务助手
3. 从 receipt 扩成 document inbox

---

## 6. 修复顺序

### 第一优先级：先保命
1. 删除 `/api/debug/gemini`
2. Worker 不再信任前端裸传 `uid`
3. 增加 body size 限制 + MIME allowlist
4. 收紧 CORS origin
5. 增加真正的 quota / rate limit 防护
6. 修 processor 命名逻辑（category → merchant）

### 第二优先级：补可靠性
7. sign out / reset 清理所有本地敏感缓存
8. 修 service worker 注册与缓存策略
9. 给 Sheets 增加补偿 / retry / 未同步提示
10. 修 remember me 状态流
11. 修测试

### 第三优先级：拉开产品差距
12. merchant normalization / alias memory
13. 更强的 review queue
14. analytics / 月度洞察
15. tax / warranty / return 等场景

---

## 7. 最终结论

### 是否值得继续做？
**值得。**

### 是否适合公开放量？
**暂时不建议。** 至少先修高危项。

### 最准确评价

> 产品脑子是对的，体验已经有亮点，但安全壳子还没焊完。
