# Web 本机存储与恢复

本模块实现 `src/shared/ipc.ts` 的全部 `AppApi`，入口为 `src/web/storage/index.ts` 的 `createWebApi({ assets, speech })`。返回的 `WebRuntime` 包含 `api`、`backup` 和异步 `dispose()`。必须等待初始化成功再挂载学习界面；失败不能进入临时内存库。

本轮验证状态、计数和团队依赖统一见本地 wiki `.agent-wiki/INDEX.md` 的 Now 块。完整格式约定见 [架构](architecture.md)。

## 模块

| 文件                                  | 职责                                                                               |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| `types.ts`                            | WebRuntime、BackupClient 和可注入的结构化 assets/speech 依赖                       |
| `index.ts`                            | AppApi 装配、写入与备份串行队列、Blob URL 生命周期、空间不足暂停资源下载           |
| `client.ts`                           | Worker 请求 ID、稳定错误码、崩溃与超时处理；不自动重试写入                         |
| `database.worker.ts`                  | 单一数据库 Worker；初始化、完整性检查、串行服务派发                                |
| `sqlite.ts`、`database.ts`            | SQLite WASM SAHPool、写入者锁、事务、迁移与迁移前快照                              |
| `repositories/`、`learningService.ts` | 从桌面适配的相同 SQL 和学习服务；直接复用共享 FSRS、计划、日期、连续天数和提示规则 |
| `files.ts`、`wav.ts`、`recordings.ts` | IndexedDB WAV、稳定 UUID、保留策略和启动孤儿清理                                   |
| `backup.ts`、`contentIds.ts`          | 严格备份字段、摘要与内容引用校验、代际替换                                         |
| `diagnostics.ts`                      | 本地限量日志与诊断下载；仅保存事件类别，不保留文本、识别结果、PCM 或个人数据库     |
| `testing.ts`                          | 可注入的 Fake assets、speech 和串行服务 transport                                  |
| `validation/`                         | 使用真实 Chromium、真实 SQLite WASM/OPFS/IndexedDB 的合成数据冒烟脚本              |

生产入口不导入 Node SQLite、Electron 或桌面文件系统。允许直接复用的桌面文件只有无 Node 依赖的迁移 SQL 与输入校验 schema。测试中的 Node SQLite 仅是注入的 SQL Provider，不证明浏览器持久化。

## 数据安全

数据库逻辑文件是 `/learning.sqlite3`，位于固定 `.kaikou-sahpool` 池。实际物理文件映射完全交给 SQLite，不能手动复制、删除或改名池文件。使用回滚日志，未启用 WAL。Web Locks 的 `kaikou-learning-writer` 锁在安装池之前取得并持有至关闭；冲突返回 `STORAGE_BUSY`。

安装包已核对具有 `preserveOnInitFailure` 实现；运行时要求 SQLite 至少 3.54，并显式设置 `clearOnInit:false`、`preserveOnInitFailure:true`。较旧构件被拒绝，不能在初始化错误后清空存储。这一要求来自 [SQLite 官方 SAHPool 文档](https://sqlite.org/wasm/doc/trunk/persistence.md#opfs-sahpool)；实际包源代码也已核对。

迁移沿用 `src/main/db/migrations.ts`。现存库迁移前，使用官方 `exportFile()` 生成独立 SQLite 快照，写入 IndexedDB 的 `snapshot/pre-migration-v<版本>`；快照保存失败时不迁移。迁移 SQL、版本和迁移事件在同一同步事务内提交。未知较新数据库版本拒绝打开，不更换文件、池或数据库。

录音以 `generation/UUID` 为 IndexedDB 键；SQL `recordings.file` 仅存 UUID。先提交录音 Blob，再提交 SQL 索引和保留策略；练习保留第一次和最近三次，挑战不自动裁剪。删除旧 Blob 留到下一次启动，避免清理失败把已提交保存报告为失败。SQL 中没有持久化 Blob URL；列表替换、导入成功和 runtime 关闭时回收会话 URL。

识别前需要保留的录音先保存；识别失败仍保留录音，score/transcript 不伪造。录音空间不足会抛错并暂停可重新下载资源，界面不能显示已完成。

## 完整备份

`exportFile()` 在串行队列中冻结学习写入，读取一致 SQL 表快照并按顺序读取全部被索引 WAV。缺少录音时失败，不生成不完整的“完整备份”。格式为架构定义的 UTF-8 JSON，不包括课程音频、模型、缓存、诊断日志或 Blob URL。

`inspectFile()` 默认限制 100 MiB，拒绝未知格式/未来版本、额外字段、非法类型、重复主键/文件键、缺少或额外录音、无效 base64、字节数/摘要/WAV 头不一致、无效复习和内容引用、无效设置与连续天数。每行仅按代码允许的列名绑定插入，不接受或执行备份携带的 SQL。当前恢复接受本应用当前数据库 schema 的完整备份；不声称兼容桌面数据库文件导入。

`importFile()` 再次校验，先准备并触发下载当前完整备份，再向新 generation 写全部录音，最后用单一 SQL 事务替换学习表和 generation 标记。写 Blob 或 SQL 失败均保留旧 generation；中断遗留的 staging 文件在下一次启动清理。成功后的首次重开先做数据库和引用录音存在性检查，再清理旧 generation。下载动作不能证明用户已将文件保存到“文件”，界面仍须提示人工保存。

`storageStatus()` 请求持久化并估算用量，拒绝和不可用返回明确的 false/null；持久化获准也不代替外部备份。超时会关闭 Worker，提示重新打开检查记录，不自动重复提交可能已经完成的写入。

## 实际执行的验证

- `npx vitest run src/web/storage`：通过。覆盖原桌面学习案例、迁移和事务回滚、重复完成补卡、每日上限、额外练习不改间隔、提示计数、完整录音往返、损坏/未来版本拒绝、导入两阶段中断、配额失败、ASR 失败仍保留音频、AppApi 全方法及 Worker 超时。
- `npx eslint src/web/storage`：源代码通过。早期曾把工作区内临时构建 JS 也扫描进去而失败；生成物现已改到 OS 临时目录，已移除工作区临时输出，不将该次失败记作源码通过。
- `npx prettier --check src/web/storage docs/web/storage.md`：以最终实际执行结果记录在 Now。
- `npm run web:typecheck`、`npm run typecheck`：曾通过/存在其他构建者同时修改造成的中间失败；最终状态及精确失败路径见 Now 和 board，不以较早通过掩盖后续失败。
- `node src/web/storage/validation/run.mjs`：真实原生无头 Chrome、真实 WASM/OPFS/IndexedDB 已通过进程冷重开和第二写入者拒绝；也已执行备份导入后再次重开并恢复同一 WAV。沙盒内 CDP 建连后无响应，经允许在沙盒外运行后成功。脚本不下载模型、不读取真实个人数据，并禁止测试页面的下载写入用户下载目录。详细合成结果在脚本创建的 OS 临时目录 `result.json`，不会提交。

Vite 对 zod 源码 PURE 注释给出删除注释的构建警告；冒烟构建成功。测试页面 favicon 的 404 不影响 Worker/WASM 与存储验证。完整 `web:check` 由协调者执行；本模块没有把桌面 Chrome 结果称作 Safari/PWA 通过。

## 重复真实浏览器与 iPhone 检查

桌面 Chrome 可运行上述 `validation/run.mjs`。脚本使用新的合成 profile，固定同一次测试的 origin，完成写入 → 第二 Worker 被拒绝 → 退出浏览器进程 → 重开核对设置、活动、录音 → 导出/替换/导入 → 再退出重开验证活动 generation。没有新 npm 依赖；Windows Chrome 路径在脚本中，其他系统需替换为已安装 Chrome 路径。

iPhone 必须另外按 [移动规范](mobile-ui.md) 和本地受信任 HTTPS 操作：

1. 固定同一 HTTPS origin，从 Safari 添加到主屏幕；确认非隐私模式、可用空间充足。
2. 下载第 1 周，完成一课和一次复习，修改设置，保存一段挑战录音并回听。
3. 飞行模式下退出并杀掉应用，再从主屏幕冷启动；核对课程、复习安排、连续天数、设置与录音回听。
4. 同源 Safari 再开一页，确认只显示“请回到已打开的学习窗口”，原窗口数据仍在；关闭全部后重开，确认锁可恢复。
5. 导出备份并人工保存到“文件”，更改记录后 inspect/确认导入，再杀掉重开核对 SQL 与录音。
6. 测试拒绝持久化、空间不足、导入期间退出应用和保存失败重试；应保留旧数据或完整新 generation，不能静默重建空库。

尚未验证：真实 iPhone Safari/PWA、系统实际回收/配额拒绝、手机上接近大小上限的备份峰值内存、真实 OPFS 迁移失败恢复。JSON 备份仍需在内存中解析；大小上限是防护，不是手机峰值内存合格证明。

## 恢复方法

- 第二窗口冲突：回到原窗口；需要切换时先关闭原窗口。不要清除网站数据或使用新池名绕过锁。
- 空间不足或一般写入失败：保留当前页面与记录，暂停下载，处理系统空间后重开/重试。若操作超时，重开后先核对是否已提交，避免盲目重复。
- 导入中断：使用相同 origin 重开。SQLite generation 是唯一权威，旧 generation 在 SQL 提交前一直有效；启动会清理未引用文件。
- 未来版本数据库：升级应用后再开，不能降级重建。
- 有完整 JSON 备份：通过界面先 inspect，再明确确认替换；恢复后再次冷启动核对录音。
- 迁移失败：保留 OPFS 与 IndexedDB。开发恢复时从 `snapshot/pre-migration-v<版本>` 取出 SQLite Blob；关闭所有数据库句柄后，使用同一 SAHPool 的官方 `importDb('/learning.sqlite3', bytes)` 恢复，再打开匹配版本检查。不要直接操作池物理文件。该人工恢复流程尚未在真实手机执行。
- 若浏览器已清除整个 origin 数据，只有用户实际保存到网站外部的备份可恢复；本模块不上传个人数据，没有服务器副本。
