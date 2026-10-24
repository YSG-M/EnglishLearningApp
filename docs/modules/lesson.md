# 课程流程（Lesson）

代码：`src/renderer/src/pages/PartPage.tsx`、`src/renderer/src/features/lesson/`、`features/dialogue/`、`features/phonics/`。

每个"课程部分"（`Part`，见 `src/shared/content/bundle.ts`）是一天的新内容。`PartPage` 按 `part.kind` 选择播放器，结束时调用 `parts.complete`，显示"完成啦"和新卡片数量。

| kind                  | 组件            | 步骤                                                                      |
| --------------------- | --------------- | ------------------------------------------------------------------------- |
| `learn` 学新句子      | `LearnPart`     | 单元介绍 → 每个句子一步（`SentenceCard`）→ 小语法（如果有）→ 单词表       |
| `practice` 句型和发音 | `PracticePart`  | 句型替换（`DrillStep`）→ 拼读规则（`PhonicsRule`）→ 听辨题（`PairQuiz`）  |
| `apply` 实战对话      | `ApplyPart`     | 分支对话（`DialoguePlayer`）→ 今日实战任务                                |
| `review` 本周复习     | `ReviewDayPart` | 本周每个单元的对话再走一遍 → 听一遍本周所有句子（可"全部播放"）           |
| `challenge` 录音挑战  | `ChallengePart` | 提示句 → 录音（最长 `maxSeconds`，不自动停）→ 保存 → 和以前的挑战录音对比 |

所有步骤都可以前进、后退，**不强制说对才能继续**（防放弃：卡住了也能往下走）。

## SentenceCard（一句话）

1. 进入时自动播放一遍原音。
2. `TokenLine` 显示每个词和谐音提示（规则见 `ui.md`）。
3. 中文（按设置一直显示，或点一下显示）、小提示。
4. ▶ 播放 / 🐢 慢速（`playbackRate = settings.slowRate`，保持音高）。
5. `SpeakPanel`：🎤 录音 → `speech.recognize` → `bestMatch(目标句 + accept)` → `buildFeedback`（一句表扬 + 最多一条建议，问题词在句子里高亮）→ 👂 听我的 / ▶▶ 原音 + 我的。
   - 说对时调用 `hints.recordCorrect`（句子里每个词的计数 +1，满 3 次谐音自动隐藏）。
   - 有录音 id 时调用 `speech.annotateRecording` 保存分数和识别文字（进度页对比用）。

## 句型替换

点上面的中文选项换一个词，说出整句话；说对后自动跳到下一个没说过的选项。录音按句子的音频 key 归档。

## 分支对话（DialoguePlayer）

- 对方的话自动播放，可以重播，中文按设置显示。
- 列出 1–3 句可以说的回答（带谐音提示和播放按钮）。她说其中一句，`bestMatch` 选出最接近的一句；分数 ≥ 0.5（`CHOOSE_SCORE`）就走那条分支。
- 不确定、或者语音识别不可用时，每句回答旁边出现"👆 点这一句继续"，**对话永远不会卡住**。
- 结束后可以"再来一遍"。

## 拼读听辨（PairQuestion）

播放一对相近词中的一个（由种子决定，刷新不会变），她选是哪一个。选错时依次播放她选的词和正确的词，方便对比。复习里的 `pair-discriminate` 用同一个组件。
