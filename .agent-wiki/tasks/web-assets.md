# 任务：web-assets（Codex）

你是 coordinator-web 的构建子代理，负责静态构建、压缩音频、资源下载、PWA/Service Worker、装配入口和本地 HTTPS。

## 先读（按顺序）

1. `CLAUDE.md`。
2. `D:\Tools\Claude Work Rule\Project Wiki and Sub-agent rule.md`。
3. `.agent-wiki/INDEX.md`、`.agent-wiki/reusable.md`、`.agent-wiki/tasks/web-board.md`。
4. `docs/progress.md`、`docs/decisions/0008-web-pwa-iphone.md`、`docs/02-architecture.md`、`docs/web/architecture.md`（完整，尤其客户端、缓存、命令与 HTTPS）、`docs/web/mobile-ui.md`。
5. `package.json`、锁文件、`tsconfig*`、`vitest.config.ts`、`eslint.config.*`、`.gitignore`、`scripts/content-build.ts`、`scripts/audio-generate.ts`、`scripts/lib/**`、`src/shared/content/bundle.ts`、`src/shared/ipc.ts`、`src/renderer/src/main.tsx`、`src/renderer/src/api/client.ts`、`docs/dev-setup.md`。

## 硬规则与归属

- 不 commit、不 push；文档简体中文、代码/注释英文；UTF-8 无 BOM、LF，不在 Git Bash 命令行写中文。
- 独占 `src/web/assets/**`、`src/web/pwa/**`、`src/web/index.html`、`src/web/main.tsx`、`public/web/**`、`scripts/web/**`（**排除** `models-download.ts`，归 speech）；根 package/lock、`vite.web.config.ts`、`tsconfig*`、`vitest.config.ts`、`eslint.config.*`、`.gitignore`；文档 `docs/web/assets.md`、`docs/dev-setup.md`。不可编辑 renderer/storage/speech/shared/main。
- 新依赖仅 Now 批准的 `@sqlite.org/sqlite-wasm` 与 `ffmpeg-static`（dev），你统一安装/锁版本；sherpa WASM 下载由 speech 脚本负责，不新增 npm 包。无批准其他包就报 BLOCKED。保留原桌面命令与检查。

## 交付

1. Vite 静态 Web 入口、浏览器/Worker 类型检查与测试配置；按架构交付 web:assets/dev/build/serve/typecheck/check/models 命令。不要依赖 Electron dev server。将新生成目录与证书/私钥排除 git。
2. ffmpeg-static WAV → mono AAC M4A 40 kbps，保留 clipKey 与内容哈希路径；重复构建只更新变化文件，编码参数变化产生新 URL。实测大小与时长，不能复制预测值。
3. 构建校验的 web-manifest.json、完整 clip→week 依赖图、内容与 shell 摘要、模型清单接入点。引用缺失或重复冲突时构建失败。模型构件不阻塞基本课程构建；不可用时明确未包含，不造假资源。
4. 架构第 2 节 AssetsClient/types：课程与模型分开进度，完整性校验后记成功、并发 2、暂停恢复与配额处理；首次 shell/content/week1，后续前台空闲下载。不能依赖 iOS Background Sync。
5. Service Worker：base/scope 一致，完整音频缓存与 Range 206/416，断网导航回当前 release，候选更新完整后用户确认激活；保留活跃旧客户端资源，失败退回旧版。缓存清理不碰个人存储。
6. manifest.webmanifest、apple-touch-icon、status-bar、竖屏声明、startup image 和启动页；已有 icon 可复用/生成尺寸，不加无批准图像依赖。
7. main.tsx 装配 createAssetsClient → createSpeechClient → createWebApi → setApi/configurePlayer → WebServicesProvider/App；按冻结签名先用 Fake 接入，不能改其他构建者文件。启动失败可见并可重试。
8. Node 原生 HTTPS 静态服务，证书步骤、固定 LAN origin、手机安装/完全信任根 CA、专用网络防火墙说明。密钥不提交，不为方便关闭 TLS 校验或防火墙。实际安装信任由手机持有人完成，未执行就写未测。
9. `docs/web/assets.md` 和 dev-setup 记录命令、来源、产物、实测、手机步骤与未通过项。

## 验收

- `npx vitest run src/web/assets src/web/pwa`：Fake fetch/cache，校验失败不记成功、缺文件构建失败、暂停恢复、Range/416、子路径、更新中断/旧缓存保护。
- `npm run web:assets` 连跑两次核对幂等；`npm run web:build` 验证全清单文件与摘要、WASM MIME、无 Node/Electron/native sherpa 运行时导入。
- `npm run web:typecheck`、`npm run web:check`、原 `npm run check`；依赖尚未整合导致失败时记录具体错误，等待/通知对应构建者，不跳过。
- 用 web:serve 本地 HTTPS 实测静态响应与 Range，真机步骤记录但没有手机不宣称通过。最终放行由协调者整合。

## 结束

先核对 Now/git status，自己行设 active。发现坑立刻写 reusable；约 68% 写 `.agent-wiki/summaries/web-assets-1.md` 并 HANDOFF。结束前读 board、写总结、行设 ended、追加 `STATUS web-assets: DONE`；任何未完成阻塞必须精确说明。
