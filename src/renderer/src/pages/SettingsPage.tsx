import { useEffect, useState } from 'react';
import type { AppInfo } from '@shared/ipc';
import { api, logError } from '../api/client';
import { Button, Card, Notice, PageHeader } from '../components/ui';
import { zh } from '../i18n/zh';
import { useApp } from '../state/AppContext';
import { WebSettings } from '../../../web/ui/WebSettings';
import { useWebServices } from '../../../web/ui/WebServices';

export function SettingsPage() {
  const web = useWebServices();
  const { settings, updateSettings, speech, refreshSpeech, saveError } = useApp();
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [exported, setExported] = useState<string | null>(null);
  const [name, setName] = useState(settings.learnerName);

  useEffect(() => {
    api.app
      .getInfo()
      .then(setInfo)
      .catch((err: unknown) => logError('app.getInfo', err));
    void refreshSpeech();
  }, [refreshSpeech]);

  const exportDiag = async () => {
    try {
      const r = await api.diagnostics.exportBundle();
      setExported(r.folder);
    } catch (err) {
      logError('diagnostics.exportBundle', err);
    }
  };

  return (
    <div className="page settings">
      <PageHeader title={`⚙️ ${zh.settings.title}`} />
      <WebSettings />
      {saveError ? <Notice tone="warn">{saveError}</Notice> : null}

      <Card title={zh.settings.learning}>
        <label className="setting-row">
          <span>
            {zh.settings.showHints}
            <span className="muted small block">{zh.settings.showHintsHelp}</span>
          </span>
          <input
            type="checkbox"
            className="toggle"
            checked={settings.showHints}
            onChange={(e) => void updateSettings({ showHints: e.target.checked })}
          />
        </label>

        <label className="setting-row">
          <span>
            {zh.settings.showGlosses}
            <span className="muted small block">{zh.settings.showGlossesHelp}</span>
          </span>
          <input
            type="checkbox"
            className="toggle"
            checked={settings.showGlosses}
            onChange={(e) => void updateSettings({ showGlosses: e.target.checked })}
          />
        </label>

        <div className="setting-row">
          <span>{zh.settings.chineseMode}</span>
          <div className="segmented" role="radiogroup">
            {(['always', 'tap'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={settings.chineseMode === m}
                className={settings.chineseMode === m ? 'active' : ''}
                onClick={() => void updateSettings({ chineseMode: m })}
              >
                {m === 'always' ? zh.settings.chineseAlways : zh.settings.chineseTap}
              </button>
            ))}
          </div>
        </div>

        <label className="setting-row">
          <span>
            {zh.settings.reviewCap}：
            <strong>
              {settings.reviewCap} {zh.settings.reviewCapUnit}
            </strong>
          </span>
          <input
            type="range"
            min={5}
            max={60}
            step={5}
            value={settings.reviewCap}
            onChange={(e) => void updateSettings({ reviewCap: Number(e.target.value) })}
          />
        </label>

        <label className="setting-row">
          <span>
            {zh.settings.slowRate}：<strong>{settings.slowRate.toFixed(2)}×</strong>
          </span>
          <input
            type="range"
            min={0.5}
            max={0.95}
            step={0.05}
            value={settings.slowRate}
            onChange={(e) => void updateSettings({ slowRate: Number(e.target.value) })}
          />
        </label>

        <label className="setting-row">
          <span>
            {zh.settings.silenceMs}：<strong>{zh.settings.seconds(settings.silenceMs)}</strong>
          </span>
          <input
            type="range"
            min={600}
            max={3000}
            step={100}
            value={settings.silenceMs}
            onChange={(e) => void updateSettings({ silenceMs: Number(e.target.value) })}
          />
        </label>

        <label className="setting-row">
          <span>{zh.settings.learnerName}</span>
          <input
            className="text-input"
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name !== settings.learnerName && void updateSettings({ learnerName: name.trim() })}
          />
        </label>
      </Card>

      <Card title={zh.settings.speech}>
        <p>
          {zh.settings.speechState[speech.state]}
          {speech.message ? <span className="muted"> · {speech.message}</span> : null}
        </p>
      </Card>

      <Card title={zh.settings.about}>
        {info ? (
          <dl className="info-list">
            <dt>{zh.settings.appVersion}</dt>
            <dd>{info.appVersion}</dd>
            <dt>{zh.settings.contentVersion}</dt>
            <dd>{info.contentVersion}</dd>
            <dt>{zh.settings.dataDir}</dt>
            <dd className="mono">{info.dataDir}</dd>
          </dl>
        ) : null}
      </Card>

      <Card title={zh.settings.help}>
        <div className="row">
          <Button
            onClick={() =>
              void api.diagnostics.openLogsFolder().catch((e: unknown) => logError('openLogs', e))
            }
          >
            📂 {web ? '导出日志' : zh.settings.openLogs}
          </Button>
          <Button onClick={() => void exportDiag()}>📦 {zh.settings.exportDiag}</Button>
        </div>
        {exported ? (
          <Notice tone="success">
            {web ? `诊断文件已准备：${exported}，请保存到“文件”。` : zh.settings.exported(exported)}
          </Notice>
        ) : null}
      </Card>
    </div>
  );
}
