# Brief: web-integrator (Codex)

All four builders are DONE (storage, mobile, speech-2, assets). You join the parts, fix leftovers, verify the final tree,
and prepare the iPhone test for the user. You may edit any file needed for integration, but keep changes minimal and
related to the task (CLAUDE.md code rules).

## Read first
`CLAUDE.md` (note the 2026-10-29 exception: `.agent-wiki/` is tracked in git → no secrets/keys/personal data in it),
`D:\Tools\Claude Work Rule\Project Wiki and Sub-agent rule.md`, `.agent-wiki/INDEX.md` (Now block), `.agent-wiki/reusable.md`,
`.agent-wiki/tasks/web-board.md` (all of it), the summaries `web-architect-1`, `web-storage-1`, `web-mobile-1`, `web-speech-1`,
`web-speech-2`, `web-assets-1`, then `docs/web/*.md` and `docs/decisions/0008-web-pwa-iphone.md`.

## Do
1. Fix the issues on the board addressed to the integrator (Today root tab shows "← 回到今天"; root tabs must not show a back
   button. Download progress shows "已校验 0 / 0 字节" before the manifest loads). Read the board for anything else left open.
2. Run on the final tree and fix what fails: `npm run check`, `npm run web:check`, `npm run web:build`,
   `node scripts/web/browser-smoke.mjs`, the mobile screenshot script `src/web/ui/validation/capture.mjs` (look at the 428×926
   screenshots yourself, page by page: Today, Course, a lesson step with the fixed next button, Review, Settings/我的, Summary).
   Skipped tests are failures. `tsx` commands need approval outside the sandbox (reusable.md).
3. Wire-up check: the real `createWebApi` + real assets + real speech client are what `src/web/main.tsx` uses in production
   (Fakes only in tests). Do one end-to-end run in Chrome against the built site: first-run download of week 1 → open lesson →
   play audio → (speech uses a course WAV as fake mic only if the harness already supports it; otherwise state it is untested).
4. Write ONE user-facing Chinese guide `docs/web/iphone-test.md` for the user (not a developer): on the PC, which commands to run
   to serve over LAN HTTPS (fixed LAN IP, firewall); on the iPhone, install the local CA profile + enable full trust
   (设置 → 通用 → 关于本机 → 证书信任设置), open in Safari, 添加到主屏幕, then a checklist: first download, offline (airplane
   mode) cold start, audio with the silent switch on, record + playback volume after recording, mic permission on relaunch,
   speech recognition time per sentence, backup export/import, rotate/keyboard/safe areas. A table to fill in results.
   Link the existing details in speech.md / assets.md / storage.md instead of copying them.
5. Docs: add the web docs to `docs/README.md`; update `docs/progress.md` with a dated web section (what was verified and how,
   what is NOT verified — iPhone not tested yet), known issues. Numbers only from what you measure.
6. Do not remove Electron code yet (that happens after the iPhone test passes).

## Finish
Update the Now block and your roster row (add `web-integrator`), write `.agent-wiki/summaries/web-integrator-1.md`, post
`STATUS web-integrator: DONE` (or BLOCKED with evidence) on the board. List every file you changed in the summary.
Never `git commit` / `git push`. At ~68% context: summary + `STATUS web-integrator: HANDOFF ...`.
