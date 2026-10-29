/**
 * Fetches the free, offline speech models.
 *
 *   npm run models:download                    # Whisper base.en (int8) for the app, ~160 MB on disk
 *   npm run models:download -- --with-kokoro   # also Kokoro TTS, only needed to generate course audio
 *
 * Re-uses anything already in .models/ (archives or extracted folders). Safe to re-run: finished
 * files are skipped and interrupted downloads resume. Integrity check is by byte size (the
 * upstream release publishes no checksums).
 */
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT } from './lib/content-files';
import { download, extractTarBz2 } from './lib/download';
import { DEV_MODELS_DIR, KOKORO_DIR, WHISPER_DIR } from './lib/paths';

const RELEASE = 'https://github.com/k2-fsa/sherpa-onnx/releases/download';
const DOWNLOADS = join(DEV_MODELS_DIR, '_download');

const WHISPER = {
  url: `${RELEASE}/asr-models/sherpa-onnx-whisper-base.en.tar.bz2`,
  archive: join(DOWNLOADS, 'whisper-base.en.tar.bz2'),
  folder: 'sherpa-onnx-whisper-base.en',
  files: {
    'encoder.int8.onnx': 'base.en-encoder.int8.onnx',
    'decoder.int8.onnx': 'base.en-decoder.int8.onnx',
    'tokens.txt': 'base.en-tokens.txt',
  } as Record<string, string>,
};

const KOKORO = {
  url: `${RELEASE}/tts-models/kokoro-en-v0_19.tar.bz2`,
  archive: join(DOWNLOADS, 'kokoro-en-v0_19.tar.bz2'),
};

const rel = (p: string) => relative(ROOT, p);
const nonEmpty = (p: string) => existsSync(p) && statSync(p).size > 0;

async function ensureArchive(url: string, archive: string): Promise<void> {
  if (nonEmpty(archive)) return;
  mkdirSync(DOWNLOADS, { recursive: true });
  console.log(`downloading ${url}`);
  await download(url, archive);
}

async function whisper(): Promise<void> {
  const targets = Object.keys(WHISPER.files).map((f) => join(WHISPER_DIR, f));
  if (targets.every(nonEmpty)) {
    console.log(`whisper: already present in ${rel(WHISPER_DIR)}`);
    return;
  }
  const extracted = join(DEV_MODELS_DIR, WHISPER.folder);
  const sources = Object.values(WHISPER.files).map((f) => join(extracted, f));
  if (!sources.every(nonEmpty)) {
    await ensureArchive(WHISPER.url, WHISPER.archive);
    console.log('whisper: extracting');
    extractTarBz2(
      WHISPER.archive,
      DEV_MODELS_DIR,
      Object.values(WHISPER.files).map((f) => `${WHISPER.folder}/${f}`),
    );
  }
  mkdirSync(WHISPER_DIR, { recursive: true });
  const manifest: Record<string, number> = {};
  for (const [target, source] of Object.entries(WHISPER.files)) {
    copyFileSync(join(extracted, source), join(WHISPER_DIR, target));
    manifest[target] = statSync(join(WHISPER_DIR, target)).size;
  }
  writeFileSync(
    join(WHISPER_DIR, 'manifest.json'),
    `${JSON.stringify({ model: 'whisper-base.en int8', source: WHISPER.url, bytes: manifest }, null, 2)}\n`,
    'utf8',
  );
  console.log(`whisper: ready in ${rel(WHISPER_DIR)}`);
}

async function kokoro(): Promise<void> {
  if (nonEmpty(join(KOKORO_DIR, 'model.onnx')) && nonEmpty(join(KOKORO_DIR, 'voices.bin'))) {
    console.log(`kokoro: already present in ${rel(KOKORO_DIR)}`);
    return;
  }
  await ensureArchive(KOKORO.url, KOKORO.archive);
  console.log('kokoro: extracting');
  extractTarBz2(KOKORO.archive, DEV_MODELS_DIR);
  console.log(`kokoro: ready in ${rel(KOKORO_DIR)}`);
}

async function main(): Promise<void> {
  await whisper();
  if (process.argv.includes('--with-kokoro')) await kokoro();
}

main().catch((err: unknown) => {
  console.error(`models:download failed: ${(err as Error).message}`);
  process.exit(1);
});
