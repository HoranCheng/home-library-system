# Receipt Renamer 审计执行清单（工程版）

## P0 — 立即修复
- [ ] 删除 `receipt-proxy/src/index.js` 中 `/api/debug/gemini`
- [ ] Worker 不再信任前端裸传 `uid`
  - [ ] 前端发送 Google ID token
  - [ ] Worker 验签后取 `sub`
  - [ ] 移除 `anonymous` fallback
- [ ] 收紧 CORS
  - [ ] 只允许 `https://horancheng.github.io`
- [ ] 给 `/api/analyze` 增加输入限制
  - [ ] MIME allowlist: jpeg/png/pdf
  - [ ] 图片大小上限
  - [ ] PDF 大小上限
  - [ ] 校验 `fileType`
- [ ] quota 机制改成原子计数
  - [ ] 评估 Durable Objects
- [ ] 修 `src/services/processor.js`
  - [ ] 文件名从 `category` 改为 `merchant`
  - [ ] 统一 title-case + safeName

## P1 — 可靠性
- [ ] `signOut()` / `handleReset()` 清理所有本地敏感缓存
  - [ ] `rr-image-cache`
  - [ ] `rr-pending-uploads`
  - [ ] `rr-non-receipt-alerts`
- [ ] 修 service worker 注册路径
- [ ] 重写 `public/sw.js`
  - [ ] 只缓存 same-origin 静态资源
  - [ ] 不缓存 Drive / Sheets / OAuth / API
- [ ] 给 Sheets 写入补偿机制
  - [ ] 记录 `sheet_pending`
  - [ ] 自动 retry
  - [ ] UI 提示未同步记录
- [ ] 修 `rememberMe` 状态流
  - [ ] 统一到 config
  - [ ] 登录恢复逻辑统一读取同一来源

## P2 — 工程质量
- [ ] 修复现有测试漂移
- [ ] 给 worker 增加基础测试
- [ ] 补以下测试：
  - [ ] processor 分流逻辑
  - [ ] 命名规则
  - [ ] review approve/delete
  - [ ] sign out / reset 清缓存
  - [ ] analyze / quota
- [ ] 整理文档
  - [ ] `docs/ARCHITECTURE.md`
  - [ ] `docs/SECURITY.md`
  - [ ] `docs/ROADMAP.md`

## P3 — 产品增强
- [ ] merchant normalization / alias memory
- [ ] 月度统计与洞察
- [ ] tax / GST / BAS 方向探索
- [ ] 保修 / 退货提醒
- [ ] 从 receipt 扩到 document inbox
