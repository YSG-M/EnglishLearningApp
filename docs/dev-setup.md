# 开发环境与打包

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
