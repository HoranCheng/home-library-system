# Roadmap Blockers / Needs Horan Input

Updated: 2026-03-13

## Must wait for Horan

### Phase 1.2
- **Google Sign-In 集成**
  - Need: `wrangler secret put GOOGLE_CLIENT_ID`
  - Reason: frontend GSI button cannot be wired until Worker has the client id

### Phase 2.1
- **中文书数据源方案决策**
  - Need: budget / risk preference
  - Options to choose:
    1. paid API first (lowest risk, fastest)
    2. shared cache first (cheapest, slower coverage growth)
    3. crawling experiments (highest legal/maintenance risk)

### Phase 2.4
- **隐私政策 / 用户协议文案**
  - Need: final wording or approval to generate draft and treat as temporary

### Phase 3.3
- **自定义域名**
  - Need: chosen domain / DNS access

## Not blocked, just large
- Phase 1.1 full frontend modularization
  - Started: Vite + first modules extracted
  - Why large: current app is a 4k+ line single-file SPA with shared global DOM state
  - Can continue incrementally without user input
