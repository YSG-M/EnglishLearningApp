# 界面（Renderer）

代码：`src/renderer/`。React 19 + TypeScript，没有路由库和状态库，只用 React 自带的 Context。

## 结构

```
src/renderer/
  index.html                 CSP：只允许本地脚本；media: 用于课程音频和录音
  src/
    main.tsx                 入口；全局错误和未处理的 Promise 写入日志
    App.tsx                  启动加载、侧边栏、页面切换、错误边界
    i18n/zh.ts               所有界面文字（只改这里）
    api/client.ts            api 代理（测试时可以替换）、errorCode()、logError()
    api/mockApi.ts           内存版 AppApi + 测试用的小内容包
    state/AppContext.tsx     内容包、设置、语音状态、谐音进度、当前页面
    state/content.ts         查内容：找句子、找单词、速查搜索
    audio/player.ts          全局唯一的播放器（同一时间只放一个声音）
    audio/recorder.ts        麦克风录音、自动停止、重采样到 16 kHz
    audio/capture.worklet.ts AudioWorklet，把麦克风数据分批送出来
    audio/resample.ts, wav.ts
    hooks/                   useRecorder、useActiveTime、usePlayingId
    components/              TokenLine、SpeakPanel、播放按钮、中文显示、错误边界、通用 UI
    features/lesson/         课程四种部分 + 挑战（见 lesson.md）
    features/dialogue/       分支对话
    features/phonics/        拼读规则和听辨题
    features/review/         复习（见 review.md）
    pages/                   今天 / 课程 / 复习 / 速查 / 进度 / 设置 / 课程部分
    styles/global.css        全部样式，颜色在 :root 变量里
```

## 关键约定

- **只通过 `api`（`api/client.ts`）调用主进程**，不要直接用 `window.api`，这样测试可以用 `setApi(createMockApi())` 替换。
- **文字都放 `i18n/zh.ts`**。
- **页面切换**：`useApp().navigate({ name: 'part', partId })`。每个页面外面都有错误边界，一个页面出错不会让整个程序白屏。
- **音频**：所有播放都走 `player`。课程音频文件找不到时，自动改用 Windows 自带语音（`speechSynthesis`）。离开页面时 `useStopAudioOnUnmount` 会停止播放。
- **录音**：`useRecorder().record({ silenceMs })`。开始说话后静音 `silenceMs` 自动停止；7 秒内没说话就停止并提示；最长 15 秒（挑战录音不自动停，按 `maxSeconds` 计）。出来的是 16 kHz 单声道 Float32。
  - 说话检测：前 250 ms 测量环境噪音，阈值取噪音的 3 倍，最低 0.015 RMS。
- **语音识别不可用时不阻塞**：`SpeakPanel` 自动改成"录音 + 回放 + 原音对比 + 自己判断"；复习里的"看中文说英文"自动变成"想一想 + 自己评分"。
- **学习时长**：`useActiveTime` 只在窗口可见、并且 90 秒内有操作时计时，每 30 秒通过 `today.addActiveTime` 上报。`parts.complete` 只带上**还没上报的剩余时间**（主进程会把它加进当天时长，避免重复计算）。复习的时长由每张卡片的 `activeMs` 上报，复习页不另外计时。

## 谐音显示规则（`TokenLine`）

| 情况                  | 显示                                       |
| --------------------- | ------------------------------------------ |
| 绿 / 黄，说对次数 < 3 | 谐音 + 拼音                                |
| 绿 / 黄，说对 ≥ 3 次  | 一个小点，点单词才显示                     |
| 设置里关闭谐音        | 不显示，点单词才显示                       |
| 红                    | 永远没有谐音，只有红点；点单词显示口型说明 |

点任何单词都会播放这个词的读音。下划线颜色就是等级。

## 测试

`npx vitest run src/renderer`。组件测试文件顶部要写 `// @vitest-environment jsdom`；用 `test-utils.tsx` 的 `renderWithApp()`，它会装好 mock api 和假的音频播放。

## 截图检查（不用人工点）

```
npx electron-vite build
KAIKOU_CAPTURE_DELAY=2500 npx electron . --capture=shot.png
KAIKOU_CAPTURE_SCRIPT="document.querySelectorAll('.nav-item')[1].click()" npx electron . --capture=course.png
```

脚本里不要写中文（Git Bash 会把中文变成 `?`），用 CSS 选择器。
