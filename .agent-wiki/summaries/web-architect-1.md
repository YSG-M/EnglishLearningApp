# web-architect 交接

日期：2026-10-29。状态：设计任务完成，未编写实现代码，未安装依赖，未 commit/push，未启动构建子代理。

## 已完成

- 按任务书顺序阅读项目规则、外部 wiki 规则、wiki/board、进度、架构、决定和 AppApi，检查工作树/分支并浏览 main 与 renderer 的关键实现。
- 决定 `docs/decisions/0008-web-pwa-iphone.md`：记录 Web 替代桌面、离线识别/自评回退、压缩课程音频、静态资源下载、完整备份与局域网 HTTPS。
- `docs/02-architecture.md` 链接新增 `docs/web/architecture.md`，明确本轮 Web 与保留的桌面说明边界。
- Web 架构定义 AppApi 浏览器实现、四个构建者的互斥文件归属、装配导出名称、AssetsClient/SpeechClient/BackupClient、SQL Worker 与 Speech Worker 协议、OPFS/IndexedDB、备份代际恢复、资源清单/Range/更新流程、未来命令与验收。
- `docs/web/mobile-ui.md`：四标签、我的入口、每页返回、学习步骤固定下一步、安全区/键盘/字体、全部原页面映射、下载/识别/备份与真机验收。
- 四份独立任务书：`tasks/web-storage.md`、`web-speech.md`、`web-mobile.md`、`web-assets.md`。INDEX 四行 planned，协调者之后启动。未增加第五个构建者，最终共享改动与整合由协调者负责。

## 重要实现注意

1. 实际类型名 AppApi；原 setApi 已能注入浏览器实现。共享 ipc.ts 不改，player 注入 URL resolver。
2. SQLite 用单 Worker SAHPool，防止第二窗口抢占；不要照搬 Node DB 或 WAL。SQL migration 可复用；具体 Database 类型耦合需要适配。
3. 录音文件先 IndexedDB、后 SQL 索引；导入用 generation 防跨库事务中断。完整备份含所有被索引录音，不能只导出设置/卡片。
4. 模型网络/cache 属 assets；speech 选择和加载模型；初次课程包不包含模型。禁止 SpeechRecognition/在线 TTS 兜底。
5. 音频 Range 必测；iOS 后台下载不能保证应用挂起后继续；保留前台队列与重开恢复。
6. 根 package、lock、tsconfig、入口全部由 assets 独占，其他人通过 board 请求。

## 风险与待验证

- 尚未确认可直接分发的 Whisper 单线程 sherpa WASM 构件组合；官方 WASM 文档存在，但展示的模型不能作为 Whisper 的成功证据。speech 优先验证；若受阻明确 BLOCKED，同时实现录音/回听/自评。
- 没有真机验证 iOS 版本、OPFS、麦克风重复权限、静音开关、录音后的扬声器路由、内存/识别速度、启动图和杀进程离线启动。
- HTTPS 的根 CA 安装/信任需由手机持有人操作；LAN origin 变化会改变数据空间，先固定地址。
- 压缩大小和下载耗时需实际构建后测量，未复制预测值为测量结论。
- 备份 JSON 的 base64 内存增长需压力测试；当前设计限制导入 100 MiB，超限可后续由证据调整，不能静默截断数据。

## 需要用户决定

当前无必须重开的产品决定。托管选择按已定安排延后；真实手机测试时需要手机持有人完成证书信任、主屏幕安装和反馈。任何新增非批准依赖需另行报批，不推定授权。

## 验证范围

本轮仅文档和 wiki；进行文档格式与差异检查，具体命令结果见 board。未运行 Web 构建或真实模型，不声称实现、自动化测试或手机验证通过。协调者需把新文档加入 docs/README 并在开始实现/阶段结束更新 progress；这些共享文件未由架构角色擅改。
