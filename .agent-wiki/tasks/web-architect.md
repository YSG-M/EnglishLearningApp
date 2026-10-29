# Brief: web-architect (Codex)

You are a sub-agent of the coordinator (`coordinator-web`). Goal of the whole team: turn this Windows desktop app
into a **web app (PWA) that the learner adds to her iPhone 14 Plus home screen**. The web version **replaces** the
desktop app (user decision 2026-10-29). Your job is the design and the shared interfaces, not the implementation.

## Read first (in this order)
1. `CLAUDE.md` — project rules. They apply to you exactly as to Claude agents (you are Codex; there is no AGENTS.md).
2. `D:\Tools\Claude Work Rule\Project Wiki and Sub-agent rule.md` — wiki and sub-agent rules.
3. `.agent-wiki/INDEX.md` (Now block + rosters), `.agent-wiki/reusable.md`, `.agent-wiki/tasks/web-board.md`.
4. `docs/progress.md`, `docs/02-architecture.md`, `docs/decisions/*`, `src/shared/ipc.ts`, then skim `src/main/**` and `src/renderer/src/**`.

## Hard rules
- Never `git commit`, never `git push`. Leave changes in the working tree.
- Docs in Chinese (simplified); code, comments, identifiers in English. UTF-8 without BOM, LF.
- Git Bash is cp1252: never put Chinese on a command line; write it into files.
- Path has spaces: quote it.
- New dependencies: only the approved ones (Now block). Anything else → `STATUS web-architect: BLOCKED` on the board.
- Keep the wiki true (rules 10–14): update your roster row in `INDEX.md` and add traps to `reusable.md` as you find them.
- At ~68% context: write `.agent-wiki/summaries/web-architect-1.md` and post `STATUS web-architect: HANDOFF ...`.

## Decisions already made by the user (do not re-open)
- Web version replaces desktop. Same repo. Do not delete Electron code in this round; plan its removal as the
  last step, after the web version is verified.
- All runtime stays free and **offline-first**: static site + Service Worker; all personal data on the phone.
  No backend, no sync between devices, no accounts at runtime.
- Speech recognition: **offline only** (sherpa-onnx WebAssembly + a small Whisper, e.g. tiny.en / base.en int8).
  If it is too slow or unavailable on the phone: fall back to "listen to your own recording and rate yourself".
  Never Apple's / Safari's online speech recognition.
- Course audio: convert WAV → AAC (m4a) or MP3 mono ~32–48 kbps with `ffmpeg-static` at build time
  (expected ~22–33 MB total). Keep the content-hash file names so updates only download changed files.
- Download to the phone: first open downloads app + content + week 1 audio, rest in the background (or a
  rolling window); progress shown; ASR model is a separate opt-in download in settings ("use Wi-Fi").
- Backup: export / import of all learning data to a file (deleting the home-screen icon deletes the data).
- Hosting: later (GitHub Pages or Cloudflare Pages). For now everything must work locally, including a way to
  open it on the real iPhone over the LAN with HTTPS (mic needs a secure context) — design that test path.

## The layout must be designed for the iPhone home-screen app, not adapted from desktop or a normal web page
iPhone 14 Plus: 428×926 pt, notch (no Dynamic Island). Requirements: `viewport-fit=cover` + `env(safe-area-inset-*)`,
`100dvh`; bottom tab bar (thumb reach); fixed "next" button above the home indicator; every page has its own back
button (standalone mode has no browser back); touch targets ≥ 44 pt, no hover; inputs ≥ 16 px (no zoom); no
double-tap zoom, no rubber-band scroll on the shell; `apple-touch-icon`, status-bar style, splash; portrait.
Keep the project UI rules (big text, big buttons, one thing per page, no fancy animation).

## iOS traps the design must handle (verify on the real phone later)
- Silent switch mutes Web Audio → play with `<audio>` elements and/or `navigator.audioSession.type = 'playback'`.
- After `getUserMedia`, playback may route to the earpiece / get quiet → stop all mic tracks right after each recording.
- Mic permission may be asked again on every launch in standalone mode.
- Audio playback needs a user gesture.
- Storage: OPFS / IndexedDB / Cache Storage quota and eviction; request `navigator.storage.persist()`.
- Safari `MediaRecorder` produces mp4/AAC, not webm; for ASR capture raw PCM (AudioWorklet) and resample to 16 kHz.

## Deliverables
1. `docs/decisions/0008-web-pwa-iphone.md` (编号、日期、背景、选项、结论、原因) — includes the speech fallback and
   the "replaces desktop" decision.
2. Web section in `docs/02-architecture.md` (or a new `docs/web/architecture.md` linked from it): module boundaries,
   **file ownership per builder**, folder layout (e.g. `src/web/`), how the browser implements the existing `Api`
   in `src/shared/ipc.ts` (keep that interface as the contract so the renderer barely changes), storage design with
   sqlite-wasm (reuse existing SQL/migrations where possible; which worker owns the DB), speech worker message
   protocol, asset manifest format + Service Worker cache strategy + update flow, backup file format, build/serve
   commands, how tests stay Mock-provider based.
3. A mobile UI spec (`docs/web/mobile-ui.md`): shell, tabs, each page mapped from the desktop pages, safe areas.
4. Task briefs for **at most 5 builders** in `.agent-wiki/tasks/web-<role>.md`, same style as this brief, each one
   independent, owning disjoint files, with its own acceptance checks (commands to run, what "done" means).
   Suggested split (change it if the code says otherwise): storage+services+Api in the browser; speech
   (recorder, ASR worker, fallback, model download); mobile shell + pages; assets+PWA (audio conversion, manifest,
   Service Worker, download progress, local HTTPS serve for the iPhone, build scripts); plus whatever is left.
   Add one row per builder to the web team table in `.agent-wiki/INDEX.md` with state `planned`.
5. Do **not** write implementation code. Tiny feasibility checks are fine in a scratch folder outside `src/`
   (delete them afterwards or note them in the wiki).

## Finish
- Update your roster row to `ended`, write `.agent-wiki/summaries/web-architect-1.md` (what you decided, open
  questions, risks), then post `STATUS web-architect: DONE` on the board. If something needs the user's decision,
  list it in the summary under "需要用户决定" and still finish the rest.
