# 当前进度

> 新会话开始时先读这里。最后更新：2026-10-29（Pages 发布准备；线上与 iPhone 待验收）

## 2026-10-29：GitHub Pages 发布准备

新增 Pages 工作流与 `web:build:ci`，提交手机生成资产供 CI 使用；本地完整生成命令保留。手机指南改为 Pages，LAN/证书移到开发文档。未提交、推送或操作仓库设置；GitHub 与 iPhone 尚待用户验收。实测检查结果统一见 wiki Now。

## 2026-10-29：iPhone Web / PWA 集成

Web 版已接入真实 `createWebApi`（SQLite WASM / OPFS / IndexedDB）、资源客户端和单线程语音 Worker；生产入口不使用 Fake。保留 Electron 代码，按决定 0008 等 iPhone 测试通过后再处理移除。手机操作与结果表见 [iPhone 试用步骤](web/iphone-test.md)，模块细节见 [Web 文档索引](README.md#iphone-web--pwa)。

- 修复四个根标签误显示返回按钮；清单未就绪时显示“正在读取资源清单”，不显示零字节总量，进度条保持等待状态。
- 集成者实际执行 `npm run check`、`npm run web:check`、`npm run web:build`。测试计数、最终 release 和测量记录统一见 `.agent-wiki/INDEX.md` 的 Now；不把跳过当作通过。构建中 zod PURE 注释警告不影响成功；内容校验仍有已知的词汇警告。
- `node scripts/web/browser-smoke.mjs` 使用新 Chrome profile，对最终构建真实执行首周下载校验、首次 SW 接管、打开第一课、播放 M4A 至结束、断网 Range 206 与离线重载。首轮程序点击缺少用户手势而未完成播放；补上 CDP 用户手势后通过。此证据验证浏览器解码与播放结束，不证明手机扬声器实际出声。
- `node src/web/ui/validation/capture.mjs` 在两种宽度下检查横向溢出、根标签与固定学习栏；人工逐页查看目标尺寸的今天、课程、汇总、复习、我的、设置和句子步骤。[截图说明](web/mobile-validation.md) 区分 Mock 布局与真实站点验证。
- 既有 builders 的真实 Chrome 存储冷重开、备份恢复及 WASM 课程音频识别记录保留在各模块文档；本轮没有用它们代替 iPhone 测试。生产站点 harness 没有课程 WAV 作为假麦克风的能力，所以生产录音到识别的整条链路本轮未测。

**尚未验证**：iPhone Safari/主屏幕的飞行模式进程冷启动、真人麦克风、重开权限、静音开关、录音后音量/路由、每句识别速度与峰值内存、备份真机往返、横屏/软键盘/安全区、真实配额及系统回收。下一步由持有人按试用表填写结果；目前不宣称 iPhone 已放行。

**已知 Web 限制**：旧激活 release 缓存保守保留，没有自动回收；完整 JSON 备份有内存开销，手机大备份尚未压测；运行时上游未附完整第三方构建依赖声明，公开分发前仍需核对。模型失败保留回听/自评；不使用云识别或浏览器 TTS。用户已决定公开仓库并使用 GitHub Pages，跳过 LAN 测试；发布步骤见 [开发说明](dev-setup.md#发布到-github-pages)。

## 已完成（v1）

| 部分     | 内容                                                                                                                                          | 如何验证过                                                        |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 课程内容 | 13 周 · 26 个单元（13 个前台工作 + 13 个生活场景）、411 个分级谐音词（绿 68 / 黄 333 / 红 10）、24 个拼读单元、3 次录音挑战，共 94 个课程部分 | `npm run content:validate` 0 错误 0 警告；`tests/content.test.ts` |
| 课程音频 | 1135 段，Kokoro 离线生成（英式女声为主，对话角色用不同声音），约 80 MB                                                                        | `npm run content:audio` 全部生成                                  |
| 核心逻辑 | FSRS 复习、自动调速、连续天数 + 休息卡、语音比对（数字/缩写/本地词）、反馈                                                                    | `src/shared/**/*.test.ts`                                         |
| 主进程   | SQLite 数据库与迁移、学习服务、录音存储、Whisper 识别进程、日志、诊断包                                                                       | `src/main/**/*.test.ts`；真实 app 中跑通                          |
| 界面     | 今天 / 课程 / 复习 / 速查 / 进度 / 设置；学新句子、句型和发音、实战对话、周复习、录音挑战                                                     | 截图逐页检查（见下）                                              |
| 打包     | 配置、图标 `build/icon.png`、CI；**安装程序还没打包成功**（见已知问题）                                                                       | `win-unpacked` 目录已生成                                         |
| 文档     | 学习方法、架构、课程表、编写指南、模块文档、技术决策、使用说明                                                                                | —                                                                 |

### 2026-10-24 整合时实际验证的内容

- `npm run typecheck`、`npm run lint`、`npx prettier --check .`、`npm test`（全部通过）、`npm run content:validate`
- 用截图模式在全新数据目录里检查：首页（第一天 / 学了一天后）、学新句子、句型替换、实战对话、复习（40 张到期只显示 20 张）、课程、进度、设置
- 语音全链路：课程音频 → 界面重采样到 16 kHz → IPC → Whisper 进程 → 文字。"Hi, I'm Amy." / "What time is it?" 完全正确；首次识别约 1 秒（含加载模型），之后约 0.3 秒

## 2026-10-24 第二步：句型 + 场景课程（决定 `docs/decisions/0006-pattern-scene-lessons.md`）

| 改动     | 内容                                                                                                                                                                                                                        | 如何验证过                                                                                      |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 句型课   | 第 2 天"句型和发音"改为"句型课"：句型框 + 10 个场景例句 → 看场景自己说 → 拼读。26 个单元共 260 个例句，按排课表每单元 1–3 个句型框；对话里都用到本单元句型；新增 72 个词（`content/lexicon/patterns-*.json`），谐音人工编写 | `npm run content:validate`；`compile.test.ts`、`pattern.test.ts`、`PracticePart.test.tsx`；截图 |
| 逐词意思 | 点任何词都显示中文意思；"📖 逐词意思"开关（设置 `showGlosses`）；句型部分高亮                                                                                                                                               | `TokenLine.test.tsx`；截图                                                                      |
| 再上一次 | 课程页和今天页用同一个 `PartTile`，上过的课都能"再上一次"，打开同一个上课页面；再上一次不重复计数，只补缺少的卡片                                                                                                           | `learningService.test.ts`、`CoursePage.test.tsx`；截图                                          |
| 复习分区 | 复习页：今天的复习（FSRS）/ 最近 7 天学的 / 全部学过的（按单元或随机 20 张）；后两者不改复习安排                                                                                                                            | `learningService.test.ts`、`ReviewPage.test.tsx`；截图                                          |
| 例句卡片 | 新卡片类型 `example`；数据库迁移 v2（重建 `cards` 表，旧数据保留）                                                                                                                                                          | `database.test.ts`（v1 → v2 保留卡片）                                                          |
| 音频     | 新增 355 段（例句、新回答、新词）                                                                                                                                                                                           | `npm run content:audio`                                                                         |

验证：`npm run check` 全部通过（207 个测试）；`npx electron-vite build` 后用截图模式在全新数据目录里看了：课程页、句型课介绍、例句（逐词意思打开）、看场景自己说、学新句子里的"🔑 明天的句型"、今天页"再上一次"、复习页。

## 2026-10-25 第三步：汇总页、小故事、日常用词（决定 `docs/decisions/0007-summaries-and-stories.md`）

| 改动       | 内容                                                                                                           | 如何验证过                                            |
| ---------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 日常用词   | 每个单元 12 个生活里用的词（共 312 个），每个配一句生活句子和场景；第 1 天在单词表前逐个学，建 `word` 复习卡片 | `LearnPart.test.tsx`、`learningService.test.ts`；截图 |
| 生活场景   | 句型例句每单元至少 6/10 是生活场景（改了场景，id 不变）                                                        | 子代理逐单元检查                                      |
| 单元汇总页 | 句子、句型例句、日常用词、对话里她说的话、单词表、两篇小故事（Amy 的一天 + 小剧本）；全部播放、每句跟读        | `SummaryPage.test.tsx`；截图                          |
| 周汇总页   | 13 周，每周两个单元（可折叠）+ 两篇周故事（`content/weeks/wNN.json`）                                          | `SummaryPage.test.tsx`；截图                          |
| 入口       | 课程页"📄 汇总""📄 本周汇总"；实战对话 / 本周复习完成页的按钮                                                  | 截图                                                  |
| 内容       | 78 篇故事；词库 483 → 754 个词；音频 3022 段；校验对"还没学过的词"给警告（43 条，每篇 ≤ 2 个，人名除外）       | `npm run content:validate`                            |

界面只显示拼音式谐音，不显示汉字（2026-10-24 用户要求）；"下一步"按钮固定在窗口底部。

## 没有验证过的

- **真人用麦克风说话**的完整体验（录音自动停止、噪音环境、她的口音下的识别率）。自动测试只能用合成语音。
- 在她自己的电脑上安装运行。

## 已知问题 / 限制

- **`npm run dist` 失败**（2026-10-24）：electron-builder 生成卸载程序时，需要运行一个临时的、没有签名的 NSIS exe，这一步报 `spawn UNKNOWN`（`NsisTarget.computeScriptAndSignUninstaller`）。很可能是 Windows 11 的智能应用控制或 Defender 拦截了这个 exe。`release/0.1.0/KaikouEnglish-Setup-0.1.0.exe`（236 KB）不完整，**不要用**；`release/0.1.0/win-unpacked/` 是完整的，可以直接运行里面的 `KaikouEnglish.exe`。下一步：检查 Windows 安全中心的拦截记录，或者先改用 `portable` / `zip` 打包目标。
- 发音评分只到"哪个词没说对"，还不能指出具体哪个音（比如 th 读成了 s）。计划用 wav2vec2 音素模型做（见 `docs/modules/speech.md`）。
- Whisper 不认识的新加坡本地词（aircon、kopi 等）会被"拼"成别的样子，现在按辅音骨架算"很接近"（半分）。
- 谐音是人工编写的，还没有经过真人逐条试听检查。内容子代理自己标出的没把握条目：excuse、stomachache、upstairs、altogether、timetable、he、she、we、fee；第二步新增：drink、delivery、classroom、nearest、hospital、haircut、quiet、car、helpful、separately、ate、queue、medicine、appointment、mistake、computer、Wi-Fi、heater、carry、show、order、start、SIM、our、hot、sit、use。
- 内容子代理指出旧词条不符合"辅音后面不加汉字"的规则：`phone` 否恩、`headache` 嘿嘚克、`stomachache` 斯大么克诶克，待人工改。
- 新增 271 个词的谐音同样没有真人试听；子代理标出的没把握条目在 `.agent-wiki/summaries/content-d?-1.md`（如 battery、temperature、transfer、karaoke、dress、straight、noisy）。
- 故事是子代理写的，没有经过用户试读。
- 去掉旧的句型替换后，有 23 个词库词条不再被任何句子用到（evening、night、Wednesday 等；`content:validate --warnings` 可见）。不影响使用，以后写新内容可能用上。
- 改版前已经上过的"句型课"（第 2 天）没有例句复习卡片：要在课程页"再上一次"那节句型课，才会补建这个单元的 10 张例句卡片。
- 界面代码包约 770 KB（主要是 React），桌面应用可以接受。
- 设置里的滑块每次拖动都会保存，没有防抖。
- 没有自动更新：新版本直接覆盖安装，学习数据保存在用户数据目录，不会丢。

## 下一步（建议）

1. 让她实际用一周，收集：哪些谐音不好用、识别是否太严/太松、每天用时是否合适。
2. 根据反馈调整 `PASS_SCORE`、静音时长、每日复习上限。
3. 音素级发音评分（wav2vec2）。
4. 第 4–6 个月的课程内容（第 2 阶段后半）。
