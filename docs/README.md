# 文档索引

开口说 · 新加坡生活英语（KaikouEnglish）—— 离线、免费的英语口语学习软件；iPhone Web/PWA 正在真机验收前准备，仓库暂保留 Windows 桌面版。

## 先读这几篇

| 文档                                             | 内容                                                   |
| ------------------------------------------------ | ------------------------------------------------------ |
| [`progress.md`](progress.md)                     | 当前进度：已完成 / 未完成 / 已知问题 / 下一步          |
| [`01-learning-method.md`](01-learning-method.md) | 学习方法、目标、研究依据、防放弃设计、自动调速规则     |
| [`02-architecture.md`](02-architecture.md)       | 技术架构、模块边界、文件归属、路径、IPC 接口、数据库表 |

## iPhone Web / PWA

| 文档                                          | 内容                                       |
| --------------------------------------------- | ------------------------------------------ |
| [iPhone 试用步骤](web/iphone-test.md)         | 电脑启动、证书安装、主屏幕安装及真机结果表 |
| [Web 架构](web/architecture.md)               | 模块装配、存储、资源与备份契约             |
| [移动界面规范](web/mobile-ui.md)              | 四标签、学习步骤与安全区                   |
| [界面验证](web/mobile-validation.md)          | Chrome 截图与真机待测边界                  |
| [资源与 HTTPS](web/assets.md)                 | 资源构建、离线缓存、更新及本地服务         |
| [语音](web/speech.md)                         | 录音、播放、本地识别与限制                 |
| [存储](web/storage.md)                        | SQLite、录音、完整备份与恢复               |
| [决定 0008](decisions/0008-web-pwa-iphone.md) | Web 替代桌面与真机放行条件                 |

## 课程内容

| 文档                                                       | 内容                                                      |
| ---------------------------------------------------------- | --------------------------------------------------------- |
| [`content/curriculum.md`](content/curriculum.md)           | 13 周课程表、阶段目标、拼读安排                           |
| [`content/authoring-guide.md`](content/authoring-guide.md) | 怎么添加 / 修改课程内容、谐音分级规则、校验和音频生成命令 |

## 模块设计（`modules/`）

| 文档                                                 | 内容                                                       |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| [`modules/storage.md`](modules/storage.md)           | 数据库、迁移、备份                                         |
| [`modules/speech.md`](modules/speech.md)             | 语音识别进程、录音保存、发音比对                           |
| [`modules/main-process.md`](modules/main-process.md) | 主进程：窗口、IPC、日志、诊断                              |
| [`modules/ui.md`](modules/ui.md)                     | 界面结构、组件、录音和播放                                 |
| [`modules/lesson.md`](modules/lesson.md)             | 课程流程：学新句子 / 句型和发音 / 实战对话 / 复习日 / 挑战 |
| [`modules/review.md`](modules/review.md)             | 复习：题型、评分、FSRS 调度                                |

## 开发与决定

| 文档                           | 内容                                                   |
| ------------------------------ | ------------------------------------------------------ |
| [`dev-setup.md`](dev-setup.md) | 开发环境搭建、常用命令、打包                           |
| [`decisions/`](decisions/)     | 重要技术决定记录（编号、日期、背景、选项、结论、原因） |

## 给学习者

| 文档                                   | 内容                     |
| -------------------------------------- | ------------------------ |
| [`user-guide-zh.md`](user-guide-zh.md) | 使用说明（写给她本人看） |
