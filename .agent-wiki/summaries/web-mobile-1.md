# web-mobile 交付与交接（2026-10-29）

角色：web-mobile。遵守任务文件归属，无 commit/push，无新依赖，协调仅使用 tasks/web-board.md。

已读 CLAUDE、外部规则、INDEX/reusable/board、任务指定全部架构与页面规范，核对初始 git 已有设计改动。

实现：四标签移动 shell、来源返回栈、我的入口、独立滚动与安全区、固定学习栏/VisualViewport、课程按周展开、汇总与故事折叠、对话历史折叠、首次手动播放；WebServicesProvider 的 props 为 {assets,speech,backup,children}，configurePlayer onError 已在 Provider 接入。缺音频可前往下载设置或课程。各客户端类型只引用对应 owner types.ts。

Web 设置：课程字节进度/暂停恢复、getAvailableWeeks 核验显示、独立模型 opt-in 与 Wi-Fi、安装与更新、备份 prepare→用户下载/分享、inspect→当前备份下载→确认替换→重载。UI 不另建存储。模型未验证会显示 speech 的中文不可用原因。

修复旧行为：ReviewSession submit 成功才允许前进，失败重试不会重复计分；ChallengePart 改录音→回听→显式保存，保存成功才完成，卸载后不自动保存；设置不再乐观显示保存成功，失败显示提示。PracticePart 原测试改 await 保存结果，保留断言。

验证与真机限制见 docs/web/mobile-validation.md。Chrome CDP 脚本 src/web/ui/validation/capture.mjs，无依赖，隐藏窗口，临时 profile 每次唯一以避开陈旧 DevToolsActivePort。截图/measurements 位于 .agent-wiki/mobile-screenshots。Electron 本机页 ERR_FAILED，未冒充通过。

Own changes：src/web/ui/**；renderer App/state、global.css、Today/Course/Settings/Phrasebook/Progress/Part/Summary、SentenceList、DialoguePlayer、SentenceCard、ChallengePart、PairQuestion、review exercises/ReviewSession 及相关测试、test-utils。未写 speech 独占路径，未写根配置、shared/main/scripts。

尚未实测 iPhone safe area/软键盘/麦克风/OPFS/SW/离线冷启动；单线程 Whisper runtime 未验证为 speech 项，UI 保留自评。不应把本轮 Mock UI 与 Chrome 布局称为产品真机放行。整合者请跑全仓 check/web:check/build 和真机验收。
