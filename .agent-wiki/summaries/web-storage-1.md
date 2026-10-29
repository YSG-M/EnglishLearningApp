# web-storage 结束交接

本轮任务 `tasks/web-storage.md`。已按任务读取项目规则、外部规则、wiki/board、进度与设计、原有共享接口/规则/SQL/服务及相关测试。只改 storage 所有权、storage 文档和自己的 wiki/board；未 commit/push、未改依赖和根配置。用户另有一句 “down to 5.5 also can”，已异步询问具体指什么，未据此擅自降级任何依赖。

## 已交付

- `src/web/storage/index.ts` 导出真实 `createWebApi({assets,speech})`，返回 AppApi 全方法、BackupClient 与 dispose。types/index 可装配，`testing.ts` 提供 Fake deps/transport。
- Dedicated Worker 独占 SQLite WASM SAHPool。Web Lock 在池初始化前拦住第二写入者。固定池和逻辑库名，不在错误时换库、清空或回退内存。
- 核对实际 sqlite-wasm 构件的 `preserveOnInitFailure` 实现并开启；旧构件版本拒绝。SQL 迁移沿用原 MIGRATIONS；现存库迁移前官方导出快照到 IDB，再同步事务迁移；未来库版本不修改。
- SQL 仓库与 LearningService 在 storage 适配，共享 FSRS/计划/连续天数规则直接复用；原桌面学习测试案例也接入 Web adapter。未改 src/main/src/shared。
- 16 kHz mono PCM WAV 存 IndexedDB，SQL UUID。先 Blob 后 SQL，第一次+最近三次练习、永久挑战；孤儿延迟启动清理。Blob URL 在列表替换/导入/关闭时回收。ASR 失败保留已保存录音，配额失败暂停 assets 下载。
- 完整 JSON 备份：严格表/字段/类型/ID/引用、大小、base64、摘要/WAV/时长校验；不执行用户 SQL。导入先 inspect、准备当前备份下载、新录音 generation，最后 SQL 事务切换，失败保留旧代。真实浏览器已验证导入后再冷重开。
- 本地限量类别日志/诊断下载、persist/estimate 状态、Worker 超时和稳定错误码。不上传个人数据。

## 验证与命令

最新计数和状态只记 `INDEX.md` Now。实际执行过：

```text
npx vitest run src/web/storage
npx eslint src/web/storage
npx prettier --check src/web/storage docs/web/storage.md
git diff --check
npm run web:typecheck
npm run typecheck
node src/web/storage/validation/run.mjs
```

storage 单测/lint/格式/diff 通过。两套整体 typecheck 曾通过，最后被正在修改的 speech 文件阻塞，精确位置见 Now/board，不能当作最终全仓通过。最终 `web:check` 由协调者执行。

原生 Chrome smoke 脚本无新依赖，生产方式打包真实 Worker/WASM，合成 profile 与输出放 OS temp。实际关闭 Chrome 进程后重开、设置/活动/WAV 保留；第二 Worker STORAGE_BUSY；完整备份导入后再关闭重开仍匹配。同一脚本沙盒内 CDP 建连但命令无回复，获准沙盒外后成功；可复用已批准 node 前缀。测试页 favicon 404 与 zod PURE 注释构建警告不影响通过，不隐藏记录。

早期把临时输出放 storage/.validation 导致 lint/prettier 扫到生成代码，已移至 OS temp 并清除 workspace 生成目录。assets 另添加了忽略规则；我未修改其配置。

## 未验证与集成事项

- iPhone Safari/PWA、真实配额/系统回收、接近大小上限的 JSON 峰值内存、真机迁移故障恢复未验证。文档 `docs/web/storage.md` 给出逐步流程；Chrome 不能替代 iPhone。
- App UI 必须等待 createWebApi resolve 再挂载；错误不能进入学习。导入 UI 要确认替换并刷新 AppContext；下载仅表示文件已准备，不证明保存成功。
- 初始语音 Provider 不可用不阻挡存储；`speech.getStatus` 抛错会回 unavailable。识别结果和个人日志不上传。
- 不要绕过 SAHPool 默认故障删除风险，至少当前已核对的安全构件版本；不要改池名“解决”失败。
- 迁移 SQLite 快照存 `snapshot/pre-migration-v<版本>`，只能通过官方池 importDb 恢复，不能复制池物理文件。人工恢复未实测手机。
- root 配置、Web build/资源整合、最终 web:check 和真机放行不在本代理归属。

已读最终 board，自己的 roster ended，并追加 DONE。后续协调仍只用 board。
