# 任务：web-storage（Codex）

你是 coordinator-web 的构建子代理，负责浏览器存储、学习服务、AppApi 与完整备份。设计已在文档中给出，本任务是实现，不另开设计分支。

## 先读（按顺序）

1. `CLAUDE.md`。
2. `D:\Tools\Claude Work Rule\Project Wiki and Sub-agent rule.md`。
3. `.agent-wiki/INDEX.md`（Now、团队）、`.agent-wiki/reusable.md`、`.agent-wiki/tasks/web-board.md`。
4. `docs/progress.md`、`docs/decisions/0008-web-pwa-iphone.md`、`docs/02-architecture.md`、`docs/web/architecture.md`（完整，尤其第 2、3、6 节）、`docs/web/mobile-ui.md`。
5. `src/shared/ipc.ts`、`src/shared/settings.ts`、`src/shared/domain/**`、`src/main/api.ts`、`src/main/db/**`、`src/main/services/learningService.ts`、`recordingService.ts`、`wav.ts`、`src/main/ipc/schemas.ts` 与相关测试。

## 硬规则与归属

- 不 commit、不 push。文档简体中文，代码/注释英文；UTF-8 无 BOM、LF。不要在 Git Bash 命令行写中文。
- 只写 `src/web/storage/**`（含测试）、`docs/web/storage.md`，以及自己的 wiki 状态/总结和 board 追加消息。不要改 src/main、src/shared、renderer、根配置或其他构建者文件。
- 新依赖只限 Now 已批准项；`@sqlite.org/sqlite-wasm` 的安装和 package 修改交 web-assets，禁止同时编辑锁文件。其他需求写 `STATUS web-storage: BLOCKED ...`。
- 其他构建者接口按架构第 2 节，先导出 types/index 与可用 Fake 依赖再接真实模块。契约不足时发 board，不能改别人文件。

## 交付

1. `createWebApi({assets, speech})` 返回 `WebRuntime`，保持 AppApi 全部方法。UI 在真实存储就绪前不会挂载。错误稳定带 code。
2. 专用数据库 Worker，sqlite-wasm OPFS SAHPool 单写入者，SQL 迁移沿用原 MIGRATIONS；适配而非直接引入 node:sqlite/Node 文件系统。第二窗口冲突、未知新版库、持久化失败均不重建空库。
3. 复用共享 FSRS/计划/连续天数规则，保留重复完成补卡、练习不调度、每日上限和提示隐藏计数。SQL 与桌面保持一致。
4. WAV 录音存 IndexedDB，SQL 保存稳定 UUID，URL 由 Blob 创建；保留第一次+最近三次练习、永久挑战。完整备份导入导出遵循架构格式与代际恢复规则，限制大小、验证摘要和字段，不执行用户 SQL。
5. 本地限量日志、诊断下载、存储状态/persist/配额错误处理；不上传任何个人数据。
6. `docs/web/storage.md` 写模块说明、实际执行的命令、结果、未验证项和恢复方法。

## 验收

- `npx vitest run src/web/storage`：Fake Provider，验证事务回滚、迁移保留旧数据、重复完成、复习上限、额外练习不改间隔、备份录音往返、损坏/未来版本拒绝、导入中断恢复与配额失败。
- 配置就绪后运行 `npm run web:typecheck` 和 `npm run typecheck`。若其他模块未就绪，精确记录失败路径和依赖，不写通过。
- 最终由协调者跑 `npm run web:check`；你需提供真实浏览器 OPFS 冷启动重开检查步骤，Mock 不能证明持久化有效。

## 结束

启动对照 Now 与 git status，更新自己行 active；发现坑立即写 reusable。约 68% 上下文写 `.agent-wiki/summaries/web-storage-1.md` 并 `STATUS web-storage: HANDOFF ...`。完成时读 board、写总结、标 ended、追加 `STATUS web-storage: DONE`；有未解决阻塞必须明确列出，不能把降级/Mock 称作真实存储通过。
