# Agent Activity Heartbeat

Use machine-readable heartbeat entries (append newest first):

```json
{
  "agent": "Tech-Lead",
  "task_id": "T-015",
  "status": "Review",
  "progress": 100,
  "last_update": "2026-03-08T22:02:00+11:00",
  "last_artifact": "commit:59cc32b; tests:52/52",
  "blocker": "none",
  "next_eta_min": 10,
  "lease_expires_at": "2026-03-08T22:32:00+11:00",
  "retry_count_same_error": 0
}
```

```json
{
  "agent": "Tech-Lead",
  "task_id": "T-011",
  "status": "Stale",
  "progress": 92,
  "last_update": "2026-03-08T22:02:00+11:00",
  "last_artifact": "commit:8b4815f",
  "blocker": "lease expired; L1 ping sent, no timely response",
  "next_eta_min": 15,
  "lease_expires_at": "2026-03-08T21:45:00+11:00",
  "retry_count_same_error": 1
}
```

```json
{
  "agent": "Worker-Claude",
  "task_id": "T-011",
  "status": "In Progress",
  "progress": 92,
  "last_update": "2026-03-08T21:15:00+11:00",
  "last_artifact": "commit:8b4815f",
  "blocker": "none",
  "next_eta_min": 20,
  "lease_expires_at": "2026-03-08T21:45:00+11:00",
  "retry_count_same_error": 0
}
```

## Rules
- Worker updates every 5 minutes or after each meaningful sub-step.
- Lease TTL default: 30 minutes. Must renew before expiry.
- Tech Lead checks stale lease and stale artifact signal before each status report.
- If stale >30m while status is active, trigger escalation in `tech-lead-alerts`.
- If same error retries reach 3, force pause + re-plan.
