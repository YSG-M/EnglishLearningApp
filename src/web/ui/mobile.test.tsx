// @vitest-environment jsdom
/* @jsxRuntime automatic */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Screen } from '../../renderer/src/App';
import { renderWithApp } from '../../renderer/src/test-utils';
import { WebServicesProvider, type WebServices } from './WebServices';
import { WebSettings } from './WebSettings';
import type { DownloadState } from '../assets/types';

afterEach(cleanup);

function fakeServices() {
  const listeners = new Set<(state: DownloadState) => void>();
  const state: DownloadState = {
    phase: 'idle',
    completedBytes: 0,
    totalBytes: 100,
    completedFiles: 0,
    totalFiles: 1,
  };
  const services = {
    assets: {
      getState: () => state,
      subscribe: (next: (state: DownloadState) => void) => {
        listeners.add(next);
        return () => {
          listeners.delete(next);
        };
      },
      ensureWeeks: vi.fn(async () => {
        for (const listener of listeners) listener({ ...state, phase: 'ready', completedBytes: 100 });
      }),
      pause: vi.fn(() => {
        for (const listener of listeners) listener({ ...state, phase: 'paused' });
      }),
      checkForUpdate: vi.fn(async () => false),
      activateUpdate: vi.fn(async () => {}),
    },
    speech: {
      subscribe: () => () => {},
      downloadModel: vi.fn(async () => {}),
      removeModel: vi.fn(async () => {}),
    },
    backup: {
      storageStatus: vi.fn(async () => ({ persistent: false, usage: 0, quota: 100000 })),
      exportFile: vi.fn(async () => new Blob(['backup'])),
      inspectFile: vi.fn(async () => ({ createdAt: '2026-10-29', recordingCount: 3 })),
      importFile: vi.fn(async () => {}),
    },
  };
  return { services, value: services as unknown as WebServices };
}

describe('mobile navigation', () => {
  it('has four tabs and keeps all personal pages reachable with return to source', async () => {
    renderWithApp(<Screen />);
    const nav = screen.getByRole('navigation', { name: '主菜单' });
    expect(within(nav).getAllByRole('button')).toHaveLength(4);
    for (const tab of ['今天', '课程', '复习', '我的']) {
      fireEvent.click(within(nav).getByRole('button', { name: new RegExp(tab) }));
      expect(document.querySelector('.mobile-topbar button')).toBeNull();
    }
    fireEvent.click(within(nav).getByRole('button', { name: /我的/ }));
    for (const name of ['速查', '进度', '设置']) {
      const entry = screen.getByRole('button', { name: new RegExp(`${name} →`) });
      fireEvent.click(entry);
      expect(
        await screen.findByRole('heading', { name: new RegExp(name === '进度' ? '我的进步' : name) }),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '← 返回' }));
      expect(screen.getByRole('heading', { name: '我的' })).toBeInTheDocument();
    }
  });

  it('opens unit and week summaries, both stories, and lessons from courses', async () => {
    renderWithApp(<Screen />);
    fireEvent.click(screen.getByRole('button', { name: '课程' }));
    fireEvent.click(await screen.findByRole('button', { name: '📄 汇总' }));
    expect(screen.getByText(/Amy 的早上/)).toBeInTheDocument();
    expect(screen.getByText(/小剧本：新邻居/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: '← 返回' })[0]!);
    fireEvent.click(await screen.findByRole('button', { name: /本周汇总/ }));
    expect(screen.getByRole('heading', { name: /第 1 周汇总/ })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: '← 返回' })[0]!);
    fireEvent.click(await screen.findByRole('button', { name: '开始上课' }));
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: '← 返回' })[0]!);
    expect(await screen.findByRole('heading', { name: '课程' })).toBeInTheDocument();
  });
});

describe('web settings with injected services', () => {
  it('pauses/resumes courses and downloads the model independently', async () => {
    const { services, value } = fakeServices();
    renderWithApp(
      <WebServicesProvider {...value}>
        <WebSettings />
      </WebServicesProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '暂停下载' }));
    expect(screen.getByText(/下载已暂停/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /准备第 1 周/ }));
    await waitFor(() => expect(services.assets.ensureWeeks).toHaveBeenCalledWith([1]));
    await waitFor(() => expect(screen.getByRole('button', { name: /启用并下载/ })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /启用并下载/ }));
    await waitFor(() => expect(services.speech.downloadModel).toHaveBeenCalledOnce());
    expect(services.assets.ensureWeeks).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid imports and requires inspection and a current backup before replacement', async () => {
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:backup'), revokeObjectURL: vi.fn() }),
    );
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { services, value } = fakeServices();
    services.backup.inspectFile.mockRejectedValueOnce(new Error('Invalid backup'));
    renderWithApp(
      <WebServicesProvider {...value}>
        <WebSettings />
      </WebServicesProvider>,
    );
    const input = screen.getByLabelText('导入备份');
    fireEvent.change(input, { target: { files: [new File(['bad'], 'bad.json')] } });
    expect(await screen.findByText(/操作未完成/)).toBeInTheDocument();
    expect(services.backup.importFile).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { files: [new File(['good'], 'good.json')] } });
    const confirm = await screen.findByRole('button', { name: '确认替换当前记录' });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '导出全部学习数据' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '下载备份文件' })).toBeEnabled());
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '下载备份文件' }));
    await waitFor(() => expect(confirm).toBeEnabled());
    expect(screen.getByText(/备份日期：2026-10-29；录音：3 段/)).toBeInTheDocument();
    fireEvent.click(confirm);
    expect(await screen.findByRole('button', { name: '重新打开应用' })).toBeInTheDocument();
    expect(services.backup.importFile).toHaveBeenCalledOnce();
  });
});
