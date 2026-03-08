# Changelog

All notable changes to this project will be documented in this file.

## [0.1.1] - 2026-03-08
### Added
- **首页双模式**：扫码模式（scan）与手动录入模式（manual），通过 localStorage 持久化切换；底部 Nav 固定三项：scan / search / tidy
- **手动录入**：支持 ISBN、书名、作者字段；ISBN 自动标准化（ISBN-10/13），录入前执行强/软去重校验
- **导出**：`exportJson` 导出完整 LibraryState JSON；`exportCsv` 导出带 CSV 引号转义的表格（9 列）
- **导入**：`validateImportJson` 校验 schema shape 与必填字段；`importState` 原子替换状态
- **Settings UI snapshot**：`buildSettingsUiSnapshot` 向 UI 层暴露统一的 export/import 处理函数
- **手机边界测试**：16 条移动端边界用例（viewport resize、无输入、特殊字符、并发 toggle、重复扫描等）
- **iPhone / PWA 使用说明**：详见 README.md

### Fixed
- 扫码失败回退：`handleScanFailure` 保留 partialIsbn，可重试或切换至手动录入模式

### Tests
- 测试文件 13 个，共 52 条用例，全部通过（vitest run）

## [0.1.0] - 2026-03-08
### Added
- Initial project structure
- Discord collaboration lane setup (threads)
- Basic development + release workflow
