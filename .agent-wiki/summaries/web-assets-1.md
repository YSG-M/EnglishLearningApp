# web-assets 交接

任务已完成，最终指标和命令结果以 `INDEX.md` 的日期化 Now 为唯一事实位置。未 commit/push，仅修改任务归属与允许共享的 wiki。结束前已重读 board，接入 speech 后继的真实模型/运行时/许可证，并执行用户要求的 wiki 跟踪例外。

## 交付

- `src/web/assets/`：冻结 AssetsClient/DownloadState、清单校验、完整性校验、双并发队列、课程/模型进度隔离、暂停恢复、配额暂停、按周可用性复核、模型缓存、候选更新与确认激活。可选扩展 `getAvailableWeeks/getClipWeeks/getModelState/subscribeModel` 保持 Fake 兼容。
- `src/web/pwa/`：完整音频 Range、416、base 路由、当前 release 离线导航、显式首次校验后接管、更新确认才 skipWaiting。旧已激活 release 保守保留，失败候选才清理，个人库完全不触碰。
- `src/web/index.html/main.tsx`、`public/web/`：浏览器装配、可重试启动、缺音频/手势播放提示、原图标复用尺寸、manifest、苹果图标、目标机型启动图。播放器禁用 TTS。前台空闲继续课程，不用 Background Sync。
- `scripts/web/`（不含 speech 所有的 models-download.ts）：转码、依赖图、摘要清单、静态产物检查、HTTPS server、本地 CA/服务器证书、显式 CA HTTPS 冒烟、原生 Chrome PWA 冒烟。
- 根 package/lock、Vite、TS 与 eslint/ignore 配置；保留桌面命令。桌面 typecheck 的生成缓存写入被忽略的 resources/web-reports，恢复了本轮检查产生的根 tsbuildinfo 噪声。
- `docs/web/assets.md`、`docs/dev-setup.md`：来源、实测报告位置、命令、子路径、证书完全信任、固定 LAN origin、防火墙、未验收项。

## 重现

先确保既有 `resources/audio` 对内容包的全部 WAV 在磁盘。运行 `npm run web:assets`；`npm run web:build`；`npm run web:check`；`npm run check`。本机 Codex Windows 沙箱的 tsx 会报系统用户信息 ENOMEM，使用已批准的沙箱外命令前缀；不是跳过检查。

`node scripts/web/browser-smoke.mjs` 使用已有 Chrome、临时合成 profile 和 localhost 安全上下文，验证真实 SW 缓存与断网加载。HTTPS 按 docs/web/assets.md 建开发 CA，然后 `web:serve`，再用 `https-smoke.ts` 显式信任 CA；本轮服务已停止。所有私钥在 .certs，不能进入 wiki 或提交。

子路径需要 WEB_BASE 环境变量与服务 --base 相同。已实际验证根路径和架构约定子路径；最终 dist-web 恢复为默认根路径，最终 release 见 Now。

## 集成者留意

- Vite 内建可选 manifest 有 Worker 构建问题，已关闭；实际发布清单来自 Vite 输出逐文件扫描，不会漏 Worker/WASM，也不会把资源源目录的失去引用文件当 shell 发布。
- 候选下载必须向网络取 no-store 字节，避免旧 SW 同 URL shell 导致摘要恒不匹配。导航仍保留离线 fallback。
- 暂停测试已修复调度先后假设；最终完整检查已通过，speech 后继旧失败报告已被 Now 取代。
- old release 缓存采用保守保留策略，尚无自动回收；长期升级需更多空间，这是明确限制，不应在集成时擅自清理个人数据或活跃旧窗口资源。
- 页面、数据、模型桌面测试通过不等于手机放行。手机安装 CA/完全信任/主屏幕离线进程冷启动、麦克风/静音开关/扬声器、真实配额和内存均待持有人；最终放行归协调者。
