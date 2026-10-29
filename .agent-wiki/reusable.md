# Reusable commands, snippets and traps

- Pages CI：`npm run web:build:ci` 只读取已提交的 `resources/web`，先验源清单摘要再构建 shell/SW，再验最终清单。`npm ci --ignore-scripts` 避免 ffmpeg/Electron 下载；esbuild 由 npm 平台可选包提供。`node scripts/web/ci-smoke.mjs` 复制 Git 可见文件到 OS temp，断言无原 WAV/开发模型/证书及 ffmpeg，安装后执行 Pages 子路径构建和真实 Chrome 冒烟；Windows/Chrome/tsx 需沙箱外。此本机复现不是 Linux/GitHub 已通过证明。（2026-10-29）
- PowerShell 通过管道把含中文的 Python 源码送到 stdin 可能损坏 Unicode；本轮首次 board 消息出现问号，已追加说明。使用 apply_patch 直接编辑 UTF-8 文件；需要脚本时先写 UTF-8 文件再执行，避免带中文的 stdin 管道。（2026-10-29）

- Web speech WASM（2026-10-29）：官方 HF vad-asr JS 前缀是中文模型 file-packager，直接加载会请求巨大 .data；固定摘要后在唯一 `var moduleOverrides=Object.assign({},Module);` 边界保留运行时后段，以 wasmBinary 及缓存 tiny.en FS 文件装配。不能只用空 getPreloadedPackage 糊弄：那仍会注册中文文件。必须匹配同提交 wrapper，真实解码验证布局；实现/固定摘要见 docs/web/speech.md。
- Speech Chrome 冒烟：`node src/web/speech/validation/capture.mjs` 必须沙箱外运行（内层 CDP 可连接却不响应）；复用现有 Chrome/Node CDP，无 npm 新依赖。build/profile 放 OS temp，避免把浏览器配置写入用户已要求跟踪的 wiki；结果仅保留合成课程识别 JSON，不使用个人录音。不要把 `.data` 缺失误判为模型不兼容。

## Commands

- Chrome CDP 生产播放冒烟：Runtime.evaluate 内 button.click() 默认不附用户激活，可能被 autoplay 拒绝；用 `userGesture:true` 表达测试者点击，再观察真实 HTMLMediaElement ended/duration，不要用伪造 play() 成功。`scripts/web/browser-smoke.mjs` 已覆盖真实课进入及音频播放；没有假麦克风，不宣称生产录音/识别已验。UI 截图 harness 的 build/profile 已移 OS temp，tracked wiki 仅留合成截图/测量。（2026-10-29）
| Task | Command |
|---|---|
| Validate content while units are still missing | `npx tsx scripts/content-validate.ts --allow-missing --warnings` |
| Full validation | `npm run content:validate` |
| Validate only some units (others may be mid-edit) | `npx tsx scripts/content-validate.ts --only u03,u04 --warnings` |
| Screenshot the built app with a click script | scratchpad `shoot.mjs <name> <userDataDir> <script.js> [delayMs]` (copy below); script can call `window.api.parts.complete(...)` to set up state, then click buttons by text |
| Typecheck both sides | `npm run typecheck` |
| Tests | `npm test` (vitest; renderer tests need `// @vitest-environment jsdom` at the top of the file) |
| Dev bundle from whatever compiles now (logs what it skipped) | `npx tsx scripts/content-build.ts --allow-missing` |
| Generate a few audio clips to test | `npx tsx scripts/audio-generate.ts --limit 5` (`--prune` removes stale wavs, `--force` regenerates all) |
| Speech models (idempotent, uses .models cache) | `npx tsx scripts/models-download.ts --with-kokoro` |
| Check electron-builder config without a full installer | `npx electron-builder --win --dir --config electron-builder.yml` (needs `out/` built first; delete `release/` after) |
| Extract one member from a .tar.bz2 on Windows | `extractTarBz2(archive, outDir, ['folder/file'])` in `scripts/lib/download.ts` (uses System32 bsdtar; Git Bash GNU tar mangles `D:` paths) |
| Pick a dependency version ≥ 2 weeks old | `node "$TMP/pick.mjs" <pkg>@<major>` (script: list `npm view <pkg> time --json`, filter by date) |

## Verified facts (2026-10-24, this machine)
- Node 24.21, npm 11.19, no Rust. Electron 44.7.0 bundles Node 24.21; `node:sqlite` works in both Node and Electron.
- Electron 44 downloads its binary on first run (`npx electron --version`), not on install.
- npm 11 blocks dependency install scripts unless listed in `allowScripts` in package.json (`npm install-scripts approve <pkg>`).
- sherpa-onnx-node 1.13.8 loads in Node 24 and Electron. Spike timings on this laptop: Kokoro 4.3 s of audio in 1.8 s; Whisper base.en int8 recognises it in 0.4 s.
- Kokoro v0_19 speaker ids: 0 af, 1 af_bella, 2 af_nicole, 3 af_sarah, 4 af_sky, 5 am_adam, 6 am_michael, 7 bf_emma, 8 bf_isabella, 9 bm_george, 10 bm_lewis. Sample rate 24000.
- Whisper writes numbers as digits/currency ("$280"); `normalizeWords` in `src/shared/domain/normalize.ts` handles both sides.

## sherpa-onnx snippets (Node)
```js
const sh = require('sherpa-onnx-node');
const tts = new sh.OfflineTts({ model: { kokoro: { model, voices, tokens, dataDir /* espeak-ng-data */ }, numThreads: 2 }, maxNumSentences: 1 });
const audio = tts.generate({ text, sid: 7, speed: 1.0 }); // { samples: Float32Array, sampleRate }
sh.writeWave(path, { samples: audio.samples, sampleRate: audio.sampleRate });

const rec = new sh.OfflineRecognizer({ featConfig: { sampleRate: 16000, featureDim: 80 },
  modelConfig: { whisper: { encoder, decoder }, tokens, numThreads: 2 } });
const s = rec.createStream(); s.acceptWaveform({ samples, sampleRate }); rec.decode(s); // or await rec.decodeAsync(s)
rec.getResult(s).text;
```

## Traps
- PWA 更新暂存必须 bypass 已激活 SW 的旧 shell 缓存：下载使用 fetch cache:no-store，SW 对这种非导航请求直接放行网络；导航即使 no-store 仍需离线 fallback。否则同 URL 的 index/sw 永远拿到旧字节，候选摘要校验无法完成。
- 并发暂停测试不能假定 bundle 先于音频完成；应记录真正写入缓存的已校验 URL，再核对恢复不会重新请求它们。
- Web 静态构建：Vite 7.3.7 开启 build.manifest 且有 Worker 构建时，本机出现 `[vite:manifest] entryCssReferenceIds is not iterable`。web 构建关闭这个可选 manifest，直接从 Vite dist 输出遍历生成带摘要的 web-manifest（仍校验每个 shell/Worker/WASM）。
- 手机 UI 本机截图（2026-10-29）：`node src/web/ui/validation/capture.mjs` 使用现有 Chrome + Node WebSocket/CDP，无新依赖；首次需 GUI/浏览器启动权限，已获脚本命令前缀批准。隐藏 Electron 加载本机页曾 ERR_FAILED，不能当截图通过。Chrome user-data-dir 每轮唯一，避免读到上次遗留的 DevToolsActivePort 而 ECONNREFUSED；成果保存在 `.agent-wiki/mobile-screenshots`，仅 Mock 布局，非 iPhone 验收。
- Web speech（2026-10-29）：AudioContext 要在点击调用栈创建并 resume；getUserMedia 后 addModule/resume 失败必须 stop 全部 tracks。hook 卸载时不仅 stop 已创建 session，还须 AbortController 覆盖等待权限/加载的阶段，并返回 null，防 ChallengePart 在卸载后继续保存。
- Web 迁移设计核对（2026-10-29）：`src/shared/ipc.ts` 的实际契约名是 `AppApi`；`setApi` 已支持浏览器启动前注入，不需要伪造 Electron preload。`contentAudioUrl` 固定输出 `media://`，浏览器应注入播放器 clip resolver，不让 SW 接管该 scheme。
- sqlite-wasm：优先单 Dedicated Worker 的 `opfs-sahpool`，可避免 COOP/COEP 要求，但不支持多个池持有者；不能照抄桌面 WAL 或直接复制池的物理文件作数据库备份。官方核对来源见 `docs/web/architecture.md`。
- 旧 repositories 和 LearningService 虽主要是 SQL/纯逻辑，但类型依赖具体 `src/main/db/database.ts`（node:sqlite）；不要直接导入 Web 后假定无 Node 依赖。迁移 SQL 可独立复用。
- sherpa 的 WASM 支持/Zipformer 示例不等于已验证 Whisper 单线程构件；必须核对实际构件、模型与真机，不能复用 Node 测速当手机结论。iOS 下载“后台”应按前台空闲+下次恢复设计。
- **The Bash tool can collapse `\\` inside heredocs.** Write any file containing backslashes (regexes!) with the Write/Edit tool, not `cat <<EOF`.
- Git Bash is cp1252: never put Chinese on a command line; put it in UTF-8 files.
- Project path has spaces: always quote it.
- TypeScript 6: `baseUrl` is deprecated; `paths` are relative (`./src/...`).
- Vitest 5: `environmentMatchGlobs` is gone; use a `// @vitest-environment jsdom` docblock per file.

## Screenshot runner (shoot.mjs)
Runs `node_modules/electron/dist/electron.exe .` with `KAIKOU_USER_DATA`, `KAIKOU_CAPTURE=<png>`, `KAIKOU_CAPTURE_DELAY`,
`KAIKOU_CAPTURE_SCRIPT=<file contents>` (needs `npx electron-vite build` first). Click helper used in scripts:
`const click=async(t,n=0)=>{[...document.querySelectorAll("button")].filter(b=>b.textContent.includes(t))[n].click();await sleep(700)}`.
Beware: the course page has several "开始上课" buttons (the light challenge comes first).

## Pattern lessons (2026-10-24)
- Frame matching (`src/shared/content/pattern.ts`): words before the frame are allowed, words after it are not.
- Content agents cannot be stopped with `wmux agent kill` from this session (auto-mode classifier denies it); ask the user to close the tabs.

- sqlite-wasm 官方持久化文档新坑（2026-10-29 核对）：SAHPool 初始化失败默认可能 removeVfs 删除池，preserveOnInitFailure 是 3.54 新增。storage 必须核对实际包是否支持并显式 true；不支持时不能把失败保留数据称为已实现。
- **Codex sandbox (Windows, workspace-write): `tsx` fails reading OS user info (ENOMEM)** — any `npx tsx ...` / `npm run check` / `web:assets` must run outside the sandbox, so Codex asks for approval. Tell the user to answer `p` (don't ask again) for repeated scripts. (2026-10-29)

- storage 原生 Chrome CDP（2026-10-29）：本沙盒内 WS open、HTTP /json 成功但 Runtime.enable/evaluate 无响应；相同 node src/web/storage/validation/run.mjs 经 require_escalated 后成功。生成输出/合成 profile 放 OS temp，避免 lint/prettier 递归扫描构建物。该命令已验证真实 SQLite WASM OPFS+IDB、进程冷重开和第二 Worker STORAGE_BUSY；不是 iPhone 证明。
