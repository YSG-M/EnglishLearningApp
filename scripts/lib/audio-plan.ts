import type { ClipSpec } from '../../src/shared/content/bundle';

export interface AudioPlan {
  /** Clip keys with no wav file yet, in a stable order. */
  missing: string[];
  /** wav files in the audio folder that no clip refers to any more. */
  orphans: string[];
  existing: number;
}

const CLIP_FILE = /^(.+)\.wav$/;

/** Decides what to generate and what is stale. Clip keys are content hashes, so changed text = new key. */
export function planAudio(clips: Record<string, ClipSpec>, filesInAudioDir: string[]): AudioPlan {
  const present = new Set<string>();
  const orphans: string[] = [];
  for (const f of filesInAudioDir) {
    const m = CLIP_FILE.exec(f);
    if (!m) continue;
    if (clips[m[1]!]) present.add(m[1]!);
    else orphans.push(f);
  }
  const missing = Object.keys(clips)
    .filter((k) => !present.has(k))
    .sort();
  return { missing, orphans: orphans.sort(), existing: present.size };
}

/** Kokoro v0_19 speaker ids (see .agent-wiki/reusable.md). */
export const KOKORO_SPEAKERS: Record<string, number> = {
  af: 0,
  af_bella: 1,
  af_nicole: 2,
  af_sarah: 3,
  af_sky: 4,
  am_adam: 5,
  am_michael: 6,
  bf_emma: 7,
  bf_isabella: 8,
  bm_george: 9,
  bm_lewis: 10,
};

export function speakerId(voice: string): number {
  const id = KOKORO_SPEAKERS[voice];
  if (id === undefined) throw new Error(`Unknown Kokoro voice "${voice}"`);
  return id;
}
