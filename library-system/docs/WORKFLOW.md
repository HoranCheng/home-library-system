# AI Collaboration Workflow

## Delivery loop
1. Tech Lead defines scope (one core goal each cycle)
2. Claude implements (primary worker)
3. Gemini performs QA edge-case review
4. Tech Lead validates, applies final edits, and merges
5. Update CHANGELOG + release-log

## Monitor mode (watchdog)
1. Before each status report, read `docs/HEARTBEAT.md` and `docs/TASKS.md`.
2. If any Active worker has no heartbeat update for >30 minutes, post alert in `tech-lead-alerts` and assign unblock action.
3. Publish periodic standup summary in `tasks-board`:
   - 🟢 Done
   - 🟡 In Progress
   - 🔴 Blocked
4. Each task must include owner + ETA. If ETA exceeded, require blocker note + re-plan.
