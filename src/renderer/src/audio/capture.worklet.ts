/**
 * AudioWorklet that forwards raw microphone samples (first channel) to the main thread in
 * batches of ~85 ms, so the recorder can measure level and keep the audio without dropping frames.
 */

// The AudioWorkletGlobalScope is not part of the DOM lib typings.
declare global {
  abstract class AudioWorkletProcessor {
    readonly port: MessagePort;
    abstract process(
      inputs: Float32Array[][],
      outputs: Float32Array[][],
      parameters: Record<string, Float32Array>,
    ): boolean;
  }
  function registerProcessor(name: string, ctor: new () => AudioWorkletProcessor): void;
}

const BATCH = 4096;

class CaptureProcessor extends AudioWorkletProcessor {
  private buffer = new Float32Array(BATCH);
  private filled = 0;

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    let offset = 0;
    while (offset < channel.length) {
      const n = Math.min(channel.length - offset, BATCH - this.filled);
      this.buffer.set(channel.subarray(offset, offset + n), this.filled);
      this.filled += n;
      offset += n;
      if (this.filled === BATCH) {
        this.port.postMessage(this.buffer);
        this.buffer = new Float32Array(BATCH);
        this.filled = 0;
      }
    }
    return true;
  }
}

registerProcessor('capture-processor', CaptureProcessor);

export {};
