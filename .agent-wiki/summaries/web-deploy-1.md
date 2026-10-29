# web-deploy 结束交接

日期：2026-10-29。任务已完成，本地验证通过；GitHub/Pages 与 iPhone 尚未运行。没有 commit、push、修改 GitHub 设置或添加依赖。计数、release、实测路径与命令结果统一见 INDEX Now。

## 实现与验证

已读任务全部指定文件（包括 scripts/web 全部脚本）、CLAUDE、外部 Wiki 规则、INDEX/reusable、board、两份前任交接及 progress/dev-setup。根 AGENTS.md 不存在。工作区含前任全部未提交变更，未撤销或提交它们。

`web:build:ci` 先用 verify --source 核对已提交资源，单独构建 app shell/Service Worker，再核对全部输出。将摘要/文件工具移到 asset-files，CI 不再间接导入 ffmpeg-static；本地 web:build 仍先完整生成资源。resources/web 取消忽略，所有原始 WAV、开发模型、证书、报告和 dist 继续忽略。检查目录仅有公开课程生成资产、固定来源模型/运行时/许可证及图像；JSON/TXT 未发现绝对开发机路径、秘密或个人数据。二进制来源沿用前任固定来源，不把课程合成音频当个人录音。

Pages 工作流使用 ubuntu-latest/Node 24，main push 与 workflow_dispatch，npm ci --ignore-scripts，Pages base，configure/upload/deploy，专用环境和最小权限、pages 并发。手动选择非 main 可构建但不部署。未改原 ci.yml。跳过安装脚本消除 ffmpeg/Electron 下载，esbuild 平台可选包仍由 npm 安装。官方 GitHub API 发布日期已核对在 Now；工作流参考 [GitHub 官方文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

干净复现工具 ci-smoke 复制 tracked + unignored untracked 文件到 OS temp（此时尚未 commit），断言不含原 WAV/模型缓存/证书；npm ci 后断言 ffmpeg 二进制不存在，再执行子路径 CI build 和真实 Chrome smoke。全部成功。本机是 Windows，不能声称 Linux runner 已实跑；Linux 使用同锁文件的原生平台可选依赖机制，实际 GitHub 结果待用户首次推送。安装报告既有 2 high vulnerabilities，未擅自更新依赖。

完整本地 build 与 CI 副本生成同一 release；check/web:check 均成功，无跳过；format/diff 检查通过。首次 lint 因新 mjs 的 console/process 未显式导入失败，已修复后重跑。Zod PURE 与既有内容词汇警告保留。Chrome 证明真实第一课音频 ended、首周缓存、首次 SW、离线 Range/重载；不是生产麦克风或 iPhone 证明。

手机指南直接打开 Pages，分享→添加到主屏幕；保留检查表、可选机型/iOS，删除固定网址栏，新增影响和彻底删除说明。旧电脑/LAN/CA/防火墙操作完整保留在 assets 开发者段；用户本轮跳过 LAN。

## 本轮全部修改文件

- `.gitignore`
- `package.json`
- `.github/workflows/pages.yml`（新增）
- `scripts/web/asset-files.ts`（新增）
- `scripts/web/asset-build.ts`
- `scripts/web/build.ts`
- `scripts/web/verify.ts`
- `scripts/web/ci-smoke.mjs`（新增，可重复执行）
- `docs/web/assets.md`
- `docs/web/iphone-test.md`
- `docs/dev-setup.md`
- `docs/decisions/0008-web-pwa-iphone.md`
- `docs/progress.md`
- `.agent-wiki/INDEX.md`
- `.agent-wiki/reusable.md`
- `.agent-wiki/tasks/web-board.md`（追加）
- `.agent-wiki/summaries/web-deploy-1.md`（本文件）
- `.agent-wiki/summaries/web-deploy-assets.txt`（新增；逐行列出每个待跟踪资源文件）
- `resources/web/` 下全部待跟踪文件：完整逐文件清单见 [web-deploy-assets.txt](web-deploy-assets.txt)，包含课程 M4A、content bundle、model/runtime/licenses、安装图像及 manifest。本轮完整 build 没有新增转码；它们从 ignored 变为待用户添加，尚未 git add。

package-lock.json 与 ci.yml 未被本轮修改；锁文件原已有前任变更。临时文档生成 Python 脚本已移除，不作为交付。dist/resources/content/reports 为被忽略的构建结果。

## 用户精确操作

1. 核对全部工作区（含 builders 的既有变更）与待提交资源，运行 `git add .`，然后 `git commit -m "Prepare GitHub Pages deployment"`。
2. `git switch main` → `git merge feat/v1` → `git push origin main`。若没有本地 main，先检出远程 main 或创建 main；保留提交后的完整工作。
3. 仓库若仍私有，在 Settings → General → Danger Zone 将其设为 Public。Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。
4. Actions → **Deploy GitHub Pages** 查看 build/deploy；若初次 push 早于启用 Pages 导致失败，启用后 Run workflow，选择 main。
5. 成功后用 iPhone Safari 打开 https://ysg-m.github.io/EnglishLearningApp/ → 分享 → 添加到主屏幕，按 docs/web/iphone-test.md 填表。无需电脑或本地证书。
6. 后续更新先提交/合并/push main。手机联网，在离线设置检查更新，完整下载校验后确认激活并重开。课程改变时先在开发机运行 web:build 并提交 resources/web 的更新；重要个人记录先导出备份。

本任务 DONE 表示交付发布配置和本地复现，不表示 GitHub 已部署或 iPhone 已放行。完整上游第三方构建声明、旧 release 无自动回收与手机大备份/内存限制仍按既有记录保留。
