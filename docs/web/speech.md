# Web 录音、播放与离线识别

真实单线程 sherpa-onnx WASM / Whisper tiny.en int8 Provider 已在桌面 Chrome Worker 中识别课程音频。实测数字只在 wiki `INDEX.md` 的 Now，原件 `.agent-wiki/speech-validation/results.json`。**iPhone 尚未测试**，电脑结果不代表手机性能。

## 模块与装配

- `index.ts` 导出 `createSpeechClient(assets)`；模型由 assets 显式下载、核验、缓存和读取，不建立第二套网络缓存，不使用在线识别、云语音或 Node 原生引擎。
- `sherpa-engine.ts` 实现 OfflineEngine，`speech.worker.ts` 接入真实 Provider。缓存的 encoder/decoder/tokens 写入 Emscripten FS 后构造 OfflineRecognizer：16 kHz mono、80 维特征、英文转写、CPU、单线程、greedy_search。每次 stream 在 finally 中 free；dispose 销毁 recognizer 并 unlink 文件；取消/超时 terminate Worker，释放全部运行时内存。
- 上游 JS 的 file-packager 前缀默认请求中文 `.data`。装配器在固定的 `var moduleOverrides=Object.assign({},Module);` 边界去掉前缀，保留后面的原始运行时，用已核验的 wasmBinary 和 tiny.en 缓存装配。Chrome 请求日志确认没有 `.data` 请求。
- 原始 JS 与同提交 wrapper 通过 `Function` 在 Worker 内装配，不联网加载脚本。未来部署 CSP 需要允许此装配与 WASM 编译，或改为构建时模块化；拒绝时必须回退自评。JS 是可执行资产，必须保留 assets 完整性检查。
- 控制层懒建 Worker、串行识别，先复制再 transfer，保留回听缓冲。模型读取/初始化合计最多 60 秒、解码最多 20 秒；generation 隔离迟到结果，失败后显式重新启用。静音返回空文字。重启的 getStatus 检查已有缓存，无需再联网下载。
- 播放器注入 resolveClip，浏览器 allowSpeechSynthesis:false；单一 audio，play 拒绝/缺音频中止连续播放并通知界面。桌面 media:// 和原兜底保留。
- 点击创建/resume AudioContext，AudioWorklet 采原始 PCM、重采样；播放/录音互斥。失败、取消、后台、pagehide、卸载均释放 tracks/context/nodes；结束先释放麦克风再回听。Safari 扬声器路由仍待真机验证。
- SpeakPanel 所有识别失败均保留回听和自评，不捏造 transcript/score；自评 score:null、heardText:''。hook 的 AbortController 覆盖等待权限/初始化，取消返回 null，避免离开后保存挑战。

## 固定构件与许可证

运行时版本标识为官方 k2-fsa Space 提交 **`9d5fc71d88ab1222ed1af2274fb194592af48455`**（2026-03-12），[固定文件树](https://huggingface.co/spaces/k2-fsa/web-assembly-vad-asr-sherpa-onnx-zh-zipformer-ctc/tree/9d5fc71d88ab1222ed1af2274fb194592af48455)。不冒称原先 sherpa v1.13.8：发布元数据未给出 sherpa semver，二进制未导出版本查询 API，无法证明其 semver。WASM 内有 ORT `1.17.1` 字符串。使用同提交 wrapper，真实构造/解码已验证所用 C API 配置布局兼容。

WASM 没有共享内存导入，JS 没有 pthread/SharedArrayBuffer 依赖；使用 SIMD，不支持时初始化失败回退。初始线性内存为 512 MiB，不等于进程峰值，还要加缓存、FS、模型与解码工作区。

| 运行时文件                         | SHA-256                                                            |
| ---------------------------------- | ------------------------------------------------------------------ |
| sherpa-onnx-wasm-main-vad-asr.js   | `8a7f50a3e4e5930749e8aff9ad98f03753b87490e7796c576947611439dae9d0` |
| sherpa-onnx-asr.js                 | `6297ed7520e0b4569486cd89be89045146728605418254fec4172194abc36c8d` |
| sherpa-onnx-wasm-main-vad-asr.wasm | `e4dead1d159c531282e635069fa9e028175dee71f3f90908186994655425b3ce` |

模型来自[官方 tiny.en 归档](https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-tiny.en.tar.bz2)，asset ID 179374011，归档 SHA-256 `2bd6cf965c8bb3e068ef9fa2191387ee63a9dfa2a4e37582a8109641c20005dd`。上游未提供 digest；这是官方 HTTPS 资产的本机实测锁定，不是签名。tiny 为 39M 参数；未经手机证据不启用 base.en 或改换模型。

| 模型文件                  | SHA-256                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| tiny.en-encoder.int8.onnx | `0ce578b827c94a961aacb8fa14b02f096504b337e5c94be37c36238cbe3e8bc6` |
| tiny.en-decoder.int8.onnx | `06c0e6ff6348d427e51839219d1c886c18cfdf411e629e33f5e1679bff9c1527` |
| tiny.en-tokens.txt        | `306cd27f03c1a714eca7108e03d66b7dc042abe8c258b44c199a7ed9838dd930` |

sherpa 为 [Apache-2.0](https://github.com/k2-fsa/sherpa-onnx/blob/v1.13.8/LICENSE)，Whisper 为 [MIT](https://github.com/openai/whisper/blob/v20240930/LICENSE)，ORT 为 [MIT](https://github.com/microsoft/onnxruntime/blob/v1.17.1/LICENSE)。`src/web/speech/licenses/` 保留这些文本及 ORT 第三方声明，模型脚本一并输出；Apache 文本来源标签不表示构件 semver。上游未附完整 sherpa 构建依赖清单，公开分发前仍需集成者核对完整第三方声明。

## 开发准备与验证

`npm run web:models` 准备模型、运行时与许可证；长度/摘要不符即失败，`--check` 只用已有下载重新核验。输出 resources/web-models/manifest.json，路径带内容摘要；artifactVerified:true 在真实 Chrome 验证后启用。开发准备不触发手机下载，assets 重建后由设置按钮准备手机缓存。

```text
npx tsx scripts/web/models-download.ts --check
npx vitest run src/web/speech src/renderer/src/audio
npm run web:typecheck
npm run typecheck
npx eslint src/web/speech src/renderer/src/audio src/renderer/src/hooks/useRecorder.ts src/renderer/src/hooks/usePlayer.ts src/renderer/src/components/SpeakPanel.tsx scripts/web/models-download.ts
node src/web/speech/validation/capture.mjs
```

tsx 和隐藏 Chrome 在本机需要沙箱外运行。harness 使用现有 Chrome/Node CDP，无新依赖；第一单元课程 WAV 经 AudioContext 解码/重采样到 16 kHz，逐条送 Worker，记录 init、text、durationMs、线性内存和 HTTP 路径。init 含 WASM 编译、FS 装配、模型构造，不含此前文件下载，不代表用户总等待时间。合成课程短句不代表真人口音识别率。自动单测仍用 Fake Worker/Provider，不加载真实模型。

## iPhone 人工验收（待用户执行）

1. 依 assets 文档配置可信 HTTPS，Safari 确认 secure context、麦克风权限，添加主屏幕；记录机型/iOS、Safari 或主屏幕模式。下载第 1 周，飞行模式杀进程重开，核对课程音频可用。
2. 设置中显式下载模型，核对进度/完整状态。飞行模式再次杀进程重开，确认仍可识别且不下载；未下载、下载中断、移除模型时仍能回听/自评继续。
3. 点原音/慢速/连续播放，分别测试静音开关。录三条短句，停止后确认麦克风灯消失，再回听/比较原音，核对扬声器路由与音量。记录原文、识别文字、冷加载与逐条等待、页面是否被系统杀掉；不拿电脑时间/内存代填。
4. 拒绝权限后重试；录音或等待权限时返回、锁屏、切后台，确认麦克风释放、离开后不保存挑战，返回后能再录。
5. 识别中取消/离开，测试过慢、初始化失败和 Worker 崩溃，确认回听/自评可继续、自评不写机器分数、旧结果不覆盖新一轮；完成课程/复习，挑战手动保存后重开核对。
6. 模拟缺音频/播放手势失败，确认下载或点击继续提示，不调用浏览器 TTS。Safari 与主屏幕分别执行，向协调者报告；手机验收前不宣称移动 ASR 已放行。
