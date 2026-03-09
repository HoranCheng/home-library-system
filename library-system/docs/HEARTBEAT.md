# Agent Activity Heartbeat

Use machine-readable heartbeat entries (append newest first):

```json
{
  "agent": "Tech-Lead",
  "task_id": "T-017",
  "status": "Stale",
  "progress": 86,
  "last_update": "2026-03-09T15:31:34+11:00",
  "last_artifact": "commits: 3cf80e7, 7a44009, f517fc5, d1b2f70, 18248de",
  "blocker": "no fresh heartbeat / lease renewal after 15:31 artifact burst",
  "next_eta_min": 15,
  "lease_expires_at": "2026-03-09T15:30:00+11:00",
  "retry_count_same_error": 2
}
```

```json
{
  "agent": "Tech-Lead",
  "task_id": "T-017",
  "status": "In Progress",
  "progress": 78,
  "last_update": "2026-03-09T14:52:14+11:00",
  "last_artifact": "commit: 3cf80e7 (highlight duplicate isbn matches and polish edit flow)",
  "blocker": "none",
  "next_eta_min": 30,
  "lease_expires_at": "2026-03-09T15:30:00+11:00",
  "retry_count_same_error": 0
}
```

```json
{
  "agent": "Tech-Lead",
  "task_id": "T-017",
  "status": "Stale",
  "progress": 65,
  "last_update": "2026-03-09T14:40:00+11:00",
  "last_artifact": "commits: 6a4a611, 37f8c12, e375bbd, f8a699d, a3e9360; dirty: library-system/preview/index.html",
  "blocker": "awaiting fresh heartbeat/artifact after lease expiry",
  "next_eta_min": 20,
  "lease_expires_at": "2026-03-09T14:30:00+11:00",
  "retry_count_same_error": 1
}
```

```json
{
  "agent": "Tech-Lead",
  "task_id": "T-017",
  "status": "In Progress",
  "progress": 65,
  "last_update": "2026-03-09T14:00:00+11:00",
  "last_artifact": "commits: 6a4a611, 37f8c12, e375bbd, f8a699d, a3e9360; dirty: library-system/preview/index.html",
  "blocker": "none",
  "next_eta_min": 30,
  "lease_expires_at": "2026-03-09T14:30:00+11:00",
  "retry_count_same_error": 0
}
```

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
