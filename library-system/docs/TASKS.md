# TASKS

## Status lanes
- To Do
- In Progress (with lease)
- Review
- Done
- Stale (lease expired)

## In Progress
- [T-011] UI interaction final polish (home/manual/settings)
  - Owner: Worker-Claude
  - Status: In Progress
  - ETA: 2h
  - Lease TTL: 30m (renew required)
  - Budget: 120 min / medium token budget
  - Rollback: revert UI handlers + restore previous snapshot wiring
  - Last artifact: commit `8b4815f`

- [T-012] QA edge-case matrix update and prioritization
  - Owner: Worker-Gemini
  - Status: In Progress
  - ETA: 1h
  - Lease TTL: 30m (renew required)
  - Budget: 60 min / low token budget
  - Rollback: drop added QA-only docs/tests if noisy
  - Last artifact: QA checklist pending

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
