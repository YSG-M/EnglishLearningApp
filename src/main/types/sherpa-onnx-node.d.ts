// Minimal typings for the parts of sherpa-onnx-node this app uses (the package ships JSDoc only).
declare module 'sherpa-onnx-node' {
  export interface Waveform {
    samples: Float32Array;
    sampleRate: number;
  }

  export interface OfflineRecognizerConfig {
    featConfig?: { sampleRate?: number; featureDim?: number };
    modelConfig: {
      whisper?: { encoder: string; decoder: string; language?: string; task?: string; tailPaddings?: number };
      tokens: string;
      numThreads?: number;
      debug?: boolean | number;
      provider?: string;
    };
  }

  export class OfflineStream {
    acceptWaveform(w: Waveform): void;
  }

  export class OfflineRecognizer {
    constructor(config: OfflineRecognizerConfig);
    static createAsync(config: OfflineRecognizerConfig): Promise<OfflineRecognizer>;
    createStream(): OfflineStream;
    decode(stream: OfflineStream): void;
    decodeAsync(stream: OfflineStream): Promise<{ text: string }>;
    getResult(stream: OfflineStream): { text: string };
  }

  export interface OfflineTtsConfig {
    model: {
      kokoro?: { model: string; voices: string; tokens: string; dataDir?: string; lengthScale?: number };
      numThreads?: number;
      debug?: boolean | number;
    };
    maxNumSentences?: number;
  }

  export class OfflineTts {
    constructor(config: OfflineTtsConfig);
    readonly numSpeakers: number;
    readonly sampleRate: number;
    generate(req: { text: string; sid?: number; speed?: number }): Waveform;
  }

  export function writeWave(path: string, w: Waveform): void;
  export function readWave(path: string): Waveform;
}
