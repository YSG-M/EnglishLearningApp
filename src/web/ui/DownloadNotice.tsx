/* @jsxRuntime automatic */
import { useEffect, useState } from 'react';
import { Button, Notice } from '../../renderer/src/components/ui';
import { useWebServices } from './WebServices';

export function DownloadNotice() {
  const services = useWebServices();
  const [state, setState] = useState(services?.assets.getState());
  useEffect(() => services?.assets.subscribe(setState), [services]);
  if (!services || !state || state.phase === 'idle' || state.phase === 'ready') return null;
  return (
    <Notice>
      <p>
        {state.phase === 'paused'
          ? '课程下载已暂停'
          : state.phase === 'error'
            ? '课程下载未完成，请检查网络和可用空间'
            : '正在准备离线课程'}{' '}
        {state.totalBytes > 0
          ? `· 已校验 ${state.completedBytes.toLocaleString()} / ${state.totalBytes.toLocaleString()} 字节`
          : '· 正在读取资源清单…'}
      </p>
      <progress
        aria-label="离线准备进度"
        value={state.totalBytes > 0 ? state.completedBytes : undefined}
        max={state.totalBytes || 1}
      />
      <div className="row">
        <Button onClick={() => services.assets.pause()}>暂停课程下载</Button>
        <Button onClick={() => void services.assets.ensureWeeks([1]).catch(() => {})}>继续准备第 1 周</Button>
      </div>
    </Notice>
  );
}
