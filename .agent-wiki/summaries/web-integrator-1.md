# web-integrator 结束交接

日期：2026-10-29。任务 `tasks/web-integrator.md` 已完成，iPhone 持有人验收仍待执行。未 commit/push，未新增依赖，未移除 Electron。最终测试计数、release、布局测量、浏览器结果与临时目录统一在 INDEX Now。

## 阅读与实现

已读 CLAUDE、外部 Project Wiki/Sub-agent 规则、INDEX/reusable、完整 board、六份指定 builders 总结、docs/web 全部原有文档、决定 0008、docs/README 与 progress。根目录 AGENTS.md 不存在；启动 git 核对见到 builders 的未提交变更，未撤销这些改动。沿用本项目 wiki 跟踪例外，不另询问已经授权的集成事项。

修复四个根标签的误返回按钮，子页保持来源返回；下载未知总字节时显示读取清单与 indeterminate progress。导航已有测试加入四根页断言。UI 截图脚本新增汇总/复习与布局断言，把 build/profile 移到系统临时目录。旧 wiki 内浏览器生成目录保留移到 OS temp（位置见 Now），不把它们提交。

生产 main 已静态核对：createAssetsClient → createSpeechClient → await createWebApi → setApi → Provider/App；真实 Worker/WASM/课程清单，禁用浏览器 TTS，无生产 Fake。没有为测试更改生产装配或暴露 API。

## 验证与证据边界

- 最终 `npm run check`、`npm run web:check`、`npm run web:build` 成功，无跳过测试；prettier 与 git diff --check 通过。构建保留 zod PURE 注释警告及原有内容词汇警告。
- `node src/web/ui/validation/capture.mjs` 成功，两种宽度无横向溢出，固定学习栏不遮正文。已亲自查看目标宽度的今天、课程、汇总、复习、我的、设置、句子步骤。
- `node scripts/web/browser-smoke.mjs` 对最终真实 dist 执行新 profile 首周下载、SW 首次接管、真实第一课进入、课程 M4A ended、离线 Range 和重载，成功。首轮仅程序 click 没有用户手势导致播放等待失败；CDP evaluate 加 userGesture 后完整重跑成功，不是跳过。真实解码/播放结束不能替代扬声器听感测试。
- 没有生产假麦克风能力，因此真实 main 的录音→识别链路未测；语音 builder 独立课程 WAV/Worker 证据仍有效但不冒称本轮 E2E。iPhone 无设备，所有真机项目在用户指南留空待填。

## 文档与下一步

ONE 用户中文指南 docs/web/iphone-test.md：固定 LAN IP、命令、防火墙专用网/LocalSubnet、只传 CA 公钥、安装 profile 与开启完全信任、Safari/主屏幕、首次下载/飞行模式进程冷开/静音/录音后音量/权限/识别每句时间/完整备份/横屏键盘安全区与结果表。链接 assets/speech/storage，不复制协议。文档索引、progress、架构过期状态和移动根标签规则已同步。

持有人完成手机表后再考虑删除 Electron 与托管。旧 release 缓存无自动回收、JSON 大备份手机峰值内存、完整上游第三方声明核对仍是已记录限制。没有更改现有产品决定。

## 本轮修改文件（不含 builders 的既有改动）

- `src/renderer/src/App.tsx`
- `src/web/ui/DownloadNotice.tsx`
- `src/web/ui/WebSettings.tsx`
- `src/web/ui/mobile.test.tsx`
- `src/web/ui/validation/capture.mjs`
- `scripts/web/browser-smoke.mjs`
- `docs/README.md`
- `docs/progress.md`
- `docs/web/iphone-test.md`（新增）
- `docs/web/architecture.md`
- `docs/web/mobile-ui.md`
- `docs/web/mobile-validation.md`
- `.agent-wiki/INDEX.md`
- `.agent-wiki/reusable.md`
- `.agent-wiki/tasks/web-board.md`（追加）
- `.agent-wiki/summaries/web-integrator-1.md`（本文件，新增）
- `.agent-wiki/mobile-screenshots/measurements.json`
- `.agent-wiki/mobile-screenshots/428-1.png`
- `.agent-wiki/mobile-screenshots/428-2.png`
- `.agent-wiki/mobile-screenshots/428-3.png`
- `.agent-wiki/mobile-screenshots/428-5.png`
- `.agent-wiki/mobile-screenshots/428-6.png`
- `.agent-wiki/mobile-screenshots/428-7.png`
- `.agent-wiki/mobile-screenshots/428-9.png`
- `.agent-wiki/mobile-screenshots/428-10.png`
- `.agent-wiki/mobile-screenshots/428-11.png`
- `.agent-wiki/mobile-screenshots/428-12.png`
- `.agent-wiki/mobile-screenshots/320-13.png`
- `.agent-wiki/mobile-screenshots/320-14.png`
- `.agent-wiki/mobile-screenshots/320-15.png`
- `.agent-wiki/mobile-screenshots/320-17.png`
- `.agent-wiki/mobile-screenshots/320-18.png`
- `.agent-wiki/mobile-screenshots/320-19.png`
- `.agent-wiki/mobile-screenshots/320-21.png`
- `.agent-wiki/mobile-screenshots/320-22.png`
- `.agent-wiki/mobile-screenshots/320-23.png`
- `.agent-wiki/mobile-screenshots/320-24.png`

构建也重写被忽略的 resources/content、resources/web、resources/web-reports、dist-web；不作为源码修改交付。原 `.agent-wiki/mobile-preview/` 与 `.agent-wiki/mobile-chrome/` 下临时生成树整体保留移出仓库，不逐条把浏览器内部文件列成源码。未触碰个人学习数据或证书。
