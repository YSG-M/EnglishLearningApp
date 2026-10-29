# Web/PWA 架构与构建者契约

日期：2026-10-29。状态：实现已交付，桌面浏览器集成验证中，iPhone 待人工验收。产品决定见 [0008](../decisions/0008-web-pwa-iphone.md)。变动事实与验证结果统一记在 wiki 的 Now 块；本文记录模块契约。

## 1. 模块与目录

```text
src/web/
  index.html, main.tsx       # 浏览器启动与装配
  storage/                  # SQLite Worker、迁移、仓库、学习服务、录音、备份
  speech/                   # 离线识别 Worker、模型管理、Provider
  assets/                   # 资源清单、下载队列、Service Worker 客户端
  pwa/                      # Service Worker 源码
  ui/                       # 下载、备份、安装说明等移动端组件
public/web/                 # 手工维护的图标和 manifest 模板
scripts/web/                # 转码、资源构建、模型获取、HTTPS 服务
resources/web/              # 生成物，不提交
dist-web/                   # 静态站点，不提交
docs/web/                   # 设计与各角色验证记录
```

UI → `AppApi` 浏览器适配器 → 数据库 Worker；UI → 录音/播放器；适配器 → SpeechClient → 识别 Worker。资源下载独立于个人数据。Service Worker 只缓存静态资源，不访问学习库，不持有麦克风，不识别语音。

### 文件归属（本轮覆盖旧架构中的桌面分工）

| 构建者          | 独占可写路径                                                                                                                                                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| web-storage     | `src/web/storage/**`、`docs/web/storage.md`                                                                                                                                                                                                                                                       |
| web-speech      | `src/web/speech/**`；`src/renderer/src/audio/**`；`src/renderer/src/hooks/useRecorder.ts`、`usePlayer.ts`；`src/renderer/src/components/SpeakPanel.tsx`；`scripts/web/models-download.ts`；`docs/web/speech.md`                                                                                   |
| web-mobile      | `src/web/ui/**`；`src/renderer/src/**`，排除上行语音文件；`docs/web/mobile-validation.md`                                                                                                                                                                                                         |
| web-assets      | `src/web/assets/**`、`src/web/pwa/**`、`src/web/index.html`、`src/web/main.tsx`、`public/web/**`；`scripts/web/**` 排除模型脚本；根目录 `package.json`、锁文件、`vite.web.config.ts`、`tsconfig*`、`vitest.config.ts`、`eslint.config.*`、`.gitignore`；`docs/web/assets.md`、`docs/dev-setup.md` |
| coordinator-web | `src/shared/**`（本轮预期无需改）、`docs/02-architecture.md`、`docs/README.md`、`docs/progress.md`、最终集成报告与团队状态                                                                                                                                                                        |

所有构建者只读 `src/main/**`、`src/preload/**` 和 `content/**`；不移动或删除 Electron 代码，不互相编辑文件。各自测试放自己目录内；跨模块测试由协调者负责。wiki 的各自状态行/总结和 append-only board 是共享例外。

## 2. AppApi 兼容层

真实类型名是 `AppApi`，定义在 `src/shared/ipc.ts`，并非 `Api`。所有方法保持异步、输入输出与错误码不变。浏览器在挂载 React 前调用现有 `setApi(api)`；无需伪造 Electron preload。测试继续用 `setApi(mockApi)`。

| 方法组                                                      | 浏览器实现                                                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `app.getInfo`                                               | 构建版本、内容版本；`dataDir`/`logsDir` 返回明确标识浏览器本地存储的说明，不伪造磁盘路径   |
| `content.getBundle`                                         | AssetsClient 加载当前已激活清单对应内容包，校验内容哈希                                    |
| `today`、`parts`、`review`、`hints`、`progress`、`settings` | 在数据库 Worker 内运行学习服务与 SQL 仓库，复用共享调度逻辑                                |
| `speech.getStatus`                                          | SpeechClient 当前状态；模型下载与识别状态分开                                              |
| `speech.recognize`                                          | 校验 PCM → 需要保留时先存录音 → 本地识别 → 写 transcript；失败保留已保存录音并抛原有错误码 |
| `speech.annotateRecording`                                  | 存分数/文字；自己评分保持 score/transcript 为 null，不捏造识别成绩                         |
| `recordings.*`                                              | 持久化录音、列举挑战；返回会话内有效的 Blob URL，数据库只存稳定文件键                      |
| `diagnostics.openLogsFolder`                                | 下载本地日志文本；界面标签改成“导出日志”                                                   |
| `diagnostics.exportBundle`                                  | 下载诊断 JSON，返回 `{folder: 下载文件名}`；界面显示“文件已准备”，不称已保存到文件夹       |
| `log.write`                                                 | 本地限量日志，不记录原始 PCM、整段识别文字和个人数据库，不上传                             |

`contentAudioUrl()` 的 `media://` 只用于桌面。浏览器播放器通过注入的 `resolveClip` 转换 clipKey；禁止修改共享函数影响 Electron，禁止让 Service Worker 拦截非 HTTP scheme。所有录音 URL 用 Blob URL，页面卸载/列表替换时回收。

### 装配边界（实现时导出这些名称）

以下是设计签名，类型由各自目录的 `types.ts` 定义，不能再建立第二套 `AppApi`：

```ts
// assets/index.ts
createAssetsClient(baseUrl: string): Promise<AssetsClient>
// speech/index.ts
createSpeechClient(assets: AssetsClient): SpeechClient
// storage/index.ts
createWebApi(deps: { assets: AssetsClient; speech: SpeechClient }): Promise<WebRuntime>
// renderer/src/audio/player.ts
configurePlayer(options: { resolveClip: (key: string) => string;
  allowSpeechSynthesis: boolean }): void
```

`WebRuntime` 含 `api: AppApi`、`backup: BackupClient`、`dispose(): Promise<void>`。`BackupClient`：`exportFile(): Promise<Blob>`、`inspectFile(file: Blob): Promise<{createdAt: string; recordingCount: number}>`、`importFile(file: Blob): Promise<void>`（替换，不合并）、`storageStatus(): Promise<{persistent: boolean; usage: number | null; quota: number | null}>`。导出/导入按钮与文件名、下载/分享动作归 mobile；导入校验、事务与文件解析归 storage。

`SpeechClient`：`getStatus(): Promise<SpeechStatus>`、`recognize(samples: Float32Array, sampleRate: 16000): Promise<string>`、`downloadModel(): Promise<void>`、`removeModel(): Promise<void>`、`cancel(): void`、`subscribe(listener: (state: {status: SpeechStatus; download: DownloadState}) => void): () => void`、`dispose(): void`。SpeechClient 不保存学习记录、不打开 SQLite。

`AssetsClient`：`getBundle(): Promise<ContentBundle>`、`resolveClip(key: string): string`（同步得到清单 URL）、`ensureWeeks(weeks: number[]): Promise<void>`、`downloadModelFiles(modelId: string): Promise<void>`、`removeModelFiles(modelId: string): Promise<void>`、`modelFiles(modelId: string): Promise<{path: string; bytes: Uint8Array}[]>`、`pause(): void`、`subscribe(listener: (state: DownloadState) => void): () => void`、`getState(): DownloadState`、`checkForUpdate(): Promise<boolean>`、`activateUpdate(): Promise<void>`。模型文件由 assets 负责网络/完整性/cache，speech 负责选择模型和加载，不重复下载。`DownloadState` 在 assets/types.ts：`{phase: 'idle'|'downloading'|'paused'|'ready'|'error'; completedBytes: number; totalBytes: number; completedFiles: number; totalFiles: number; message?: string}`。speech 的 subscribe 只转发属于模型的进度，不覆盖课程下载进度；assets 内分别维护任务状态。

`main.tsx` 先建立 assets，再 speech，再 WebRuntime，设置 api 和播放器，最后挂载 React。mobile 提供 `src/web/ui/WebServices.tsx` 的 Provider，接受 `{assets, speech, backup}`；现有 AppContext 保持学习状态。装配错误显示可重试的启动页，不先加载 UI 再报 preload 不存在。

## 3. 数据库 Worker 与个人文件

- 一个 Dedicated Worker 独占 sqlite-wasm、OPFS SAHPool 与所有 SQL。UI 不跨 Worker 调用同步 SQL。请求格式 `{id, method, args}`，响应 `{id, ok: true, value}` 或 `{id, ok: false, error: {code, message}}`，不传函数/Error 实例。串行执行写操作；事务回调绝不跨 await。
- `src/main/db/migrations.ts` 是无 Node 导入的 SQL 历史，可直接导入，不改已发布迁移。数据库适配器在 storage 内实现同等 `run/get/all/exec/transaction/userVersion`；旧仓库和 LearningService 引用了具体 Node Database 类型，**不能直接导入后假定可用**。将仓库 SQL 与服务逻辑适配到 storage，保持行为，通过旧测试案例与共享纯逻辑校验；本轮不重构桌面层。
- 使用 SAHPool，不依赖 SharedArrayBuffer/COOP/COEP。SQLite 官方说明其适用于无法配置隔离头的场景，但只支持一个池持有者：[持久化说明](https://www.sqlite.org/wasm/doc/trunk/persistence.md)。第二个同源窗口无法取得写入权时，显示“请回到已打开的学习窗口”，不得重建空库。
- OPFS 内 SQLite 池由官方 VFS 管理，不能自行按数据库文件名复制池文件。使用官方导出/导入能力做迁移快照。使用回滚日志模式，禁止照搬桌面 WAL 配置。
- 每次迁移先导出快照，事务迁移 `user_version`；未来版本库拒绝降级打开。OPFS 无法打开/写入时保留现有文件，给重试和导出入口，不回退到无提示内存库。
- 录音用 16 kHz mono PCM WAV Blob 存 IndexedDB `kaikou-personal` 的 `recordings` store，键为 UUID；SQL `recordings.file` 存 UUID，保持旧保留策略：第一次 + 最近三次练习、挑战不自动清理。录音文件先落盘，再提交 SQL 索引；中断留下的孤儿可在下次启动清理，绝不能先删旧录音再保存新录音。
- SQL 与 IndexedDB 无跨库事务。导入使用代际命名：先验证并准备新录音 generation，再在数据库事务中替换表和 generation 标识；活动 generation 以 SQLite 为准；启动清理未引用 generation。失败时保留旧 generation，成功后才清理旧文件。
- 调用 `storage.persist()`/`estimate()`，处理拒绝和 QuotaExceededError，保存失败不显示完成。空间不足先暂停可重下载资源，不自动删除学习数据/挑战录音。WebKit 不保证请求必获准：[存储策略](https://webkit.org/blog/14403/updates-to-storage-policy/)。

## 4. 录音与离线识别

沿用 AudioWorklet 采样和已有 resample，输出 16 kHz Float32 mono。MediaRecorder 的压缩 Blob 不能作为 PCM 发送；如果以后用于回听，必须通过 `isTypeSupported` 探测，不能硬编码 webm。WebKit 文档记录了 MP4/AAC 支持：[MediaRecorder](https://webkit.org/blog/11353/mediarecorder-api/)。

录音只能由点击触发；创建/恢复 AudioContext，所有成功、失败、取消、离开页面、锁屏路径必须停止麦克风 tracks、断开节点和关闭 context。录音开始前停止播放器；结束释放麦克风后再回听。播放器使用单个 `<audio>`，按能力设置 `navigator.audioSession.type = 'playback'`，录音时切换、结束后恢复；未支持时不报错。静音开关与听筒路由属于真机验收项。

### Speech Worker 协议

```ts
type Request =
  | { id: number; type: 'init'; modelId: string; files: { path: string; buffer: ArrayBuffer }[] }
  | { id: number; type: 'recognize'; samples: Float32Array; sampleRate: 16000 }
  | { id: number; type: 'dispose' };
type Response =
  | { id: number; type: 'ready' }
  | { id: number; type: 'result'; text: string; durationMs: number }
  | { id: number; type: 'disposed' }
  | { id: number; type: 'error'; code: 'SPEECH_UNAVAILABLE' | 'SPEECH_FAILED'; message: string };
```

files 与 samples 使用 transferable；识别输入先复制给 Worker，不能 detach UI 用于回听/保存的缓冲区。只允许一个在途识别；取消/超时由主线程 terminate Worker 并递增 generation，忽略旧响应，不能指望同步 WASM decode 会处理 cancel 消息。单次上限 20 秒，初始化上限 60 秒；超时释放模型内存，切换自己评分，后续由用户重新启用。静音先检测，不把空音频当识别成功。

默认使用不要求 SharedArrayBuffer 的单线程构件，固定 sherpa 构件版本、SHA-256、许可证和 Whisper 模型匹配信息。官方 WASM 页面本身只证明存在构建路径，**不证明可下载的 Whisper 单线程组合已验证**：[sherpa WASM](https://k2-fsa.github.io/sherpa/onnx/wasm/index.html)。speech 构建者先做可复现的构件可用性核对；找不到可用构件时完成录音/回听/评分并在 board 明确报告该识别阻塞，不能替换成云服务或声称识别完成。

失败状态仍保留本次回听；SpeakPanel 的 recognize 失败（不只 unavailable）都能进入自己评分。当前 selfMode 仅保留会话回听，保持此语义；挑战仍通过 `saveChallenge` 持久化。自评结果不写自动识别分数，复习仍通过共享 gradeOutcome 走原规则。

## 5. 静态清单与缓存

`web-manifest.json` 是资源清单，不是安装用 `manifest.webmanifest`。assets 构建者定义并校验版本 1：

```json
{
  "schemaVersion": 1,
  "releaseId": "release-content-build-hash",
  "appVersion": "0.1.0",
  "contentHash": "content-hash",
  "bundle": "content/bundle.content-hash.json",
  "files": [
    {
      "url": "content/bundle.content-hash.json",
      "kind": "content",
      "bytes": 100,
      "sha256": "hex",
      "required": true
    },
    {
      "url": "audio/bf_emma_clip-hash.m4a",
      "kind": "audio",
      "bytes": 100,
      "sha256": "hex",
      "clipKey": "bf_emma_clip-hash",
      "weeks": [1, 2]
    },
    {
      "url": "models/model-hash/encoder.int8.onnx",
      "kind": "model",
      "bytes": 100,
      "sha256": "hex",
      "modelId": "whisper-tiny-en-int8"
    }
  ]
}
```

上例数字/哈希仅示意。kind 还允许 shell/wasm；每个 URL 都是相对站点 base 的同源路径，拒绝 `..`、外部 URL 与重复冲突键。编译产物 JS/CSS 清单从 Vite 输出生成，避免手写漏项。音频转换保留 clipKey，最终字节另有 SHA-256；编码参数变化必须更换资源路径/发布版本，不能让同 URL 指向不同字节。生成器遍历单元、周故事、词库、拼读和挑战所有 clip 引用，复用词跨周收集 weeks；第 1 周所引用的共享词音频也必须下载。

- 第一次应用安装缓存 shell、SQLite WASM、内容清单与内容；第 1 周全部依赖下载校验完成后才显示“第 1 周可离线使用”。模型不属于必需缓存。
- shell 使用 release 缓存，内容与音频按不可变 URL cache-first，模型独立 cache。下载先校验状态、长度和 SHA-256，再放正式缓存；进度从校验完成文件统计，失败不计为已下载。并发上限 2，按字节显示总体进度，暂停后恢复按已有文件核对。
- UI 请求远期课程时 `ensureWeeks`，未下载时显示“这周还没下载”，连网可下载，离线回到可用课程。后台仅指应用保持前台时空闲下载；iOS 挂起后下次启动继续。
- 音频缓存存完整 200 响应。Service Worker 对单段 byte Range 返回正确 206/Content-Range；越界返回 416，避免 Safari 已缓存却无法播放。不能把 206 碎片当整文件缓存。
- 导航 network-first，失败回当前 release 的 index；JS/CSS/worker/WASM 按 release 固定引用。新版本下载到 staging，清单、shell、内容及已承诺离线周音频齐备后标记候选版本。旧版一直可用，失败清 staging。
- 更新只在非录音、非识别、非学习提交时由用户点“更新并重新打开”。禁止无条件 skipWaiting/clients.claim 打断课程。确认后激活并 reload，数据库迁移独立备份；旧客户端存活时不删除其资源。清理只删不再引用且无活跃旧客户端的缓存，绝不删除个人存储。
- 所有获取只访问当前静态站点，不加载 CDN 脚本/在线语音。SW scope、base、start_url、资源路径一致，兼容 `/EnglishLearningApp/` 子目录。

## 6. 完整备份格式

单文件 `kaikou-backup-<date>.json`，UTF-8：`{format: 'kaikou-backup', version: 1, createdAt, appVersion, contentHash, dbUserVersion, tables, recordings}`。tables 包含现有全部学习表（卡片、复习日志、进度、活动、连续天数、提示、设置、录音索引与事件）；recordings 是 `{id, mime: 'audio/wav', bytes, sha256, dataBase64}` 数组，包含全部被索引录音。排除派生 Blob URL、课程音频、模型、缓存与本地诊断日志。无需 ZIP 新依赖；大文件导出需显示准备状态，按顺序处理录音，测试内存边界。

导出时暂停写队列，读取一致 SQL 快照和引用录音，缺文件要报失败，不能输出“完整”但缺录音的包。下载后提示保存到“文件”，如支持文件分享由用户点击分享；浏览器不能证明用户已保存，所以不承诺自动备份成功。

导入先 inspect：格式/版本、严格字段、文件大小上限（默认 100 MiB）、base64 长度、哈希、唯一 ID、外键/内容引用和允许表名；禁止执行备份携带的 SQL。未知未来数据库版本拒绝。显示备份日期和录音数，用户确认替换后先导出现有备份，再按第 3 节代际方案导入。失败保留旧数据；重新打开校验成功后刷新 AppContext。模型与课程可随后重下，不要求恢复时联网。

## 7. 构建与本地 HTTPS

由 assets 交付以下命令并记录实际结果：

| 命令                                                                       | 契约                                                                     |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `npm run web:assets`                                                       | content:build 后转码并生成清单，可重复执行，只更新变化文件               |
| `npm run web:dev`                                                          | Vite 浏览器开发入口，localhost 测试，不宣称 iPhone 可用                  |
| `npm run web:build`                                                        | 完整生成 dist-web 静态站点，不加载 Electron/Node 原生运行依赖            |
| `npm run web:serve -- --host 0.0.0.0 --port 4173 --cert <pem> --key <pem>` | Node 原生 HTTPS 服务，服务 dist-web，正确 MIME、Range、base 和 SW 响应头 |
| `npm run web:typecheck`                                                    | Web 主线程、Worker 与脚本类型检查                                        |
| `npm run web:check`                                                        | web:typecheck、lint、Mock 单测、内容校验与静态产物检查                   |
| `npm run web:models`                                                       | 固定版本、完整性核对的可选 WASM/Whisper 构件准备；不自动运行下载到手机   |

HTTPS 不增加 npm 依赖：脚本使用 Node `https`；证书用已有 OpenSSL 或 Windows 证书工具生成本地开发 CA 与带固定 LAN IP/DNS SAN 的服务器证书。只把 CA 公钥证书传到手机，私钥保留本机且 gitignore。iPhone 安装描述文件后在“设置 → 通用 → 关于本机 → 证书信任设置”开启根证书完全信任，再通过 Safari 打开 `https://<LAN-IP>:4173/<base>/`，确认无证书警告、`isSecureContext` 为 true、麦克风可用，再“分享 → 添加到主屏幕”。固定 IP、端口、base，换 origin 不会共享学习数据。防火墙只开放专用局域网入站，绝不关闭整个防火墙。证书信任和安装必须由持有手机的人完成，记录为待人工执行。

## 8. 测试与放行

Vitest 继续 Mock Provider，不在自动测试下载/加载模型。storage 用可注入数据库/文件存储，测试迁移、备份损坏、配额失败、导入中断、复习上限与重复完成；speech 用 Fake Worker/麦克风验证超时、stale response、track 清理和回退；assets 用 Fake fetch/cache 验证断点恢复、校验失败、Range 和更新失败回滚；mobile 用现有 mockApi 与 Fake WebServices 测试导航、自评和进度。

Web 检查不得省略新目录；原 `npm run check` 继续运行，最终再跑 `npm run web:check` 和 `npm run web:build`。生成物扫描 Node/Electron/sherpa-onnx-node 引用、验证所有清单文件存在和摘要正确。真实 WASM、OPFS 和 Service Worker 另做浏览器/真机冒烟，不能用 Mock 代替。

真机验收：主屏幕冷启动 → 第 1 周下载 → 飞行模式杀掉重开 → 听/慢速/录音/回听/自评 → 完成课和复习 → 重开数据仍在 → 导出/导入恢复录音与进度。再测试锁屏/切后台、静音开关、拒绝麦克风、ASR 失败、磁盘不足和中断下载。单独记录模型冷加载、短句解码耗时与是否崩溃，不把电脑时间当手机性能。完成这些且用户接受后，才能计划删除桌面代码与选择托管。
