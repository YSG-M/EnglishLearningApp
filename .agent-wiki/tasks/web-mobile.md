# 任务：web-mobile（Codex）

你是 coordinator-web 的构建子代理，负责为 iPhone 主屏幕重新组织 React 界面，保持原学习逻辑。

## 先读（按顺序）

1. `CLAUDE.md`。
2. `D:\Tools\Claude Work Rule\Project Wiki and Sub-agent rule.md`。
3. `.agent-wiki/INDEX.md`、`.agent-wiki/reusable.md`、`.agent-wiki/tasks/web-board.md`。
4. `docs/progress.md`、`docs/decisions/0008-web-pwa-iphone.md`、`docs/02-architecture.md`、`docs/web/architecture.md`、`docs/web/mobile-ui.md`（全部）。
5. `src/shared/ipc.ts`、`src/renderer/src/App.tsx`、`state/**`、`pages/**`、`features/**`、`components/**`、`styles/global.css`、`api/**`、`test-utils.tsx`；只读语音文件了解组件契约。

## 硬规则与归属

- 不 commit、不 push；文档/界面简体中文、代码/注释英文，UTF-8 无 BOM、LF。
- 写 `src/web/ui/**` 和 `src/renderer/src/**`，但**不写** `audio/**`、`hooks/useRecorder.ts`、`hooks/usePlayer.ts`、`components/SpeakPanel.tsx`（含其新增测试），这些归 speech。不写 src/web/main.tsx/index.html、根配置、shared、main、脚本。
- 自己模块文档为 `docs/web/mobile-validation.md`；wiki 只改自己的行、总结和追加 board。
- 不增加依赖。根配置需求交 assets；语音需求交 speech；API/备份需求交 storage。

## 交付

1. 428×926 竖屏主屏幕布局：safe area、100dvh、独立内容滚动、四底部标签、每页返回、学习全屏与固定下一步、44 px 触摸区、16 px 输入、键盘适配；严格按 mobile-ui 页面映射。
2. 所有原页面功能可达：今天、课程/再上一次、三类复习、速查、进度、设置、课程五种 part、拼读、单元/周汇总和两种故事。我的入口容纳速查/进度/设置，不丢页。
3. 导出 `src/web/ui/WebServices.tsx` Provider，接受架构规定 `{assets,speech,backup}`，测试可注入 Fake 服务；桌面无该 Provider 时保持已有学习页面可启动，不要求 Electron 才能渲染。
4. 下载进度/周离线状态、独立模型 opt-in（Wi-Fi 提示）、安装说明、更新入口、完整备份导出/inspect/确认替换导入/重载，使用架构中的客户端，不在 UI 另建存储。备份文件下载/分享必须在用户操作下进行。
5. 缺音频、识别失败、麦克风拒绝、空间不足和保存失败均有可理解的中文提示。页面不能把下载已准备称为已落盘成功，也不能在存储失败时前进到完成页。
6. 对 SpeakPanel 只通过 props 和通用 CSS 布局，变更需求发 board。识别刷新沿用 AppContext；用户手动启用模型后刷新 speech 状态。首句由用户点播放，不依赖自动播放。

## 验收

- `npx vitest run src/renderer/src src/web/ui`，沿用 mockApi/Fake WebServices；测试四标签、返回来源、全部页面入口、下载暂停恢复、模型下载独立、备份 inspect 拒绝/成功和原学习行为。语音专属测试由 speech 负责。
- 配置就绪后 `npm run typecheck`、`npm run web:typecheck`。不得通过删旧测试、跳过测试掩盖回归。
- 浏览器 428×926 与窄屏检查：无横向滚动、最后一行不被固定栏覆盖、键盘不挡输入、内容可滚动；截图与未测真机项写 `docs/web/mobile-validation.md`。没有手机不能声称主屏幕 safe area/麦克风已实测。

## 结束

核对 Now/git status，自己行设 active；坑即写 reusable。约 68% 写 `.agent-wiki/summaries/web-mobile-1.md` 与 HANDOFF。结束前读 board、写总结、自己的行设 ended、追加 `STATUS web-mobile: DONE`；任何失败如实列出并通知协调者。
