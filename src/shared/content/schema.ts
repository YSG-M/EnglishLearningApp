/**
 * Authoring schema for everything under `content/`.
 *
 * These are the shapes a content author writes by hand. `compile.ts` turns them into the
 * runtime bundle the app loads. IDs are permanent: learner progress is keyed by them, so an ID
 * may be retired but never reused or renamed (see docs/content/authoring-guide.md).
 */
import { z } from 'zod';

const id = (pattern: RegExp, hint: string) => z.string().regex(pattern, hint);

export const UNIT_ID = /^u\d{2}$/;
export const CHUNK_ID = /^u\d{2}\.c\d{2}$/;
export const PHONICS_ID = /^p\d{2}$/;

export const HintGrade = z.enum(['green', 'yellow', 'red']);
export type HintGrade = z.infer<typeof HintGrade>;

/**
 * Chinese pronunciation aid for one word.
 * green  = the Chinese sound is close enough to use as-is
 * yellow = close, but `note` says what to adjust
 * red    = Chinese has no such sound: no 谐音 at all, only `note` (mouth position)
 */
export const Hint = z
  .object({
    grade: HintGrade,
    /** 汉字谐音, e.g. 哈喽. Forbidden for red. */
    hanzi: z.string().min(1).optional(),
    /** Pinyin-style detail, e.g. "kǎ(p)": parentheses = mouth shape only, no sound. */
    pinyin: z.string().min(1).optional(),
    note: z.string().min(1).optional(),
  })
  .superRefine((h, ctx) => {
    if (h.grade === 'red') {
      if (h.hanzi) ctx.addIssue({ code: 'custom', message: 'red hints must not carry a 谐音 (hanzi)' });
      if (!h.note) ctx.addIssue({ code: 'custom', message: 'red hints need a note explaining the mouth position' });
    } else if (!h.hanzi) {
      ctx.addIssue({ code: 'custom', message: `${h.grade} hints need hanzi` });
    }
    if (h.grade === 'yellow' && !h.note && !h.pinyin) {
      ctx.addIssue({ code: 'custom', message: 'yellow hints need a note or pinyin saying what to adjust' });
    }
  });
export type Hint = z.infer<typeof Hint>;

export const LexiconEntry = z.object({
  /** Display form, e.g. "I'm". The lookup key is its lower-cased form. */
  text: z.string().min(1),
  zh: z.string().min(1),
  hint: Hint,
});
export type LexiconEntry = z.infer<typeof LexiconEntry>;

export const Lexicon = z.array(LexiconEntry);

const Sentence = z.object({
  en: z.string().min(1),
  zh: z.string().min(1),
});

export const Chunk = Sentence.extend({
  id: id(CHUNK_ID, 'chunk ids look like u01.c01'),
  /** Plain-language usage note in Chinese. */
  note: z.string().min(1).optional(),
  /** Other answers that also count as correct when she says it from memory. */
  accept: z.array(z.string().min(1)).optional(),
});
export type Chunk = z.infer<typeof Chunk>;

export const Drill = z.object({
  /** Sentence frame with exactly one "___", e.g. "Can I have ___, please?" */
  pattern: z.string().regex(/^[^_]*___[^_]*$/, 'a drill pattern needs exactly one ___'),
  zh: z.string().min(1),
  fills: z.array(Sentence).min(3).max(6),
});
export type Drill = z.infer<typeof Drill>;

export const Grammar = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  examples: z.array(Sentence).min(1),
});

export const Voice = z.enum(['bf_emma', 'bf_isabella', 'bm_george', 'bm_lewis', 'af_sarah', 'am_michael']);
export type Voice = z.infer<typeof Voice>;

export const DialogueReply = Sentence.extend({ next: z.string().min(1) });

export const DialogueNode = z.object({
  id: z.string().min(1),
  npc: Sentence,
  /** Empty on the closing line. */
  replies: z.array(DialogueReply).max(3),
});

export const Dialogue = z.object({
  title: z.string().min(1),
  /** Where she is and who she is talking to, in Chinese. */
  setting: z.string().min(1),
  npcName: z.string().min(1),
  npcVoice: Voice,
  start: z.string().min(1),
  nodes: z.array(DialogueNode).min(2),
});
export type Dialogue = z.infer<typeof Dialogue>;

export const UnitKind = z.enum(['life', 'work']);

export const Unit = z.object({
  id: id(UNIT_ID, 'unit ids look like u01'),
  kind: UnitKind,
  title: z.string().min(1),
  titleEn: z.string().min(1),
  /** What she can do after this unit, in Chinese. */
  goal: z.string().min(1),
  chunks: z.array(Chunk).min(4).max(12),
  /** Lexicon keys (lower-case) that become vocabulary review cards. */
  words: z.array(z.string().min(1)).min(3).max(14),
  drill: Drill,
  grammar: Grammar.optional(),
  phonics: id(PHONICS_ID, 'phonics ids look like p01').optional(),
  dialogue: Dialogue,
  /** 今日实战任务: one small real-life action. */
  task: z.string().min(1),
});
export type Unit = z.infer<typeof Unit>;

export const PhonicsPair = z.object({
  id: z.string().regex(/^p\d{2}\.m\d{2}$/, 'pair ids look like p01.m01'),
  a: Sentence,
  b: Sentence,
});

export const PhonicsUnit = z.object({
  id: id(PHONICS_ID, 'phonics ids look like p01'),
  title: z.string().min(1),
  /** The rule in plain Chinese. */
  rule: z.string().min(1),
  /** How to shape the mouth, in Chinese. */
  mouth: z.string().min(1).optional(),
  examples: z.array(Sentence).min(3).max(8),
  /** Minimal pairs for listening discrimination. */
  pairs: z.array(PhonicsPair).max(6),
});
export type PhonicsUnit = z.infer<typeof PhonicsUnit>;

export const Challenge = z.object({
  id: z.string().regex(/^ch\d{2}$/),
  title: z.string().min(1),
  intro: z.string().min(1),
  /** Things she can talk about, each with an English starter. */
  prompts: z.array(Sentence).min(2),
  maxSeconds: z.number().int().min(20).max(120),
});
export type Challenge = z.infer<typeof Challenge>;

export const CurriculumWeek = z.object({
  week: z.number().int().min(1),
  units: z.array(id(UNIT_ID, 'unit id')).min(1).max(2),
  /** Challenge recorded before this week's first unit. */
  challengeBefore: z.string().optional(),
  /** Challenge recorded on this week's review day. */
  challengeAfter: z.string().optional(),
});

export const Curriculum = z.object({
  contentVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  defaultVoice: Voice,
  weeks: z.array(CurriculumWeek).min(1),
  challenges: z.array(Challenge),
});
export type Curriculum = z.infer<typeof Curriculum>;
