/**
 * Runtime content bundle: what `scripts/content-build.ts` writes to resources/content/bundle.json
 * and what the app reads. Everything is pre-resolved so the UI never has to look things up by hand.
 */
import type { Hint, Voice } from './schema';
import type { Token } from './tokenize';

export type ClipKey = string;

export interface Sentence {
  en: string;
  zh: string;
  audio: ClipKey;
}

/** A sentence she says herself: tokenised so each word can show its pronunciation hint. */
export interface SpokenSentence extends Sentence {
  tokens: Token[];
}

export interface WordEntry {
  key: string;
  text: string;
  zh: string;
  hint: Hint;
  audio: ClipKey;
}

/** Where a sentence fits one of the unit's pattern frames. */
export interface PatternMatch {
  /** Index into `UnitItem.patterns.frames`. */
  frame: number;
  /** Token range [start, end) that fills the ___, highlighted in the UI. */
  slot: [number, number];
}

export interface ChunkItem extends SpokenSentence {
  id: string;
  note?: string;
  accept?: string[];
  /** Set when the sentence already uses this unit's pattern ("🔑 tomorrow's pattern"). */
  pattern?: PatternMatch;
}

export interface PatternFrameItem {
  frame: string;
  zh: string;
  usage: string;
}

export interface PatternExampleItem extends SpokenSentence {
  id: string;
  scene: string;
  note?: string;
  accept?: string[];
  pattern: PatternMatch;
}

export interface DialogueReplyItem extends SpokenSentence {
  next: string;
}

export interface DialogueNodeItem {
  id: string;
  npc: Sentence;
  replies: DialogueReplyItem[];
}

export interface DialogueItem {
  title: string;
  setting: string;
  npcName: string;
  start: string;
  nodes: Record<string, DialogueNodeItem>;
}

/** 🏠 An everyday word in a daily-life sentence. */
export interface DailyItem extends SpokenSentence {
  id: string;
  /** Lexicon key of the word taught. */
  word: string;
  scene: string;
  note?: string;
  accept?: string[];
  /** Token range [start, end) of the word in the sentence, highlighted. */
  slot: [number, number];
}

export interface StoryLineItem extends SpokenSentence {
  /** Who says it; absent for narration. */
  speaker?: string;
}

export interface StoryItem {
  kind: 'narrative' | 'dialogue';
  title: string;
  setting?: string;
  lines: StoryLineItem[];
}

export interface StoriesItem {
  narrative: StoryItem;
  dialogue: StoryItem;
}

export interface WeekItem {
  week: number;
  unitIds: string[];
  stories: StoriesItem;
}

export interface UnitItem {
  id: string;
  kind: 'life' | 'work';
  week: number;
  title: string;
  titleEn: string;
  goal: string;
  chunks: ChunkItem[];
  words: string[];
  patterns: { frames: PatternFrameItem[]; examples: PatternExampleItem[] };
  daily: DailyItem[];
  stories: StoriesItem;
  grammar?: { title: string; body: string; examples: Sentence[] };
  phonics?: string;
  dialogue: DialogueItem;
  task: string;
}

export interface PhonicsPairItem {
  id: string;
  a: Sentence;
  b: Sentence;
}

export interface PhonicsItem {
  id: string;
  title: string;
  rule: string;
  mouth?: string;
  examples: Sentence[];
  pairs: PhonicsPairItem[];
}

export interface ChallengeItem {
  id: string;
  title: string;
  intro: string;
  prompts: Sentence[];
  maxSeconds: number;
}

export type PartKind = 'learn' | 'practice' | 'apply' | 'review' | 'challenge';

export interface Part {
  /** Stable progress key, e.g. "u03:learn", "w02:review", "ch01". */
  id: string;
  kind: PartKind;
  week: number;
  /** 1–7 within the week; challenges share the day of the part that follows / precedes them. */
  day: number;
  title: string;
  /** learn/practice/apply: the unit. review: every unit of the week. */
  unitIds: string[];
  challengeId?: string;
  /** Light parts (challenges) ride along with a regular part instead of taking a day of their own. */
  light: boolean;
}

export interface ClipSpec {
  text: string;
  voice: Voice;
}

export interface ContentBundle {
  contentVersion: string;
  /** Hash of all content inputs; changes whenever any content file changes. */
  contentHash: string;
  lexicon: Record<string, WordEntry>;
  units: Record<string, UnitItem>;
  phonics: Record<string, PhonicsItem>;
  challenges: Record<string, ChallengeItem>;
  /** Keyed by week number ("1", "2", ...). */
  weeks: Record<string, WeekItem>;
  parts: Part[];
  clips: Record<ClipKey, ClipSpec>;
}

/** Card ids used by the review scheduler. */
export type CardKind = 'chunk' | 'word' | 'pair' | 'example';

export function cardId(kind: CardKind, itemId: string): string {
  return `${kind}:${itemId}`;
}

export function parseCardId(id: string): { kind: CardKind; itemId: string } {
  const i = id.indexOf(':');
  const kind = id.slice(0, i);
  if (kind !== 'chunk' && kind !== 'word' && kind !== 'pair' && kind !== 'example') throw new Error(`Unknown card id: ${id}`);
  return { kind, itemId: id.slice(i + 1) };
}
