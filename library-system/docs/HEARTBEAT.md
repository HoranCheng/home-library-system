# Agent Activity Heartbeat

Use machine-readable heartbeat entries (append newest first):

```json
{
  "agent": "Worker-Claude",
  "task_id": "T-016",
  "status": "In Progress",
  "progress": 10,
  "last_update": "2026-03-09T04:49:00+11:00",
  "last_artifact": "session:agent:claude:acp:1db8f83f-0062-4ecc-9e4d-7ee09da41ef3; run:0f80db24-c1df-4a94-8343-07fe5fe43ec9",
  "blocker": "none",
  "next_eta_min": 30,
  "lease_expires_at": "2026-03-09T05:20:00+11:00",
  "retry_count_same_error": 0
}
```

```json
{
  "agent": "Tech-Lead",
  "task_id": "T-016",
  "status": "In Progress",
  "progress": 15,
  "last_update": "2026-03-09T04:49:00+11:00",
  "last_artifact": "next-version kickoff; GitHub Pages live path retained as rollback",
  "blocker": "none",
  "next_eta_min": 30,
  "lease_expires_at": "2026-03-09T05:20:00+11:00",
  "retry_count_same_error": 0
}
```

```json
{
  "agent": "Tech-Lead",
  "task_id": "T-013",
  "status": "In Progress",
  "progress": 20,
  "last_update": "2026-03-08T22:25:00+11:00",
  "last_artifact": "tests:52/52; T-015 accepted",
  "blocker": "none",
  "next_eta_min": 30,
  "lease_expires_at": "2026-03-08T22:55:00+11:00",
  "retry_count_same_error": 0
}
```

```json
{
  "agent": "Tech-Lead",
  "task_id": "T-015",
  "status": "Done",
  "progress": 100,
  "last_update": "2026-03-08T22:25:00+11:00",
  "last_artifact": "commit:59cc32b; tests:52/52",
  "blocker": "none",
  "next_eta_min": 0,
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
