# 手机界面验证

日期：2026-10-29。实现遵循 [移动界面规范](mobile-ui.md) 和 [Web 架构](architecture.md)。本页记录 web-mobile 的检查范围；本地测试数量与团队状态以 `.agent-wiki/INDEX.md` 的 Now 为准。

## 已实现

- 今天 / 课程 / 复习 / 我的四标签；我的保留速查、进度和设置。今天保留速查快捷入口。页面顶部可返回，汇总与学习页面保留来源。
- 安全区环境变量、`100dvh` 回退、独立 main 滚动、44 px 点击区、16 px 以上输入、学习与复习固定操作栏。VisualViewport 调整可见高度和操作栏偏移。
- 按周折叠课程，默认打开当前周；单元与周汇总、两种故事、单词表可折叠；历史对话可展开。五种课程 part、拼读及三类复习沿用原内容与学习逻辑。
- 原音首次需点击；WebServicesProvider 注入 assets/speech/backup，桌面及 Mock 页面无需此 Provider。播放器通过 Provider 注入浏览器资源解析和中文缺音频/手势提示。
- 第一次课程准备进度、暂停/继续、逐周真实缓存校验；模型独立启用与 Wi-Fi 提示；安装说明和用户触发更新。
- 完整备份先准备，再由用户点击下载或分享，不声称文件已落盘。导入先 inspect，显示日期与录音数，先准备并点击下载当前备份，再确认替换，恢复后重新打开。
- 复习等待提交成功后允许下一张，失败可重试。挑战必须录音、点击回听、手动保存成功后才能完成。设置只在保存成功后更新显示，失败保留中文提示。

## 自动检查

已运行并通过：

```text
npx vitest run src/renderer/src src/web/ui
npm run typecheck
npm run web:typecheck
npx eslint src/web/ui src/renderer/src
```

测试保留已有学习行为，新增四标签与返回来源、个人页面入口、两种汇总与故事、五种 part、下载暂停恢复、模型独立下载、备份 inspect 拒绝与确认恢复，以及复习/挑战保存失败阻止前进的覆盖。语音专项测试由 speech 构建者负责。

## 浏览器布局与截图

可重复命令（本机已有 Chrome，不新增依赖）：

```text
node src/web/ui/validation/capture.mjs
```

脚本用独立 Mock API / WebServices、Vite 临时构建、原生 Node HTTP 和 Chrome CDP，不打开真实个人存储，不下载模型。Chrome 隐藏运行；临时构建和独立浏览器 profile 位于系统临时目录。wiki 已按用户决定纳入 Git，只保留合成截图与测量记录。

集成者重新运行 428×926 与 320×926 检查今天、课程、单元汇总、复习、我的、设置、速查、课程介绍和第一句学习步骤：document 与 main 均无横向溢出，shell 高度匹配视口；设置长页可独立纵向滚动。脚本断言根标签无返回按钮，学习正文末尾位于固定操作栏上方。428×926 今天、课程、汇总、复习、我的、设置及学习步骤已逐页人工查看。

本地证据（不作为发布资源提交）：

- [测量记录](../../.agent-wiki/mobile-screenshots/measurements.json)
- [428 今天](../../.agent-wiki/mobile-screenshots/428-1.png)
- [428 汇总](../../.agent-wiki/mobile-screenshots/428-3.png)
- [428 复习](../../.agent-wiki/mobile-screenshots/428-5.png)
- [428 我的](../../.agent-wiki/mobile-screenshots/428-6.png)
- [428 设置](../../.agent-wiki/mobile-screenshots/428-7.png)
- [428 学习步骤](../../.agent-wiki/mobile-screenshots/428-12.png)
- [320 设置](../../.agent-wiki/mobile-screenshots/320-19.png)
- [320 学习步骤](../../.agent-wiki/mobile-screenshots/320-24.png)

尝试隐藏 Electron 浏览器加载本地预览时返回 `ERR_FAILED`，没有计为截图通过；改用 Chrome CDP 后完成上述检查。

## 待真机及集成验证

没有真实 iPhone，以下均未实测：主屏幕安全区、Safari 软键盘与 VisualViewport、横屏、麦克风权限、静音开关、录音后扬声器路由、真实离线冷启动、OPFS 持久化与完整备份恢复。桌面 Chrome 的布局测量不能替代这些项目。

模型下载客户端已接入；speech 后继已验证真实桌面 Chrome 的单线程 Whisper runtime，详见 [语音说明](speech.md)。iPhone 识别可用性与性能仍未验证。UI 保留录音、回听、自评，不用云识别。

完整 Web 启动、Service Worker 更新与真实课程缓存/空间不足场景由后续整合验收；本页自动测试使用 Fake 服务，不把 Mock 成功视为真实存储成功。
