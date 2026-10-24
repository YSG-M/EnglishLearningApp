/**
 * The media:// scheme: the only way the renderer can read audio files from disk.
 *   media://audio/<clipKey>.wav  -> resources/audio
 *   media://rec/<file>.wav       -> <userData>/recordings
 * File names are matched against a strict pattern, so no path can escape those folders.
 */
import { join } from 'node:path';

export const MEDIA_FILE = /^[a-z0-9_-]{1,120}\.wav$/;

export type MediaKind = 'audio' | 'rec';

export interface MediaTarget {
  kind: MediaKind;
  file: string;
}

export function parseMediaUrl(url: string): MediaTarget | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'media:') return null;
  const kind = u.hostname;
  if (kind !== 'audio' && kind !== 'rec') return null;
  const file = decodeURIComponent(u.pathname.replace(/^\/+/, ''));
  if (!MEDIA_FILE.test(file)) return null;
  return { kind, file };
}

export function mediaFilePath(
  target: MediaTarget,
  dirs: { audioDir: string; recordingsDir: string },
): string {
  return join(target.kind === 'audio' ? dirs.audioDir : dirs.recordingsDir, target.file);
}

export function recordingUrl(file: string): string {
  return `media://rec/${file}`;
}
