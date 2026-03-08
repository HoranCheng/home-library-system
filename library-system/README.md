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

- **导出 JSON**：完整备份，包含所有图书字段和元数据。
- **导出 CSV**：可用 Excel/Numbers 打开，9 列（id, title, authors, isbn13, isbn10, edition, status, createdAt, updatedAt）。
- **导入 JSON**：上传之前导出的 JSON 文件，自动校验 schema；校验失败时显示错误信息，不会破坏现有数据。

### 离线使用

- 已添加到主屏幕后，Service Worker（如已配置）会缓存应用 Shell。
- 无网络时，手动录入的草稿会暂存在本地；联网后可继续操作。
- 当前版本（v0.1.1）离线 PWA 缓存为基础实现，完整离线支持计划在 v0.3.0 完成。
