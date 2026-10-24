import { describe, expect, it } from 'vitest';
import { concatFloat32, resample, rms } from './resample';
import { encodeWav } from './wav';

describe('resample', () => {
  it('downsamples 48 kHz to 16 kHz with the right length', () => {
    const input = new Float32Array(48000);
    expect(resample(input, 48000).length).toBe(16000);
  });

  it('keeps a constant signal constant', () => {
    const out = resample(new Float32Array(4800).fill(0.5), 48000);
    expect(out.length).toBe(1600);
    for (const v of out) expect(v).toBeCloseTo(0.5, 6);
  });

  it('preserves a low-frequency tone (200 Hz) almost unchanged', () => {
    const rate = 44100;
    const input = new Float32Array(rate).map((_, i) => Math.sin((2 * Math.PI * 200 * i) / rate));
    const out = resample(input, rate);
    expect(out.length).toBe(16000);
    // RMS of a unit sine is 1/sqrt(2); averaging attenuates 200 Hz by well under 1%.
    expect(rms(out)).toBeGreaterThan(0.7);
    expect(rms(out)).toBeLessThan(0.71);
  });

  it('attenuates content above the new Nyquist frequency', () => {
    const rate = 48000;
    const input = new Float32Array(rate).map((_, i) => Math.sin((2 * Math.PI * 12000 * i) / rate));
    expect(rms(resample(input, rate))).toBeLessThan(0.3);
  });

  it('upsamples by interpolation', () => {
    const out = resample(new Float32Array([0, 1]), 8000);
    expect(out.length).toBe(4);
    expect(out[0]).toBe(0);
    expect(out[1]).toBeCloseTo(0.5);
  });

  it('returns a copy when rates match and handles empty input', () => {
    const input = new Float32Array([0.1, 0.2]);
    const out = resample(input, 16000);
    expect(out).not.toBe(input);
    expect([...out]).toEqual([...input]);
    expect(resample(new Float32Array(0), 48000).length).toBe(0);
  });
});

describe('helpers', () => {
  it('concatenates chunks', () => {
    expect([...concatFloat32([new Float32Array([1]), new Float32Array([2, 3])])]).toEqual([1, 2, 3]);
  });

  it('encodes a valid 16-bit mono WAV header', () => {
    const buf = encodeWav(new Float32Array([0, 1, -1]), 16000);
    const v = new DataView(buf);
    expect(buf.byteLength).toBe(44 + 6);
    expect(String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3))).toBe('RIFF');
    expect(v.getUint32(24, true)).toBe(16000);
    expect(v.getInt16(46, true)).toBe(0x7fff);
    expect(v.getInt16(48, true)).toBe(-0x8000);
  });
});
