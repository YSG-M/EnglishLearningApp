/**
 * Entry point of the speech utility process (Electron utilityProcess).
 * Owns the Whisper model so recognition never blocks the main process; if the native code
 * crashes, only this process dies and the main process starts a new one.
 */
import type * as Sherpa from 'sherpa-onnx-node';
import type { OfflineRecognizer } from 'sherpa-onnx-node';
import type { HostRequest, HostResponse, WhisperModelFiles } from './protocol';

let recognizer: OfflineRecognizer | null = null;

function send(msg: HostResponse): void {
  process.parentPort.postMessage(msg);
}

async function load(model: WhisperModelFiles, numThreads: number): Promise<void> {
  // Loaded lazily: requiring the native addon costs time and memory we only pay when needed.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sherpa = require('sherpa-onnx-node') as typeof Sherpa;
  recognizer = await sherpa.OfflineRecognizer.createAsync({
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: {
      // base.en is English-only: no language/task options (verified working that way in the spike).
      whisper: { encoder: model.encoder, decoder: model.decoder },
      tokens: model.tokens,
      numThreads,
      debug: false,
    },
  });
}

async function handle(req: HostRequest): Promise<void> {
  try {
    if (req.type === 'init') {
      const t = Date.now();
      if (!recognizer) await load(req.model, req.numThreads);
      send({ type: 'ready', id: req.id, loadMs: Date.now() - t });
      return;
    }
    if (!recognizer) throw new Error('model not loaded');
    const t = Date.now();
    const stream = recognizer.createStream();
    stream.acceptWaveform({ samples: req.samples, sampleRate: req.sampleRate });
    const result = await recognizer.decodeAsync(stream);
    send({ type: 'result', id: req.id, text: (result.text ?? '').trim(), decodeMs: Date.now() - t });
  } catch (err) {
    send({ type: 'error', id: req.id, message: err instanceof Error ? err.message : String(err) });
  }
}

// Requests are handled one at a time: Whisper is CPU-bound, parallel decodes only slow each other.
let chain: Promise<void> = Promise.resolve();
process.parentPort.on('message', (e: { data: HostRequest }) => {
  chain = chain.then(() => handle(e.data));
});
