# 模块 · 数据存储（src/main/db）

## 技术选择

Node 内置的 `node:sqlite`（`DatabaseSync`）。Electron 44 自带的 Node 24 已经包含它，
所以**不需要为 Electron 重新编译原生模块**，测试（普通 Node）和应用里用的是同一个库。

- 文件：`<userData>/data/learning.sqlite`，WAL 模式，`busy_timeout = 3000`
- 测试：`openDatabase(':memory:')`

## 迁移

- `migrations.ts` 是一个**只能追加**的列表：`{ version, name, sql }`。已经发布的迁移不要改，改结构就加一个新版本。
- 打开数据库时按 `PRAGMA user_version` 执行还没跑过的迁移，每个迁移都在一个事务里完成，失败会整体回滚，版本号不变。
- **迁移前先备份**：已经存在的数据库升级之前，会先执行 WAL checkpoint，再复制到 `<userData>/data/backups/learning-v<旧版本>-<时间>.sqlite`。
- 如果数据库版本比程序新（她装回了旧版本），程序会拒绝打开并给出提示，不会损坏数据。
- 每次迁移都记录在 `app_events` 表里。

## 表

| 表               | 内容                                                                             | 读写                      |
| ---------------- | -------------------------------------------------------------------------------- | ------------------------- |
| `cards`          | 复习卡片，字段对应 `StoredCard`（`due` 是 UTC ISO 字符串，可以直接按字符串排序） | `CardRepository`          |
| `review_logs`    | 每次复习：卡片、题型、评分、是否正确、用时、日期                                 | `ReviewLogRepository`     |
| `part_progress`  | 已完成的课程部分和完成日期                                                       | `PartProgressRepository`  |
| `daily_activity` | 每天的学习时长、复习数、完成课数、是否算学习日、当天是否已结算连续天数           | `DailyActivityRepository` |
| `streak`         | 连续天数状态（一行 JSON）                                                        | `StreakRepository`        |
| `hint_progress`  | 每个单词说对的次数（谐音读对 3 次后隐藏）                                        | `HintProgressRepository`  |
| `recordings`     | 录音文件名、对应内容、类型（练习 / 挑战）、时长、分数、识别出的文字              | `RecordingRepository`     |
| `settings`       | 设置（一行 JSON）                                                                | `SettingsRepository`      |
| `app_events`     | 迁移、连续天数结算等事件，方便排查问题                                           | `EventRepository`         |

## 设置的容错

设置用 `Settings`（zod）解析：新版本加的设置自动用默认值；某一项存坏了只重置那一项，不影响其他设置；整条 JSON 坏了就回到默认值。
**IPC 的设置补丁不能用 `Settings.partial()`**：zod 4 里 `.partial()` 仍然会给没传的字段填默认值，结果是改一项就把其他设置全部重置。
`ipc/schemas.ts` 里的 `SettingsPatch` 专门处理了这个问题，并有测试覆盖。

## 录音文件

- 位置：`<userData>/recordings/<内容id>-<时间戳>-<随机8位>.wav`，16 kHz 单声道 16-bit PCM
- 保留策略：练习录音每个内容只保留**第一次 + 最近 3 次**；挑战录音全部保留
- 界面通过 `media://rec/<文件名>` 播放

## 诊断包

设置页"导出诊断包"会在桌面生成 `KaikouEnglish-diagnostics-<时间>/`，里面有：

- `logs/`：全部日志
- `learning.sqlite`：用 `VACUUM INTO` 生成的数据库完整副本，程序运行中也能安全生成
- `info.json`：版本号、系统信息、语音状态、卡片数量、最近的事件

**不包含录音。**
