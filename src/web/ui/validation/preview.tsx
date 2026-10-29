/* @jsxRuntime automatic */
import { createRoot } from 'react-dom/client';
import { App } from '../../../renderer/src/App';
import { setApi } from '../../../renderer/src/api/client';
import { createMockApi, fixtureBundle } from '../../../renderer/src/api/mockApi';
import { WebServicesProvider, type WebServices } from '../WebServices';
import '../../../renderer/src/styles/global.css';

// This isolated fixture never opens personal storage or loads a speech model.
setApi(createMockApi());
const idle = { phase: 'idle' as const, completedBytes: 0, totalBytes: 0, completedFiles: 0, totalFiles: 0 };
const services: WebServices = {
  assets: {
    getBundle: async () => fixtureBundle(),
    resolveClip: (key) => `/audio/${key}`,
    ensureWeeks: async () => {},
    getAvailableWeeks: async () => [1],
    downloadModelFiles: async () => {},
    removeModelFiles: async () => {},
    modelFiles: async () => [],
    pause: () => {},
    subscribe: () => () => {},
    getState: () => idle,
    checkForUpdate: async () => false,
    activateUpdate: async () => {},
  },
  speech: {
    getStatus: async () => ({ state: 'unavailable' }),
    recognize: async () => '',
    downloadModel: async () => {},
    removeModel: async () => {},
    cancel: () => {},
    subscribe: () => () => {},
    dispose: () => {},
  },
  backup: {
    exportFile: async () => new Blob(['fixture']),
    inspectFile: async () => ({ createdAt: '2026-10-29', recordingCount: 0 }),
    importFile: async () => {},
    storageStatus: async () => ({ persistent: false, usage: 0, quota: 100000000 }),
  },
};
createRoot(document.getElementById('root')!).render(
  <WebServicesProvider {...services}>
    <App />
  </WebServicesProvider>,
);
