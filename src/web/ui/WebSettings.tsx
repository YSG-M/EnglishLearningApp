/* @jsxRuntime automatic */
import { useEffect, useState } from 'react';
import { Button, Card, Notice } from '../../renderer/src/components/ui';
import { useApp } from '../../renderer/src/state/AppContext';
import { useAvailableWeeks, useWebServices } from './WebServices';

export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function WebSettings() {
  const services = useWebServices();
  const { bundle, refreshSpeech } = useApp();
  const [download, setDownload] = useState(services?.assets.getState());
  const [model, setModel] = useState<{ completedBytes: number; totalBytes: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<{ createdAt: string; recordingCount: number } | null>(null);
  const [prepared, setPrepared] = useState<Blob | null>(null);
  const [currentBackupDownloaded, setCurrentBackupDownloaded] = useState(false);
  const [restored, setRestored] = useState(false);
  const [update, setUpdate] = useState(false);
  const [storage, setStorage] = useState<{
    persistent: boolean;
    usage: number | null;
    quota: number | null;
  } | null>(null);
  useEffect(() => {
    if (!services) return;
    const a = services.assets.subscribe(setDownload);
    const s = services.speech.subscribe((state) => setModel(state.download));
    void services.backup
      .storageStatus()
      .then(setStorage)
      .catch(() => setMessage('暂时无法读取本机空间，请稍后重试。'));
    return () => {
      a();
      s();
    };
  }, [services]);
  if (!services) return null;
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (error) {
      setMessage(
        error instanceof Error && /[\u4e00-\u9fff]/.test(error.message)
          ? error.message
          : '操作未完成。请检查备份文件、网络和本机可用空间后重试。',
      );
    } finally {
      setBusy(false);
    }
  };
  const filename = `kaikou-backup-${new Date().toISOString().slice(0, 10)}.json`;
  return (
    <>
      <Card title="添加到主屏幕">
        <p>在 Safari 打开本应用，点“分享” → “添加到主屏幕”，以后从桌面图标打开。</p>
        <p>数据只保存在这台手机。删除主屏幕应用或清除网站数据可能丢失记录，请先导出备份。</p>
      </Card>
      <Card title="离线课程">
        <p>下载只在应用打开时继续，关闭后下次可以恢复。</p>
        {download ? (
          <>
            <p role="status">
              {download.phase === 'ready'
                ? '本次课程资源已校验'
                : download.phase === 'paused'
                  ? '下载已暂停'
                  : download.phase === 'error'
                    ? '下载未完成，请检查网络和空间后重试'
                    : '准备课程资源'}{' '}
              {download.totalBytes > 0
                ? `· 已校验 ${download.completedBytes.toLocaleString()} / ${download.totalBytes.toLocaleString()} 字节`
                : '· 正在读取资源清单…'}
            </p>
            <progress
              max={download.totalBytes || 1}
              value={download.totalBytes > 0 ? download.completedBytes : undefined}
              aria-label="课程下载进度"
            />
          </>
        ) : null}
        <div className="row">
          <Button disabled={busy} onClick={() => void run(() => services.assets.ensureWeeks([1]))}>
            准备第 1 周 / 继续下载
          </Button>
          <Button onClick={() => services.assets.pause()}>暂停下载</Button>
        </div>
        <p className="muted">每周下载完成并校验后，才可离线播放该周音频。</p>
        <div className="offline-weeks">
          {Object.keys(bundle.weeks)
            .map(Number)
            .sort((a, b) => a - b)
            .map((week) => (
              <WeekDownload key={week} week={week} />
            ))}
        </div>
        {storage ? (
          <p className="small">
            {storage.persistent
              ? '浏览器已允许持久存储，仍请定期备份。'
              : '浏览器可能回收本机存储，请定期备份。'}
            {storage.quota !== null && storage.usage !== null
              ? ` 可用约 ${Math.max(0, Math.floor((storage.quota - storage.usage) / 1048576))} MB。`
              : ''}
          </p>
        ) : null}
      </Card>
      <Card title="离线识别（可选）">
        <p>先录音、回听和自己评分就能上课。识别模型独立下载，建议连接 Wi-Fi。</p>
        <p>
          {model?.totalBytes
            ? `模型资源：${model.totalBytes.toLocaleString()} 字节；已校验 ${model.completedBytes.toLocaleString()} 字节`
            : '模型大小尚未读取；点击启用后会显示实际下载进度。'}
        </p>
        <div className="row">
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await services.speech.downloadModel();
                await refreshSpeech();
              })
            }
          >
            启用并下载离线识别
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await services.speech.removeModel();
                await refreshSpeech();
              })
            }
          >
            删除识别模型
          </Button>
        </div>
      </Card>
      <Card title="全部学习数据备份">
        <p>包含学习记录、设置和录音。请将文件保存到“文件”；准备好下载不代表已经保存。</p>
        <Button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              setCurrentBackupDownloaded(false);
              setPrepared(null);
              setPrepared(await services.backup.exportFile());
              setMessage('备份文件已准备，请点击下载并保存到“文件”。');
            })
          }
        >
          导出全部学习数据
        </Button>
        {prepared ? (
          <div className="row">
            <Button
              onClick={() => {
                downloadFile(prepared, filename);
                setCurrentBackupDownloaded(true);
              }}
            >
              下载备份文件
            </Button>
            {typeof navigator.canShare === 'function' ? (
              <Button
                onClick={() =>
                  void run(async () => {
                    const f = new File([prepared], filename, { type: 'application/json' });
                    if (!navigator.canShare({ files: [f] })) throw new Error('File sharing unavailable');
                    await navigator.share({ files: [f] });
                    setCurrentBackupDownloaded(true);
                  })
                }
              >
                分享备份文件
              </Button>
            ) : null}
          </div>
        ) : null}
        <label className="block">
          导入备份
          <input
            aria-label="导入备份"
            type="file"
            accept=".json,application/json"
            disabled={busy}
            onChange={(e) => {
              const candidate = e.target.files?.[0];
              setInspection(null);
              setFile(null);
              setRestored(false);
              setPrepared(null);
              setCurrentBackupDownloaded(false);
              if (candidate)
                void run(async () => {
                  const result = await services.backup.inspectFile(candidate);
                  setFile(candidate);
                  setInspection(result);
                });
            }}
          />
        </label>
        {inspection && file ? (
          <Notice tone="warn">
            <p>
              备份日期：{inspection.createdAt}；录音：{inspection.recordingCount} 段。导入会替换当前记录。
            </p>
            <p>确认前先准备并下载当前数据的备份。</p>
            <Button
              disabled={busy || !currentBackupDownloaded}
              onClick={() =>
                void run(async () => {
                  await services.backup.importFile(file);
                  setRestored(true);
                  setInspection(null);
                  setMessage('备份已恢复，请重新打开以读取恢复的学习记录。');
                })
              }
            >
              确认替换当前记录
            </Button>
          </Notice>
        ) : null}
        {restored ? <Button onClick={() => window.location.reload()}>重新打开应用</Button> : null}
      </Card>
      <Card title="应用更新">
        <Button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const available = await services.assets.checkForUpdate();
              setUpdate(available);
              setMessage(available ? '有新版，请结束学习后更新。' : '当前没有可用更新。');
            })
          }
        >
          检查更新
        </Button>
        {update ? (
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await services.assets.activateUpdate();
                window.location.reload();
              })
            }
          >
            更新并重新打开
          </Button>
        ) : null}
      </Card>
      {busy ? <Notice>正在准备，请保持应用打开…</Notice> : null}
      {message ? <Notice>{message}</Notice> : null}
    </>
  );
}

export function WeekDownload({ week }: { week: number }) {
  const services = useWebServices();
  const weeks = useAvailableWeeks();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!services) return null;
  return (
    <div className="week-download">
      <span>
        第 {week} 周 · {ready || weeks.includes(week) ? '可离线使用（本次已校验）' : '尚未核对离线资源'}
      </span>
      <Button
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setFailed(false);
          void services.assets
            .ensureWeeks([week])
            .then(() => setReady(true))
            .catch(() => setFailed(true))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? '正在校验 / 下载…' : ready ? '重新核对' : '核对 / 下载'}
      </Button>
      {failed ? <p className="error-text">下载未完成，请连网重试；空间不足时请先释放空间。</p> : null}
    </div>
  );
}
