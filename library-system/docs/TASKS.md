# TASKS

## Status lanes
- To Do
- In Progress (with lease)
- Review
- Done
- Stale (lease expired)

## Review
- [T-015] QA edge-case matrix update and prioritization（重派）
  - Owner: Worker-Claude
  - Status: Review（产出已到，等待 Tech Lead 验收）
  - ETA: done
  - Lease TTL: 30m
  - Budget: 60 min / low token budget
  - Rollback: 仅文档/测试改动，可整组回滚
  - Last artifact: commit `59cc32b`

## Stale
- [T-011] UI interaction final polish (home/manual/settings)
  - Owner: Worker-Claude
  - Status: Stale（lease 超时）
  - ETA: overdue
  - Lease TTL: expired at 21:45
  - Budget: 120 min / medium token budget
  - Rollback: revert UI handlers + restore previous snapshot wiring
  - Last artifact: commit `8b4815f`

- [T-012] QA edge-case matrix update and prioritization
  - Owner: Worker-Gemini
  - Status: Stale（ACP 会话不稳定，follow-up 失败 code 4）
  - ETA: overdue
  - Lease TTL: expired
  - Budget: 60 min / low token budget
  - Rollback: drop added QA-only docs/tests if noisy
  - Last artifact: none（仅 pending 描述，无可验证产出）

## Queue
- [T-013] Release candidate checklist + final smoke
- [T-014] iPhone usage guide + launch notes

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
