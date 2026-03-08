# Agent Activity Heartbeat

| Agent Name | Current Task | Last Update (AEST) | Progress | Status |
|---|---|---|---|---|
| Tech-Lead | v0.1.1 stabilization + release prep | TBD | 0% | Active |
| Worker-Claude | UI interaction chain + polish | TBD | 0% | Active |
| Worker-Gemini | QA edge-case review | TBD | 0% | Active |

## Rules
- Worker updates every 5 minutes or after each meaningful sub-step.
- Tech Lead checks for stale updates before every status report.
- If `Last Update` > 30 minutes while Status is `Active`, raise alert in `tech-lead-alerts`.
