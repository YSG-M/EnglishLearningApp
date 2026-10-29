# content-pc-1 summary (units u15–u20, pattern lessons)

Status: **all done.** `npx tsx scripts/content-validate.ts --only u15,u16,u17,u18,u19,u20 --warnings` → `content ok`,
no "no dialogue reply uses the unit's pattern" warning; all 15 new lexicon words are used.

## Units
| Unit | Frame | Examples | Dialogue replies using the frame |
|---|---|---|---|
| u15 | `Let me ___.` | 10 | n1 (existing "Let me check for you"), new reply in n2 "Let me check his homework", new reply in n3 "Let me ask the teacher" |
| u16 | `My ___ is not working.` | 10 | n1 existing + new reply "Hi, the water is leaking. My aircon is not working." |
| u17 | `Let's ___.` | 10 | n3 existing "Let's go to the coffee shop" + new "Yes! Let's go now."; n2 new "Sorry, I'm busy today. Let's have lunch tomorrow." (→ later) |
| u18 | `I'm here to ___.` | 10 | node `down` (was an end node) now has 2 replies "Hi, I'm here to collect my parcel." / "Hi, I'm Amy. I'm here to collect a parcel." → `end` |
| u19 | `You need to ___.` | 10 | new reply n3 "Yes, you need to bring this book to class."; n5 new reply → new nodes n6, n7 ("You need to fill in this form, please." / "...come 10 minutes early on Saturday.") |
| u20 | `I want to ___.` | 10 | n1 existing "I want to top up my phone" + new reply "I want to change my phone plan." |

Only `drill` → `patterns` and dialogue replies/nodes changed. No chunk, words, phonics or task changes; no ids renamed.
u18: node `down` is no longer an end node (it now leads to `end`); `end` is the only end node there.

## Lexicon: `content/lexicon/patterns-c.json` — 15 words
carry, show, computer, mic, Wi-Fi, heater, break, order, rest, tap, cancel, learn, money, SIM, start

## 谐音 I am unsure about (please have a human listen)
- **computer** 肯皮优特 (kəm-piú-te): four hanzi for one word; "肯" must close to m. Maybe too long to be helpful.
- **Wi-Fi** 外发 (wài-fài): "发" alone lacks the -i glide; relies on the note.
- **heater** 希特 (hī-te): 希 is x, not h — the note corrects it, but the hanzi itself teaches the wrong onset. Could be red-ish; kept yellow because the rest is easy.
- **carry** 开瑞 (kāi-ri): 开 is a diphthong, English /æ/ is a short single vowel.
- **show** green 收: Chinese sh is retroflex, English /ʃ/ is not; judged close enough for green.
- **order** 奥的 / **start** 斯达(t): British non-rhotic readings; if the app's TTS voice sounds rhotic, the notes "不卷舌" need revisiting.
- **SIM** 西 sì(m): same pattern as existing `sick` / `since`, flagged only because 西 is x.
- **money** green 嘛尼: fine I think, listed for completeness.

## For the coordinator
- **u17 uses `sit`, which is defined in `patterns-d.json`** (content-pd added it first; I removed my duplicate). If pd drops `sit`, u17.e03 breaks.
- `drink` (u19.e04) comes from `patterns-a.json`.
- u17.e07 "Let's order some kopi" and u18.e05 "collect my order" share my `order` entry (zh covers both senses).
