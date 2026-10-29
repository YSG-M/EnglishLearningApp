# content-pd-1 — pattern lessons u21–u26 (DONE)

`npx tsx scripts/content-validate.ts --only u21,u22,u23,u24,u25,u26 --warnings` → `content ok`, no
"no dialogue reply uses the unit's pattern" warning, none of my new words reported as unused.

## Units
| Unit | Frames | Examples | Dialogue replies using the pattern |
|---|---|---|---|
| u21 | `Would you like to ___?` | e01–e10 | 3 (n1 alt, n4 alt, n5 event reply) |
| u22 | `I like ___.` / `I don't like ___.` / `I think ___.` | e01–e10 | already 6+ (dialogue unchanged) |
| u23 | `Can I ___?` (usage contrasts with Can you) | e01–e10 | 2 (n2 existing, n4 new alt) |
| u24 | `It's too ___.` (usage: too ≠ very) | e01–e10 | 2 (n1 reply text changed, n2 new alt) |
| u25 | `Who is ___?` | e01–e10 | 2 (new node n3b) |
| u26 | `Is this ___?` / `Is it ___?` | e01–e10 (5 + 5) | 3 (n2 alt, n3 alt, existing n4) |

`drill` removed in all six. `chunks`, `words`, `phonics`, `task`, `grammar` untouched.

## Dialogue changes (node ids kept; new nodes added)
- u21: n1 + alt reply; n2 npc text "Maybe. When does…"; n4 + alt → new node `n4b`; n5 event reply now ends
  "Would you like to join?" → new node `n6` ("Parents are welcome to join.") → end.
- u23: n4 + alt "Thank you. Can I go home now?".
- u24: n1 second reply text → "This is the wrong size. It's too small."; n2 + alt "It's too small. I bought it yesterday." → n3.
- u25: n3 now has 2 replies → new node `n3b` (parent says "someone from my family will come"; she asks
  "Who is picking her up?" / "Sorry, who is coming?") → n4; n4 npc shortened to "Her grandmother will come. Is that OK?".
- u26: n2 + alt "Yes. Is this pen OK?"; n3 + alt "OK! Is it far?" → new node `n3b` → n4.

## New lexicon words: 7 (`content/lexicon/patterns-d.json`)
our, teaching, sit, use, big, hot, cold — all yellow.

### 谐音 I am unsure about
- **our** — 奥 · ào-e. British /aʊə/; I wrote a light "呃" tail. Some speakers say /ɑː/ ("啊"). Check by ear against Kokoro bf_emma.
- **hot** — 霍 · huò(t). Chinese h is a throat fricative, English h is a breath; note says so. British /ɒ/ is between 霍 and 哈.
- **sit** — 西 · sì(t), same style as existing `sick`. Risk she merges it with `seat` (西～ · sī(t)); note warns.
- **use** — 优 · yōu(z). Only correct for the verb (/juːz/); the noun (/juːs/) is not used anywhere yet.

## For the coordinator
- During validation I once got `duplicate lexicon entry "sit"` while no other file contained `sit` a moment later —
  probably another content agent added and removed it concurrently. Re-check for duplicates after all agents finish.
- u21 `task` still uses the old drill sentence "The new term starts in ___." (still a valid chunk, so left as is).
- All 60 new examples + new dialogue replies need audio (`npm run content:audio`) and the 7 new 谐音 go on the 待真人试听 list.
