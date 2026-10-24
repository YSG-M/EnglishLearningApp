# 当前进度

> 新会话开始时先读这里。最后更新：2026-10-24（v1 第一版完成）

## 已完成（v1）

| 部分 | 内容 | 如何验证过 |
|---|---|---|
| 课程内容 | 13 周 · 26 个单元（13 个前台工作 + 13 个生活场景）、411 个分级谐音词（绿 68 / 黄 333 / 红 10）、24 个拼读单元、3 次录音挑战，共 94 个课程部分 | `npm run content:validate` 0 错误 0 警告；`tests/content.test.ts` |
| 课程音频 | 1135 段，Kokoro 离线生成（英式女声为主，对话角色用不同声音），约 80 MB | `npm run content:audio` 全部生成 |
| 核心逻辑 | FSRS 复习、自动调速、连续天数 + 休息卡、语音比对（数字/缩写/本地词）、反馈 | `src/shared/**/*.test.ts` |
| 主进程 | SQLite 数据库与迁移、学习服务、录音存储、Whisper 识别进程、日志、诊断包 | `src/main/**/*.test.ts`；真实 app 中跑通 |
| 界面 | 今天 / 课程 / 复习 / 速查 / 进度 / 设置；学新句子、句型和发音、实战对话、周复习、录音挑战 | 截图逐页检查（见下） |
| 打包 | 配置、图标 `build/icon.png`、CI；**安装程序还没打包成功**（见已知问题） | `win-unpacked` 目录已生成 |
| 文档 | 学习方法、架构、课程表、编写指南、模块文档、技术决策、使用说明 | — |

### 2026-10-24 整合时实际验证的内容
- `npm run typecheck`、`npm run lint`、`npx prettier --check .`、`npm test`（全部通过）、`npm run content:validate`
- 用截图模式在全新数据目录里检查：首页（第一天 / 学了一天后）、学新句子、句型替换、实战对话、复习（40 张到期只显示 20 张）、课程、进度、设置
- 语音全链路：课程音频 → 界面重采样到 16 kHz → IPC → Whisper 进程 → 文字。"Hi, I'm Amy." / "What time is it?" 完全正确；首次识别约 1 秒（含加载模型），之后约 0.3 秒

## 没有验证过的
- **真人用麦克风说话**的完整体验（录音自动停止、噪音环境、她的口音下的识别率）。自动测试只能用合成语音。
- 在她自己的电脑上安装运行。

## 已知问题 / 限制
- **`npm run dist` 失败**（2026-10-24）：electron-builder 生成卸载程序时，需要运行一个临时的、没有签名的 NSIS exe，这一步报 `spawn UNKNOWN`（`NsisTarget.computeScriptAndSignUninstaller`）。很可能是 Windows 11 的智能应用控制或 Defender 拦截了这个 exe。`release/0.1.0/KaikouEnglish-Setup-0.1.0.exe`（236 KB）不完整，**不要用**；`release/0.1.0/win-unpacked/` 是完整的，可以直接运行里面的 `KaikouEnglish.exe`。下一步：检查 Windows 安全中心的拦截记录，或者先改用 `portable` / `zip` 打包目标。
- 发音评分只到"哪个词没说对"，还不能指出具体哪个音（比如 th 读成了 s）。计划用 wav2vec2 音素模型做（见 `docs/modules/speech.md`）。
- Whisper 不认识的新加坡本地词（aircon、kopi 等）会被"拼"成别的样子，现在按辅音骨架算"很接近"（半分）。
- 谐音是人工编写的，还没有经过真人逐条试听检查。内容子代理自己标出的没把握条目：excuse、stomachache、upstairs、altogether、timetable、he、she、we、fee。
- 界面代码包约 770 KB（主要是 React），桌面应用可以接受。
- 设置里的滑块每次拖动都会保存，没有防抖。
- 没有自动更新：新版本直接覆盖安装，学习数据保存在用户数据目录，不会丢。

## 下一步（建议）
1. 让她实际用一周，收集：哪些谐音不好用、识别是否太严/太松、每天用时是否合适。
2. 根据反馈调整 `PASS_SCORE`、静音时长、每日复习上限。
3. 音素级发音评分（wav2vec2）。
4. 第 4–6 个月的课程内容（第 2 阶段后半）。
