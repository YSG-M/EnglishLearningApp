# Task: pattern lessons for your units (content-pa / pb / pc / pd)

You are a content sub-agent of EnglishLearningApp. The main agent (coordinator) owns code and shared files.
Your role name and units are given in the command that started you.

| Role | Units | Your new-word lexicon file |
|---|---|---|
| content-pa | u01, u03, u04, u05, u06, u07, u08 | `content/lexicon/patterns-a.json` |
| content-pb | u09, u10, u11, u12, u13, u14 | `content/lexicon/patterns-b.json` |
| content-pc | u15, u16, u17, u18, u19, u20 | `content/lexicon/patterns-c.json` |
| content-pd | u21, u22, u23, u24, u25, u26 | `content/lexicon/patterns-d.json` |

## Read first (in this order)
1. `CLAUDE.md` (project rules; communicate in Chinese with the user, but you will mostly just work)
2. `docs/decisions/0006-pattern-scene-lessons.md` — the decision. **Section 3 is the pattern table: use exactly the frames listed for your units.** Units with two frames: question + answer pairs, still 10 examples total.
3. `docs/content/authoring-guide.md` — especially 3 (lexicon / 谐音 rules) and 4.1 (patterns)
4. `content/units/u02-not-understand.json` — the quality bar for `patterns` (coordinator wrote it)
5. `src/shared/content/schema.ts` — `Patterns`, `PatternFrame`, `PatternExample`
6. `.agent-wiki/reusable.md`

## For each of your units
1. Replace the old `"drill": {...}` block with a `"patterns": {...}` block (put it where drill was). The `drill` field no longer exists.
2. Write the frame(s) from the decision table, with `zh` and a plain-language `usage` (no grammar terms).
   - For units whose existing `grammar` already explains the point (u09 he/she, u14 past tense), keep `grammar`.
3. Write **10 examples** `uNN.e01`–`uNN.e10`, each with its own `scene` (one Chinese line: where, who, what she wants).
   About half from this unit's scene, half from her other life in Singapore (front desk at the tuition centre, hawker centre,
   clinic, NTUC, HDB, colleagues, home). No travel / hotel / abroad scenes. Short first (3–4 words), then longer.
   Use `note` for phrase meanings that word-by-word glosses get wrong. Use `accept` for other correct ways to say it.
4. Adjust the `dialogue` so that **at least 2–3 of her replies use the unit's pattern** (or earlier units' patterns).
   Keep existing node ids; you may change reply text or add nodes. Every path must still reach the end node.
5. Optionally mark nothing in `chunks` — the compiler detects chunks that already fit the pattern. Do not change chunk ids.
   Do not change `chunks`, `words`, `phonics`, `task` unless something is plainly wrong.
6. New words she must say go into **your own lexicon file** (create it as a JSON array). Before adding a word, check it is
   not already in any `content/lexicon/*.json` (`grep -i '"text": "word"' content/lexicon/*.json`). Write every 谐音 by hand
   following the grade rules (red = no hanzi; never 三克油-style; no hanzi after final consonants).
7. Validate only your units: `npx tsx scripts/content-validate.ts --only u03,u04 --warnings` (ignore "is never used"
   warnings for words other agents' units use). Must show `content ok`. The warning "no dialogue reply uses the unit's
   pattern" must not appear for your units.

## Rules
- Only edit your unit files and your own lexicon file. If you need a change elsewhere, write it in your summary.
- Never `git commit` / `git push`. No new dependencies.
- Files: UTF-8 without BOM, LF. Use the Edit/Write tools for JSON (Git Bash is cp1252: never put Chinese on a command line).
- One unit at a time; validate after each.

## When done
Write `.agent-wiki/summaries/<role>-1.md` (in English): units done, number of new lexicon words, every 谐音 you are
**unsure** about (word + why), anything you changed besides patterns/dialogue, and anything the coordinator must fix.
Then stop.

If your context reaches ~68%, write the summary with what is left, and say so at the top; the coordinator will continue.
