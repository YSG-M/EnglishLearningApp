# web-speech-2 结束交接

任务完成，真实桌面 Chrome ASR 构件阻塞已解除；iPhone 仍待用户手测。所有耗时、大小、测试数量见 INDEX.md 的 Now，不能把桌面性能当作手机结果。未 commit/push，未加 npm 依赖；只经 web-board 协调。

## 交付与所有权

- 新增 `src/web/speech/sherpa-engine.ts`，`speech.worker.ts` 接真实 OfflineEngine，FS 写入 tiny.en，recognizer/stream 生命周期与 finally 清理。取消由已有 SpeechClient terminate Worker，释放整个 WASM 内存。
- `model.ts` 固定 HF commit 版本标识并在真实测试后启用 ARTIFACT_VERIFIED；`index.ts` 检测重开后的模型缓存，保留缺模型/取消/超时回退，不重新联网下载。`client.test.ts` 更新下载测试并补缓存恢复测试。
- `scripts/web/models-download.ts` 固定官方运行时文件长度/SHA-256，生成完整 manifest、artifactVerified:true、运行时来源和验证说明；保留原固定 tiny.en 归档验证；`--check` 只核验已有缓存，现成功退出。模型清单含许可证，资产负责人需重建资源以纳入最终文件。
- `src/web/speech/licenses/` 包含 sherpa Apache、Whisper MIT、ORT MIT/第三方声明。上游预编译未附完整 sherpa 构建依赖清单，公开分发前集成者仍需核对完整声明；没有假称 ORT 声明就是全部 sherpa 声明。
- `src/web/speech/validation/{capture.mjs,preview.html,preview.ts,smoke.worker.ts}` 用原生 Chrome/CDP、真实 Worker 解码课程 WAV（浏览器解码并重采样）。build/profile 在 OS temp，旧自建 wiki profile/build 已清理；结果在 `.agent-wiki/speech-validation/results.json`，只含合成课程数据。
- `docs/web/speech.md` 已改为真实实现说明，记录来源/摘要/许可证、版本证据边界、CSP Function 装配需求、测量定义、命令与 iPhone 人工步骤。

## 构件证据与限制

原始固定 JS 带中文 file-packager，不能直接加载。SherpaEngine 在唯一明确边界剥掉前缀，保留剩余运行时，使用 assets 已核验字节。没有下载中文 .data，HTTP 请求日志可复核。相同 HF commit 的 wrapper 构造/解码成功，所用 C API 布局已实证兼容。

上游 HF 元数据未注明 sherpa semver，二进制未导出版本查询 API，所以版本使用精确 HF commit，不冒称前任核对的 sherpa release。二进制有 ORT 版本字符串，详见模块文档。单线程 SIMD，不要求共享内存/隔离头；不支持 SIMD/CSP 拒绝/手机内存不足均需回退。

## 验证与集成待办

语音测试、两套 typecheck、语音 lint/格式/diff 与真实 Chrome smoke 通过；模型脚本实际核验成功。全仓测试存在资产暂停恢复失败，证据已发 board，归资产负责人/集成者处理；不得宣称全仓通过。数字见 Now。

assets 必须重建发布清单；之后集成者重跑整体检查/构建和离线实际下载。手机验收、真人口音、权限/路由/静音、主屏幕冷重开和系统内存终止未测，手动步骤在模块文档。未测 Moonshine，也未更换 tiny.en。
