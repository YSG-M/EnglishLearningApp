import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import type { ContentBundle } from '../../src/shared/content/bundle';
import type { AssetFile, WebManifest } from '../../src/web/assets/types';
import { validateManifest } from '../../src/web/assets/manifest';

import { fileEntry, hash, root, writeChanged } from './asset-files';
export { fileEntry, hash, root, writeChanged } from './asset-files';
export const encoding = ['-ac', '1', '-c:a', 'aac', '-b:a', '40k', '-movflags', '+faststart'];

export function clipWeeks(bundle: ContentBundle): Map<string, number[]> {
  const graph = new Map(Object.keys(bundle.clips).map((key) => [key, new Set<number>()]));
  const walk = (value: unknown, week: number) => {
    if (Array.isArray(value)) {
      value.forEach((v) => walk(v, week));
      return;
    }
    if (!value || typeof value !== 'object') return;
    const obj = value as Record<string, unknown>;
    if (typeof obj.audio === 'string') {
      const set = graph.get(obj.audio);
      if (!set) throw new Error(`Missing clip reference: ${obj.audio}`);
      set.add(week);
    }
    if (!obj.audio && typeof obj.key === 'string' && bundle.lexicon[obj.key])
      walk(bundle.lexicon[obj.key], week);
    for (const [key, v] of Object.entries(obj)) if (key !== 'key') walk(v, week);
  };
  for (const unit of Object.values(bundle.units)) {
    walk(unit, unit.week);
    for (const word of unit.words) {
      if (!bundle.lexicon[word]) throw new Error(`Missing word: ${word}`);
      walk(bundle.lexicon[word], unit.week);
    }
    if (unit.phonics) {
      if (!bundle.phonics[unit.phonics]) throw new Error(`Missing phonics: ${unit.phonics}`);
      walk(bundle.phonics[unit.phonics], unit.week);
    }
  }
  for (const week of Object.values(bundle.weeks)) walk(week, week.week);
  for (const part of bundle.parts)
    if (part.challengeId) {
      if (!bundle.challenges[part.challengeId]) throw new Error(`Missing challenge: ${part.challengeId}`);
      walk(bundle.challenges[part.challengeId], part.week);
    }
  // Lookup-only words and unused drills remain available in the initial offline library.
  for (const entry of Object.values(bundle.lexicon)) {
    if (!graph.has(entry.audio)) throw new Error(`Missing word audio: ${entry.audio}`);
    if (!graph.get(entry.audio)!.size) walk(entry, 1);
  }
  return new Map([...graph].map(([key, weeks]) => [key, [...weeks].sort((a, b) => a - b)]));
}

export function buildAssets(out = join(root, 'resources/web')): WebManifest {
  if (!ffmpeg || !existsSync(ffmpeg))
    throw new Error('ffmpeg-static executable is missing; approve its install script');
  for (const entry of readdirSync(join(root, 'public/web'))) {
    writeChanged(join(out, entry), readFileSync(join(root, 'public/web', entry)));
  }
  const bundleBytes = readFileSync(join(root, 'resources/content/bundle.json'));
  const bundle = JSON.parse(bundleBytes.toString('utf8')) as ContentBundle;
  const graph = clipWeeks(bundle);
  const bundleUrl = `content/bundle.${hash(bundleBytes)}.json`;
  writeChanged(join(out, bundleUrl), bundleBytes);
  const files: AssetFile[] = [fileEntry(out, bundleUrl, 'content', { required: true })];
  let converted = 0,
    sourceBytes = 0,
    sourceSeconds = 0,
    outputSeconds = 0;
  for (const [key, weeks] of graph) {
    const source = join(root, 'resources/audio', `${key}.wav`);
    const wav = readFileSync(source);
    sourceBytes += wav.length;
    // RIFF chunks are parsed rather than assuming a fixed WAV header size.
    let rate = 0;
    for (let offset = 12; offset + 8 <= wav.length;) {
      const tag = wav.toString('ascii', offset, offset + 4),
        length = wav.readUInt32LE(offset + 4);
      if (tag === 'fmt ') rate = wav.readUInt32LE(offset + 16);
      if (tag === 'data' && rate) sourceSeconds += length / rate;
      offset += 8 + length + (length % 2);
    }
    const fingerprint = hash(
      Buffer.concat([wav, Buffer.from(JSON.stringify({ encoding, ffmpeg: '5.3.0' }))]),
    );
    const url = `audio/${key}.${fingerprint.slice(0, 24)}.m4a`;
    const target = join(out, url);
    if (!existsSync(target)) {
      mkdirSync(dirname(target), { recursive: true });
      const result = spawnSync(
        ffmpeg,
        [
          '-nostdin',
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-i',
          source,
          ...encoding,
          '-f',
          'ipod',
          `${target}.tmp`,
        ],
        { encoding: 'utf8' },
      );
      if (result.status !== 0) throw new Error(`ffmpeg failed: ${result.stderr}`);
      renameSync(`${target}.tmp`, target);
      converted++;
    }
    files.push(fileEntry(out, url, 'audio', { clipKey: key, weeks }));
  }
  // Decode the complete playlist to measure encoded duration without a new ffprobe dependency.
  const list = files
    .filter((f) => f.kind === 'audio')
    .map((f) => `file '${join(out, f.url).replaceAll('\\', '/').replaceAll("'", "'\\''")}'`)
    .join('\n');
  const reportDir = join(root, 'resources/web-reports');
  writeChanged(join(reportDir, 'measure.ffconcat'), list);
  const measured = spawnSync(
    ffmpeg,
    [
      '-nostdin',
      '-hide_banner',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      join(reportDir, 'measure.ffconcat'),
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  );
  if (measured.status !== 0) throw new Error(`Duration measurement failed: ${measured.stderr}`);
  const times = [...measured.stderr.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)];
  const time = times.at(-1);
  if (time) outputSeconds = Number(time[1]) * 3600 + Number(time[2]) * 60 + Number(time[3]);
  const modelsPath = join(root, 'resources/web-models/manifest.json');
  if (existsSync(modelsPath)) {
    const models = JSON.parse(readFileSync(modelsPath, 'utf8')) as {
      files: { url: string; path: string; modelId: string; bytes: number; sha256: string }[];
    };
    for (const model of models.files) {
      if (!model.url.startsWith('models/') || model.url.includes('..')) throw new Error('Invalid model path');
      const bytes = readFileSync(resolve(root, model.path));
      if (model.bytes !== bytes.length || model.sha256 !== hash(bytes))
        throw new Error(`Model integrity mismatch: ${model.url}`);
      writeChanged(join(out, model.url), bytes);
      files.push(fileEntry(out, model.url, 'model', { modelId: model.modelId }));
    }
  }
  const appVersion = (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string })
    .version;
  const manifest = validateManifest({
    schemaVersion: 1,
    releaseId: hash(JSON.stringify(files)),
    appVersion,
    contentHash: bundle.contentHash,
    bundle: bundleUrl,
    files,
    modelsIncluded: files.some((f) => f.kind === 'model'),
  });
  writeChanged(join(out, 'web-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const report = {
    clips: graph.size,
    sourceBytes,
    sourceSeconds,
    encodedBytes: files.filter((f) => f.kind === 'audio').reduce((s, f) => s + f.bytes, 0),
    encodedDecodedSeconds: outputSeconds,
  };
  writeChanged(join(reportDir, 'measurement.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ...report, converted, modelsIncluded: manifest.modelsIncluded }));
  return manifest;
}
