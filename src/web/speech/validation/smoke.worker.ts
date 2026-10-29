import { SherpaEngine } from '../sherpa-engine';
import { MODEL_ID } from '../model';
const engine = new SherpaEngine();
globalThis.onmessage = async ({ data }) => {
  try {
    const start = performance.now();
    let text: string | undefined;
    if (data.type === 'init') await engine.init(MODEL_ID, data.files);
    else if (data.type === 'recognize') text = await engine.recognize(data.samples, 16000);
    else engine.dispose();
    globalThis.postMessage({
      text,
      durationMs: performance.now() - start,
      wasmMemoryBytes: engine.memoryBytes(),
    });
  } catch (error) {
    globalThis.postMessage({ error: String(error) });
  }
};
