import { z } from 'zod';

export const Settings = z.object({
  /** Show 谐音 / pinyin hints under words. Per-word hints still fade after 3 correct answers. */
  showHints: z.boolean().default(true),
  /** 'always' shows Chinese under every sentence; 'tap' hides it until tapped. */
  chineseMode: z.enum(['always', 'tap']).default('always'),
  /** Maximum reviews per day; the rest wait for later days. */
  reviewCap: z.number().int().min(5).max(60).default(20),
  /** Playback rate of the 🐢 slow button. */
  slowRate: z.number().min(0.5).max(0.95).default(0.75),
  /** Silence after speech that ends a recording automatically. */
  silenceMs: z.number().int().min(600).max(3000).default(1200),
  /** Optional English name used in on-screen greetings. */
  learnerName: z.string().max(40).default(''),
});
export type Settings = z.infer<typeof Settings>;

export const defaultSettings: Settings = Settings.parse({});

// Kept here for existing imports; the UI imports it from domain/hints to avoid bundling zod.
export { HINT_FADE_AFTER } from './domain/hints';
