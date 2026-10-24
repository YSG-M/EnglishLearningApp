/**
 * Whisper "hears" words in silence (a known hallucination). Recordings without real speech
 * never reach the model; the UI then says "没听到声音".
 */
export const SILENCE_RMS = 0.006;
/** Shorter than this cannot be a word. */
export const MIN_SPEECH_MS = 250;

export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i] ?? 0;
    sum += s * s;
  }
  return Math.sqrt(sum / samples.length);
}

/** Loudest 50 ms window: robust to long quiet stretches around a short answer like "Yes." */
export function peakWindowRms(samples: Float32Array, sampleRate: number): number {
  const win = Math.max(1, Math.floor(sampleRate * 0.05));
  let best = 0;
  for (let start = 0; start < samples.length; start += win) {
    best = Math.max(best, rms(samples.subarray(start, Math.min(samples.length, start + win))));
  }
  return best;
}

export function isSilent(samples: Float32Array, sampleRate: number): boolean {
  if ((samples.length / sampleRate) * 1000 < MIN_SPEECH_MS) return true;
  return peakWindowRms(samples, sampleRate) < SILENCE_RMS * 3;
}
