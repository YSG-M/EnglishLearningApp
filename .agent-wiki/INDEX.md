# Agent Wiki — EnglishLearningApp

Tracked by the user's project decision. Shared by the main agent and all sub-agents. Anyone may edit. No secrets or personal data.
Rules: `D:\Tools\Claude Work Rule\Project Wiki and Sub-agent rule.md`. Never `git commit` / `git push`.

## Manual list (read these first)
| File | What |
|---|---|
| `INDEX.md` | this list + team roster |
| `reusable.md` | commands, snippets and traps already solved — check before writing a new one |
| `summaries/` | handoff summaries, `<role>-<n>.md` |

Project docs that are the actual contracts (tracked in git):
- `CLAUDE.md` — project rules
- `docs/02-architecture.md` — module boundaries, file ownership, paths, IPC, DB tables
- `src/shared/ipc.ts` — the renderer↔main API (frozen; ask main agent to change)
- `src/shared/content/schema.ts` — content authoring format
- `content/units/u01-greetings.json` + `content/lexicon/core.json` — the quality bar for content

## Now (2026-10-29) — the one place for changing facts
- 2026-10-29 web-deploy 最终交付：Pages workflow（main push / 手动、Node 24、npm ci --ignore-scripts、子路径 CI build、上传/部署、pages 并发）已写；原 ci.yml 未改。resources/web 已取消忽略，待用户 git add/commit；内容核对仅公开课程/生成音频/模型/许可证/安装图像，无学习库、个人录音、密钥或绝对本机路径。源清单 3033 项，目录全部 3040 文件（含安装图像），最终 dist 清单 3049 项，release `7362d5c79a3666264f1d4c8f5577a5a761a57754753abcf7efbaa8b41b7c8151`。所有私钥、原 WAV、模型缓存、报告与 dist 继续忽略。
- 2026-10-29 web-deploy 实测：干净 Git 可见文件副本 `D:/Users/Micheal_Yang/AppData/Local/Temp/kaikou-pages-ci-ygXxNe`，无原 WAV/开发模型/证书；`npm ci --ignore-scripts` exit 0，ffmpeg 二进制确实不存在；`web:build:ci` exit 0，源与输出摘要均通过。Chrome `/EnglishLearningApp/` 首周校验/首次 SW 控制/真实第一课/M4A ended（1.41s）/离线 Range（206，bytes 3-11/6214，9 bytes）/离线重载均通过。复现环境 Windows，Linux runner/GitHub/Pages/iPhone 未运行；生产麦克风链路仍未测。npm 安装报告 2 high vulnerabilities（既有依赖，未擅自升级），Zod PURE 警告保留。
- 2026-10-29 web-deploy 最终检查：本地完整 `WEB_BASE=/EnglishLearningApp/ npm run web:build` exit 0，converted=0、modelsIncluded=true，与干净 CI 副本 release 相同；`npm run check`、`npm run web:check` 均 exit 0，各 40 文件/307 测试通过，无跳过，内容校验保留 43 既有警告。初次 check 被新 ci-smoke.mjs 的 Node 全局导入 lint 拦下，修复后完整重跑通过。官方 API 核对 action 发布日期：upload-pages-artifact v3.0.1 2024-02-07、deploy-pages v4.0.5 2024-03-18、configure-pages v5.0.0 2024-03-30、checkout v4.2.2 2024-10-23、setup-node v4.4.0 2025-04-14。
- 2026-10-29 web-deploy 文档：手机指南改用 Pages，保留离线/录音/识别/备份/布局结果表，新增影响与删除；LAN/证书/防火墙完整步骤保留到 assets 开发者段。决定 0008、开发文档、进度已更新。交接 `summaries/web-deploy-1.md`；没有 commit/push/settings 操作，下一步用户提交合并推送、设置 Pages Source 为 GitHub Actions，再看 Actions 并在手机验收。
- 2026-10-29 web-integrator 最终检查点：修复四个根标签返回按钮、清单未加载的 0/0 字节显示；生产 main 使用真实 assets/speech/createWebApi。最终 `npm run check` 与 `npm run web:check` 均 exit 0，40 文件/307 测试全部通过、无跳过；内容校验通过（43 个既有警告）。`npm run web:build` exit 0，converted=0、modelsIncluded=true；最终 3049 文件，release `bde1fd2ae6e1f41ad2e1285928e8bcff2dae9b781001eb05c8db288d8e7700b9`，取代上轮 release。Zod PURE 注释构建警告保留。
- 2026-10-29 web-integrator 浏览器实测：新 Chrome profile 对最终 dist 通过首周下载校验、首次 SW 控制、进入真实第一课、课程 M4A 解码并触发 ended（duration 1.41s）、断网 Range 206（bytes 3-11/6214，9 bytes）及断网页面重载。首轮无 CDP 用户手势时播放未完成，给测试点击设置 userGesture 后完整通过；不是静音开关/真人听音证明。生产 harness 不支持 WAV 假麦克风，生产录音→识别链路未测，未篡改生产入口注入测试能力。Chrome 临时 profile `D:/Users/Micheal_Yang/AppData/Local/Temp/kaikou-pwa-smoke-NeiPpX`。
- 2026-10-29 web-integrator 布局实测：截图脚本 exit 0，428×926 和 320×926 共 24 个导航检查，无横向溢出、根标签无返回按钮；428 学习正文 bottom 649.46875 < 固定栏 top 852.328125，320 下 721.71875 < 852.328125。428 今天/课程/汇总/复习/我的/设置/句子学习步骤已逐页人工查看。证据 `.agent-wiki/mobile-screenshots/`；截图 Mock 与生产 E2E 区分记录。旧 wiki 中 mobile-preview/mobile-chrome 生成物已保留移至 OS temp `kaikou-old-mobile-20067d5ad698435192da619bb34a05d6`，新 harness 不再将构建/profile 写进 tracked wiki。
- 2026-10-29 web-integrator 交付 `docs/web/iphone-test.md` 中文试用指南、文档索引/进度/过期设计状态修正及 `summaries/web-integrator-1.md`。iPhone 本人安装 CA/完全信任、LAN 防火墙、飞行模式进程冷启动、静音/录音后音量/路由、麦克风重开权限、每句识别时间/手机内存、真机备份与键盘/安全区仍未验证；公开分发前完整第三方构建声明仍待核对，旧 release 无自动回收。Electron 保留，无 commit/push。最终任务 DONE 指集成交付，不是 iPhone 放行。
- 2026-10-29 web-assets 最终检查点：资源/PWA/入口/根配置/HTTPS/文档已交付，说明 `docs/web/assets.md`、交接 `summaries/web-assets-1.md`。已锁定 sqlite-wasm 3.54.1-build1 与 ffmpeg-static 5.3.0（开发依赖），无其他新增包；ffmpeg 安装脚本已批准。当前引用的 3022 WAV 实测 256584294 bytes、5342.735958333324s；M4A 实测 34858783 bytes、完整解码时长 5343.18s。重复 web:assets 转码数 0，原始报告 `resources/web-reports/measurement.json`。最终根路径 dist 清单 3049 文件，release `edc362ec68f607a134621fd269a2b9de1dbd2711b80558cbfd6dac24745986c3`；首周含 shell/content/WASM 为 307 文件、6613081 bytes；完整可选模型/运行时/许可证 10 文件、115844094 bytes，已接入。
- 2026-10-29 web-assets 最终验收：`web:assets` 重复执行、`web:build`、`web:typecheck`、`web:check`、原 `check`、自有 lint/格式/diff 均通过。最终 web:check 全仓 40 文件/307 测试通过；原 check 的前一检查点 40 文件/306 测试通过。已修复 speech-2 报告的暂停测试顺序假设；源文件缺失、完整性失败、暂停恢复、配额、并发二、候选失败/显式激活/旧缓存保护、Range/416/子路径有回归。真实 Chrome 在根路径及 `/EnglishLearningApp/` 通过首周校验、首次 SW 接管、断网 Range、断网页面重载；最终根路径修复后复测通过。HTTPS 用显式 CA 保持 TLS 校验，静态/完整音频/206/416/WASM MIME/SW scope 通过。私钥仅在被忽略的 `.certs/`，未导入系统信任库；本轮 HTTPS 服务已停止。iPhone 持有人安装/完全信任 CA、LAN 防火墙、主屏幕进程冷启动及实际录音/路由/配额仍未测。旧已激活 release 缓存保守保留，无自动回收，详见 assets.md；无 commit/push。
- 2026-10-29 web-storage 最终检查点：`src/web/storage/**` 与 `docs/web/storage.md` 已交付，3 文件/38 测试、storage lint、prettier 与 git diff --check 通过。真实原生 Chrome（不是 Mock SQL）通过 SQLite WASM SAHPool/IndexedDB 进程冷重开、第二 Worker STORAGE_BUSY、完整录音备份导入后再次冷重开；最终结果 `D:/Users/Micheal_Yang/AppData/Local/Temp/kaikou-storage-smoke-A9EMZN/result.json`（合成数据，不提交）。两套 typecheck 最后执行均失败于并行 speech 文件 `sherpa-engine.ts:34/64`（undefined）和 `validation/preview.ts:1`（错误 resample import），storage 无报错。iPhone、真实配额、100 MiB 手机峰值内存与真机迁移恢复未验证；恢复/步骤见 storage.md，交接 `summaries/web-storage-1.md`。storage roster 启动 active 曾被并行旧快照覆盖为 planned，本次按实际结束状态更正。
- Branch `feat/v1`, working tree clean at session start (last commit `9a51c08 V2`).
- Desktop v1 state: see `docs/progress.md` (not copied here).
- **Active work: iPhone web/PWA version** — replaces the desktop app (user decision 2026-10-29). Sub-agents are **Codex only** (no Claude sub-agents), in visible wmux tabs. Board: `.agent-wiki/tasks/web-board.md`.
- Approved new deps (2026-10-29): `@sqlite.org/sqlite-wasm`, `ffmpeg-static` (dev only), sherpa-onnx WebAssembly files (downloaded by script, not npm). Anything else → ask the user.
- Measured 2026-10-29: `resources/audio` 3096 WAV, 24 kHz mono 16-bit, 258 MB, 91.4 min total; `resources/models` Whisper int8 160 MB; `resources/content` 1.4 MB.
- Hosting: GitHub Pages，公开仓库，用户提交/推送并启用 Actions Source 后部署；跳过本地 LAN，直接在 Pages 验收（2026-10-29 决定）。
- 2026-10-29 user: `.agent-wiki/` is tracked in git for this project (exception to global rule 7, recorded in CLAUDE.md) → no secrets/keys/personal data in the wiki. Other .gitignore entries unchanged for now.
- 2026-10-29 web-architect 已完成设计与四份构建任务书；尚未实现 Web。契约入口：`docs/web/architecture.md`、`docs/web/mobile-ui.md`、决定 `0008`；交接：`summaries/web-architect-1.md`。Whisper 单线程 WASM 构件与真实 iPhone 验收待后续执行，不能视为已验证。
- 2026-10-29 web-speech-2：已解除真实浏览器 ASR 构件阻塞，交付 SherpaEngine/Worker、固定 HF commit 的 JS/WASM+wrapper 摘要、完整模型/许可证脚本与 Chrome smoke；前任交接 `summaries/web-speech-1.md` 的 BLOCKED 已被本条取代，当前交接 `summaries/web-speech-2.md`、模块文档 `docs/web/speech.md`。tiny.en int8 模型三文件 103627191 bytes，归档 118071777 bytes；运行时+模型 115492062 bytes，加许可证完整输出 115844094 bytes，10 个文件。`web:models -- --check` 成功 exit 0，artifactVerified:true，无手机下载动作；assets 需重建发布清单纳入最终组合。
- 2026-10-29 web-speech-2 最终实测（Chrome/156.0.8078.49，原生隐藏 Chrome，真实 SIMD 单线程 WASM，非 Mock）：冷 init 689.4ms（含编译/FS/模型构造，不含先前静态文件读取），三条 16kHz 课程音频分别 1.4101875/1.4210625/1.1478125s，识别为 `Hi, I'm Amy.` / `Nice to meet you.` / `Good morning.`，decode 1060.4/1175.0/932.3ms；init 及各次 decode 的 WASM 线性内存均 536870912 bytes，不是进程峰值。请求日志无中文 .data。原件 `.agent-wiki/speech-validation/results.json`；Chrome profile/build 已改存 OS temp。iPhone/真人麦克风/静音开关/扬声器路由/手机峰值内存仍未测，不能用这些电脑数字替代。
- 2026-10-29 web-speech-2 最终检查点：语音 6 文件/32 测试通过，两套 typecheck、语音 lint、prettier、git diff --check 通过；已修复 storage 检查时发现的 speech TS 错误。全仓 npm test 为 39 文件通过/1 文件失败、304 测试通过/1 失败（总 305），失败为 assets.test.ts:158 暂停恢复的重复 bundle fetch，已通知资产负责人，未改其文件。当前是并行 builders 未提交工作区，最终集成需按最终树复核。
- 2026-10-29 coordinator-web independent re-check after web-integrator DONE: `npm run check` and `npm run web:check` both pass (40 test files / 307 tests, 7 files under src/web; content ok; web release verified 3049 files). Sizes: `resources/web` 153 MB = audio 40 MB + models 111 MB + content 1.4 MB. All builders + integrator ended. **Next: user runs `docs/web/iphone-test.md` on the real iPhone**; then Electron removal and hosting.
- 2026-10-29 user: repo may be **public**; skip local LAN/iPhone test; publish on GitHub Pages `https://ysg-m.github.io/EnglishLearningApp/` and test there.
- 2026-10-29 coordinator-web re-check after web-deploy DONE: `npm run check` + `npm run web:check` pass (40 files / 307 tests; web release verified 3049 files). `git add -n .` = 3247 paths; none under .certs/keys/WAV/desktop models/dist-web/sqlite; secret scan clean; one file > 50 MB (tiny.en decoder 89.9 MB, < 100 MB). **Waiting on user**: commit → merge to main → push → repo Public → Pages Source = GitHub Actions → iPhone test per `docs/web/iphone-test.md`. All Codex agents ended.
- 2026-10-29 user publish checklist lives in `tasks/user-steps.md` (order: commit, repo Public, Pages Source = Actions, then push main). coordinator updates its status table as the user reports each step.

## Team (web/PWA version, started 2026-10-29) — Codex sub-agents
| Role | Agent | Owns | State |
|---|---|---|---|
| coordinator-web (main session, Claude) | — | wiki, briefs, spawning/supervising, final verification report; 4 builders spawned 2026-10-29 (wmux agent ids in board) | idle — waiting for user's push + iPhone test |
| web-architect | Codex | `docs/decisions/0008-*`, web section of `docs/02-architecture.md`, `docs/web/*`, `.agent-wiki/tasks/web-*.md` briefs | ended |
| web-storage | Codex | `src/web/storage/**`, `docs/web/storage.md`；任务 `tasks/web-storage.md` | ended |
| web-speech | Codex | `src/web/speech/**`、renderer 语音文件、模型脚本；任务 `tasks/web-speech.md` | ended（ASR BLOCKED；回退已完成） |
| web-speech-2 | Codex | successor of web-speech-1, same ownership; brief `tasks/web-speech-2.md` (real sherpa WASM runtime) | ended（真实 Chrome ASR 已验；iPhone 待人工） |
| web-mobile | Codex | `src/web/ui/**`、renderer（排除语音文件）；任务 `tasks/web-mobile.md` | ended |
| web-assets | Codex | assets/PWA/入口、构建与根配置、HTTPS；任务 `tasks/web-assets.md` | ended |
| web-integrator | Codex | integration, final checks, `docs/web/iphone-test.md`, `docs/README.md`, `docs/progress.md`; brief `tasks/web-integrator.md` | ended（桌面集成通过；iPhone 待持有人） |
| web-deploy | Codex | GitHub Pages workflow, tracking `resources/web`, user test guide for Pages; brief `tasks/web-deploy.md` | ended（本地 CI 副本通过；GitHub/手机待用户） |

## Team (v1 build, started 2026-10-24)
| Role | Owns |
|---|---|
| main agent (coordinator) | `src/shared/**`, tests for shared, integration, final verification, `docs/progress.md` |
| content-a | `content/units/u02–u13`, `content/lexicon/core.json` |
| content-b | `content/units/u14–u26`, `content/lexicon/phase2.json` |
| phonics-docs | `content/phonics/p01–p24`, `docs/01-learning-method.md`, `docs/content/*`, `docs/user-guide-zh.md`, `docs/README.md` |
| main-process | `src/main/**`, `src/preload/index.ts`, `docs/modules/{storage,speech,main-process}.md` |
| renderer | `src/renderer/**`, `docs/modules/{ui,lesson,review}.md` |
| tooling | `scripts/**` (except content-validate/lib owned jointly), `electron-builder.yml`, `.github/`, `README.md`, `docs/dev-setup.md`, `docs/decisions/` |

## Team (pattern lessons, started 2026-10-24) — decision `docs/decisions/0006-pattern-scene-lessons.md`
Task brief for content agents: `.agent-wiki/tasks/patterns-content.md`.
| Role | Owns |
|---|---|
| main agent (coordinator) | all code (`src/**`, `scripts/**`), u02 exemplar, `content/lexicon/patterns-main.json`, docs |
| content-pa | u01, u03–u08 + `content/lexicon/patterns-a.json` |
| content-pb | u09–u14 + `content/lexicon/patterns-b.json` |
| content-pc | u15–u20 + `content/lexicon/patterns-c.json` |
| content-pd | u21–u26 + `content/lexicon/patterns-d.json` |
Status 2026-10-24: all four content agents done; coordinator summary `summaries/coordinator-2.md`.

## Team (summaries, stories, daily words, 2026-10-24/25) — decision `docs/decisions/0007-summaries-and-stories.md`
Brief: `.agent-wiki/tasks/daily-stories-content.md`. content-da … content-de all done (summaries in `summaries/`).
Tools: `.agent-wiki/tools/fmt_unit.py` (compact JSON style), `.agent-wiki/tools/taught.ts` (which words are taught by a unit).
