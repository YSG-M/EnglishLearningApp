/**
 * Generates course audio with Kokoro (offline, free) for every clip in the content bundle.
 *
 *   npm run content:audio                 # generate what is missing
 *   npm run content:audio -- --limit 5    # quick test
 *   npm run content:audio -- --prune      # also delete wav files no clip refers to any more
 *   npm run content:audio -- --force      # regenerate everything (e.g. after changing TTS_SPEED)
 *
 * Clip keys hash voice + text, so editing a sentence produces a new key and only that clip is
 * regenerated. Each file is written to *.tmp and renamed, so an interrupted run leaves no
 * half-written wav and simply resumes next time.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { cpus } from 'node:os';
import { join, relative } from 'node:path';
import type { ContentBundle } from '../src/shared/content/bundle';
import { planAudio, speakerId } from './lib/audio-plan';
import { ROOT } from './lib/content-files';
import { AUDIO_DIR, BUNDLE_FILE, KOKORO_DIR } from './lib/paths';

/** Slightly slower than natural speed: she is a beginner; the 🐢 button slows further. */
const TTS_SPEED = 0.9;

interface GeneratedAudio {
  samples: Float32Array;
  sampleRate: number;
}
interface Sherpa {
  OfflineTts: new (config: unknown) => {
    generate(req: { text: string; sid: number; speed: number }): GeneratedAudio;
  };
  writeWave(file: string, audio: GeneratedAudio): void;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function main(): void {
  const limit = Number(arg('--limit') ?? Infinity);
  const prune = process.argv.includes('--prune');
  const force = process.argv.includes('--force');

  if (!existsSync(BUNDLE_FILE)) {
    console.error(`No bundle at ${relative(ROOT, BUNDLE_FILE)}. Run: npm run content:build`);
    process.exit(1);
  }
  const modelFiles = ['model.onnx', 'voices.bin', 'tokens.txt', 'espeak-ng-data'].map((f) =>
    join(KOKORO_DIR, f),
  );
  const missingModel = modelFiles.filter((f) => !existsSync(f));
  if (missingModel.length) {
    console.error(`Kokoro model not found (${missingModel.map((f) => relative(ROOT, f)).join(', ')}).`);
    console.error('Run: npm run models:download -- --with-kokoro');
    process.exit(1);
  }

  const bundle = JSON.parse(readFileSync(BUNDLE_FILE, 'utf8')) as ContentBundle;
  mkdirSync(AUDIO_DIR, { recursive: true });
  for (const f of readdirSync(AUDIO_DIR)) if (f.endsWith('.tmp')) unlinkSync(join(AUDIO_DIR, f));

  const plan = planAudio(bundle.clips, force ? [] : readdirSync(AUDIO_DIR));
  console.log(
    `clips: ${Object.keys(bundle.clips).length} total, ${plan.existing} present, ${plan.missing.length} to generate, ` +
      `${plan.orphans.length} orphaned`,
  );
  if (prune) {
    for (const f of plan.orphans) unlinkSync(join(AUDIO_DIR, f));
    if (plan.orphans.length) console.log(`pruned ${plan.orphans.length} orphaned file(s)`);
  } else if (plan.orphans.length) {
    console.log('(run with --prune to delete orphaned files)');
  }

  const todo = plan.missing.slice(0, limit);
  if (!todo.length) return;

  const sherpa = createRequire(__filename)('sherpa-onnx-node') as Sherpa;
  const tts = new sherpa.OfflineTts({
    model: {
      kokoro: {
        model: join(KOKORO_DIR, 'model.onnx'),
        voices: join(KOKORO_DIR, 'voices.bin'),
        tokens: join(KOKORO_DIR, 'tokens.txt'),
        dataDir: join(KOKORO_DIR, 'espeak-ng-data'),
      },
      numThreads: Math.max(1, Math.min(4, Math.floor(cpus().length / 2))),
    },
    maxNumSentences: 1,
  });

  const started = Date.now();
  todo.forEach((key, i) => {
    const clip = bundle.clips[key]!;
    const audio = tts.generate({ text: clip.text, sid: speakerId(clip.voice), speed: TTS_SPEED });
    const tmp = join(AUDIO_DIR, `${key}.wav.tmp`);
    sherpa.writeWave(tmp, { samples: audio.samples, sampleRate: audio.sampleRate });
    renameSync(tmp, join(AUDIO_DIR, `${key}.wav`));
    const done = i + 1;
    const eta = ((Date.now() - started) / done) * (todo.length - done);
    process.stdout.write(
      `\r  ${done}/${todo.length}  eta ${Math.round(eta / 1000)}s  ${clip.text.slice(0, 40).padEnd(40)}`,
    );
  });
  process.stdout.write('\n');
  console.log(`generated ${todo.length} clip(s) in ${Math.round((Date.now() - started) / 1000)}s`);
}

main();
