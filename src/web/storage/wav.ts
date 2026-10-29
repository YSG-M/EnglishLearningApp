import { AppError } from './errors';

export function validateAudio(samples: Float32Array, sampleRate: number): void {
  if (
    !(samples instanceof Float32Array) ||
    sampleRate !== 16000 ||
    !samples.length ||
    samples.length > 16000 * 130 ||
    samples.some((s) => !Number.isFinite(s))
  )
    throw new AppError('INVALID_INPUT', '录音格式无效。');
}
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  validateAudio(samples, sampleRate);
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) =>
    [...value].forEach((c, i) => {
      bytes[offset + i] = c.charCodeAt(0);
    });
  text(0, 'RIFF');
  view.setUint32(4, bytes.length - 8, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => {
    const n = Math.max(-1, Math.min(1, s));
    view.setInt16(44 + i * 2, Math.round(n * (n < 0 ? 32768 : 32767)), true);
  });
  return new Blob([bytes], { type: 'audio/wav' });
}
export function validWav(bytes: Uint8Array): boolean {
  if (bytes.length < 46 || bytes.length > 44 + 16000 * 130 * 2 || bytes.length % 2) return false;
  const text = (a: number, b: number) => String.fromCharCode(...bytes.slice(a, b));
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return (
    text(0, 4) === 'RIFF' &&
    text(8, 12) === 'WAVE' &&
    text(12, 16) === 'fmt ' &&
    text(36, 40) === 'data' &&
    v.getUint32(4, true) === bytes.length - 8 &&
    v.getUint32(16, true) === 16 &&
    v.getUint16(20, true) === 1 &&
    v.getUint16(22, true) === 1 &&
    v.getUint32(24, true) === 16000 &&
    v.getUint32(28, true) === 32000 &&
    v.getUint16(32, true) === 2 &&
    v.getUint16(34, true) === 16 &&
    v.getUint32(40, true) === bytes.length - 44
  );
}
