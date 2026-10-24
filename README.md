# 开口说英语 · KaikouEnglish

一款 **Windows 桌面英语口语学习软件**，给生活在新加坡、英语基础比较弱的中文母语成年人每天使用。
主线是"先学整句 → 听原音跟读 → 按遗忘规律复习 → 当天在生活里用一次"，内容围绕新加坡日常生活和补习中心前台工作。
**完全免费、完全离线**：朗读用预先生成的 Kokoro 音频，语音识别用本地 Whisper，学习记录只保存在本机。

A Windows desktop app for daily English **speaking** practice, built for a Chinese-speaking adult beginner
living in Singapore. Free and fully offline: pre-generated Kokoro audio, local Whisper speech recognition,
FSRS spaced repetition, and all learner data kept on the device.

## 快速开始 · Quick start

需要 Node.js 24+（Windows 10/11）。Requires Node.js 24+.

```bash
npm install
npm run models:download -- --with-kokoro   # 语音模型（Whisper 给 app 用，Kokoro 只用于生成课程音频）
npm run content:build                      # content/*.json → resources/content/bundle.json
npm run content:audio                      # 生成课程音频（第一次大约需要几十分钟）
npm run dev                                # 开发模式运行
```

课程还没写完时，可以用 `npm run content:build -- --allow-missing` 只编译已经写好的单元（仅限开发）。

## 常用命令 · Commands

| 命令                       | 作用                                                         |
| -------------------------- | ------------------------------------------------------------ |
| `npm run dev`              | 开发模式运行（热更新）                                       |
| `npm run check`            | 类型检查 + lint + 测试 + 内容校验（提交前跑一遍）            |
| `npm test`                 | 单元测试（不需要语音模型）                                   |
| `npm run content:validate` | 校验课程内容（谐音分级、每个词都在词库里、对话没有死路……）   |
| `npm run content:build`    | 编译课程内容包                                               |
| `npm run content:audio`    | 生成缺少的课程音频；`--limit 5` 试跑，`--prune` 删除过期音频 |
| `npm run models:download`  | 下载 / 准备语音模型                                          |
| `npm run dist`             | 打包 Windows 安装程序（输出到 `release/<版本>/`）            |

## 文档 · Docs

- `CLAUDE.md` — 项目规则（学习者画像、核心原则、开发流程）
- `docs/02-architecture.md` — 技术架构与模块约定
- `docs/dev-setup.md` — 开发环境、打包、升级
- `docs/decisions/` — 技术决定记录（ADR）

## 升级 · Upgrading

没有自动更新。安装新版本时直接运行新的安装程序覆盖旧版本即可；学习记录和录音保存在
`%APPDATA%\KaikouEnglish`，不会丢失。No auto-update: install the new version over the old one; data is kept.
