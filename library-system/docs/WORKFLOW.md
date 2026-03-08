# AI Collaboration Workflow

## Delivery loop
1. Tech Lead defines scope (one core goal each cycle)
2. Claude implements (primary worker)
3. Gemini performs QA edge-case review
4. Tech Lead validates, applies final edits, and merges
5. Update CHANGELOG + release-log

## Task state machine (strict)
- Allowed transitions only:
  - `To Do -> In Progress -> Review -> Done`
  - `In Progress -> Stale` (lease expired)
  - `Review -> In Progress` (changes requested)
- Worker cannot mark `Done` directly from `In Progress`.
- `Done` must be set by Tech Lead after review evidence.

## Lease + timeout policy
- Every `In Progress` task must include a lease TTL (default 30 min).
- If TTL expires without renewal, task auto-moves to `Stale`.
- Lease renewal requires fresh heartbeat + artifact evidence.

## Watchdog (monitor mode)
1. Before each status report, read `docs/HEARTBEAT.md` and `docs/TASKS.md`.
2. Detect stalled tasks using **dual signals**:
   - heartbeat stale (`last_update` exceeds threshold), and/or
   - no artifact progress (`commit/test log/file diff`) in expected interval.
3. Escalation levels:
   - **L1 (30m):** ping worker for status
   - **L2 (60m):** Tech Lead intervenes and re-splits task
   - **L3 (120m):** notify owner + suggest reassign/scope downgrade
4. Retry fuse:
   - same error family max 3 retries, then force pause + mini-retro + new plan.
5. Publish periodic standup summary in `tasks-board`:
   - 🟢 Done
   - 🟡 In Progress
   - 🔴 Blocked

## Branch/commit discipline
- Branch format: `feat/T-xxx-short-name`
- Commit message must include task id, e.g. `feat(T-011): ...`
- Each task record includes rollback steps before implementation begins.

## Quiet hours and alerting
- Quiet window: 23:00-08:00 (AEST).
- During quiet window, only P0 alerts go to `tech-lead-alerts`.
- Non-P0 delays are aggregated into next standup.

## Budget guardrails
- Each task must define max runtime + token budget.
- If budget exceeded: pause execution and request Tech Lead re-plan.
