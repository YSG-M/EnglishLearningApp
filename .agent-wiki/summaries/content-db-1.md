# content-db-1 — daily words + stories, u07–u12, w04–w06 (DONE)

Task: `.agent-wiki/tasks/daily-stories-content.md`. Decision 0007.

## Done
- u07–u12: 12 `daily` words each (after `patterns`), `stories` (narrative + dialogue) after `daily`.
- Pattern scenes moved to daily life so each unit has ≤ 4 work scenes (ids kept):
  u07 e04, e08 (scene only) · u09 e02, e08, e10 (scene), e05 (now "She is my daughter.") ·
  u11 e06 (scene) · u12 e02, e03, e04, e07 (scene). u08, u10 were already fine.
- Weeks: `content/weeks/w04.json`, `w05.json`, `w06.json`.
- `content/lexicon/daily-b.json`: 68 entries (new daily words, a few words needed by sentences/stories,
  plus the name `Mei`, Amy's friend, used in u07/w04/u10/w06 with voice `af_sarah`).
- `npx tsx scripts/content-validate.ts --only u07,...,u12,w04,w05,w06 --warnings` → no errors; full
  `--allow-missing` run → `content ok`. No duplicate daily words or lexicon entries in the whole course (checked 2026-10-25).

## Daily words
u07 battery charge charger missed text mum video sister wrong loud internet tonight
u08 tap crowded taxi left straight traffic stairs train driver umbrella cross drive
u09 boy girl baby cute tall play cousin children naughty grandma brother kind
u10 apples bananas basket trolley fridge oil salt juice bottle meat tofu sell
u11 rest doctor nurse teeth arm foot temperature pharmacy mask allergic soon headache
u12 voice location link delete download arrived plan pick news picture sticker selfie

## Remaining "not taught" warnings (all ≤ 2 per story)
u08 narrative: next, raining · u08 dialogue: but · w04: raining (both stories) · u09 dialogue: but ·
w05: out (narrative), about (dialogue) · u11 dialogue: but · u12 narrative: oh · w06 dialogue: oh.
Reason: common little words (but / oh / out / about) that no earlier sentence teaches yet.
If the coordinator wants zero, a chunk or daily sentence before u08 containing "but" and "oh" would clear most of them.

## Coordination with other content agents
Rule agreed with content-da/dc/de: a lexicon entry lives once, in the file of the earliest unit that uses it;
the earliest unit keeps a contested daily word. Results:
- daily-b keeps loud, turn, stairs, slow (content-dc uses turn u16.d09 and slow u18.d08 as daily words: keep both entries).
- `traffic` entry lives in daily-e.json (used by my u08.d06).
- I replaced u08 early → cross, u09 son/daughter/park → boy/girl/cousin (owned by u03/u05).

## 谐音 I'm unsure about (please check)
- battery 拜特瑞 bǎi-te-rī; bad 白 bǎi(d); taxi 太西 tǎi(k)-sī; traffic(not mine); apples 爱婆 ǎi-po(l)(z):
  /æ/ written as "ai + 嘴巴张大", same as the existing `has` entry.
- turn 疼 tēn, nurse 呢 nē(s), girl 哥 gē(l): /ɜː/ written as a long 额.
- straight 斯缀 s-truèi(t); train 崔恩 t-rèin; temperature 腾普瑞切 tèm-p-re-che.
- brother graded yellow (th in the middle, b-rǎ-(th)e); video and voice graded red (v at the start).
- baby 贝比 and boy 波一 graded green; tofu 头夫 green.

## Files changed
content/units/u07–u12 (*.json), content/weeks/w04.json, w05.json, w06.json (new), content/lexicon/daily-b.json (new).
No commits.
