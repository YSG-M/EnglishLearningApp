# tooling-1 summary (2026-10-24) — DONE

## Built
| File | What |
|---|---|
| `scripts/content-build.ts` | content/ → `resources/content/bundle.json`. `--allow-missing` = dev-only partial build via `compilePartial` (drops unwritten weeks, units/phonics that still have errors, dangling phonics refs; logs every drop) |
| `scripts/audio-generate.ts` | Kokoro v0_19 → `resources/audio/<clipKey>.wav` (16-bit PCM, 24 kHz mono, speed 0.9 = `TTS_SPEED`). Skips existing, `.tmp`+rename (resumable), `--limit N`, `--prune`, `--force` |
| `scripts/models-download.ts` | Whisper base.en int8 → `resources/models/whisper-base.en/{encoder.int8.onnx,decoder.int8.onnx,tokens.txt,manifest.json}`; `--with-kokoro` → `.models/kokoro-en-v0_19/`. Reuses `.models/` cache; download resumes (Range), size-checked |
| `scripts/lib/{paths,partial,audio-plan,download}.ts` | shared bits; `content-files.ts` unchanged |
| `tests/scripts/{partial,audio-plan}.test.ts` | 11 tests, pass |
| `electron-builder.yml` | NSIS x64 per-user, zh_CN+en_US, asarUnpack sherpa-onnx-node + sherpa-onnx-win-x64, extraResources content/audio/models, publish null, no signing |
| `.github/workflows/ci.yml` | windows-latest, Node 24: npm ci, typecheck, lint, test, content:validate |
| `README.md`, `docs/dev-setup.md`, `docs/decisions/0001–0005` | Chinese docs/ADRs |

## Verified (real runs)
- models:download → whisper files present in resources/models/whisper-base.en (copied from .models cache); downloader tested on a real GitHub asset; bsdtar extraction of a single member tested.
- content:build full → fails listing missing units (expected now); `--allow-missing` → partial bundle (u01 only at the time; others mid-write).
- content:audio `--limit 5`/`--prune` → valid WAVs, orphan + .tmp cleanup works.
- `electron-builder --win --dir` → config validates; failed only on missing `out/main/index.js` (main not built yet). Packed layout checked: resources/{content,audio,models}, app.asar.unpacked/node_modules/sherpa-onnx-*.
- lint/prettier/tsc clean for my files.

## Not done / notes for others
- No `build/icon.ico` yet (default Electron icon).
- Full `npm run dist` not run end-to-end (needs main/renderer build + all content + full audio).
- Full audio generation not run (content not final). Run `npm run content:build && npm run content:audio` once content is done (~1500–2000 clips; ~0.4 s per short clip).
- CI `content:validate` will fail until all 26 units + phonics exist.
