# content-b-1 — units u14–u26 + content/lexicon/phase2.json (2026-10-24)

## Done
- 13 unit files: `content/units/u14-yesterday.json` … `u26-singlish.json`, topics/phonics refs exactly as assigned (p12–p24).
  Each: 8–9 chunks, 10–12 words, 1 drill (4 fills), 4–6 dialogue nodes (u17, u18 have two closing nodes), task.
  Grammar blocks: u14 (过去时), u22 (like + 动词ing), u25 (he/she).
- `content/lexicon/phase2.json`: 169 entries = every word my units need that core.json does not have.
  Red hints only for th-/v- initial words: that, the, there, think, this, very (those that survived dedup).
- `npm run content:validate -- --warnings`: 0 errors, 0 warnings (26 units, 411 words, 94 parts, 1135 clips).

## How dedup works
content-a owns core.json and kept adding common words while I worked; I removed 100 of my entries that core.json
now has. If core.json grows again, any new overlap shows as `duplicate lexicon entry` — delete the phase2.json copy.
Scratch scripts (not in repo): scratchpad `needwords.ts` (missing/dup/unused report), `dedup.py` (drop phase2 keys present in core).

## Uncertain / for review
- u16.c07 "I live in Block 123." — Whisper may write "Block 123" or "block one two three"; normalizeWords would turn
  "one two three" into "6" (sums number words). Worth a test or a normalize tweak (digit-by-digit sequences).
- u19 "Each class is one and a half hours." — "one" becomes "1" on both sides, fine; Whisper may write "1.5 hours" (would fail).
- u21 "10% discount", "15 December", "25 January": number tokens; Whisper formatting ("10 percent", "15th") may not match.
- Hints with hanzi that add a final vowel are always paired with pinyin + note; still worth a human pass by the learner's husband.
