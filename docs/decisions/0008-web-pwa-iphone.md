# 0008 · iPhone 主屏幕离线 PWA 替代桌面版

- 日期：2026-10-29
- 状态：用户已决定产品方向；本文记录实现约定，真机能力尚待验证。

## 背景

学习者将通过 iPhone 14 Plus 主屏幕使用课程。同仓库保留课程、共享学习逻辑和 React 页面，运行时免费、离线优先，个人数据只在手机上。此决定覆盖 0001–0004 中仅适用于桌面的框架、存储和音频交付方式，不改变学习方法与 FSRS。

## 选项

1. 继续 Electron：无法满足手机主屏幕使用。
2. 原生 iOS 应用：增加平台构建与分发成本。
3. 静态 PWA：复用现有 TypeScript、React、内容和业务接口。
4. 云端识别、账号和同步：不符合离线与隐私要求。

## 结论

采用静态 PWA，**Web 版替代桌面版**。本轮保留 Electron 代码，Web 真机验证完成后，再单独移除桌面入口、依赖和打包配置。

- Vite 构建 `src/web/` 入口，复用 `src/renderer/src/`。浏览器实现现有 `AppApi`，不修改 `src/shared/ipc.ts` 的方法或含义。
- SQLite WASM 在专用数据库 Worker 中运行，首选 OPFS `opfs-sahpool`，单写入者；持久化不可用时明确阻止保存型学习，不能默默使用临时内存库。
- 课程 WAV 在构建时通过已批准的 `ffmpeg-static` 转成单声道 AAC/M4A，目标 40 kbps，保留原内容哈希键；压缩后大小必须实测。
- 首次下载应用、内容与第 1 周完整音频，显示可核对的进度；后续音频在前台空闲时继续，支持暂停和恢复。不依赖 iOS 关闭应用后的后台执行。
- 识别只允许本地 sherpa-onnx WASM + 小型英文 Whisper。模型在设置中单独选择下载，提示使用 Wi-Fi。优先验证 tiny.en int8，base.en int8 仅在内存和速度合格时采用；不能把 Node 原生模块当作 WASM 使用。
- 模型缺失、初始化失败、识别过慢、内存不足或 Worker 崩溃时，自动回到“听原音、录音、回听、自己评分”，不会阻止课程与复习。禁止 Safari / Apple 在线识别和任何云识别。
- 不依赖浏览器 TTS：缺少课程音频时显示下载/重试和离线状态，不能偷偷调用可能联网的语音。
- 学习数据、设置、录音支持完整文件导出/导入，不包含可重新下载的课程与模型。不提供账号、后台或跨设备同步。
- 托管决定（2026-10-29）：公开仓库 YSG-M/EnglishLearningApp，使用 GitHub Pages，地址 https://ysg-m.github.io/EnglishLearningApp/，base `/EnglishLearningApp/`。跳过本地 LAN/iPhone 测试，发布后直接在 Pages 验收。
- 手机生成资源随 git 提交，CI 校验资源并构建 shell/SW，不依赖原 WAV 或 Kokoro。个人录音、学习库和私钥禁止提交。

## 原因

复用已存在的学习流程与共享纯逻辑可以控制迁移范围。专用 Worker 隔离 SQLite 与识别的耗时操作。SQLite 官方文档明确将 SAHPool 用于无法配置隔离响应头、且不需要多标签并发的场景；这是当前设计选择，仍需实际手机验证：[SQLite 持久化说明](https://www.sqlite.org/wasm/doc/trunk/persistence.md)。

WebKit 存储可能被系统回收，持久化请求也不是备份保证，因此必须处理写入失败并提供外部备份：[WebKit 存储策略](https://webkit.org/blog/14403/updates-to-storage-policy/)。

## 验证边界

WASM 识别速度、Whisper 构件可用性、主屏幕麦克风权限、静音开关、录音后扬声器路由和离线冷启动，均未在真实手机验证。完整协议、文件归属与验收见 [Web 架构](../web/architecture.md) 和 [移动界面](../web/mobile-ui.md)。不能用桌面测试通过来宣称手机通过。
