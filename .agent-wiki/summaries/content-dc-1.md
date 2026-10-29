# content-dc-1: daily words + stories for u13–u18, w07–w09 (done)

## Done
- **u13–u18**: each has 12 `daily` words (`uNN.d01–d12`, after `patterns`) and `stories` (a narrative and a dialogue).
  At least one story per unit is set in daily life.
- **Pattern scenes moved to daily life, so each unit now has ≥ 6 life scenes** (ids and `en` unchanged; only `scene` edited):
  - u13: e01, e02, e03, e04, e06
  - u14: e01, e02, e06, e09
  - u15: e04, e08
  - u17: e03, e07
  - u16 and u18 already had ≥ 6 and were not changed.
- **Weeks**: created `content/weeks/w07.json`, `w08.json`, `w09.json`.
- **Lexicon**: `content/lexicon/daily-c.json` has 69 entries, all with hand-written 谐音.
  The cross-agent rule is "an entry lives in the file of the earliest unit that uses it", so daily-c also holds:
  - `wet` and `date`: daily words of u03 and u04 (content-da)
  - `forget`: daily word u19.d07 (content-dd)
  - `birthday`, `wedding`, `online`: content-de's stories use them
  - `out`, `find`: needed only for sentences

## Daily words (each used once in the course; checked with grep 2026-10-25)
- u13: birthday visit dentist evening calendar cancel movie remember tuesday wedding wednesday holiday
- u14: slept night saw met cleaned washed clothes took played ago shopping rained
- u15: noisy messy dirty angry smell rubbish careful smoke cold fault forgot rude
- u16: sink bathroom window plumber bed shower ceiling lock turn remote room bulb
- u17: breakfast delicious noodles soup salty sweet vegetables fruit share taste healthy bowl
- u18: online gift box heavy letter letterbox stamp slow doorbell post sent received

Some of these words have their entries in other lexicon files:
- `turn`, `slow`: daily-b
- `cancel`: patterns-c
- `cold`: patterns-d
- `night`, `holiday`, `wednesday`, `evening`: core

## Validation
- `npx tsx scripts/content-validate.ts --allow-missing --warnings`: no errors in my files. The only errors are in u12, which content-db had not finished.
- My scratchpad checker counts everything taught across all units and finds **0 "not taught" words** in all 18 stories, and no line over 10 words.
- The validator shows one warning: `w07 narrative line 2: "parent"`. "parent" is taught in u12, and the validator skips u12 until its schema errors are fixed. This should clear once content-db finishes u12 — please re-run.
- With `--only`, extra "not taught" warnings appear (child, fever, after, fish…). This is expected: `--only` drops the earlier units from the taught set.

## 谐音 I am unsure about (please check)
- **visit** and **vegetables**: graded red (they start with v).
- **share**:
  - The 汉字 晒 is only approximate; the pinyin "shèi" carries the real sound.
- **Approximate 汉字 for words with a medial th**:
  - **birthday**: 勃嘚 · bě(th)-dèi
  - **bathroom**: 芭如 · bā(th)-rū(m)
  - **healthy**: 嘿 · hè(l)-thi
- **Approximate 汉字 for r-initial words** (graded yellow, like the existing `wrong` / `right`):
  - **rubbish**: 惹比
  - **rained**: 瑞嗯
  - **remote**: 瑞谋
  - **received**: 瑞西
- **Non-standard pinyin** (no Chinese equivalent):
  - **tuesday**: 丢嘚 · tiū(z)-dèi (the t-iu sound)
  - **online**: 翁赖 · ōn-lài(n)
- **noisy**: 诺伊子 · nòi-zi

## For the coordinator
- The `tap` lexicon entry (patterns-c) says "轻碰；刷（卡）". The faucet meaning (水龙头) is used by u08's daily word, so you may want to add it to the zh.
- The scratchpad tool `taught.ts <uid> --story <file>` reports untaught or missing-from-lexicon words using the full taught set. It is worth adding to `reusable.md` if useful (copied to `.agent-wiki/tools/taught.ts`; usage: `npx tsx .agent-wiki/tools/taught.ts u18 --story stories.json`, or `u18 word1 word2`, or `u18 --dump`).
