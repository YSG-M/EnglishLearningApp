# 课程内容编写指南

所有课程内容都是手写的 JSON 文件，放在 `content/` 下。格式由 `src/shared/content/schema.ts`（zod）定义，编译和交叉检查在 `src/shared/content/compile.ts`。质量标杆：`content/units/u01-greetings.json` + `content/lexicon/core.json`。

## 1. 文件
```
content/
  curriculum.json      周次、每周的单元、挑战录音、内容版本号、默认朗读声音
  lexicon/*.json       词库：每个词的中文意思 + 谐音提示（所有文件合并，词不能重复）
  units/uNN-*.json     每个单元一个文件
  phonics/pNN.json     每个拼读单元一个文件
  weeks/wNN.json       每周两篇小故事（周汇总页其余内容自动生成）
```

## 2. ID 永久不变（最重要的规则）
她的学习进度（复习卡片、已完成部分、录音）都按 ID 保存：
- 单元 `u01`，句子块 `u01.c01`，句型例句 `u01.e01`，日常用词 `u01.d01`，拼读 `p01`，最小对立词 `p01.m01`，挑战 `ch01`，单词卡片按词库的小写拼写（如 `thank`）。
- **ID 可以停用，但绝不能重新使用或改名。** 改了句子的英文内容没关系（会自动重新生成音频），但如果意思完全变了，请用新 ID。
- 删除一个句子块后，它的编号空着，不要让后面的往前挪。

## 3. 词库（lexicon）
```json
{ "text": "nice", "zh": "好的；令人愉快的",
  "hint": { "grade": "yellow", "hanzi": "奈", "pinyin": "nài(s)", "note": "结尾 s 只吹出\"嘶\"的气流，不要念成\"奈斯\"" } }
```
- 查找键是 `text` 的小写形式。`I'm`、`o'clock` 这种带撇号的形式单独成词。数字（`280`、`$12`、`4pm`）不需要进词库。
- **她要说出口的句子里，每个词都必须在词库里**（句子块、句型例句、对话里她的回答）。对方说的话、语法例句、拼读例词不需要。
- 同一个词在所有文件里只能出现一次。

### 谐音分级规则
| 级别 | 什么时候用 | 必填 | 例子 |
|---|---|---|---|
| 🟢 green | 汉字读音和英文已经很接近，照着读不会出错 | `hanzi` + `pinyin` | hi → 嗨；bye → 拜；two → 兔 |
| 🟡 yellow | 接近，但有一处必须调整（尾音、长短音、卷舌等） | `hanzi` + `pinyin`（+ `note`） | good → 古 · gǔ(d)；meet → 米～ · mī(t) |
| 🔴 red | 这个词的关键音中文里没有，给谐音反而会教错 | `note`（口型说明），**禁止** `hanzi` | thank、three、think、this、very |

- **界面只显示 `pinyin`**，不显示 `hanzi`，所以绿 / 黄词必须写 `pinyin`（测试会检查）。`hanzi` 仍然要写，作为对照。
- **拼音括号**表示只做口型、不出声：`kǎ(p)`、`wàng(t)`。
- 判断 red 的标准：如果这个"中文没有的音"是词的开头或主体（th-、v-），定为 red；如果只是词中间或结尾的一个小音（have 结尾的 v、evening 中间的 v），定为 yellow，并在 `note` 里说清楚。
- **绝不写**"三克油"式的谐音，也不要在辅音后面加汉字（good 不写成"古德"）。
- `note` 用中文大白话，说具体动作："舌尖放在上下牙齿之间吹气"，而不是"发齿间音"。
- 谐音必须人工逐条编写、检查，**禁止用程序自动生成**。

## 4. 单元（unit）
参考 `u01-greetings.json`。字段：
- `kind`：`life`（生活）或 `work`（前台 / 老师工作）
- `title` / `titleEn` / `goal`：中文标题、英文副标题、学完能做到什么
- `chunks`：4–12 个句子块（建议 8–10）。`note` 用法说明（可选）；`accept` 其他也算对的说法（可选，比如 `I am` 和 `I'm`）
- `words`：3–14 个复习单词（词库的键）
- `patterns`：本单元的万用句型（第 2 天的句型课），见下面 4.1
- `grammar`（可选）：只讲中文里没有的语法，一句话说清楚，配例句
- `phonics`（可选）：对应的拼读单元 ID（u03–u26 依次对应 p01–p24）
- `dialogue`：情景分支对话
  - `npcVoice`：对方的声音（`bm_george`、`bm_lewis`、`am_michael` 男声，`bf_isabella`、`af_sarah` 女声）；她自己的句子用默认声音 `bf_emma`
  - 每个节点：对方说一句（`npc`），她有 1–3 个回答（`replies`），每个回答指向下一个节点（`next`）
  - 必须有一个没有回答的结束节点；所有节点都要能从 `start` 走到
  - 她的回答尽量复用本单元或之前学过的句子块
  - **至少有两三个回答要用本单元的句型**（校验会对一句都没有的单元给出警告），也可以用前面单元学过的句型
- `task`：今日实战任务，一件小而具体、当天就能做的事

### 4.1 句型（`patterns`）
决定见 `docs/decisions/0006-pattern-scene-lessons.md`，每个单元的句型见那里的排课表。质量标杆：`u02-not-understand.json`。
```json
"patterns": {
  "frames": [{ "frame": "Can you ___?", "zh": "你能……吗？", "usage": "请别人帮你做一件事。框不变，只把想让对方做的事放进 ___。" }],
  "examples": [
    { "id": "u02.e01", "scene": "家长在前台说得太快，你没听清。", "en": "Can you say that again?", "zh": "可以再说一遍吗？", "note": "say that again = 再说一遍" }
  ]
}
```
- `frames`：1–3 个句型框，每个**只能有一个** `___`。`usage` 用大白话说什么时候用，不用语法术语。
  一个单元有两个句型时，通常是一问一答（`What did you ___?` + `I ___ yesterday.`），例句可以成对：相邻两句用同一个场景。
- `examples`：**10 个**（允许 8–12），ID 是 `uNN.e01`–`uNN.e10`。每个例句：
  - `scene`：🎬 一行中文场景，说清楚**在哪、对谁、要干什么**（"在 hawker centre 点餐，你不太能吃辣。"）。不写英文、不写答案。
  - `en` 必须符合某一个句型框（按词比较，忽略大小写和标点；框前面可以多几个词，比如 `Sorry, can you …?` 也算 `Can you ___?`）。校验会检查。
  - `zh`：整句自然的中文意思。
  - `note`（可选）：**短语意思**，专门解释逐词翻译会理解错的地方："take a seat = 坐下"、"answer the phone = 接电话"。
  - `accept`（可选）：其他也算对的说法。
- 场景分布：大约一半来自本单元的场景，另一半来自她的其他生活（前台、hawker centre、诊所、超市、家里、同事、HDB）。**不要用旅游、出国、酒店**这类她用不到的场景。
- 10 个例句要**各不相同**：换不同的人、地方、要做的事，填进 `___` 的部分长短不一。从短到长排，第一句最好 3–4 个词。
- 和本单元句子块（`chunks`）重复的句子尽量少（最多 2 句）。
- 例句里出现的新词要加进词库（规则同上，谐音人工写）。

### 4.2 日常用词（`daily`）和小故事（`stories`）
决定见 `docs/decisions/0007-summaries-and-stories.md`；质量标杆 `u01-greetings.json`。
- `daily`：**12 个**（允许 8–14），`uNN.d01`–`uNN.d12`。每个：`word`（词库键，必须出现在 `en` 里）、`scene`、`en`（≤ 8 个词）、`zh`，可选 `note`、`accept`。
  和本单元主题有关，但用在**生活里**（家、家人、邻居、朋友、hawker centre、NTUC、MRT、HDB、诊所、周末、天气、手机、钱），不是教学 / 前台工作。全课程每个词只教一次。
- 句型例句：10 个里**至少 6 个是生活场景**。
- `stories.narrative`（Amy 的……，8–12 句，叙述为主）和 `stories.dialogue`（小剧本，8–14 句，`setting` + `cast` + 每句 `speaker`；Amy 不放进 `cast`，用默认声音）。
  - 大量复用本单元和之前单元的原句，放进新的情景；两篇里至少一篇是生活场景。
  - 每个词必须在词库里；校验会对"到这里还没学过的词"给警告（`cast` 里的人名除外），**每篇最多 2 个**。
- 周故事 `content/weeks/wNN.json`：`{ "week": N, "stories": {...} }`，用这一周两个单元（和之前）学过的东西。

### 句子风格
- 新加坡真实场景：小贩中心、MRT、NTUC、PayNow、HDB、补习中心前台。拼写用英式（centre、colour）。
- 短句、常用词、礼貌的标准口语。Singlish 只在 u26 教"听懂"。
- 第 1 阶段每句最好不超过 8 个词。
- 人名用 Amy（她可以换成自己的名字），家长 / 同事用常见的新加坡英文名（Mrs Tan、Jason、Mr Lim）。
- 中文意思自然，不要逐词硬译。

## 5. 拼读（phonics）
```json
{ "id": "p17", "title": "...", "rule": "中文规则", "mouth": "口型（新音才写）",
  "examples": [{ "en": "think", "zh": "想" }],
  "pairs": [{ "id": "p17.m01", "a": { "en": "think", "zh": "想" }, "b": { "en": "sink", "zh": "水槽" } }] }
```
- 例词 3–8 个，优先用课程里出现过的词。
- 最小对立词最多 6 组，必须是**真实、常见的词**，并且两个词只差目标音。

## 6. 命令
| 命令 | 作用 |
|---|---|
| `npm run content:validate` | 校验全部内容（格式、ID、词库覆盖、对话走向、周次） |
| `npx tsx scripts/content-validate.ts --allow-missing --warnings` | 内容还没写完时用；`--warnings` 会列出没用到的词库词条 |
| `npx tsx scripts/content-validate.ts --only u03,u04,w02 --warnings` | 只看这几个单元 / 周文件的问题（前面的单元也会编译，用来判断"学过没有"；其他文件的错误不显示） |
| `python -I .agent-wiki/tools/fmt_unit.py <文件>` | 用程序改过 JSON 后，恢复"一个对象一行"的紧凑格式 |
| `npm run content:build` | 生成 `resources/content/bundle.json`（app 读这个文件） |
| `npm run content:audio` | 用 Kokoro 为新增 / 修改的句子生成音频（只生成缺少的，已有的跳过） |

音频文件名由"声音 + 文字"的哈希决定：改了文字就会生成新音频，旧进度不受影响。

## 7. 提交前检查清单
- [ ] `npm run content:validate` 通过
- [ ] 新 ID 没有和已有的重复，旧 ID 没有改名
- [ ] 她要说的每个词都在词库里，谐音分级合理，red 没有汉字
- [ ] 对话每条路都能走到结束
- [ ] 中文意思自然，用法说明是大白话
- [ ] 运行了 `npm run content:audio`，并在 app 里听过新句子
- [ ] 如果改了周次或单元，同步更新 `docs/content/curriculum.md`
