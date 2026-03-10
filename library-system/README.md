# 📚 毛毛图书管理系统

> 一款移动优先的个人藏书管理 PWA，扫码即录、自动补全、优雅管理。

**在线体验** → [horancheng.github.io/home-library-system](https://horancheng.github.io/home-library-system/)

---

## ✨ 核心功能

- **📷 扫码录入** — 对准条形码自动识别 ISBN，秒级入库
- **🔍 智能补全** — 自动从 Google Books / Open Library 获取书名、作者、分类、封面
- **🀄 中文优先** — 所有分类自动翻译为中文，中文书优先中文元数据
- **📖 阅读追踪** — 想读 / 在读 / 读完，首页显示当前在读
- **🗂 分类管理** — 按字母/时间排序，分类 chip 筛选
- **📍 存放位置** — 记录每本书的物理位置，支持自定义预设
- **🔎 搜索** — 全文搜索书名、作者、ISBN、分类、状态
- **📤 数据备份** — 导出/导入 JSON/CSV，数据完全在你手中
- **📱 PWA** — 添加到主屏幕，全屏运行，接近原生 App 体验

## 📱 安装使用

### iPhone / iPad（推荐）
1. 用 **Safari** 打开 → [在线地址](https://horancheng.github.io/home-library-system/)
2. 点底部 **分享按钮**（方框+箭头）
3. 选择 **"添加到主屏幕"**
4. 从桌面图标启动 → 全屏模式，无地址栏

> ⚠️ 仅 Safari 支持 iOS 上安装 PWA

### Android
1. Chrome 打开在线地址
2. 点击地址栏或弹窗中的 **"安装"**

### 桌面浏览器
直接访问在线地址即可使用。

## 🏗 技术栈

| 组件 | 技术 |
|------|------|
| 前端 | 单文件 HTML + Vanilla JS（零依赖） |
| 元数据 | Cloudflare Worker 代理 → Google Books API |
| 备选源 | Open Library API（免费公开） |
| 扫码 | BarcodeDetector API + ZXing fallback |
| 存储 | localStorage（纯客户端） |
| 部署 | GitHub Pages（自动） |
| PWA | Service Worker + Web App Manifest |

## 📋 版本历史

详见 [CHANGELOG.md](./CHANGELOG.md)

| 版本 | 日期 | 亮点 |
|------|------|------|
| v0.5.0 | 2026-03-10 | Cloudflare Worker 代理、分类中文化、封面统一、缩放锁定 |
| v0.4.0 | 2026-03-09 | 首页仪表盘、连续录入、搜索页、阅读追踪 |
| v0.1.1 | 2026-03-08 | 双模式录入、导入导出、去重校验 |
| v0.1.0 | 2026-03-08 | 项目初始化 |

## 🤝 开发

```bash
# 本地预览
cd preview && python3 -m http.server 8080

# 部署 Cloudflare Worker（需要 wrangler）
cd worker && npx wrangler deploy
```

## 📄 License

MIT
