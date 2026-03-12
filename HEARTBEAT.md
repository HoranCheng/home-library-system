# HEARTBEAT Tasks

- Read `receipt-renamer/docs/TASKS.md` for current project status.
- If any active worker heartbeat is stale >30 minutes, post alert to `tech-lead-alerts`.
- Post a concise standup update to `tasks-board` with Done/In Progress/Blocked.
- If no stale worker and no blocker changes, return HEARTBEAT_OK.

## Heartbeat Rules (参考 library-system 规范)
- Worker 每 5 分钟或每个有意义子步骤后更新一次
- Lease TTL 默认 30 分钟，必须在到期前续租
- Tech Lead 在每次状态报告前检查 stale lease 和 stale artifact 信号
- 如果 stale >30m 且状态仍为 active，在 `tech-lead-alerts` 触发升级
- 同一错误重试达 3 次，强制暂停 + 重新规划
