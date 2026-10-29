# Brief: web-speech-2 (Codex) — successor of web-speech-1

Read first: `CLAUDE.md`, `D:\Tools\Claude Work Rule\Project Wiki and Sub-agent rule.md`, `.agent-wiki/INDEX.md` (Now block),
`.agent-wiki/reusable.md`, `.agent-wiki/tasks/web-speech.md` (your original brief — all its rules and file ownership still apply),
`.agent-wiki/summaries/web-speech-1.md` (what is done), `docs/web/speech.md`, `docs/web/architecture.md`, the board.

## The blocker is resolved by a lead from the coordinator (verify it yourself, do not trust it blindly)
Official k2-fsa prebuilt sherpa-onnx WASM runtime, pinned by commit:
- Space `k2-fsa/web-assembly-vad-asr-sherpa-onnx-zh-zipformer-ctc`, commit `9d5fc71d88ab1222ed1af2274fb194592af48455`
- `https://huggingface.co/spaces/k2-fsa/web-assembly-vad-asr-sherpa-onnx-zh-zipformer-ctc/resolve/<commit>/<file>` for
  `sherpa-onnx-wasm-main-vad-asr.js` (95 KB), `sherpa-onnx-wasm-main-vad-asr.wasm` (11.7 MB, LFS sha256 `e4dead1d159c531282e635069fa9e028175dee71f3f90908186994655425b3ce`),
  `sherpa-onnx-asr.js` (JS wrapper, OfflineRecognizer). **Do not download the 368 MB `.data`** — it is the Chinese model.
- The runtime is model-independent: `app-vad-asr.js` in sherpa-onnx `wasm/vad-asr/` picks whisper when `whisper-encoder.onnx` exists.
  Coordinator checked: no SharedArrayBuffer/pthread (single-threaded), and `Module.FS_createDataFile` / `FS_createPath` / `FS_unlink`
  are exported → write the tiny.en files (already pinned in `resources/web-models`) into the Emscripten FS at runtime from the
  asset cache, then create the OfflineRecognizer with `modelConfig.whisper`. Skip the `.data` preload (set `Module.locateFile` /
  avoid the file packager fetch, or check how the JS behaves without it — verify).
- Version: confirm which sherpa-onnx version the runtime is (C API must match the wrapper you vendor from the same commit).
  Licence Apache-2.0. This is within the approved dep scope ("sherpa-onnx WASM files downloaded by script").

## Do
1. Extend `scripts/web/models-download.ts` to fetch + sha256-pin the runtime files; update manifest (`artifactVerified` true only
   after step 3 passes).
2. Implement the real OfflineEngine in the speech worker (FS assembly, recognizer lifecycle, free on terminate).
3. Real check in desktop Chrome (headless CDP harness at `src/web/ui/validation/capture.mjs` can be copied into your own dir):
   decode a few course audio clips (resampled to 16 kHz) and record transcript, cold-init time, per-clip decode time, wasm memory.
   Put numbers in the Now block only.
4. If tiny.en is too slow/heavy, you may *measure* Moonshine tiny in the same runtime as an alternative, but do not switch the
   model without posting the numbers on the board for the coordinator/user.
5. Write the iPhone manual test steps into `docs/web/speech.md` (the user will do them).

Finish as in the original brief: roster row (add `web-speech-2`), summary `.agent-wiki/summaries/web-speech-2.md`,
`STATUS web-speech: DONE` (or BLOCKED with evidence). Never commit/push. Commands using `tsx` need approval outside the sandbox
(see reusable.md).
