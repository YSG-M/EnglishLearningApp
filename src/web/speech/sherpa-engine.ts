import { MODEL_ID } from './model';
import type { OfflineEngine } from './worker-handler';

interface Stream {
  handle: number;
  acceptWaveform(rate: number, samples: Float32Array): void;
  free(): void;
}
interface Recognizer {
  handle: number;
  createStream(): Stream;
  decode(stream: Stream): void;
  getResult(stream: Stream): { text: string };
  free(): void;
}
interface Runtime {
  HEAPU8: Uint8Array;
  FS_createDataFile(
    parent: string,
    name: string,
    data: Uint8Array,
    read: boolean,
    write: boolean,
    own: boolean,
  ): void;
  FS_unlink(path: string): void;
}
type Constructor = new (config: object, runtime: Runtime) => Recognizer;

/** Owns one runtime per Worker; terminating the Worker releases its linear memory. */
export class SherpaEngine implements OfflineEngine {
  private runtime: Runtime | null = null;
  private recognizer: Recognizer | null = null;
  private paths: string[] = [];

  async init(modelId: string, files: { path: string; buffer: ArrayBuffer }[]): Promise<void> {
    if (this.runtime || modelId !== MODEL_ID) throw new Error('Invalid engine initialization');
    const get = (name: string) => {
      const matches = files.filter((file) => file.path.split('/').at(-1) === name);
      if (matches.length !== 1) throw new Error(`Missing or duplicate model asset: ${name}`);
      return matches[0]!.buffer;
    };
    const decoder = new TextDecoder();
    const source = decoder.decode(get('sherpa-onnx-wasm-main-vad-asr.js'));
    // The pinned upstream file starts with a Chinese-model file packager. Remove
    // only that prefix: all model/WASM bytes already came from the verified cache.
    const boundary = 'var moduleOverrides=Object.assign({},Module);';
    const start = source.indexOf(boundary);
    if (start < 0 || source.indexOf(boundary, start + 1) >= 0) throw new Error('Unexpected runtime format');
    const RuntimeFactory = new Function('Module', `${source.slice(start)};return Module;`) as (
      options: object,
    ) => Runtime;
    const OfflineRecognizer = new Function(
      `${decoder.decode(get('sherpa-onnx-asr.js'))};return OfflineRecognizer;`,
    )() as Constructor;
    let runtime!: Runtime;
    await new Promise<void>((resolve, reject) => {
      runtime = RuntimeFactory({
        wasmBinary: new Uint8Array(get('sherpa-onnx-wasm-main-vad-asr.wasm')),
        noInitialRun: true,
        locateFile: (path: string) => {
          if (!path.endsWith('.wasm')) throw new Error('Unexpected runtime asset');
          return path;
        },
        onRuntimeInitialized: resolve,
        onAbort: (reason: unknown) => reject(new Error(String(reason))),
      });
    });
    this.runtime = runtime;
    try {
      for (const [sourceName, name] of [
        ['tiny.en-encoder.int8.onnx', 'whisper-encoder.onnx'],
        ['tiny.en-decoder.int8.onnx', 'whisper-decoder.onnx'],
        ['tiny.en-tokens.txt', 'tokens.txt'],
      ] as const) {
        runtime.FS_createDataFile('/', name, new Uint8Array(get(sourceName)), true, false, true);
        this.paths.push(`/${name}`);
      }
      this.recognizer = new OfflineRecognizer(
        {
          featConfig: { sampleRate: 16000, featureDim: 80 },
          modelConfig: {
            whisper: {
              encoder: '/whisper-encoder.onnx',
              decoder: '/whisper-decoder.onnx',
              language: 'en',
              task: 'transcribe',
            },
            tokens: '/tokens.txt',
            numThreads: 1,
            provider: 'cpu',
            debug: 0,
          },
          decodingMethod: 'greedy_search',
        },
        runtime,
      );
      if (!this.recognizer.handle) throw new Error('Whisper recognizer initialization failed');
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  async recognize(samples: Float32Array, sampleRate: 16000): Promise<string> {
    if (!this.recognizer) throw new Error('Recognizer not initialized');
    const stream = this.recognizer.createStream();
    if (!stream.handle) throw new Error('Stream allocation failed');
    try {
      stream.acceptWaveform(sampleRate, samples);
      this.recognizer.decode(stream);
      return this.recognizer.getResult(stream).text.trim();
    } finally {
      stream.free();
    }
  }

  memoryBytes(): number {
    return this.runtime?.HEAPU8.buffer.byteLength ?? 0;
  }

  dispose(): void {
    if (this.recognizer?.handle) this.recognizer.free();
    this.recognizer = null;
    if (this.runtime) for (const path of this.paths) this.runtime.FS_unlink(path);
    this.paths = [];
    this.runtime = null;
  }
}
