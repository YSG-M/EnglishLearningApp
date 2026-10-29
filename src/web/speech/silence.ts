export function isSilent(samples: Float32Array, rate: number): boolean {
  if (samples.length / rate < 0.25) return true;
  const window = Math.max(1, Math.floor(rate * 0.05));
  for (let start = 0; start < samples.length; start += window) {
    const end = Math.min(samples.length, start + window);
    let sum = 0;
    for (let i = start; i < end; i++) sum += samples[i]! ** 2;
    if (Math.sqrt(sum / (end - start)) >= 0.018) return false;
  }
  return true;
}
