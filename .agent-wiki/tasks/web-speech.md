# 任务：web-speech（Codex）

你是 coordinator-web 的构建子代理，负责 iPhone 录音/播放、离线识别与自己评分回退。

## 先读（按顺序）

1. `CLAUDE.md`。
2. `D:\Tools\Claude Work Rule\Project Wiki and Sub-agent rule.md`。
3. `.agent-wiki/INDEX.md`、`.agent-wiki/reusable.md`、`.agent-wiki/tasks/web-board.md`。
4. `docs/progress.md`、`docs/decisions/0008-web-pwa-iphone.md`、`docs/02-architecture.md`、`docs/web/architecture.md`（完整，尤其装配、协议与模型职责）、`docs/web/mobile-ui.md`。
5. `src/shared/ipc.ts`、`src/main/speech/**`、`src/renderer/src/audio/**`、`src/renderer/src/hooks/useRecorder.ts`、`usePlayer.ts`、`src/renderer/src/components/SpeakPanel.tsx`、`src/renderer/src/features/review/exercises.tsx`、`src/renderer/src/features/lesson/ChallengePart.tsx`、`scripts/models-download.ts`。

## 硬规则与归属

- 不 commit、不 push；简体中文文档、英文代码/注释，UTF-8 无 BOM、LF；Git Bash 命令行不写中文。
- 只写 `src/web/speech/**`、`src/renderer/src/audio/**`、`hooks/useRecorder.ts`、`hooks/usePlayer.ts`、`components/SpeakPanel.tsx`、`scripts/web/models-download.ts`、`docs/web/speech.md`，以及自己的 wiki 状态/总结和 board。其他 renderer 归 mobile，不改。
- 只用已批准依赖/下载构件；不添加第三方识别 SDK，不调用 Safari SpeechRecognition 或云语音。根 package/锁文件请求 web-assets 修改。

## 交付

1. 先核对固定版本的单线程 sherpa-onnx WASM 是否包含可用 Whisper tiny.en/base.en int8 支持，记录官方来源、许可证、SHA-256、模型参数和内存要求。Node 原生模块不能在浏览器使用；不能拿 Zipformer demo 宣称 Whisper 已实现。缺构件时明确上报阻塞，同时完成所有可独立交付项。
2. 导出架构第 2 节 `SpeechClient` 与 types；按第 4 节 Worker 消息协议实现懒加载、串行识别、静音检查、generation、terminate 取消、超时回退、资源释放。模型通过 assets 下载/读取，无第二套网络缓存。
3. 单独的开发模型脚本固定版本并核验摘要，下载是准备静态资产，手机模型下载仍由设置显式触发。先选 tiny.en int8，base.en 必须有真机证据；不得自动改用在线服务。
4. 播放器 `configurePlayer` 注入 resolveClip；浏览器关闭 speechSynthesis。保留桌面默认 media:// 与原默认兜底。单一 HTMLAudioElement，处理 user gesture、play 拒绝、音频缺失回调，不静默卡课。
5. AudioWorklet 原始 PCM、正确重采样；所有异常/取消/后台/卸载路径停止 tracks。播放与录音互斥，按能力设置 audioSession，录音结束先释放麦克风再回听。
6. SpeakPanel 所有识别失败都可直接回听和自评，保留本次录音，不捏造 transcript/score。自己评分/挑战与 AppApi 语义保持一致。样式使用 mobile 提供的通用类；需要跨文件修改写 board。
7. `docs/web/speech.md` 记录模块、构件验证、命令、结果与真机待测项。

## 验收

- `npx vitest run src/web/speech src/renderer/src/audio`，新增 SpeakPanel/录音边界测试放对应自有目录：初始化失败、识别失败/超时、取消后迟到消息、样本不被 detach、拒绝麦克风、addModule 失败后 tracks 清理、自评可继续。Fake Worker/Provider，不加载真模型。
- 配置就绪后 `npm run web:typecheck`、`npm run typecheck`，不把依赖未就绪报成通过。
- 提供真实浏览器/手机手测步骤，记录冷加载、短句耗时、静音开关与录音后路由；没有手机就写未测。构件缺失属于 ASR 阻塞，不影响回退功能验收，但不得报完整识别完成。

## 结束

先核对 Now/git status，自己的行设 active。发现陷阱即写 reusable；约 68% 写 `.agent-wiki/summaries/web-speech-1.md` 和 HANDOFF。结束前读 board、总结、行设 ended；全部完成写 `STATUS web-speech: DONE`，识别仍阻塞则明确保留 BLOCKED 与已完成范围，供协调者决定下一步。
