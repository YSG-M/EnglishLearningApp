# 0003 · 本地数据库：Node 内置 `node:sqlite`

- 状态：已采纳
- 日期：2026-10-24

## 背景

需要可靠地保存复习卡片、复习记录、课程进度、每日学习时长、录音索引和设置。数据量很小（几 MB），
但必须不丢失、可以迁移版本，出问题时方便导出排查。

## 选项

1. **`node:sqlite`（Node 内置）**
2. better-sqlite3（原生模块）
3. sql.js（WASM，整库在内存里，需要自己写回文件）
4. JSON 文件

## 决定

选 1，同步 API `DatabaseSync`，WAL 模式，用 `PRAGMA user_version` 做版本迁移，迁移前备份数据库文件。

## 原因

- Electron 44 内置 Node 24.21，`node:sqlite` 在 Node 和 Electron 里都能用（已实测），**不需要编译原生模块**。
- better-sqlite3 要分别针对 Node（测试时）和 Electron（运行时）编译两次，是常见的维护负担。
- sql.js 需要自己处理写回文件和崩溃时的数据安全；JSON 文件没有事务，数据一多容易损坏。
- 测试可以直接用 `:memory:` 数据库，速度快。

## 后果

- `node:sqlite` 还标记为实验性 API，Node 升级时要关注变化；所有数据库访问集中在 `src/main/db/`，以后换实现只改这一层。
- 同步 API 会占用主进程，但数据量小、每次查询都在毫秒级，可以接受；重的工作（语音识别）在独立进程里。
