# 上线到 iPhone：你要做的事

> 最后更新：2026-10-29 · 当前在：**第 1 步**
> 做完一步，或者卡住了，在终端告诉我，我会更新这页。

| # | 步骤 | 状态 |
|---|------|------|
| 1 | 提交代码 | ⬜ 待做 |
| 2 | 仓库改成公开 | ⬜ 待做 |
| 3 | 打开 GitHub Pages | ⬜ 待做 |
| 4 | 推到 GitHub 的 main | ⬜ 待做 |
| 5 | 等网站构建完成 | ⬜ 待做 |
| 6 | 电脑上先打开看一眼 | ⬜ 待做 |
| 7 | iPhone 上加到主屏幕 | ⬜ 待做 |
| 8 | iPhone 上逐项测试 | ⬜ 待做 |

---

## 1. 提交代码

在 VS Code 的 PowerShell 终端里，项目文件夹下运行：

```powershell
git add .
git commit -m "Add iPhone web app (PWA) and GitHub Pages deploy"
```

✅ 完成标志：`git status` 显示 `nothing to commit`。

## 2. 仓库改成公开

1. 打开 https://github.com/YSG-M/EnglishLearningApp/settings
2. 拉到最下面 **Danger Zone** → **Change visibility** → **Make public**
3. 按提示确认

✅ 完成标志：仓库名旁边显示 **Public**。

## 3. 打开 GitHub Pages

1. 打开 https://github.com/YSG-M/EnglishLearningApp/settings/pages
2. **Build and deployment** → **Source** 选 **GitHub Actions**

✅ 完成标志：选好后页面不用再点保存。

## 4. 推到 GitHub 的 main

```powershell
git push origin feat/v1
git switch main
git merge --ff-only feat/v1
git push origin main
git switch feat/v1
```

✅ 完成标志：每条命令都没有红色报错。
（大约要传 150 MB，网速慢的话要几分钟。）

## 5. 等网站构建完成

推送后会自动开始构建。

1. 打开 https://github.com/YSG-M/EnglishLearningApp/actions
2. 找到 **Deploy GitHub Pages**。如果没有自动开始：点它 → 右边 **Run workflow** → 选 `main` → **Run workflow**
3. 等它变成绿色 ✔（大约 3–5 分钟）

✅ 完成标志：绿色 ✔。
❌ 如果是红色 ✘：点进去，把红色那一步的报错复制给我。

## 6. 电脑上先打开看一眼

打开 https://ysg-m.github.io/EnglishLearningApp/

✅ 完成标志：能看到"今天"页面。

## 7. iPhone 上加到主屏幕

建议连着 Wi-Fi 做（第一次大约要下载 45 MB）。

1. 用 iPhone 的 **Safari**（必须是 Safari）打开 https://ysg-m.github.io/EnglishLearningApp/
2. 点底部的 **分享** 按钮 → **添加到主屏幕** → **添加**
3. 关掉 Safari，以后都从主屏幕的图标打开

✅ 完成标志：从图标打开时，没有 Safari 的地址栏。

## 8. iPhone 上逐项测试

按 `docs/web/iphone-test.md` 一项一项试，把结果表发给我。

> 对手机的影响：只是一个网页，不装任何东西，不改手机设置。
> 占用空间：基本内容约 45 MB；语音识别模型 111 MB 是可选的，在设置里手动下载。
> 不要的话，长按图标删除即可，数据会一起删掉（先在设置里导出备份）。

---

## 记录

- 2026-10-29：代码和检查都已完成，等你从第 1 步开始。
