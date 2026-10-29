# content-de-1 — daily words + stories for u23–u26, w12–w13 (DONE)

## Done
- u23, u24, u25, u26: `daily` (12 words each, d01–d12, after `patterns`) + `stories` (narrative + dialogue).
- `content/weeks/w12.json` (u23+u24), `content/weeks/w13.json` (u25+u26).
- Pattern examples: u23/u24/u26 already had ≤4 work scenes. u25 had 5, so I changed the scene of **u25.e03** to "家里的电话响了……". Only the scene changed; en/zh/id are the same.
- Story settings: daily life in u23 (sick day + clinic counter), u24 (shop return + electrical-shop kettle), u25 (the playground narrative), u26 (both at the hawker centre), w12 (the narrative) and w13 (the narrative). Work settings: u25 dialogue (pickup safety), w12 dialogue (taking leave from Mr Lee), w13 dialogue (calling a parent, uncle picks up).
- Formatted with `fmt_unit.py`.

## Daily words (48)
- u23: feel dizzy lie stay porridge nap relax lazy flu bored public boss
- u24: shirt dress black fit exchange hole cup price pair wrap kettle keep
- u25: plaster cut fell run road hand cry scared wash kids playground safe
- u26: accent local laugh Malay auntie packed chat funny joke polite thirsty language

`content/lexicon/daily-e.json` has 51 entries: the 48 above, plus `finger` and `hands` (used in daily sentences), plus `traffic`. I kept `traffic` here at content-db's request: it is u08.d06's daily word, and content-db removed their copy. It is not one of my daily words.
I dropped my own entries, and picked other daily words, for these: loud (u07), word (u02), traffic (u08), wedding, birthday, dirty, careful, remote, online (u13–u18, daily-c). I followed the earliest-unit rule the content agents agreed on. I still use some of these words in sentences.

## Remaining "not taught" warnings (all stories ≤ 2 distinct words)
Full run, 2026-10-25, while u05/u06/u09–u18/u22 were still being written:
- u23 narrative: evening · u23 dialogue: problem, medicine
- u24 narrative: shop · u24 dialogue: problem
- u25 dialogue: evening
- u26 dialogue: or, away. "…or not?" is the Singlish being taught, and "take away" is also deliberate.
- w12 narrative: shop · w12 dialogue: wedding. This should clear once u13.d10 (wedding) is in place.
- w13 dialogue: or
Some of these may clear once the earlier units get their daily sentences. Re-run when everyone is done.

## 谐音 I am unsure about
- dress → 拽 zhuè(s) (dr written like the "drink → 准" entry); word-like vowels: shirt → 舍 shě(t), dirty was dropped.
- exchange → ì(k)-s-chēin(j); playground → p-lèi-g-rào(nd); language → lǎng-gwì(j); plaster → p-lā-s-de (long).
- cry → 快 kuài; joke → 揪 jōu(k) (Chinese j is not quite English j); run → 让 rǎn; wrap → 瑞 rǎi(p).
- Red: birthday entry was dropped (daily-c owns it); thirsty is red (th at the start).

## For the coordinator
- The full validation still errors on other agents' unfinished units (u05, u06, u09–u18, u22 missing daily/stories) and on daily-c duplicates. None of the errors are in my files.
- Two duplicate daily words in other agents' units: `early` (u03.d08, u08.d11) and `date` (u04.d11, u13.d04).
- `--only uNN` seems to build the taught set from the listed units only, so it shows many false "not taught" warnings. Use a full run with grep instead.
