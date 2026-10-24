# 0001 · 桌面框架：Electron + React + TypeScript

- 状态：已采纳
- 日期：2026-10-24

## 背景

需要一个 Windows 桌面应用：大字号、操作简单的界面，能录音和播放音频，能离线运行本地语音模型，
而且以后要方便持续更新、调试。开发机上有 Node 24，没有 Rust。

## 选项

1. **Electron + React + TypeScript**
2. Tauri（Rust 后端 + Web 界面）
3. 原生（WPF / WinUI，C#）
4. Python 桌面（PyQt 等）

## 决定

选 1。具体版本：Electron 44、React 19、TypeScript 6、Vite 7（electron-vite 5）、electron-builder 26。

## 原因

- 语音引擎 sherpa-onnx 有现成的 Node 原生模块，可以直接在 Electron 主进程 / utilityProcess 里用（已实测）。
- 界面、主进程、构建脚本都用 TypeScript，共享同一套内容格式和业务逻辑（`src/shared/`），只需要维护一份。
- Chromium 自带录音（AudioWorklet）、音频播放、`speechSynthesis` 兜底，不需要额外的库。
- Tauri 需要安装 Rust 工具链，原生 Node 模块也更难接入；WPF 和 PyQt 的界面开发和测试工具链都比 Web 慢。

## 后果

- 安装包较大（Electron 本身约 100 MB，加上模型和音频大约 400–500 MB）。对一台家用笔记本可以接受。
- 主进程 / preload / 界面三部分要严格分开：界面只能通过 `window.api`（`src/shared/ipc.ts`）访问主进程，
  开启 `contextIsolation`、关闭 `nodeIntegration`。
