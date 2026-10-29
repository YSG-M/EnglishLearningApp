# coordinator-1 — v1 integration summary (2026-10-24)

All six sub-agents finished (content-a, content-b, phonics-docs, main-process, renderer, tooling); their summaries are in this folder.

## Integration fixes done by the coordinator
- `normalize.ts`: integers compared digit by digit ("Block 123" = "one two three"), `%` → percent, ordinals.
- `speechMatch.ts`: consonant-skeleton "close" match (Whisper heard "aircon" as "eirken").
- `srs.ts`: first review clamped to next day (FSRS gave 2 days).
- `tsconfig.web.json` excludes shared tests (node:crypto import broke web typecheck).
- `HINT_FADE_AFTER` moved to `src/shared/domain/hints.ts` so the renderer doesn't bundle zod (940 → 770 kB).
- Lexicon: `on` hint fixed (噢恩, not 安); `OK` hanzi matches pinyin.
- `.prettierignore` excludes `content/` (one-entry-per-line JSON is easier to edit by hand).
- `build/icon.png` rendered with Electron (scratch script `icon.cjs`).

## Visual verification recipe
`scratchpad/shoot.mjs <name> <userDataDir> [delayMs] [scriptFile]` runs the built app (`npx electron-vite build` first) with `KAIKOU_USER_DATA`, `KAIKOU_CAPTURE_DELAY`, `KAIKOU_CAPTURE_SCRIPT`, writes `shots/<name>.png`. To simulate days passing, edit `<userData>/data/learning.sqlite` (`update cards set due = ...`).

## Open
See `docs/progress.md` (unverified: real microphone use; hints not yet reviewed by ear).
