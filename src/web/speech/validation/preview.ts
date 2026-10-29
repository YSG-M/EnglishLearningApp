import { resample } from '../../../renderer/src/audio/resample';

const run = async () => {
  const manifest = await (await fetch('/models-manifest.json')).json();
  const files = await Promise.all(
    manifest.files.map(async (file: { url: string }) => ({
      path: file.url,
      buffer: await (await fetch(`/${file.url}`)).arrayBuffer(),
    })),
  );
  const worker = new Worker(new URL('./smoke.worker.ts', import.meta.url), { type: 'module' });
  let next = 0;
  const request = (message: object) =>
    new Promise<unknown>((resolve, reject) => {
      worker.onmessage = ({ data }) => (data.error ? reject(new Error(data.error)) : resolve(data));
      worker.onerror = (event) => reject(new Error(event.message));
      worker.postMessage({ ...message, id: ++next });
    });
  try {
    const init = await request({ type: 'init', files });
    const clips = (await (await fetch('/clips.json')).json()) as string[];
    const context = new AudioContext();
    const results = [];
    try {
      for (const clip of clips) {
        const audio = await context.decodeAudioData(await (await fetch(`/audio/${clip}`)).arrayBuffer());
        const samples = resample(audio.getChannelData(0), audio.sampleRate, 16000);
        results.push({
          clip,
          audioSeconds: samples.length / 16000,
          ...((await request({ type: 'recognize', samples })) as object),
        });
      }
    } finally {
      await context.close();
    }
    await request({ type: 'dispose' });
    return { init, results };
  } finally {
    worker.terminate();
  }
};
(globalThis as unknown as { runSpeech: typeof run }).runSpeech = run;
