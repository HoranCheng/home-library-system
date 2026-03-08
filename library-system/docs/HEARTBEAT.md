# Agent Activity Heartbeat

Use machine-readable heartbeat entries (append newest first):

```json
{
  "agent": "Tech-Lead",
  "task_id": "T-016",
  "status": "Done",
  "progress": 100,
  "last_update": "2026-03-09T10:23:00+11:00",
  "last_artifact": "commits: acad601, 46e5dc6, 9e7858b, 2c9efc9, 4c01658, f31dcc7, 4549dd0, 4396f1d, d69bdbe, 984461c, b81b12a",
  "blocker": "none",
  "next_eta_min": 0,
  "lease_expires_at": null,
  "retry_count_same_error": 0
}
```

## Rules
- Worker updates every 5 minutes or after each meaningful sub-step.
- Lease TTL default: 30 minutes. Must renew before expiry.
- Tech Lead checks stale lease and stale artifact signal before each status report.
- If stale >30m while status is active, trigger escalation in `tech-lead-alerts`.
- If same error retries reach 3, force pause + re-plan.
