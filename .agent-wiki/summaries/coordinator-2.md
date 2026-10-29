# coordinator-2 — pattern lessons, redo, review sections (2026-10-24)

Decision: `docs/decisions/0006-pattern-scene-lessons.md` (accepted). Progress: `docs/progress.md` section "第二步".
Content agents content-pa/pb/pc/pd finished (their summaries are here); their tabs may still be open.

## Code
- shared: `schema.ts` (`Patterns`, drill removed), `bundle.ts` (`patterns`, `PatternMatch`, card kind `example`),
  `pattern.ts` (frame matcher), `compile.ts`, `ipc.ts` (`PracticeScope`, `RECENT_DAYS`, `CompletePartResult.firstTime`),
  `settings.ts` (`showGlosses`).
- main: migration v2 (cards table rebuilt for `example`), `learningService` (repeat parts top up cards, practice scopes),
  `cards.allIds`, `parts.listIdsSince`, IPC schema.
- renderer: `PracticePart` (句型课 + SceneSpeak), `SentenceCard` (scene/slot/badge/gloss toggle), `TokenLine`,
  `PartTile` (shared lesson tile), Course/Today/Part/Review pages, exercises show scene for example cards.
- scripts: `content-validate.ts --only`.

## Open
- 谐音 listed as unsure in `docs/progress.md` need a human listen.
- 23 unused lexicon entries (old drill words).
