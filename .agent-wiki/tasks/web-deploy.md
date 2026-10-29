# Brief: web-deploy (Codex)

Goal: publish the web/PWA version on **GitHub Pages** from the public repo `YSG-M/EnglishLearningApp`
(user decision 2026-10-29: repo may be public; skip the local LAN/iPhone test entirely; test directly on Pages).
Target URL: `https://ysg-m.github.io/EnglishLearningApp/` (base `/EnglishLearningApp/`, already smoke-tested by web-assets).

## Read first
`CLAUDE.md`, `D:\Tools\Claude Work Rule\Project Wiki and Sub-agent rule.md`, `.agent-wiki/INDEX.md` (Now), `.agent-wiki/reusable.md`,
`.agent-wiki/tasks/web-board.md`, summaries `web-assets-1.md` and `web-integrator-1.md`, `docs/web/assets.md`,
`docs/web/iphone-test.md`, `docs/decisions/0008-web-pwa-iphone.md`, `package.json`, `.gitignore`, `.github/workflows/ci.yml`, `scripts/web/*`.

## Facts measured by the coordinator (2026-10-29)
- `dist-web` 155 MB, 3050 files: app shell 3.2 MB, content 1.4 MB, audio 40 MB, models 111 MB.
- Largest file `tiny.en-decoder.int8.onnx` 89,853,865 bytes (< GitHub 100 MB hard limit; > 50 MB warning — acceptable, no LFS).
- Course WAVs (`resources/audio`, 258 MB) are generated locally with Kokoro and **cannot be regenerated in CI**.
  `web:build` currently runs `web:assets` (content build + WAV→AAC transcoding) first, so CI cannot run it as is.

## Do
1. Make the Pages build reproducible in CI **without** WAVs/Kokoro: track the generated phone assets in git (un-ignore
   `resources/web/`, which holds converted audio, content, models, manifest — check it contains nothing secret or personal),
   and add a CI build path that builds the app shell + Service Worker against the committed `resources/web` and verifies
   every digest (`scripts/web/verify.ts`). Keep `.certs/`, `*.key`, `*.pem`, `*.pfx`, `resources/web-reports/`, `dist-web/`,
   `resources/web-models/`, `.models/`, `resources/audio/`, `resources/models/` ignored. Locally, `web:build` must still
   regenerate `resources/web` as today. Keep it simple; no new dependencies.
2. Add `.github/workflows/pages.yml`: trigger on push to `main` + `workflow_dispatch`; Node 24; `npm ci`; the CI build with
   `WEB_BASE=/EnglishLearningApp/`; upload with `actions/upload-pages-artifact` and deploy with `actions/deploy-pages`
   (permissions `pages: write`, `id-token: write`; `concurrency` group pages). Use major versions that already exist
   (≥ 2 weeks old). Check npm `allowScripts` / `ffmpeg-static` install does not break `npm ci` on Linux; if ffmpeg is not
   needed in the CI path, make sure its absence is fine. Do not break the existing `ci.yml`.
3. Prove it locally: simulate the CI path from a clean copy (e.g. copy tracked + newly-tracked files into an OS temp dir,
   `npm ci`, run the CI build with the base, run `scripts/web/verify.ts` and `node scripts/web/browser-smoke.mjs` against the
   output if possible). Report exact results; do not claim the GitHub run passed (it has not run).
4. Docs (Chinese): rewrite `docs/web/iphone-test.md` for the Pages URL — no certificates, no PC: open the URL in Safari →
   分享 → 添加到主屏幕 → checklist + results table (drop the "固定网址/证书" items; keep model and iOS version as optional).
   Add a short "对手机的影响 / 如何彻底删除" section (Settings → App → Safari → 高级 → 网站数据). Move the LAN/HTTPS steps into
   `docs/web/assets.md` as developer-only (keep them, just not in the user guide). Add a "发布到 GitHub Pages" section to
   `docs/web/assets.md` and `docs/dev-setup.md` with the exact user steps: commit, merge `feat/v1` → `main`, push, repo
   Settings → Pages → Source: **GitHub Actions**, where to watch the run, how updates reach the phone.
   Update decision 0008 (hosting: GitHub Pages, public repo, 2026-10-29) and `docs/progress.md`.
5. Run `npm run check` and `npm run web:check` at the end.

## Rules
Never `git commit` / `git push` / create GitHub settings — the user does that. `tsx` commands need approval outside the
sandbox (reusable.md). Update the Now block + your roster row (`web-deploy`), write `.agent-wiki/summaries/web-deploy-1.md`
listing every changed file and the exact user steps, then post `STATUS web-deploy: DONE` (or BLOCKED with evidence).
