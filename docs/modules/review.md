# 复习（界面部分）

代码：`src/renderer/src/pages/ReviewPage.tsx`、`src/renderer/src/features/review/`。调度算法、每日上限、自动调速在主进程和 `src/shared/domain/`（见 `docs/modules/srs.md`）。

## 流程

1. `review.getQueue()` 取今天要复习的卡片（已经按每日上限截好，**界面从不显示"欠了多少张"**）。
2. `ReviewSession` 一张一张地做。每张卡片答完立刻 `review.submit({ cardId, exercise, grade, activeMs })`，中途关掉程序也不会丢记录。
3. 答错的卡片在本轮最后**再出现一次作为练习**（不再提交、不影响安排），趁热再见一次。
4. 结束页："复习了 N 张，答对 M 张"。

## 题型（`card.exercise`，由主进程用 `chooseExercise` 决定）

| 题型                                | 做法                                                                                                    | 评分（`gradeOutcome`）                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `listen-choose` 听音选意思          | 自动播放，四个中文选项（干扰项优先取同一单元，不够再取全部内容；顺序固定不跳动）                        | 对 → good；错 → again                                                      |
| `speak-from-zh` 看中文说英文        | 三级提示：💡1 第一个词 → 💡2 谐音行 → 💡3 完整答案；`accept` 里的说法也算对；"不会，看答案"直接显示答案 | 第一次就说对且没看提示 → good；看了提示或试了几次才对 → hard；放弃 → again |
| `recall-self-rate` 想一想，自己评分 | 显示中文 → "显示答案"（同时播放）→ 😊 会了 / 🤔 有点难 / 😅 忘了                                        | good / hard / again                                                        |
| `pair-discriminate` 听辨相近词      | 和课程里的听辨题一样                                                                                    | 对 → good；错 → again                                                      |

语音识别中途不可用时，`speak-from-zh` 会自动换成 `recall-self-rate`，复习不会中断。

## 额外练习

课程页每个学过的单元有"🔁 练一练"：`review.getPracticeSet(unitId)` 取这个单元的卡片，用同一个 `ReviewSession` 做，但 `submit={false}`，**不改变复习安排**。

## 测试

`src/renderer/src/features/review/ReviewSession.test.tsx`：选对 / 选错（含练习轮不重复提交）、自我评分、语音不可用时降级、放弃、听辨题、额外练习不提交。
