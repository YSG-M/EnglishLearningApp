# 02 · 技术架构

> 这份文档是各模块之间的**约定**。改动接口（`src/shared/ipc.ts`、`src/shared/content/*`）前，先改这里。

## 1. 总览

```
┌──────────────────────── Electron 应用 ────────────────────────┐
│                                                               │
│  Renderer（界面，React）            Main（主进程，Node）        │
│  src/renderer/src/**                src/main/**               │
│   页面 / 组件 / 录音 / 播放   ◄──IPC──►  数据库 / 复习调度 / 录音存储  │
│        │  window.api (AppApi)            │                    │
│        │                                 ▼                    │
│        │                     utilityProcess: speechHost       │
│        │                     （Whisper 识别，独立进程，不卡界面）  │
│        ▼                                                      │
│  media://audio/<clip>.wav  ← resources/audio（预生成的课程音频）  │
│  media://rec/<file>.wav    ← 用户数据目录/recordings（她的录音）  │
└───────────────────────────────────────────────────────────────┘

开发时：content/*.json ──content:build──► resources/content/bundle.json
        bundle.json  ──content:audio(Kokoro)──► resources/audio/*.wav
        models:download ──► resources/models/whisper-base.en/
```

- 技术栈：Electron 44 · React 19 · TypeScript 6 · Vite 7（electron-vite）· Node 内置 `node:sqlite` · sherpa-onnx（Kokoro 朗读 + Whisper 识别）· ts-fsrs · zod
- 全部离线、全部免费。运行时没有任何网络请求。

## 2. 目录与归属

| 路径                                                   | 内容                                                                | 负责                |
| ------------------------------------------------------ | ------------------------------------------------------------------- | ------------------- |
| `src/shared/`                                          | 跨进程共享：内容格式、IPC 接口、复习/调速/连续天数/语音比对等纯逻辑 | 主代理              |
| `src/main/`                                            | 主进程：窗口、IPC 实现、数据库、录音存储、语音识别进程、日志、诊断  | main 子代理         |
| `src/preload/`                                         | 把 `AppApi` 暴露为 `window.api`                                     | main 子代理         |
| `src/renderer/`                                        | 全部界面                                                            | renderer 子代理     |
| `content/units/u02–u13`、`content/lexicon/core.json`   | 第 1–7 周课程                                                       | content-a 子代理    |
| `content/units/u14–u26`、`content/lexicon/phase2.json` | 第 7–13 周课程                                                      | content-b 子代理    |
| `content/phonics/`                                     | 拼读单元 p01–p24                                                    | phonics-docs 子代理 |
| `scripts/`、`electron-builder.yml`、`.github/`         | 构建、音频生成、模型下载、打包、CI                                  | tooling 子代理      |
| `docs/`                                                | 文档；每个代码子代理写自己模块的 `docs/modules/*.md`                | 各自负责            |

**只改自己负责的文件。** 需要别人的文件改动时，用消息通知对方或主代理。

## 3. 接口约定（冻结，改动需通知主代理）

### 3.1 IPC：`src/shared/ipc.ts`

- 主进程实现 `AppApi`，preload 按 `API_CHANNELS` 逐个转发为 `ipcRenderer.invoke('<ns>.<method>', ...args)`，界面通过 `window.api.<ns>.<method>()` 调用。
- 所有方法都是 async。主进程用 zod 校验来自界面的输入。
- 内容包新增 `UnitItem.daily`、`UnitItem.stories` 和 `ContentBundle.weeks`（来自 `content/weeks/wNN.json`）。日常用词在学新句子那天建 `word` 卡片；故事不建卡片。
- `review.getPracticeSet(scope)`：额外练习，`scope` 为 `recent`（最近 7 天第一次完成的课）、`unit` 或 `random`；不改变复习安排。`parts.complete` 返回 `firstTime`，再上一次时只补缺少的卡片。
- 主进程抛出的错误统一包装为 `{ code: AppErrorCode, message }`，界面按 `code` 显示中文提示。

### 3.2 内容：`src/shared/content/`

- `schema.ts`：手写内容的格式（zod）；`compile.ts`：校验 + 编译；`bundle.ts`：运行时格式。
- 界面启动时调用 `content.getBundle()` 拿到整个 `ContentBundle`（大约 1–2 MB），之后在界面里查询。
- 音频：`contentAudioUrl(clipKey)` → `media://audio/<clipKey>.wav`。文件不存在时，界面退回到 `speechSynthesis`（Windows 自带语音），不能报错卡住。

### 3.3 文件路径

| 用途                                | 开发时                                                                                       | 安装后                                          |
| ----------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 内容包                              | `<repo>/resources/content/bundle.json`                                                       | `process.resourcesPath/content/bundle.json`     |
| 课程音频                            | `<repo>/resources/audio/`                                                                    | `process.resourcesPath/audio/`                  |
| Whisper 模型                        | `<repo>/resources/models/whisper-base.en/{encoder.int8.onnx, decoder.int8.onnx, tokens.txt}` | `process.resourcesPath/models/whisper-base.en/` |
| Kokoro 模型（只在开发时生成音频用） | `<repo>/.models/kokoro-en-v0_19/`                                                            | 不打包                                          |
| 用户数据                            | `app.getPath('userData')`                                                                    | 同左                                            |
| 数据库                              | `<userData>/data/learning.sqlite`                                                            | 同左                                            |
| 录音                                | `<userData>/recordings/`                                                                     | 同左                                            |
| 日志                                | `<userData>/logs/`                                                                           | 同左                                            |

### 3.4 录音格式

- 界面用 AudioWorklet 采集，**在界面里重采样到 16 kHz 单声道 Float32**，通过 IPC 发给主进程。
- 主进程保存为 16-bit PCM WAV，并交给 speechHost 识别。
- 识别结果只是文字。比对（`matchSpeech`）和反馈（`buildFeedback`）在界面里用共享代码完成，再通过 `speech.annotateRecording` 把分数存回去。

## 4. 数据库（主进程）

`node:sqlite`（`DatabaseSync`），WAL 模式。用 `PRAGMA user_version` 做版本迁移；迁移前先把旧数据库文件备份到 `<userData>/data/backups/`。

| 表               | 用途                                                                |
| ---------------- | ------------------------------------------------------------------- |
| `cards`          | 复习卡片（`StoredCard` 的字段）；类型 chunk / word / pair / example |
| `review_logs`    | 每次复习：卡片、题型、评分、是否正确、用时、时间                    |
| `part_progress`  | 已完成的课程部分                                                    |
| `daily_activity` | 每天的学习时长、复习数、完成部分数、是否算学习日                    |
| `streak`         | 连续天数状态（单行 JSON）                                           |
| `hint_progress`  | 每个单词说对的次数（谐音 3 次后隐藏）                               |
| `recordings`     | 录音文件、对应内容、时长、分数、识别文字                            |
| `settings`       | 设置（单行 JSON，用 `Settings` zod 解析，缺省值自动补齐）           |
| `app_events`     | 迁移、崩溃恢复等事件记录，方便排查问题                              |

## 5. 语音

- `AsrProvider` 接口：`getStatus()`、`recognize(samples, sampleRate)`。
  - `WhisperAsrProvider`：通过 Electron `utilityProcess` 启动 `speechHost`，消息通信；第一次使用时才加载模型；崩溃后自动重启；单次识别 20 秒超时。
  - `UnavailableAsrProvider`：没有模型时使用，状态为 `unavailable`。这时界面切换到"自己评分"模式，**app 照样能用**。
  - 测试用 `FakeAsrProvider`，不加载真实模型。
- 识别前先检查音量：几乎没有声音时直接返回空文字，避免 Whisper 在静音时"幻听"出文字。

## 6. 日志与排查问题

- 主进程用 `electron-log`，写到 `<userData>/logs/main.log`（按大小轮换）；界面日志通过 `log.write` 汇总到同一个文件。
- 未捕获的异常、渲染进程崩溃、speechHost 退出都会记日志。
- 设置页提供"打开日志文件夹"和"导出诊断包"（复制日志、数据库、设置和版本信息到桌面上的一个文件夹）。

## 7. 质量要求（所有子代理）

- TypeScript `strict`，不用 `any`。`npm run typecheck`、`npm run lint`、`npm test` 必须通过。
- 纯逻辑放 `src/shared/`，写单元测试；主进程服务用内存数据库（`:memory:`）测试。
- 注释写"为什么"。界面文字用简体中文。
- 不新增依赖；确实需要时先问主代理。
