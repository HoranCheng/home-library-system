# Changelog

All notable changes to this project will be documented in this file.
Format: [Semantic Versioning](https://semver.org/)

---

## [0.5.0] - 2026-03-10

### 🔒 安全架构
- **Cloudflare Worker 代理** — Google Books API key 不再暴露在前端代码中
  - Worker: `maomao-books-proxy`，支持 CORS 白名单和 1 小时缓存
  - 用户端零配置，无感使用
- 移除设置页 API Key 输入框（不再需要）

### 🀄 分类智能中文化
- **所有书的英文分类自动翻译为中文**（不仅限于中文书）
- 60+ 精确匹配词典 + 60+ 正则模式规则
- 垃圾分类过滤（国名、地名、模糊词如 "Grief"、"Will"）
- 翻译优先于过滤，避免误杀（如 "Chinese fiction" → "中国小说"）
- 页面加载时自动迁移已有书籍分类

### 📚 图书管理
- **删除功能恢复** — 详情页底部 + 书架卡片 ⋯ 菜单
- 删除前确认对话框，防误删
- Toast 反馈

### 🖼 封面统一
- **所有封面强制 2:3 比例**，padding-top 容器法（兼容所有浏览器）
- 无封面时显示书名首字占位符
- 检测并替换 Open Library "图片不可用" 占位图

### 📊 首页增强
- **统计卡片可点击** — 总藏书 / 已入库 / 待补充 / 在读 → 跳转搜索页并自动筛选
- 搜索现支持按状态标签匹配（已入库、待补充、在读）

### 🔎 搜索优化
- 搜索框下方扫码提示
- 搜索范围扩展到存放位置和阅读状态

### 📱 移动端体验
- **全平台缩放锁定** — iOS gesture、Android pinch、桌面 Ctrl+滚轮/键盘，7 层防护
- **底部 Tab 回顶** — 点击当前页面 Tab 平滑滚回顶部
- 切换 Tab 自动回顶

### 🏗 基础设施
- Capacitor iOS 项目初始化（Bundle ID: `com.horancheng.library`）
- PWA 支持（manifest.json + Service Worker）
- GitHub Pages 自动部署
- 数据库设计文档（DATABASE.md）
- App Store 准备清单（APP_STORE.md）

### 🎨 UI
- 10 项 UX 改进（按钮尺寸、扫码提示、自动填充高亮、SVG 图标等）
- 分类预设优化（过滤垃圾、单行滚动）

---

## [0.4.0] - 2026-03-09

### Added
- **首页仪表盘模式** — 统计卡片、在读展示、分类色块
- **连续录入** — 导入后自动清空草稿、保留存放位置、记住入口方式
- **搜索页** — 全文搜索 + 分类 chip 筛选 + 重复 ISBN 高亮
- **整理页** — 待补充/已入库批量操作
- **阅读追踪** — 想读/在读/读完状态、首页在读展示
- **图书详情弹层** — 底部弹出、阅读状态切换、元数据展示
- **编辑功能** — 回填录入表单、保存后恢复滚动位置
- **存放位置预设** — 自定义位置记忆
- **ISBN 双阶段录入** — 输入/扫描 → 审阅补充 → 导入
- **Google Books 免费 fallback** — Open Library 之外的第二元数据源
- **分类自动补全** — ISBN 查询时自动填充分类
- **UI 重构** — 莫兰迪鼠尾草绿主题

---

## [0.1.1] - 2026-03-08

### Added
- 首页双模式（扫码 + 手动录入）
- 手动录入支持 ISBN 自动标准化
- 导出 JSON / CSV
- 导入 JSON（带 schema 校验）
- 去重校验（ISBN + 书名/作者相似度）
- 16 条移动端边界测试用例

### Fixed
- 扫码失败回退保留 partialIsbn

---

## [0.1.0] - 2026-03-08

### Added
- 项目初始化
- 基础开发 + 发布流程
