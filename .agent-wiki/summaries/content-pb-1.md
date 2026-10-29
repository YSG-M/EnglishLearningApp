# content-pb-1 — pattern lessons u09–u14 (complete)

All six units done. `npx tsx scripts/content-validate.ts --only u09,u10,u11,u12,u13,u14 --warnings` →
`content ok`, with no warnings other than "is never used". The "no dialogue reply uses the unit's pattern" warning does not appear.
I checked for duplicate lexicon keys across all `content/lexicon/*.json` at the end (2026-10-24) and found none. All files are UTF-8 with no BOM and LF line endings.

## Units
| Unit | Frames | Dialogue changes (all node ids kept) |
|---|---|---|
| u09 | `He is ___.` + `She is ___.` | n1 adds "He is very smart."; n2 adds "He is a bit shy in class." `grammar` kept |
| u10 | `Do you have ___?` | n2 adds "Do you have a bigger bag?" → new n2b; n3 adds "Here is $50. Do you have change?" → new n3b → end |
| u11 | `I have ___.` + `My ___ hurts.` | n1 adds "My head hurts." (it already had 3 "I have" replies). `grammar` kept |
| u12 | `There is ___.` + `There is no ___.` | n1 adds "Sorry, there is no class this week."; n2 adds "Sorry, there is a school event that day." |
| u13 | `Can we ___?` + `Is ___ okay for you?` | n2 adds "Sure. Can we arrange it next week?"; n3 adds "Is 5pm okay for you?". `grammar` kept |
| u14 | `What did you ___?` + `I ___ yesterday.` | n2 "I went to the park." → "...yesterday."; n3 "Yes, I cooked dinner." → "...yesterday."; n4 adds "Oh, really? What did you do?" → new n5 → end. `grammar` kept |

I did not change chunks, words, phonics or task.

## New lexicon words: 26 (`content/lexicon/patterns-b.json`)
shy, helpful, colleague, bit, outside, appointment, fresh, fish, medicine, question, toothache, eye, stomach, leg,
walk, queue, paper, student, parent, mistake, school, talk, separately, move, paid, ate

## 谐音 I am unsure about (for the real-voice check)
- **helpful** 嘿欧佛 `hēo(p)-fo(l)`: the dark l in "hel" written as 欧 may sound odd.
- **separately** 塞瑞利 `sài(p)-rə(t)-lī`: a long word with two silent stops, so the 谐音 is only a rough guide.
- **ate** 诶 `èi(t)`: the British voice (bf_emma) may say /et/ rather than /eɪt/. The note says both are fine; check what Kokoro actually produces.
- **queue** 克优 `k-yōu`: I relied on "same as the letter Q". 克 + 优 may still be read as two syllables.
- **medicine** 麦迪森: 麦 is "ai", not the short /e/. It also reads like "Madison".
- **appointment** 呃波因门 and **mistake** 米斯嘚: the 斯 is a hanzi for a mid-word s cluster (the same style as the existing "questions" / "smaller" entries).

## For the coordinator
- Existing entries in other files break the "no hanzi after a final consonant" rule: `headache` 嘿嘚**克** and
  `stomachache` 斯大么克诶**克**. These are not my files, so I left them alone. Please review them.
- Common words were missing from every lexicon before I added them: `school`, `parent`, `student`, `question`.
  Other content agents may want to add these too. Re-run the duplicate check after all agents finish.
- Some `accept` strings contain words that are not in the lexicon (e.g. "isn't" in u09.e09). The validator does not check
  `accept`, which I assume is intended.
- The frame matcher does not allow extra words after the frame, only before it. That is why u11.e10 is
  "When I walk, my leg hurts." (it keeps "My leg hurts when I walk." in `accept`). It would be worth stating this in authoring-guide 4.1.
