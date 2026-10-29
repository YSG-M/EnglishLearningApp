import { createWorkerHandler } from './worker-handler';
import type { SpeechRequest, SpeechResponse } from './types';
import { SherpaEngine } from './sherpa-engine';

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<SpeechRequest>) => void) | null;
  postMessage(response: SpeechResponse): void;
};
const handle = createWorkerHandler(new SherpaEngine(), (response) => scope.postMessage(response));
scope.onmessage = ({ data }) => handle(data);
