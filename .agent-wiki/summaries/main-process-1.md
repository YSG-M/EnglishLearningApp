# main-process-1 — summary (2026-10-24)

Role: main-process sub-agent. Owns `src/main/**`, `src/preload/index.ts`, `docs/modules/{main-process,storage,speech}.md`.

## Built
- `src/main/index.ts` bootstrap; `api.ts` (AppApi impl, Electron-free); `ipc/{dispatch,schemas,registerIpc,envelope}.ts`
- `db/` node:sqlite wrapper + migrations (v1) with pre-migration backup + repositories
- `services/` Learning, Content, Recording (+wav), Diagnostics
- `speech/` AsrProvider, WhisperAsrProvider (utilityProcess), speechHost, silence guard
- `app/` paths, media:// parsing, capture mode; logging (electron-log); clock; errors
- preload: window.api from API_CHANNELS
- tests: 7 files / 72 tests (`npx vitest run src/main`), fixture `test-support/fixtures.ts` (mini content compiled with real compiler + in-memory app)

## Verified
- typecheck (node config), eslint, 72 tests pass
- Real Electron run with real Whisper model: preload + IPC + error envelope, media:// audio and rec fetch (200), traversal rejected (404), recognition 0.95 s load / ~0.2 s warm, silence → '', settings patch, stats
- Real renderer home screen boots with no log errors (screenshot via capture mode)

## Decisions / traps
- Renderer errors are plain objects `{name:'AppError', code, message}` (contextBridge strips Error props).
- zod 4 `.partial()` applies defaults → use `SettingsPatch` in ipc/schemas.ts.
- media scheme needs `corsEnabled` + `access-control-allow-origin` for fetch() from file:// pages.
- openDatabase must close the handle if a migration throws (Windows file locks).

## For the coordinator (shared code, not edited)
- `introduceCard` rates 'hard' → FSRS schedules the first review **2 days** out (stability 1.29), not "next day" as the comment in srs.ts says. Tests advance 2 days, robust either way.
- `npm run typecheck` currently fails on `src/shared/content/compile.test.ts` (imports node:crypto) because tsconfig.web.json includes `src/shared/**` — exclude `**/*.test.ts` from the web config or move the test.

## Gaps
- `npm run dev` (Vite dev server path) not exercised; production-path launch verified.
- No packaged (electron-builder) run yet: asarUnpack for sherpa-onnx-* needed in tooling's config.
