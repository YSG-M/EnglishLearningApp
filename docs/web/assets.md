# Web 资源、PWA 与本地 HTTPS

本模块实现入口为 `src/web/main.tsx`，构建与服务脚本位于 `scripts/web/`，下载契约见 `src/web/assets/types.ts`。项目仍保留桌面命令。依赖以根 `package.json` 和锁文件为准；只新增已批准的 SQLite WASM 与开发时使用的 ffmpeg-static。

## 命令与来源

```powershell
npm run web:assets
npm run web:dev
npm run web:build
npm run web:typecheck
npm run web:check
npm run check
npm run web:models
```

`web:assets` 先运行原内容编译，再读取实际引用的 WAV。内容由既有人工课程编译而来，原音为项目的 Kokoro 生成结果；没有调用云语音。ffmpeg-static 转为 AAC、mono、40 kbps、M4A faststart。输出路径同时保留 clipKey 和源 WAV / 编码参数 / 编码工具版本的摘要；内容文件、音频或编码参数改变会得到新 URL。写文件使用临时文件与改名；相同字节不重写。重复运行会重新核对输入与测量，不重新编码已经存在的对应文件。

生成位置：

| 位置                                     | 用途                                          |
| ---------------------------------------- | --------------------------------------------- |
| `resources/web/content/`                 | 带字节摘要的内容包                            |
| `resources/web/audio/`                   | 带编码指纹的 M4A                              |
| `resources/web/models/`                  | 可选模型与浏览器运行时文件                    |
| `resources/web/web-manifest.json`        | 内容/音频/模型资源清单                        |
| `resources/web-reports/measurement.json` | 本机实测字节、WAV 时长与编码后解码时长        |
| `resources/web-reports/measure.ffconcat` | 实测时长使用的本地播放列表，不发布            |
| `dist-web/`                              | 完整可发布静态站点，含 shell/Worker/WASM 摘要 |

测量脚本解析实际 WAV RIFF fmt/data chunk，并让 ffmpeg 解码完整 M4A 播放列表，读取最终进度时长，不使用预计压缩率。当前实测与检查计数只记录在本地 wiki `INDEX.md` 的日期化 Now 块；原始测量结果在上表报告中。报告不包含孤立的旧 WAV。重复构建实测没有新增转码。

构建遍历单元、词库、token 词引用、拼读、周故事、挑战，形成 clip→weeks 依赖图。没有被排课引用的速查词归入首周离线库。引用缺失、源文件缺失、重复 clipKey、重复 URL、非法路径、长度/摘要不符都失败。模型可不准备；缺失时 `modelsIncluded:false`，课程照常构建。模型接入文件为 `resources/web-models/manifest.json`，每项包含 `url/modelId/path/bytes/sha256`；路径必须位于 `models/`，构建会复核字节。模型文件存在不等于识别引擎已通过手机验收，语音状态由 speech 模块决定。

`web:build` 从当前 Vite 输出自动收集所有 shell、CSS、Worker、WASM、安装图像，加入必需清单并重算 releaseId。不发布资源生成目录中失去引用的旧文件。`verify.ts` 复核每个清单文件与摘要，并扫描 Node/Electron/native sherpa 运行时导入。Vite 自带可选 manifest 在本机 Worker 构建出现 `entryCssReferenceIds is not iterable`，因此关闭它，清单直接从实际输出生成。Zod 的 PURE 注释位置警告不影响构建结果。

## 下载和更新

AssetsClient 的课程进度和每个模型进度独立；共用最多两个并行网络请求。只有完整 200 响应通过长度和 SHA-256 校验并写入 CacheStorage 后才增加完成进度。暂停会取消在途请求；恢复时重新验证已存文件。配额不足暂停可重新下载的资源，保留学习库与录音。`getAvailableWeeks` 逐文件校验缓存，不能从课程标题或全局 ready 推断离线可用。

首次下载 shell、内容、SQLite WASM 与首周完整依赖。校验后显式请求初始 Service Worker 接管，保证当前页面在第一次安装后也能访问离线音频。后续课程在前台空闲时开始；页面关闭会停止，下次重开恢复。用户可通过离线设置手动下载/继续，不使用 Background Sync。

Service Worker 缓存完整音频，并从完整响应生成单段 Range 206；无效/越界范围返回 416。导航尝试网络，网络响应也必须匹配当前 release 的 index 摘要，否则回当前已激活 index，避免部署了一半或断网时混用新版 shell。

检查更新先下载新 release 与已经承诺离线的周，完整后才报告候选。用户点击激活前不改变活动指针，不无条件 skipWaiting/claim；确认时再次校验，成功后改指针并重新打开。失败删除候选缓存，旧版仍可使用。为保护旧窗口的延迟加载资源，本版保守保留所有已激活旧 release 缓存；没有自动回收旧 release，长期升级可能需要更多空间，这是当前限制。清理候选和模型只操作静态 CacheStorage，绝不访问个人 IndexedDB/OPFS。

## 开发者专用：LAN / HTTPS（本次跳过）

先在路由器为电脑保留固定内网地址，确定端口和 base。改变 scheme/主机/端口会改变个人存储 origin；不要随意更换。默认根路径；子路径构建与服务必须一致：

```powershell
$env:WEB_BASE = '/EnglishLearningApp/'
npm run web:build
npm run web:serve -- --host 0.0.0.0 --port 4173 --base /EnglishLearningApp/ --cert .certs/server.pem --key .certs/server.key
```

根路径测试时移除该环境变量并重建。`web:dev` 是 localhost 浏览器开发服务，不代表 iPhone 已能安装。服务仅使用 Node HTTPS，正确输出 WASM MIME、Range、SW scope 与缓存响应头，不依赖 Electron。

使用本机已有 OpenSSL（脚本也能找到 Git 自带程序；其他位置可设置 `OPENSSL_PATH`）：

```powershell
npx tsx scripts/web/certificates.ts --lan-ip 192.168.1.20
npm run web:serve -- --host 0.0.0.0 --port 4173 --cert .certs/server.pem --key .certs/server.key
```

将示例 IP 换成固定的实际局域网 IPv4。脚本在 `.certs/` 创建开发根 CA、带 LAN IP/localhost SAN 的服务器证书和公钥 DER `ca.cer`；保留已有 CA，不覆盖已有服务器私钥。需要换 IP 时先明确移走旧服务器 key/pem/csr，保留 CA，再重新生成。目录只允许本机用户读取，私钥绝不传到手机、不提交 Git。手机只接收 `.certs/ca.cer` 公钥证书。

1. 电脑和 iPhone 连同一专用 Wi-Fi。仅为 Node 的指定端口添加 Windows 专用网络入站规则，范围为 LocalSubnet；不关闭防火墙，不向公网映射端口。
2. 手机持有人打开 CA 公钥证书，安装下载的描述文件；随后进入“设置 → 通用 → 关于本机 → 证书信任设置”，为开发根证书开启完全信任。
3. Safari 打开固定 `https://<LAN-IP>:4173/<base>/`，确认无证书警告、`isSecureContext` 为 true，再检查麦克风授权。
4. 点击分享 → 添加到主屏幕。安装图标、maskable 图标及 iPhone 14 Plus portrait startup image 均复用仓库现有图标生成；应用清单声明竖屏，但横屏仍需能操作。
5. 等待首周明确离线可用，开启飞行模式，杀掉后从主屏幕重开，再验证播放、录音、回听、自评、完成课、备份及恢复。手机信任与这些步骤由持有人执行，当前均未测试。

本地自动 HTTPS 冒烟使用专用 loopback 证书，Node 请求显式提供 CA 并保持 TLS 校验：

```powershell
npx tsx scripts/web/https-smoke.ts --origin https://127.0.0.1:4173/ --ca .certs/ca.pem
```

原生 Chrome PWA 冒烟使用单独的临时合成 profile 和 localhost 安全上下文，不关闭证书校验、不写入系统信任库：`node scripts/web/browser-smoke.mjs`。它验证首周缓存、首次接管、离线 Range 与离线页面重载；不能代替 iPhone 主屏幕进程冷启动。结果和未通过项以 wiki Now 及交接总结为准。

### 原 LAN 用户步骤（仅开发排查）

## 电脑准备（只需首次设置）

在路由器中给电脑保留一个固定的局域网 IPv4 地址。下面以 `192.168.1.20` 为例，请换成电脑实际地址。以后保持地址和端口相同，否则手机会进入另一份本地数据空间。

在项目文件夹打开 PowerShell，依次运行：

```powershell
Remove-Item Env:WEB_BASE -ErrorAction SilentlyContinue
npm run web:build
npx tsx scripts/web/certificates.ts --lan-ip 192.168.1.20
```

生成证书只运行一次。若提示服务器证书已存在，请先核对它是否对应这个固定地址；不要直接删除证书重试。更换地址的处理见 [资源与 HTTPS 说明](assets.md#https-与手机步骤)。

将家里的可信 Wi-Fi 在 Windows 中设为“专用网络”。以管理员身份打开 PowerShell，添加一条仅允许本地局域网访问的规则：

```powershell
New-NetFirewallRule -DisplayName 'Kaikou LAN HTTPS' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 4173 -Profile Private -RemoteAddress LocalSubnet
```

不要关闭整个防火墙，不要在路由器上做公网端口映射。回到项目文件夹的普通 PowerShell，启动服务并保持窗口打开：

```powershell
npm run web:serve -- --host 0.0.0.0 --port 4173 --cert .certs/server.pem --key .certs/server.key
```

以后每次测试只需运行上面的服务命令；代码更新后先重新运行 `npm run web:build`。

## 在 iPhone 安装并信任证书

只把电脑项目里的 `.certs/ca.cer` 传到手机（例如通过你自己可用的文件传输方式）。不要传 `.key` 私钥或整个 `.certs` 文件夹。

1. 在手机打开 `ca.cer`，按系统提示下载描述文件。
2. 打开“设置”，进入“已下载描述文件”；若没有这个入口，在“通用 → VPN 与设备管理”查找。安装 **Kaikou Local Development CA**，输入手机锁屏密码。
3. 打开“设置 → 通用 → 关于本机 → 证书信任设置”，为这个根证书开启**完全信任**并确认。
4. 用 Safari 打开 `https://192.168.1.20:4173/`（替换成实际地址）。如果仍有证书警告，先检查地址与证书信任，不要跳过警告继续录音。
5. 点 Safari 的“分享 → 添加到主屏幕”。以后从主屏幕的应用图标进入。

## 发布到 GitHub Pages

用户已于 2026-10-29 决定使用公开仓库 `YSG-M/EnglishLearningApp`，跳过本地 LAN 测试，直接在 https://ysg-m.github.io/EnglishLearningApp/ 验收。

1. 课程、音频或模型改变时，在有原 WAV 的开发机先运行 `npm run web:build`；将更新的 `resources/web/` 与源码、工作流一起提交。目录只能包含公开课程、音频、模型、许可证和清单，不能放个人录音、学习库或密钥。
2. 由用户检查工作区后执行 `git add .`、`git commit -m "Prepare GitHub Pages deployment"`，再执行 `git switch main`、`git merge feat/v1`、`git push origin main`。若尚无本地 main，先检出远程 main 或创建 main。代理不执行提交或推送。
3. 仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。若仍私有，先在 Settings → General → Danger Zone 将仓库设为 Public。
4. 在 Actions 查看 **Deploy GitHub Pages** 的 build/deploy。初次启用后可点 Run workflow 并选择 main。成功后访问目标地址，按 [iPhone 试用步骤](iphone-test.md) 安装并填写结果。当前 GitHub 尚未运行，不能宣称线上通过。
5. 后续合并并推送 main 自动发布。手机联网打开应用，在离线设置检查更新；候选资源完整校验后按提示确认激活并重新打开。离线时继续旧版，个人数据仍在手机；更新前建议导出备份。

CI 使用 Node 24、`npm ci --ignore-scripts`，设置 `WEB_BASE=/EnglishLearningApp/` 后运行 `npm run web:build:ci`。先核验已提交资源全部字节与 SHA-256，再构建 shell/Service Worker 并核验完整产物。跳过安装脚本避免 ffmpeg/Electron 下载，esbuild 使用 npm 平台可选包内二进制；CI 构建不导入转码模块，不读取原 WAV/Kokoro/本机模型缓存。原 Windows `ci.yml` 保持不变。

`resources/web/` 必须提交；`resources/web-reports/`、`dist-web/`、原 WAV、开发模型缓存及 `.certs/` 仍忽略。本地 `web:build` 继续重新生成资源；只改应用代码可直接用 CI 命令。

依据 [GitHub Pages 自定义工作流文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)，工作流使用已发布超过两周的 checkout/setup-node v4、configure-pages v5、upload-pages-artifact v3、deploy-pages v4。
