# Monitoring Ops (Heartbeat + Watchdog)

## Cheapest model policy
- Scheduled monitoring jobs use: `gemini-2.5-flash`
- Keep thinking off/minimal for routine checks.

## Active jobs
- `Library Watchdog Pulse` (every 30 min, 08:00-22:59 AEST)
- `Pause Reminder` (daily at 10:00 AEST)

## Pause checklist (to save tokens)
When project pauses:
1. Set `docs/PROJECT_STATUS.md` -> `status: PAUSED`
2. Disable monitoring jobs:
   - `openclaw cron list`
   - `openclaw cron disable <jobId>` (or remove if preferred)
3. Keep only `Pause Reminder` enabled if you still want a daily nudge.

## Resume checklist
1. Set `status: ACTIVE`
2. Re-enable jobs:
   - `openclaw cron enable <jobId>`
3. Run once manually to validate:
   - `openclaw cron run <jobId>`
