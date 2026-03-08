# TASKS

## Status lanes
- To Do
- In Progress (with lease)
- Review
- Done
- Stale (lease expired)

## In Progress
- [T-016] 真扫码网页版（下一版）
  - Owner: Worker-Claude
  - Status: In Progress
  - Goal: 在现有网页/PWA 基础上接入真实摄像头扫码（优先 ISBN）并保持手动录入兜底
  - Lease: 2026-03-09T05:20:00+11:00
  - ETA: 30m
  - Budget: 1 个 Claude worker + Tech Lead 验收
  - Rollback: 保留当前 GitHub Pages 可用静态版本，扫码能力独立回退
  - Last artifact: session `agent:claude:acp:1db8f83f-0062-4ecc-9e4d-7ee09da41ef3`, run `0f80db24-c1df-4a94-8343-07fe5fe43ec9`

## Done
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
