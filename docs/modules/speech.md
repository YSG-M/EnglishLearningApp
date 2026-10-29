# 模块 · 语音识别（src/main/speech）

## 结构

```
界面录音（16 kHz Float32）
   │ window.api.speech.recognize
   ▼
主进程 api.ts ──先保存录音──► RecordingService
   │
   ▼
AsrProvider
 ├─ WhisperAsrProvider ──utilityProcess──► speechHost.ts（sherpa-onnx + Whisper base.en int8）
 ├─ UnavailableAsrProvider（没有模型：界面改用"自己评分"）
 └─ FakeAsrProvider（测试用）
```

- **独立进程**：Whisper 很吃 CPU，原生代码一旦崩溃，只会挂掉 `speechHost` 这个进程，主进程和界面不受影响。
- **按需加载**：第一次识别（或者启动 4 秒后的预热）时才启动进程、加载模型；之后一直留在内存里。
- **一次只识别一段**：子进程里的请求排队执行，并行识别只会互相拖慢。
- **超时**：单次识别 20 秒，加载模型 60 秒。超时就结束子进程，下次请求时重新启动。主动结束不算崩溃。
- **反复崩溃**：2 分钟内崩溃 3 次，状态变成 `error`，显示"暂时出了问题，先用自己评分"，暂停重试；时间窗口过去后自动恢复。
- **静音保护**：录音少于 250 ms，或者音量最大的 50 ms 片段也很小，直接返回空文字，不送给模型。Whisper 在静音时会"幻听"出文字，这样可以避免。界面收到空文字时显示"没听到声音"。

## 模型

| 文件                                                   | 位置                                                                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `encoder.int8.onnx`、`decoder.int8.onnx`、`tokens.txt` | 开发时：`resources/models/whisper-base.en/`；安装后：`process.resourcesPath/models/whisper-base.en/` |

三个文件只要缺一个，就使用 `UnavailableAsrProvider`。这时 app 照样能用，只是复习时用"自己评分"代替"开口说"（`chooseExercise` 根据 `speechAvailable` 决定题型）。

## 状态（`speech.getStatus()`）

| state         | 含义                                              | 界面怎么做                   |
| ------------- | ------------------------------------------------- | ---------------------------- |
| `ready`       | 可以识别（模型可能还没加载，第一次会慢 1 秒左右） | 正常显示"开口说"练习         |
| `loading`     | 正在加载模型                                      | 可以显示"正在准备语音识别…"  |
| `unavailable` | 没有模型                                          | 改用自己评分，显示 `message` |
| `error`       | 反复崩溃，暂停中                                  | 改用自己评分，显示 `message` |

## 实测（2026-10-24，开发机，真实模型，通过 Electron 完整走一遍）

- 模型加载：0.95 秒（在 utility 进程里）
- 一段 1.5 秒的录音：第一次请求端到端 1.2 秒（包括启动进程和加载模型），之后每次约 0.2 秒
- 静音录音：直接返回空文字，不调用模型
- `media://audio/../..` 路径穿越：被拒绝（404）

## 以后的升级方向

现在只做到**单词级**比对：能知道哪个词没说出来、哪个词说得不像（`src/shared/domain/speechMatch.ts`），
但不能知道是哪一个**音**错了。音素级评分（比如判断 th 读成了 s）计划用 wav2vec2 音素模型实现，
可以作为一个新的 Provider 加进来，不需要改动接口。
