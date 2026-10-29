# content-da-1 — daily words, scenes and stories for u02–u06, w01–w03

Status: **done**. Validation: `npx tsx scripts/content-validate.ts --only u01,u02,u03,u04,u05,u06,w01,w02,w03 --warnings`
gives `content ok`. Every story has at most 2 "not taught" warnings.

## Files
- `content/units/u02…u06-*.json`: `daily` (12 words each) placed after `patterns`, and `stories` placed after `daily`.
  Scenes changed in u02 (e02, e05, e06), u03 (e04, e05, e06, e09) and u05 (e02, e05, e06). u05.e06 `en` is now
  "Do you want to see my new home?" (the old "classroom" line did not fit daily life). The id is unchanged.
  u04 and u06 already had 7–8 daily-life examples, so they are unchanged.
- `content/weeks/w01.json`, `w02.json`, `w03.json` (new).
- `content/lexicon/daily-a.json`: 29 new entries (hear fast speaks word little ready map easy Lily address downstairs
  floor key chair kitchen cents o'clock noon young swimming teach first egg chopsticks table fork orange tray chilli).

## Daily words (60)
- u02: know hear easy fast word little chinese sure address lost ready map
- u03: home toilet downstairs floor key chair sit early queue wet kitchen tissue
- u04: expensive cash card change cents week o'clock dollars half noon date dinner
- u05: son daughter school young learn swimming cook together park parents teach first
- u06: egg fish chopsticks table lunch fork orange milk bread tray chilli eat

## Remaining "not taught" warnings (allowed, ≤ 2 per story)
u02 narrative: way · u02 dialogue: food, but · u03 dialogue: Jason (child's name) · u04 dialogue: evening, want ·
u05 dialogue: his, grandma · u06 narrative: hawker, has · u06 dialogue: or · w01 dialogue: home · w03 narrative: has.
(u01 dialogue "too" is not mine.)

## Coordination with other content agents (please check at merge)
- We agreed: one lexicon entry per word, kept in the file of the earliest unit that uses it.
- I gave up loud, remember, umbrella, wet, grandma and juice to later units.
- My entries rely on others' files: wet, date (daily-c), price (daily-e), grandma, juice (daily-b), and phase2/core words.
  If those files drop them, u03/u04/u05/u06 break.
- Daily-word duplicates resolved by content-db/dc (u08.d11 cross, u09 boy/girl/cousin, u13.d04 changed).
  Rechecked: no lexicon or daily-word duplicates across all files.
- u06.d07 uses the word "orange" in "One orange juice, please." because "juice" is u10's daily word.

## 谐音 I am unsure about
- word `wò(d)` / first `fě(st)`: the vowel ɜː. I copied the style of `work`, but `first` uses ě.
- key `kī` and kitchen `kí-chen`: these use a k-pinyin form that is not valid pinyin, with a note saying "not q".
- address `e-(d)ruè(s)`, grandma (not used, daily-b's), tray `(t)ruèi`, umbrella (dropped).
- table `tēi-b(l)` with hanzi 忒, and chair `chē-e`.
- hear: the same hint as `here` (嘻儿 hī-er).
