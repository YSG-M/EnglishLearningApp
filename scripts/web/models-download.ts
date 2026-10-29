import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { extractTarBz2 } from '../lib/download';

const ROOT = resolve(import.meta.dirname, '../..');
const MODEL_ID = 'whisper-tiny-en-int8';
const SHERPA_VERSION = 'hf-9d5fc71d88ab1222ed1af2274fb194592af48455';
const RUNTIME_SOURCE = `https://huggingface.co/spaces/k2-fsa/web-assembly-vad-asr-sherpa-onnx-zh-zipformer-ctc/resolve/${SHERPA_VERSION.slice(3)}`;
const RUNTIME = [
  [
    'sherpa-onnx-wasm-main-vad-asr.js',
    95308,
    '8a7f50a3e4e5930749e8aff9ad98f03753b87490e7796c576947611439dae9d0',
  ],
  ['sherpa-onnx-asr.js', 47391, '6297ed7520e0b4569486cd89be89045146728605418254fec4172194abc36c8d'],
  [
    'sherpa-onnx-wasm-main-vad-asr.wasm',
    11722172,
    'e4dead1d159c531282e635069fa9e028175dee71f3f90908186994655425b3ce',
  ],
] as const;
const SOURCE =
  'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-tiny.en.tar.bz2';
// Measured from upstream asset 179374011 (updated 2024-07-13); upstream supplies no digest.
const SHA256 = '2bd6cf965c8bb3e068ef9fa2191387ee63a9dfa2a4e37582a8109641c20005dd';
const BYTES = 118071777;
const ARCHIVE = join(ROOT, '.models/_download/whisper-tiny.en.tar.bz2');
const FOLDER = 'sherpa-onnx-whisper-tiny.en';
const OUTPUT = join(ROOT, 'resources/web-models');
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

async function main(): Promise<void> {
  if (!existsSync(ARCHIVE)) {
    if (process.argv.includes('--check'))
      throw new Error('Pinned tiny.en archive missing; run without --check to prepare development assets');
    const response = await fetch(SOURCE);
    if (!response.ok) throw new Error(`Model download failed: HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length !== BYTES || hash(bytes) !== SHA256)
      throw new Error('Model archive SHA-256/size mismatch');
    mkdirSync(dirname(ARCHIVE), { recursive: true });
    writeFileSync(ARCHIVE, bytes);
  }
  const archive = readFileSync(ARCHIVE);
  if (archive.length !== BYTES || hash(archive) !== SHA256)
    throw new Error('Cached model archive SHA-256/size mismatch');
  const names = ['tiny.en-encoder.int8.onnx', 'tiny.en-decoder.int8.onnx', 'tiny.en-tokens.txt'];
  extractTarBz2(
    ARCHIVE,
    join(ROOT, '.models'),
    names.map((name) => `${FOLDER}/${name}`),
  );
  const files = names.map((name) => {
    const source = join(ROOT, '.models', FOLDER, name);
    const bytes = readFileSync(source);
    const digest = hash(bytes);
    const url = `models/${MODEL_ID}/${digest}/${name}`;
    const path = join(OUTPUT, url);
    mkdirSync(dirname(path), { recursive: true });
    copyFileSync(source, path);
    return { url, modelId: MODEL_ID, path, bytes: bytes.length, sha256: digest };
  });
  for (const [name, size, digest] of RUNTIME) {
    const source = join(ROOT, '.models/web-runtime', name);
    if (!existsSync(source)) {
      if (process.argv.includes('--check')) throw new Error(`Pinned runtime missing: ${name}`);
      const response = await fetch(`${RUNTIME_SOURCE}/${name}`);
      if (!response.ok) throw new Error(`Runtime download failed: ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length !== size || hash(bytes) !== digest)
        throw new Error(`Runtime integrity failure: ${name}`);
      mkdirSync(dirname(source), { recursive: true });
      writeFileSync(source, bytes);
    }
    const bytes = readFileSync(source);
    if (bytes.length !== size || hash(bytes) !== digest)
      throw new Error(`Cached runtime integrity failure: ${name}`);
    const url = `models/${MODEL_ID}/${digest}/${name}`;
    const path = join(OUTPUT, url);
    mkdirSync(dirname(path), { recursive: true });
    copyFileSync(source, path);
    files.push({ url, modelId: MODEL_ID, path, bytes: size, sha256: digest });
  }
  const licenses = join(ROOT, 'src/web/speech/licenses');
  for (const name of readdirSync(licenses)) {
    const source = join(licenses, name);
    const bytes = readFileSync(source);
    const digest = hash(bytes);
    const url = `models/${MODEL_ID}/${digest}/${name}`;
    const path = join(OUTPUT, url);
    mkdirSync(dirname(path), { recursive: true });
    copyFileSync(source, path);
    files.push({ url, modelId: MODEL_ID, path, bytes: bytes.length, sha256: digest });
  }
  mkdirSync(OUTPUT, { recursive: true });
  writeFileSync(
    join(OUTPUT, 'manifest.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        modelId: MODEL_ID,
        sherpaVersion: SHERPA_VERSION,
        artifactVerified: true,
        source: SOURCE,
        archiveSha256: SHA256,
        runtimeSource: RUNTIME_SOURCE,
        validation:
          'Desktop Chrome WASM Whisper smoke passed; iPhone validation remains manual. See wiki Now.',
        files,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  console.log(`Prepared and SHA-256 verified ${MODEL_ID}: ${files.reduce((n, f) => n + f.bytes, 0)} bytes.`);
  console.log(
    'Pinned browser runtime prepared. No phone download was triggered. iPhone performance remains untested.',
  );
}
main().catch((error: unknown) => {
  console.error(String(error));
  process.exitCode = 1;
});
