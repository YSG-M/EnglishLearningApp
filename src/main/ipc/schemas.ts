/**
 * Runtime validation of every argument the renderer sends. The renderer is trusted code, but a
 * bug there must produce a clear INVALID_INPUT error, never corrupt the database.
 */
import { z } from 'zod';
import type { ApiChannel } from '../../shared/ipc';
import { Settings } from '../../shared/settings';

const MAX_AUDIO_SAMPLES = 16000 * 130; // a bit over the longest challenge (120 s)

const audio = z
  .instanceof(Float32Array)
  .refine((a) => a.length > 0 && a.length <= MAX_AUDIO_SAMPLES, 'audio must be 0–130 s long');
const shortId = z.string().min(1).max(120);
const activeMs = z.number().finite().min(0).max(3_600_000);
const grade = z.enum(['again', 'hard', 'good']);
const exercise = z.enum(['listen-choose', 'speak-from-zh', 'recall-self-rate', 'pair-discriminate']);

const none = z.tuple([]);

/**
 * A settings patch. Not `Settings.partial()`: in zod 4 that still applies each field's default,
 * so `{ reviewCap: 30 }` would silently reset every other setting.
 */
export const SettingsPatch = z
  .object(
    Object.fromEntries(
      Object.entries(Settings.shape).map(([k, s]) => [
        k,
        (s as unknown as z.ZodDefault<z.ZodType>).unwrap().optional(),
      ]),
    ) as { [K in keyof typeof Settings.shape]: z.ZodOptional<z.ZodType<z.infer<typeof Settings>[K]>> },
  )
  .strict();

export const CHANNEL_ARGS = {
  'app.getInfo': none,
  'content.getBundle': none,
  'today.get': none,
  'today.addActiveTime': z.tuple([activeMs]),
  'parts.complete': z.tuple([z.object({ partId: shortId, activeMs })]),
  'parts.listCompleted': none,
  'review.getQueue': none,
  'review.submit': z.tuple([z.object({ cardId: shortId, exercise, grade, activeMs })]),
  'review.getPracticeSet': z.tuple([
    z.discriminatedUnion('scope', [
      z.object({ scope: z.literal('recent') }),
      z.object({ scope: z.literal('unit'), unitId: shortId }),
      z.object({ scope: z.literal('random'), count: z.number().int().min(1).max(100) }),
    ]),
  ]),
  'speech.getStatus': none,
  'speech.recognize': z.tuple([
    z.object({ samples: audio, sampleRate: z.literal(16000), itemId: shortId, keep: z.boolean() }),
  ]),
  'speech.annotateRecording': z.tuple([
    z.object({ recordingId: shortId, score: z.number().min(0).max(1), transcript: z.string().max(2000) }),
  ]),
  'hints.getProgress': none,
  'hints.recordCorrect': z.tuple([z.array(z.string().min(1).max(64)).max(100)]),
  'recordings.list': z.tuple([shortId]),
  'recordings.saveChallenge': z.tuple([
    z.object({ challengeId: shortId, samples: audio, sampleRate: z.literal(16000) }),
  ]),
  'recordings.listChallenges': none,
  'progress.getStats': none,
  'settings.get': none,
  'settings.update': z.tuple([SettingsPatch]),
  'diagnostics.openLogsFolder': none,
  'diagnostics.exportBundle': none,
  'log.write': z.tuple([
    z.enum(['info', 'warn', 'error']),
    z.string().max(4000),
    z.record(z.string(), z.unknown()).optional(),
  ]),
} satisfies Record<ApiChannel, z.ZodTuple>;
