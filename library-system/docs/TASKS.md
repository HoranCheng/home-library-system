# TASKS

## Status lanes
- To Do
- In Progress (with lease)
- Review
- Done
- Stale (lease expired)

## In Progress
- None

## Stale
- None

## Done
- [T-017] 连续迭代收口（录入流 / 元数据语言 / UI 体验）
  - Owner: Tech-Lead
  - Status: Done（Tech Lead 手动收口，2026-03-10）
  - Evidence: commits `3cf80e7`, `7a44009`, `f517fc5`, `d1b2f70`, `18248de`
  - Latest delta: `18248de` — remove legacy dark sticky action bar

- [T-016] 真扫码网页版（下一版）
  - Owner: Worker-Claude → Tech Lead 收口
  - Status: Done（按用户当前产品方向收口，后续能力拆入新迭代）
  - Evidence: commits `acad601`, `46e5dc6`, `9e7858b`, `2c9efc9`, `4c01658`, `f31dcc7`
  - Note: 原任务的扫码主线、概览、搜索/整理、编辑与阅读增强已落地；后续统一录入表单、多源免费 fallback、位置预设记忆改入下一轮连续迭代
- [T-015] QA edge-case matrix update and prioritization（重派）
  - Owner: Worker-Claude
  - Status: Done（Tech Lead 已验收）
  - Evidence: commit `59cc32b`, tests `52/52`

- [T-011] UI interaction final polish (home/manual/settings)
  - Owner: Worker-Claude → 收口并入 T-013 RC
  - Status: Done（stale 会话内容已验证存在于 commit `8b4815f`，全部功能在 v0.1.1 中覆盖）
  - Evidence: home dual-mode, manual entry, settings snapshot 全部可测；52/52 通过

- [T-012] QA edge-case matrix update and prioritization
  - Owner: Worker-Gemini → 收口关闭
  - Status: Done（无可验证产出；T-015 已覆盖相同 QA 目标，本任务作废关闭）

- [T-014] iPhone usage guide + launch notes
  - Owner: Tech-Lead → 并入 RC 收尾
  - Status: Done（iPhone/PWA 使用说明已写入 README.md v0.1.1 章节）
  - Evidence: README.md 更新于 2026-03-08 RC commit

- [T-013] Release candidate checklist + final smoke
  - Owner: Tech-Lead
  - Status: Done
  - Evidence: CHANGELOG.md v0.1.1, README.md iPhone/PWA 段落, tests `52/52`, final RC commit

## Escalation policy
- L1: >30m stale heartbeat or no artifact delta → ping worker
- L2: >60m no resolution → Tech Lead re-split and reassign
- L3: >120m no resolution → notify owner + scope downgrade proposal

## Definition of Done
- State flow reached `Review -> Done` by Tech Lead
- Feature path runnable end-to-end
- Tests green
- No open blocker in `tech-lead-alerts`
- CHANGELOG + release-log updated
