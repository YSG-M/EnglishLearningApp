# web-speech 交接

会话结束交接，状态 BLOCKED（仅真实 ASR 构件/真机）；已完成范围和最终验证数字见 INDEX.md 的 Now。未 commit、未 push，未增加依赖。只写任务允许路径；其他 builders 正在并行修改，不能撤销他们的文件。

## 已完成

- `src/web/speech/{index,types,model,silence,worker-handler,speech.worker}.ts`：固定 tiny.en 模型标识、SpeechClient/Worker 协议、懒加载、串行识别、copy/transfer、静音检查、60s init（包括缓存读取）/20s decode、generation、terminate、旧队列及迟到消息隔离、崩溃/失败后 unavailable、模型独立进度转发。Fake Worker 注入仅用于测试。
- 默认生产 `ARTIFACT_VERIFIED=false`；Worker 的真实 Provider 明确未实现，init 返回 unavailable，不伪造文字。不能只翻该标志解锁；需要真实 Sherpa WASM 装配。
- `audio/player.ts` 注入 resolver 与可选 onError，浏览器禁 TTS、单一 audio、拒绝 play/缺音频通知、中断 sequence；桌面默认仍 media:// + speechSynthesis。`audio/session.ts` 负责播放/录音互斥和 audioSession hint。
- `audio/recorder.ts` 点击时创建/resume AudioContext，保留原 PCM Worklet/resample；权限、addModule/初始化失败、abort、pagehide、后台、手动停止后释放 tracks/context/nodes。pending 权限取消也立即关闭 context，后授权 tracks 会停止。播放途中初始化取消也清理。
- `hooks/useRecorder.ts` pending 初始化和录音均有 AbortController/卸载保护，取消返回 null 防止卸载后保存；`SpeakPanel.tsx` 所有识别失败保留本次回听与自评，score=null，不伪造 transcript，忽略卸载后迟到结果。
- 自有 audio/ 目录测试覆盖 SpeakPanel/录音 hook；speech/ 测试通过真实 structuredClone 验证 transfer 不 detach caller。
- `scripts/web/models-download.ts` 下载/核验固定 tiny.en 归档、提取 int8 三文件到 resources/web-models，生成带 artifactVerified:false 的 manifest。归档长度/摘要与文件摘要已实测写入脚本/文档；归档上游不提供 digest，不能当上游签名。脚本准备成功后刻意退出 1 BLOCKED。
- `docs/web/speech.md` 记录官方出处、许可证、参数/内存、结果边界、命令和真实浏览器/iPhone 待测步骤。

## ASR 阻塞证据与后续

核对固定 sherpa v1.13.8 release API（缓存 .agent-wiki/tasks/speech-release.json）未发现可直接配 Whisper 的浏览器 JS/WASM 成套下载。最初只查 wasm/asr（在线接口）的范围不够，已纠正：wasm/web + wasm-common.cmake 确有 Offline API、512MiB initial memory、10MiB stack、modularized build，构建入口 build-wasm-simd-web.sh 指向 Emscripten 4.0.23。源码能力存在，但没有本机编译工具链/匹配二进制/单线程性能证据，未测任何真实 WASM 解码。Whisper tiny.en 39M、base.en 74M；base 未启用。许可证 Sherpa Apache-2.0 / Whisper MIT。

后续应独立固定 Emscripten/ORT/源码并构建、测量运行时 SHA-256/许可证清单，补真正 OfflineEngine（文件系统装配和资源释放），浏览器实际 decode 后再上 iPhone。不要换云语音、Safari SpeechRecognition、Node native 或另一个 SDK。

## 集成协作

只经 tasks/web-board.md 协调。assets/types.ts 的 getModelState/subscribeModel 已接；assets 收到请求跳过 artifactVerified:false。mobile 已接 configurePlayer onError，UI 有中文缺音频/手势入口；ChallengePart 已由 mobile 改为回听后手动保存。早期他们发现的 SpeakPanel regex +、Promise<unknown>、import() lint 问题均已修复。最终类型检查通过。

真实浏览器音频/手机未测；UI builder 的 Chrome 截图不证明音频/麦克风成功。没有记录冷加载/短句速度或宣称静音开关/路由通过。

## 重跑

见 docs/web/speech.md。全仓测试已跑过，但并行 builder 后续继续修改，最终集成者需按最终树再次做整体检查。tsx 在沙箱内遇 uv_os_get_passwd ENOMEM；批准的 `npx tsx scripts/web/models-download.ts --check` 沙箱外执行正常并以预期 BLOCKED 返回。代码仍未提交。
