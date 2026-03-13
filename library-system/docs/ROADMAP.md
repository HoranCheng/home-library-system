# 毛毛书房 产品路线图 & Checklist

> 目标：从个人工具 → 面向大众的成熟产品
> 基于 Claude × Gemini 联合代码审计（2026-03-13）制定
> ✅ = 已完成 | ⬜ = 待做 | 🔄 = 进行中

---

## Phase 0 — 立即修复（P0，合计 ~1天）

> 这些是审计双方一致认为必须先做的，不做会伤用户信任

- ✅ **备份提醒条** — `saveBooks()` 计数，10本新增或7天未导出时首页非侵入提示
- ✅ **记录上次导出时间** — localStorage 存 `lib:export:last:v1`，设置页显示
- ✅ **API 失败区分** — "未找到此书" vs "网络错误请重试" vs "查询超时" 三种不同提示
- ✅ **fetch 超时控制** — AbortController，建议 8s/请求
- ✅ **连续录入保留分类** — `clearDraftFields` 加 `keepCategory` 选项
- ✅ **修复 sw.js / manifest.json 404** — PWA 有声明但实际不工作

---

## Phase 1 — 产品化基础（~1个月）

> 从"能用"到"敢给别人用"

### 1.1 前端模块化重构
- 🔄 拆分为 ES Modules（5/12 完成：constants, utils, storage, auth, sync）
- ✅ 引入构建工具（Vite 已配置）
- ⬜ 迁移测试到模块化结构
- ⬜ 消除全局变量，改用模块作用域
- ⬜ 注意事项：
  - 不需要引入 React/Vue，vanilla JS + modules 足够
  - 保持单页应用结构
  - CSP 可以去掉 `unsafe-inline`（构建工具会打包）
  - 预算：2-3周，是整个路线图最大的工程投入

### 1.2 云同步前端集成
- ✅ 设置页登录/注册表单 UI
- ⬜ Google Sign-In 集成（`gsi` 库）
- ✅ SyncManager 激活 — debounced auto-push、启动时 pull
- ✅ 同步状态指示器（已同步/同步中/同步失败）
- ✅ 首次登录数据合并流程
- ✅ 离线队列 — 断网时缓存操作，联网后重放（含指数退避重试）
- ⬜ 注意事项：
  - Horan 需要先设置 `GOOGLE_CLIENT_ID`（`wrangler secret put`）
  - 后端已全部就绪并验证通过
  - 冲突策略暂用 Last Write Wins（Phase 3 升级）

### 1.3 备份体验产品化
- ✅ 导入支持**合并模式**（基于 ISBN 去重，newer wins）
- ✅ 导出前显示摘要（X本书、最近修改时间）
- ✅ 导入后显示 diff（新增N本、更新N本、跳过N本）

---

## Phase 2 — 公测就绪（~1-2个月）

> 从"敢给别人用"到"别人愿意一直用"

### 2.1 中文书数据源
- ⬜ 调研付费 API（ISBNdb / ISBN.cloud / Google Books 付费配额）
- ⬜ 评估自建爬虫可行性（豆瓣/当当网页解析 — 灰色地带，需评估风险）
- ⬜ 用户众包方案设计 — 查不到的书手动录入后贡献到共享库
- ⬜ D1 共享书目缓存表 — 用户A查到的书，用户B直接命中
- ⬜ 注意事项：
  - 豆瓣 API 已关闭公共访问
  - 当当/京东没有公开 ISBN API
  - jike.xyz apikey 注册暂停
  - 这是最大的业务瓶颈，但没有银弹，需要组合方案

### 2.2 封面图片防腐
- ✅ Worker 图片代理接口（`/cover/:isbn` → Open Library → Bookcover → CF Cache 7天）
- ⬜ 或 R2 存储桶转存缩略图（当前用 CF Cache，R2 可选升级）
- ✅ 前端 `coverUrl` 改为指向自己的代理
- ⬜ 注意事项：
  - R2 免费额度：10GB 存储 + 1000万次读取/月，够用
  - 500本书 × 50KB/封面 ≈ 25MB，远低于限额

### 2.3 性能优化
- ✅ IntersectionObserver 分页渲染（60本/页，滚动自动加载）
- ✅ 图片懒加载（`loading="lazy"` 全覆盖）
- ⬜ 基准测试：500 / 1000 / 5000 本书的渲染性能
- ✅ render() 输入事件去抖（120ms debounce，减少打字时整页重绘）

### 2.4 合规 & 信任
- ⬜ 隐私政策页面
- ⬜ 用户协议
- ⬜ 数据存储说明（本地+云端，用户可选）
- ✅ 账号删除功能（GDPR — 二次确认 + Worker DELETE /auth/account）

### 2.5 体验打磨
- ✅ Skeleton shimmer loading（ISBN 查询时显示骨架屏）
- ✅ Phase 2 enrichment 失败时给轻 toast 提示
- ✅ 空状态引导（首次使用 onboarding 卡片 + CTA）
- ✅ 扫码补全后智能折叠已填字段

---

## Phase 3 — 规模化（按需）

> 从"别人愿意用"到"很多人同时用"

### 3.1 多端 & 国际化
- ✅ i18n 框架 — 中/英双语翻译文件就绪（src/js/i18n.js），待接入前端
- ⬜ PWA → App Store 打包（Capacitor 或 TWA）
- ⬜ 响应式布局扩展到 tablet/desktop
- ✅ 语言切换（设置页中英文切换，i18n 框架就绪）

### 3.2 数据 & 同步升级
- ⬜ 字段级冲突合并（替代 Last Write Wins）
- ⬜ 同步历史 / 版本回滚
- ✅ 可打印 HTML 书单导出（按分类分组，支持打印/PDF）
- ⬜ Notion 导入格式

### 3.3 基础设施
- ⬜ 自定义域名 + CDN 优化
- ✅ 客户端错误收集（sessionStorage log + window.onerror + unhandledrejection）
- ✅ Rate limiting 已实现（per-key 30/60 req/min，cover 60/min）
- ✅ Playwright E2E 测试框架搭建（e2e/app.spec.ts，5 个用例）

### 3.4 增长 & 社区
- ✅ 公开书单分享（Worker /share/* + 前端 ?share=TOKEN 只读视图）
- ✅ 用户反馈入口（设置页 → 提交到 API 或 fallback GitHub Issues）
- ⬜ 更多数据源集成
- ⬜ AI 功能（书评摘要、阅读推荐 — 等核心稳定后再做）

---

## 已完成的里程碑 ✅

> 以下是审计确认代码中已存在的功能

- ✅ 核心扫码 → API查询 → 预填 → 保存链路
- ✅ 两阶段 API 查询（Fast Path + Background Enrich）
- ✅ 5 数据源集成（Google Books × 3 + Open Library × 2 + Crossref + Bookcover）
- ✅ ISBN 10↔13 双向转换 + alt ISBN 重查
- ✅ 重复检测双保险（ISBN + 书名/作者）
- ✅ 连续录入模式 + 计数器 + 多巴胺递进弹窗
- ✅ 位置记忆（最近8个）+ 连续录入保留位置
- ✅ 分类 chip 快选 + 60+ 英→中翻译映射
- ✅ 待补充机制（不完整自动标记）
- ✅ ROI 画布扫描优化（中心30%区域 + 隔帧扫描）
- ✅ 智能镜头选择（`pickBestCamera`）
- ✅ Haptic feedback 差异化（扫到码 vs 保存成功）
- ✅ 多语言偏好检测（基于书库语言分布）
- ✅ 数据来源标记（`metadataSources` + 详情页显示）
- ✅ 自动填充视觉标记（`.auto-filled` class）
- ✅ Worker proxy 隐藏 API key
- ✅ PWA 基础设施（manifest + sw 声明）
- ✅ 后端 auth 系统（register/login/Google OAuth/JWT）
- ✅ 后端 sync API（push/pull/status）
- ✅ D1 数据库（5表 schema）
- ✅ PBKDF2-SHA256 密码哈希（100k iterations）
- ✅ JSON 导出/导入 + CSV 导出
- ✅ Ghost Nav + 字母 scrubber + wander carousel
- ✅ 書海漫遊（随手一本）+ 收藏画廊

---

## 审计评分参考

| 维度 | 当前分数 | 目标（Phase 2 后） |
|------|:---:|:---:|
| UI/UX | 8.0 | 9.0 |
| 前端实现 | 6.5 | 8.0 |
| 数据架构 | 7.5 | 8.5 |
| 核心业务 | 8.5 | 9.0 |
| 用户信任 | 7.0 | 8.5 |
| 产品阶段 | 7.5 | 8.5 |
| **综合** | **7.3** | **8.6** |

---

*最后更新：2026-03-13 | 基于 Claude × Gemini 联合代码审计*
