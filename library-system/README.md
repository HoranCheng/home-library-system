# Home Library System

Personal home library management app (mobile-first), focused on:
- ISBN scan-in
- classification and shelf location
- tidy-up workflow with daily mode + bulk mode

## Workflow
- `🧠 orchestrator-hub` (coordination)
- `🤖 gpt-builder` (implementation)
- `🧩 claude-review` (review)
- `✨ gemini-explore` (alternatives/testing)
- `🚀 release-log` (release notes)

## Versioning
Use Semantic Versioning: `MAJOR.MINOR.PATCH`.

- feat -> MINOR
- fix -> PATCH
- breaking changes -> MAJOR

## Changelog
See `CHANGELOG.md`.

---

## iPhone / PWA 使用说明

### 添加到主屏幕（Add to Home Screen）

1. 用 **Safari** 打开本应用网址（其他浏览器无法触发 iOS 安装提示）。
2. 点击底部工具栏中间的 **分享** 按钮（方框加箭头图标）。
3. 下拉菜单，找到 **"添加到主屏幕"（Add to Home Screen）**，点击。
4. 确认名称后点击右上角 **"添加"**，图标即出现在桌面。
5. 从桌面图标启动后，应用以全屏模式运行（无 Safari 地址栏）。

> 提示：仅 Safari 支持在 iOS 上安装 PWA；Chrome/Firefox 会打开普通网页标签，不会安装。

### 首页双模式

| 模式 | 入口 | 适用场景 |
|------|------|----------|
| 扫码入库（scan） | 默认启动模式 | 图书有条码，对准摄像头即录 |
| 手动录入（manual） | 点击"无条码？去手动录入" | 旧书/无条码，手动填写 ISBN/书名/作者 |

模式切换通过底部 Nav 中的按钮完成，选择记忆在本地存储（localStorage），刷新或重启后保留。

### 手动录入流程

1. 切换到手动录入模式。
2. 填写 **ISBN**（ISBN-10 或 ISBN-13 均可，会自动标准化）、**书名**、**作者**。
3. 点击 **"保存图书"**。
4. 系统自动去重：ISBN 重复或书名+作者相似时会提示候选项。

### 导出 / 导入（设置页）

- **导出 JSON**：完整备份，包含所有图书字段和元数据（`books + meta`）。
- **导出 CSV**：可用 Excel/Numbers 打开，9 列（id, title, authors, isbn13, isbn10, edition, status, createdAt, updatedAt）。
- **导入 JSON**：导入前会先校验 schema；校验失败时显示错误信息，不会覆盖现有数据。
- **当前预览页说明**：预览页导出格式已与正式 JSON / CSV 结构对齐，但界面仍属于 v0.1.1 的轻量发布页，不代表最终完整前端工程结构。

### 离线使用

- 当前版本 **尚未实现完整 Service Worker / 离线缓存**。
- 添加到主屏幕后可获得接近 App 的启动体验，但 **断网可用性不做保证**。
- 完整离线支持计划在 v0.3.0 实现。
