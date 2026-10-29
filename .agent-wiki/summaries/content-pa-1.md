# content-pa-1 — pattern lessons for u01, u03–u08 (DONE)

`npx tsx scripts/content-validate.ts --only u01,u03,u04,u05,u06,u07,u08 --warnings` → `content ok`,
no warnings except "is never used" (and none of those are "no dialogue reply uses the unit's pattern").

## Units done
| Unit | Frame(s) | Dialogue changes (node ids kept) |
|---|---|---|
| u01 | `I'm ___.` | n1: added 3rd reply "Hi, I'm Amy. I'm at the front desk." |
| u03 | `Please ___.` | n5: added reply "She is coming now. Please wait here." |
| u04 | `How much is ___?` + `What time ___?` | n1: added "Hi, how much is this one?"; new node **n5** ("Anything else?" → "What time do you close today?" / "No, thank you."); card/cash now go to n5; `end` npc text changed to "We close at 10pm. Thank you, have a nice day!" |
| u05 | `Do you want to ___?` | n2: added "We have a free trial class. Do you want to try?"; n3: added "It's on Saturday at 10am. Do you want to see the classroom?" |
| u06 | `Can I have ___, please?` | n2: added "Can I have less sugar, please?" |
| u07 | `I will ___.` | n5: added "Okay, I will tell her." |
| u08 | `Where is ___?` + `How do I get to ___?` | n2: added "Yes. Where is your car?"; n3: added "Sorry, where is it?" → new node **n4** ("Near the bus stop. I'm waving at you now." → "Okay, I see you. I'm coming." → end) |

Each unit: old `drill` replaced by `patterns` (10 examples e01–e10, about half own scene / half other life, no travel).
`grammar` kept unchanged in u01, u03, u04, u05, u07 (still relevant). Nothing else changed (chunks, words, phonics, task untouched).
Note: u01's task still mentions "Good morning / Good afternoon" (from the removed drill) — fine since they are chunks/notes.

## New lexicon words: 22 (`content/lexicon/patterns-a.json`)
full, still, lift, quiet, close, off, shoes, photo, haircut, meeting, delivery, classroom, drink, ice, spoon, buy, car, cook,
tonight, hospital, house, nearest. All yellow except buy (green 拜). No red.

## 谐音 I am unsure about (please have a human listen)
- **drink** 准 zhuǐn(k): Chinese has no "drɪŋk"; 准 gets the dr- onset but the vowel (un vs ɪŋ) is off. Might be better as red.
- **delivery** 迪利佛瑞 di-lí-ve-ruì: 4 hanzi, v in the middle; 瑞 for -ry may push a retroflex r.
- **classroom** 克拉入 k-lā(s)-rū(m): 入 (rù) is a retroflex Chinese r; note warns, but hanzi may mislead.
- **nearest** 尼瑞 nī-rè(st): two-syllable split of near-est is rough.
- **hospital** 霍必透 hò(s)-bi-te(l): final syllabic l after t is hard to show.
- **haircut** 嘿呃卡 hēi-e-kǎ(t): non-rhotic "hair" as 嘿+呃 — check it does not sound like three syllables.
- **quiet** 快呃 kuài-e(t): fine I think, but two-syllable feel should be checked.
- **car** 卡 kā～: relies on the non-rhotic reading (Singapore/UK).

## For the coordinator
- `content/lexicon/patterns-c.json` and `patterns-d.json` both contain **"sit"** (duplicate lexicon entry error seen
  mid-run). Not mine; one of them must drop it. My u05.e03 uses "sit" and relies on it existing in one file.
- u07.e08 / e05-style numbers: "I will be 5 minutes late." uses a digit so "five" needs no lexicon entry.
- `phone` in core.json has hanzi 否恩 (hanzi 恩 after final n) — breaks the "no hanzi after final consonant" rule; not mine to change.
