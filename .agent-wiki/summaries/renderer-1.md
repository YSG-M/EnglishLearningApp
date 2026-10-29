# renderer-1 — handoff summary (2026-10-24)

Owner of `src/renderer/**`, `docs/modules/{ui,lesson,review}.md`. Never edited shared/main/preload.

## State: v1 UI complete
- Shell (sidebar 今天/课程/复习/速查/进度/设置), error boundaries (per route + root), loading / content-missing screens.
- Today, Part player (learn/practice/apply/review-day/challenge), Review session (4 exercise types + in-session practice requeue), Course (with 练一练 = `review.getPracticeSet`, submit=false), Phrasebook search, Progress (stats, 28-day bars, challenge recordings, first-vs-latest per chunk, trouble list), Settings (all Settings fields, speech status, app info, open logs, export diagnostics).
- Audio: `audio/player.ts` singleton (speechSynthesis fallback), `audio/recorder.ts` (AudioWorklet via `?worker&url`, adaptive VAD, auto-stop, 16 kHz resample).
- Verified: `tsc -p tsconfig.web.json` clean, eslint clean, prettier clean, 22 vitest tests pass (`src/renderer`), `electron-vite build` ok, real app screenshots of Today / learn step / Course / Progress look right (scratchpad `shots/`).
- NOT verified by a human: actual microphone recording + Whisper round trip in the window (no mic interaction possible from the agent). Recorder logic is unit-untested beyond resample/wav math.

## Decisions / contracts to know
- `parts.complete.activeMs` = only the not-yet-reported remainder (`useActiveTime.takeUnsent()`), because main adds it to the day's total as well as addActiveTime slices. Review page does no separate timing (per-card `activeMs` in `review.submit`).
- Errors from IPC arrive as plain objects with `code` (preload envelope); `errorCode()` handles both that and message strings.
- Labels aligned with docs/user-guide-zh.md: ▶ / 🐢 / 🎤 / ▶▶ 原音 + 我的 / 💡 提示 / 我说对了 / 显示答案 / 😊 会了 🤔 有点难 😅 忘了 / 导出诊断包 / page title 我的进步 (nav item stays 进度).

## Known gaps / ideas
- Renderer bundle ~940 kB because `@shared/settings` (zod) is imported for `HINT_FADE_AFTER`; harmless for desktop. Could move constants to a zod-free module.
- No "no recordings yet" message per unit in the progress comparison (rows just don't render).
- Settings sliders write on every change (no debounce).
- Dialogue/practice parts were not screenshot-verified (needs prior parts completed); covered by code review only.
