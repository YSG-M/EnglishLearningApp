# 模块 · 主进程（src/main、src/preload）

主进程负责：窗口、IPC 实现、数据库、录音文件、语音识别进程、日志、诊断。
界面只能通过 `window.api`（`src/shared/ipc.ts` 里的 `AppApi`）访问这些功能。

## 文件结构

| 路径                                     | 作用                                                                                                     |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `index.ts`                               | 启动入口：路径 → 日志 → 数据库 → 各服务 → 语音 → IPC → `media://` → 窗口。只做组装，不含业务逻辑         |
| `api.ts`                                 | 用各个服务实现 `AppApi`。不依赖 Electron，测试可以直接调用                                               |
| `ipc/dispatch.ts`                        | 每个通道：zod 校验参数 → 调用 `AppApi` → 包成信封 `{ ok, value }` / `{ ok:false, error:{code,message} }` |
| `ipc/schemas.ts`                         | 每个通道的参数校验（`satisfies Record<ApiChannel, …>`，漏写一个通道就编译不过）                          |
| `ipc/registerIpc.ts`                     | 把 dispatch 接到 `ipcMain.handle`                                                                        |
| `app/paths.ts`                           | 所有文件路径（开发 / 安装后），见架构文档 §3.3                                                           |
| `app/media.ts`                           | `media://audio/…`、`media://rec/…` 的地址解析和文件名白名单                                              |
| `app/capture.ts`                         | 截图模式（见下）                                                                                         |
| `services/learningService.ts`            | 今日计划、完成课程、复习、谐音进度、统计、设置                                                           |
| `services/contentService.ts`             | 读取并缓存 `bundle.json`；缺失时返回清楚的 `NOT_FOUND` 错误，不会让程序崩溃                              |
| `services/recordingService.ts`、`wav.ts` | 录音保存为 16-bit WAV；保留策略                                                                          |
| `services/diagnosticsService.ts`         | 打开日志文件夹；导出诊断包                                                                               |
| `speech/*`                               | 语音识别，见 [speech.md](speech.md)                                                                      |
| `db/*`                                   | 数据库，见 [storage.md](storage.md)                                                                      |
| `logging.ts`、`logger.ts`                | electron-log；服务只依赖 `Logger` 接口                                                                   |
| `clock.ts`                               | 注入"现在几点"，测试可以模拟跨天                                                                         |
| `src/preload/index.ts`                   | 按 `API_CHANNELS` 生成 `window.api`                                                                      |

## 错误处理约定

- 服务里抛 `AppError(code, 中文提示)`；其他异常一律变成 `INTERNAL`，界面只看到通用提示，细节只写进日志。
- **界面收到的错误是普通对象 `{ name: 'AppError', code, message }`，不是 `Error` 实例**：Electron 的 contextBridge 会丢掉 Error 上的自定义字段（比如 `code`）。界面用 `err.code`、`err.message` 读取即可。
- 参数校验失败 → `INVALID_INPUT`；内容缺失 / 找不到 → `NOT_FOUND`；没有模型 → `SPEECH_UNAVAILABLE`；识别失败或超时 → `SPEECH_FAILED`。

## 学习日规则（LearningService）

满足任意一条，今天就算学习日（连续天数 +1）：

1. 当天累计学习时间 ≥ 5 分钟（`MIN_ACTIVE_MS`）
2. 完成了一节课程（part）
3. 做过复习，并且今天计划的复习已经做完（复习量少的日子也能算）

每天第一次打开时结算一次漏掉的天数（用休息卡补，或者重新开始连续天数），结果记在 `daily_activity` 里，所以同一天重复打开不会重复扣卡。
单次上报的学习时长最多算 10 分钟，防止计时器卡住时虚增。

完成课程时创建复习卡片：`learn` → 句子卡 + 单词卡；`practice` → 本单元拼读的听辨卡；其他类型不建卡。
课程更新删掉某个句子后，它的旧卡片会自动不再出现。

## 安全

- `contextIsolation`、`sandbox` 开启，`nodeIntegration` 关闭；禁止弹窗和跳转到外部页面（http 链接用系统浏览器打开）。
- 只允许麦克风权限。
- 安装版通过响应头设置 CSP：`media-src 'self' media: blob:` 等。
- `media://` 只认 `^[a-z0-9_-]{1,120}\.wav$` 这样的文件名，无法访问其他目录。

## 截图模式（验证界面用）

```bash
npx electron-vite build
KAIKOU_USER_DATA=<临时目录> KAIKOU_CAPTURE_DELAY=4000 npx electron . --capture=shot.png
# 可选：先执行一段 JS（比如点击某个按钮），再等待、截图
KAIKOU_CAPTURE_SCRIPT="document.querySelector('button').click()" ...
```

截图模式下窗口不显示，截完图自动退出；不受"只能运行一个实例"的限制。
`KAIKOU_USER_DATA` 可以让测试使用一个全新的数据目录，不影响真实数据。
开发时的数据目录是 `%APPDATA%/KaikouEnglish-dev`，和安装版（`KaikouEnglish`）分开。

## 测试

`npx vitest run src/main`：使用内存数据库、`FakeClock` 和一个用真实编译器编译的小内容集（`test-support/fixtures.ts`），
覆盖数据库迁移和回滚、各个仓库、学习流程（跨天、休息卡、复习上限、欢迎回来）、IPC 校验和错误信封、
录音保留策略、WAV 读写、`media://` 路径防护、语音进程的超时 / 崩溃 / 恢复（用假的子进程）。
