# 开发环境与打包

## Web / iPhone PWA

Web 入口与桌面命令并存。先准备既有课程 WAV，再运行：

```powershell
npm run web:assets
npm run web:dev
npm run web:build
npm run web:typecheck
npm run web:check
```

可选离线识别资产由 `npm run web:models` 准备；模型缺失不阻止基本课程。静态产物在 `dist-web/`，课程压缩与测量在 `resources/web/`、`resources/web-reports/`，其中 resources/web/ 必须提交，报告和构建产物不提交。npm 安装 ffmpeg-static 后需批准其安装脚本，`package.json` 已记录批准版本。

手机直接使用 Pages HTTPS 地址，按 [iPhone 指南](web/iphone-test.md) 操作。LAN/证书仅供开发排查，见 [资源说明](web/assets.md)。

Windows Codex 沙箱可能使 tsx 的系统用户信息读取报 `uv_os_get_passwd ENOMEM`；这是本机检查环境限制，需授权同一检查在沙箱外运行，不能将跳过的检查算作通过。原桌面搭建和验证命令继续保留如下。

## 1. 环境要求

| 项目    | 版本 / 说明                                                                       |
| ------- | --------------------------------------------------------------------------------- |
| 系统    | Windows 10 / 11 x64（Windows 自带 `C:\Windows\System32\tar.exe`，解压模型要用到） |
| Node.js | 24 或以上（Electron 44 内置的也是 Node 24）                                       |
| npm     | 11 或以上                                                                         |
| 磁盘    | 约 2 GB：依赖 ~600 MB、模型 ~700 MB（含开发用的 Kokoro）、课程音频 ~200 MB        |
| 不需要  | Rust、Python、Docker、任何账号或 API Key                                          |

## 2. 第一次搭建

```bash
npm install
npx electron --version                      # Electron 44 第一次运行时才下载程序本体
npm run models:download -- --with-kokoro
npm run content:build
npm run content:audio
npm run dev
```

说明：

- **npm 11 默认拦截依赖包的安装脚本**。需要的脚本已经写在 `package.json` 的 `allowScripts` 里（electron、esbuild）；
  新增依赖时如果出现 `install-scripts` 警告，用 `npm install-scripts approve <包名>` 批准，确认它真的需要再批准。
- 项目路径里有空格，命令行里的路径都要加引号。
- 不要把中文写在 Git Bash 命令行里（cp1252 会变成 `?`），中文只写进 UTF-8 文件。

## 3. 生成物（都不进 git）

| 路径                                | 由谁生成                                   | 说明                                           |
| ----------------------------------- | ------------------------------------------ | ---------------------------------------------- |
| `resources/content/bundle.json`     | `npm run content:build`                    | app 读取的内容包                               |
| `resources/audio/*.wav`             | `npm run content:audio`                    | 课程音频，文件名 = 声音 + 文本的哈希           |
| `resources/models/whisper-base.en/` | `npm run models:download`                  | 语音识别模型（int8，约 160 MB），会被打包      |
| `.models/`                          | `npm run models:download -- --with-kokoro` | 下载缓存 + Kokoro 模型（只在开发时用，不打包） |

### 3.1 内容包

- `content:build` 失败时会列出所有错误（文件名 + 位置 + 原因）。
- `--allow-missing`：**只用于开发**。只编译已写好的单元：保留从第 1 周开始、连续有内容的周；
  还没写的单元、还有错误的单元 / 拼读文件（比如新词还没加进词库）、还没写的拼读引用都会被去掉，
  并在控制台逐条列出原因。词库和课程总表本身的错误不能跳过。正式打包前必须能不带这个参数编译成功。

### 3.2 课程音频

- 用 Kokoro v0_19 离线生成，16-bit PCM WAV，24 kHz 单声道；语速 0.9（`scripts/audio-generate.ts` 的 `TTS_SPEED`）。
- 只生成缺少的文件。改了句子 → 哈希变了 → 只重新生成那一句。中途中断可以直接重跑（先写 `.tmp` 再改名）。
- `--prune` 删除不再被引用的旧音频；`--force` 全部重新生成（比如改了语速之后）；`--limit N` 试跑。
- 本机实测：Kokoro 生成 4 秒的句子大约 1.8 秒。

### 3.3 语音模型

- 优先复用 `.models/` 里已经下载或解压好的文件；否则从 sherpa-onnx 的 GitHub Release 下载。
- 下载中断后重跑会接着下（HTTP Range）。上游没有提供校验和，所以只按文件大小检查完整性；
  模型目录里的 `manifest.json` 记录了来源和每个文件的大小。

## 4. 检查

```bash
npm run check     # typecheck + lint + test + content:validate
```

GitHub Actions（`.github/workflows/ci.yml`）在 windows-latest 上跑同样的检查，不需要模型和音频。

## 5. 打包安装程序

```bash
npm run models:download
npm run content:build        # 不能带 --allow-missing
npm run content:audio
npm run dist                 # 输出 release/<版本>/KaikouEnglish-Setup-<版本>.exe
```

- 配置在 `electron-builder.yml`：NSIS、x64、按用户安装（不需要管理员权限）、安装界面中文 / 英文。
- 内容包、音频、Whisper 模型通过 `extraResources` 放到安装目录的 `resources/` 下，app 用 `process.resourcesPath` 读取。
- sherpa-onnx 的原生模块（`.node` + DLL）通过 `asarUnpack` 放在 `app.asar.unpacked/`，否则无法加载。
- **没有代码签名**：第一次运行时 Windows SmartScreen 可能提示"未知发布者"，点"更多信息 → 仍要运行"即可。
- **没有自动更新**：升级时直接运行新版本的安装程序覆盖安装。学习记录、录音、设置保存在
  `%APPDATA%\KaikouEnglish`（`app.getPath('userData')`），覆盖安装和卸载都不会删除。
- 还没有自定义图标：放一个 256×256 的 `build/icon.ico` 即可替换 Electron 默认图标。

## 发布到 GitHub Pages

用户已于 2026-10-29 决定使用公开仓库 `YSG-M/EnglishLearningApp`，跳过本地 LAN 测试，直接在 https://ysg-m.github.io/EnglishLearningApp/ 验收。

1. 课程、音频或模型改变时，在有原 WAV 的开发机先运行 `npm run web:build`；将更新的 `resources/web/` 与源码、工作流一起提交。目录只能包含公开课程、音频、模型、许可证和清单，不能放个人录音、学习库或密钥。
2. 由用户检查工作区后执行 `git add .`、`git commit -m "Prepare GitHub Pages deployment"`，再执行 `git switch main`、`git merge feat/v1`、`git push origin main`。若尚无本地 main，先检出远程 main 或创建 main。代理不执行提交或推送。
3. 仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。若仍私有，先在 Settings → General → Danger Zone 将仓库设为 Public。
4. 在 Actions 查看 **Deploy GitHub Pages** 的 build/deploy。初次启用后可点 Run workflow 并选择 main。成功后访问目标地址，按 [iPhone 试用步骤](web/iphone-test.md) 安装并填写结果。当前 GitHub 尚未运行，不能宣称线上通过。
5. 后续合并并推送 main 自动发布。手机联网打开应用，在离线设置检查更新；候选资源完整校验后按提示确认激活并重新打开。离线时继续旧版，个人数据仍在手机；更新前建议导出备份。

CI 使用 Node 24、`npm ci --ignore-scripts`，设置 `WEB_BASE=/EnglishLearningApp/` 后运行 `npm run web:build:ci`。先核验已提交资源全部字节与 SHA-256，再构建 shell/Service Worker 并核验完整产物。跳过安装脚本避免 ffmpeg/Electron 下载，esbuild 使用 npm 平台可选包内二进制；CI 构建不导入转码模块，不读取原 WAV/Kokoro/本机模型缓存。原 Windows `ci.yml` 保持不变。

`resources/web/` 必须提交；`resources/web-reports/`、`dist-web/`、原 WAV、开发模型缓存及 `.certs/` 仍忽略。本地 `web:build` 继续重新生成资源；只改应用代码可直接用 CI 命令。

依据 [GitHub Pages 自定义工作流文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)，工作流使用已发布超过两周的 checkout/setup-node v4、configure-pages v5、upload-pages-artifact v3、deploy-pages v4。
