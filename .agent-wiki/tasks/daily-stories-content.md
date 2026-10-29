# Task: daily words, more daily-life scenes, and stories (content-da … content-de)

You are a content sub-agent of EnglishLearningApp. The coordinator owns code; you own only the files below.
Decision: `docs/decisions/0007-summaries-and-stories.md` (accepted; **12** daily words per unit). Read it first.

| Role | Units | Week files (create) | Your new-word lexicon file |
|---|---|---|---|
| content-da | u02, u03, u04, u05, u06 | w01, w02, w03 | `content/lexicon/daily-a.json` |
| content-db | u07, u08, u09, u10, u11, u12 | w04, w05, w06 | `content/lexicon/daily-b.json` |
| content-dc | u13, u14, u15, u16, u17, u18 | w07, w08, w09 | `content/lexicon/daily-c.json` |
| content-dd | u19, u20, u21, u22 | w10, w11 | `content/lexicon/daily-d.json` |
| content-de | u23, u24, u25, u26 | w12, w13 | `content/lexicon/daily-e.json` |

## Read first
1. `CLAUDE.md`, `.agent-wiki/reusable.md`
2. `docs/decisions/0007-summaries-and-stories.md` (sections 4 and 6 are your rules)
3. `docs/content/authoring-guide.md` (lexicon / 谐音 rules — **every green/yellow word needs `pinyin`**: the UI shows only the pinyin line, not the 汉字)
4. **Quality bar: `content/units/u01-greetings.json`** — look at `daily`, `stories`, and how e02/e04/e07 scenes were moved to daily life.
5. `src/shared/content/schema.ts` — `DailyWord`, `Stories`, `NarrativeStory`, `DialogueStory`, `WeekContent`

## For each of your units (in order)
1. **`daily`: 12 everyday words** (`uNN.d01`–`uNN.d12`), placed right after `patterns`. Related to the unit's theme but
   used in **daily life, not teaching/work** (home, family, neighbours, friends, hawker centre, NTUC, MRT/bus, HDB, clinic,
   weekend, weather, phone, money). Each: `word` (lexicon key, must appear in `en`), `scene` (one Chinese line: where/who/what),
   `en` (short, ≤ 8 words, simple), `zh`, optional `note` (phrase meaning), optional `accept`.
   Prefer genuinely useful high-frequency words she does not have yet; each word only once across the course
   (`grep -i '"word": "x"' content/units/*.json` and check the lexicon).
2. **Pattern examples: at least 6 of the 10 must be daily-life scenes** (at most 4 front desk / teaching / office).
   Prefer changing only `scene`; change `en`/`zh` only if the sentence does not fit daily life. Keep ids. It must still fit the frame.
3. **`stories`** (after `daily`):
   - `narrative` "Amy 的……": 8–12 lines, Amy's own day, mostly narration, may quote 1–2 lines in `"..."`.
   - `dialogue`: a short play, 8–14 lines, `setting` in Chinese, `cast` 1–3 people with voices
     (`bm_george`, `bm_lewis`, `am_michael` male; `bf_isabella`, `af_sarah` female; Amy is not in `cast`, she uses the default voice).
   - **Reuse** this unit's chunks, pattern examples, daily words and earlier units' sentences; put them in a new situation.
   - At least one of the two stories is set in daily life (after work, weekend, home, shopping, clinic…).
   - Only taught words: every word must be in the lexicon (error otherwise), and the validator warns
     `"x" has not been taught by this point`. **Get the warnings down to at most 2 new words per story** (cast names are exempt).
   - Short sentences (≤ 10 words), natural Chinese, Singapore setting, no travel/abroad.
4. Validate: `npx tsx scripts/content-validate.ts --only u03 --warnings` (ignore "is never used").
   Earlier units owned by other agents may still be unfinished, which can cause extra "not taught" warnings — note them,
   re-run at the end.

## Week files `content/weeks/wNN.json`
`{ "week": N, "stories": { "narrative": {...}, "dialogue": {...} } }` — same rules, using everything from both units of
that week (and earlier). Write a week file after both of its units are done. Validate with `--only w02 --warnings`.

## Formatting
Write JSON with the Edit/Write tools, or with Python (`encoding="utf-8"`). Afterwards run
`python -I .agent-wiki/tools/fmt_unit.py <files>` to restore the compact one-object-per-line style. UTF-8, no BOM, LF.
Never put Chinese on a Git Bash command line (cp1252).

## Rules
- Only edit your unit files, your week files and your lexicon file. Never `git commit` / `git push`. No dependencies.
- New 谐音 by hand, following the grade rules; list the ones you are unsure about.

## When done
Write `.agent-wiki/summaries/<role>-1.md` (English): units/weeks done, number of new words, remaining "not taught" warnings
(with reason), unsure 谐音, anything for the coordinator. Then stop.
If your context reaches ~68%, write the summary with what is left, say so at the top, and stop.
