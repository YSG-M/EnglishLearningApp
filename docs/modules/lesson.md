# 课程流程（Lesson）

代码：`src/renderer/src/pages/PartPage.tsx`、`src/renderer/src/features/lesson/`、`features/dialogue/`、`features/phonics/`。

每个"课程部分"（`Part`，见 `src/shared/content/bundle.ts`）是一天的新内容。`PartPage` 按 `part.kind` 选择播放器，结束时调用 `parts.complete`，显示"完成啦"和新卡片数量（再上一次时显示"又练了一遍"）。

| kind                 | 组件            | 步骤                                                                                                               |
| -------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------ |
| `learn` 学新句子     | `LearnPart`     | 单元介绍 → 每个句子一步（`SentenceCard`）→ 小语法（如果有）→ 12 个 🏠 日常用词（每个一步，带场景，词高亮）→ 单词表 |
| `practice` 句型课    | `PracticePart`  | 句型介绍 → 10 个场景例句 → 看场景自己说 → 拼读规则 → 听辨题                                                        |
| `apply` 实战对话     | `ApplyPart`     | 分支对话（`DialoguePlayer`）→ 今日实战任务                                                                         |
| `review` 本周复习    | `ReviewDayPart` | 本周每个单元的对话再走一遍 → 听一遍本周所有句子（可"全部播放"）                                                    |
| `challenge` 录音挑战 | `ChallengePart` | 提示句 → 录音（最长 `maxSeconds`，不自动停）→ 保存 → 和以前的挑战录音对比                                          |

所有步骤都可以前进、后退，**不强制说对才能继续**（防放弃：卡住了也能往下走）。

## SentenceCard（一句话）

1. 进入时自动播放一遍原音。
2. `TokenLine` 显示每个词和谐音提示（规则见 `ui.md`）。
3. 中文（按设置一直显示，或点一下显示）、小提示。
4. ▶ 播放 / 🐢 慢速（`playbackRate = settings.slowRate`，保持音高）。
5. `SpeakPanel`：🎤 录音 → `speech.recognize` → `bestMatch(目标句 + accept)` → `buildFeedback`（一句表扬 + 最多一条建议，问题词在句子里高亮）→ 👂 听我的 / ▶▶ 原音 + 我的。
   - 说对时调用 `hints.recordCorrect`（句子里每个词的计数 +1，满 3 次谐音自动隐藏）。
   - 有录音 id 时调用 `speech.annotateRecording` 保存分数和识别文字（进度页对比用）。

## 句型课（`PracticePart`）

决定见 `docs/decisions/0006-pattern-scene-lessons.md`。

1. `PatternIntro`：句型框（`___` 显示成空格）、中文意思、什么时候用。
2. 每个例句一步：`SentenceCard` 带 🎬 场景、句型高亮（框不变的词用主题色，`___` 里换的部分用底色）、短语说明。录音按例句 id（`u02.e01`）归档。
3. `SceneSpeak`（看场景，自己说）：例句按固定种子打乱，复用复习里的 `SpeakFromZh`（语音不可用时用 `RecallSelfRate`），只给场景和中文；每个场景都可以直接"下一个场景"，不卡住。
4. 拼读规则 + 听辨题（单元有拼读时）。

学新句子那天，已经符合本单元句型的句子会显示"🔑 这句用到了明天的句型"（编译时自动判断，`ChunkItem.pattern`）。

## 汇总页和小故事（`pages/SummaryPage.tsx`）

- `UnitSummaryPage`：句子、句型例句（带场景）、日常用词、对话里她说的话、单词表，最后两篇小故事。`WeekSummaryPage`：本周每个单元（可折叠）+ 两篇周故事。
- 每个区域用 `components/SentenceList`：▶ 全部播放（`player.playSequence`）、每句拼音 / 点词看意思 / ▶ 🐢 / 🎤 跟读（展开 `SpeakPanel`）。
- 入口：课程页单元名旁"📄 汇总"、每周卡片"📄 本周汇总"；实战对话和本周复习的完成页各有一个按钮。路由 `unitSummary` / `weekSummary`，`from` 记录返回位置。

## 再上一次

课程页和今天页用同一个 `PartTile`；上过的课显示"🔁 再上一次"，打开的就是同一个 `PartPage`。再上一次时 `parts.complete` 返回 `firstTime: false`：不重复计数、不改复习安排，只补上缺少的卡片（比如后来新增的句型例句）；完成页显示"又练了一遍"。`Route.part.from` 记录从哪里来，返回时回到课程页或今天页。

## 分支对话（DialoguePlayer）

- 对方的话自动播放，可以重播，中文按设置显示。
- 列出 1–3 句可以说的回答（带谐音提示和播放按钮）。她说其中一句，`bestMatch` 选出最接近的一句；分数 ≥ 0.5（`CHOOSE_SCORE`）就走那条分支。
- 不确定、或者语音识别不可用时，每句回答旁边出现"👆 点这一句继续"，**对话永远不会卡住**。
- 结束后可以"再来一遍"。

## 拼读听辨（PairQuestion）

播放一对相近词中的一个（由种子决定，刷新不会变），她选是哪一个。选错时依次播放她选的词和正确的词，方便对比。复习里的 `pair-discriminate` 用同一个组件。
