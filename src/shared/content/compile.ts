/**
 * Validates authored content and compiles it into the runtime bundle.
 *
 * Pure: file reading and hashing are injected so the same code runs in the build script,
 * in tests, and (if ever needed) elsewhere.
 */
import type { z } from 'zod';
import type {
  ChallengeItem,
  ChunkItem,
  ClipKey,
  DailyItem,
  ClipSpec,
  ContentBundle,
  DialogueItem,
  Part,
  PatternExampleItem,
  PhonicsItem,
  Sentence,
  SpokenSentence,
  StoriesItem,
  StoryItem,
  UnitItem,
  WeekItem,
  WordEntry,
} from './bundle';
import { Curriculum, Lexicon, PhonicsUnit, Unit, WeekContent } from './schema';
import type { Stories } from './schema';
import type { Voice } from './schema';
import { matchFrames } from './pattern';
import { lexiconKey, tokenize } from './tokenize';

export interface RawContent {
  curriculum: { file: string; data: unknown };
  lexicon: { file: string; data: unknown }[];
  units: { file: string; data: unknown }[];
  phonics: { file: string; data: unknown }[];
  /** content/weeks/wNN.json (week stories). */
  weeks: { file: string; data: unknown }[];
}

export interface CompileResult {
  bundle?: ContentBundle;
  errors: string[];
  warnings: string[];
}

export type HashFn = (text: string) => string;

function parse<T extends z.ZodType>(schema: T, file: string, data: unknown, errors: string[]): z.infer<T> | undefined {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  for (const issue of r.error.issues) errors.push(`${file}: ${issue.path.join('.') || '(root)'}: ${issue.message}`);
  return undefined;
}

export function compileContent(raw: RawContent, hash: HashFn): CompileResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const curriculum = parse(Curriculum, raw.curriculum.file, raw.curriculum.data, errors);
  const lexiconEntries = raw.lexicon.flatMap((f) => (parse(Lexicon, f.file, f.data, errors) ?? []).map((e) => ({ e, file: f.file })));
  const units = raw.units.flatMap((f) => {
    const u = parse(Unit, f.file, f.data, errors);
    return u ? [{ u, file: f.file }] : [];
  });
  const phonicsUnits = raw.phonics.flatMap((f) => {
    const p = parse(PhonicsUnit, f.file, f.data, errors);
    return p ? [{ p, file: f.file }] : [];
  });
  const weekFiles = raw.weeks.flatMap((f) => {
    const w = parse(WeekContent, f.file, f.data, errors);
    return w ? [{ w, file: f.file }] : [];
  });
  // Files that failed to parse are left out; keep compiling the rest so one broken file does not hide
  // problems elsewhere. The bundle is still withheld when there are any errors (see the end).
  if (!curriculum) return { errors, warnings };

  const voice: Voice = curriculum.defaultVoice;
  const clips: Record<ClipKey, ClipSpec> = {};
  const clip = (text: string, v: Voice = voice): ClipKey => {
    const key = `${v}_${hash(`${v}|${text}`).slice(0, 16)}`;
    clips[key] = { text, voice: v };
    return key;
  };

  // ---- lexicon
  const lexicon: Record<string, WordEntry> = {};
  for (const { e, file } of lexiconEntries) {
    const key = lexiconKey(e.text);
    if (lexicon[key]) errors.push(`${file}: duplicate lexicon entry "${e.text}"`);
    lexicon[key] = { key, text: e.text, zh: e.zh, hint: e.hint, audio: clip(e.text) };
  }
  const usedKeys = new Set<string>();

  const spoken = (s: { en: string; zh: string }, where: string): SpokenSentence => {
    const tokens = tokenize(s.en);
    for (const t of tokens) {
      if (!t.key) continue;
      usedKeys.add(t.key);
      if (!lexicon[t.key]) errors.push(`${where}: "${t.surface}" is not in the lexicon (sentence: "${s.en}")`);
    }
    return { en: s.en, zh: s.zh, audio: clip(s.en), tokens };
  };
  const plain = (s: { en: string; zh: string }, v?: Voice): Sentence => ({ en: s.en, zh: s.zh, audio: clip(s.en, v) });

  // ---- phonics
  const phonics: Record<string, PhonicsItem> = {};
  for (const { p, file } of phonicsUnits) {
    if (phonics[p.id]) errors.push(`${file}: duplicate phonics id ${p.id}`);
    for (const pair of p.pairs) {
      if (!pair.id.startsWith(`${p.id}.`)) errors.push(`${file}: pair ${pair.id} must start with ${p.id}.`);
    }
    phonics[p.id] = {
      id: p.id,
      title: p.title,
      rule: p.rule,
      ...(p.mouth ? { mouth: p.mouth } : {}),
      examples: p.examples.map((s) => plain(s)),
      pairs: p.pairs.map((pair) => ({ id: pair.id, a: plain(pair.a), b: plain(pair.b) })),
    };
  }

  // ---- units
  const unitWeek = new Map<string, number>();
  for (const w of curriculum.weeks) {
    for (const uid of w.units) {
      if (unitWeek.has(uid)) errors.push(`curriculum: unit ${uid} is scheduled twice`);
      unitWeek.set(uid, w.week);
    }
  }

  const unitItems: Record<string, UnitItem> = {};
  const chunkIds = new Set<string>();
  const exampleIds = new Set<string>();
  const dailyIds = new Set<string>();
  for (const { u, file } of units) {
    if (unitItems[u.id]) errors.push(`${file}: duplicate unit id ${u.id}`);
    const week = unitWeek.get(u.id);
    if (week === undefined) {
      errors.push(`${file}: unit ${u.id} is not scheduled in the curriculum`);
      continue;
    }
    const chunks: ChunkItem[] = u.chunks.map((c) => {
      if (!c.id.startsWith(`${u.id}.`)) errors.push(`${file}: chunk ${c.id} must start with ${u.id}.`);
      if (chunkIds.has(c.id)) errors.push(`${file}: duplicate chunk id ${c.id}`);
      chunkIds.add(c.id);
      const s = spoken(c, `${file} ${c.id}`);
      const pattern = matchFrames(u.patterns.frames, s.tokens);
      return {
        ...s,
        id: c.id,
        ...(c.note ? { note: c.note } : {}),
        ...(c.accept ? { accept: c.accept } : {}),
        ...(pattern ? { pattern } : {}),
      };
    });
    for (const w of u.words) {
      const key = lexiconKey(w);
      usedKeys.add(key);
      if (!lexicon[key]) errors.push(`${file}: word "${w}" is not in the lexicon`);
    }
    if (u.phonics && !phonics[u.phonics]) errors.push(`${file}: phonics ${u.phonics} does not exist`);

    const examples: PatternExampleItem[] = [];
    for (const e of u.patterns.examples) {
      if (!e.id.startsWith(`${u.id}.`)) errors.push(`${file}: example ${e.id} must start with ${u.id}.`);
      if (exampleIds.has(e.id)) errors.push(`${file}: duplicate example id ${e.id}`);
      exampleIds.add(e.id);
      const s = spoken(e, `${file} ${e.id}`);
      const pattern = matchFrames(u.patterns.frames, s.tokens);
      if (!pattern) {
        const frames = u.patterns.frames.map((f) => f.frame).join(' / ');
        errors.push(`${file} ${e.id}: "${e.en}" does not fit the pattern ${frames}`);
        continue;
      }
      examples.push({
        ...s,
        id: e.id,
        scene: e.scene,
        ...(e.note ? { note: e.note } : {}),
        ...(e.accept ? { accept: e.accept } : {}),
        pattern,
      });
    }
    const daily: DailyItem[] = [];
    for (const d of u.daily) {
      if (!d.id.startsWith(`${u.id}.`)) errors.push(`${file}: daily word ${d.id} must start with ${u.id}.`);
      if (dailyIds.has(d.id)) errors.push(`${file}: duplicate daily word id ${d.id}`);
      dailyIds.add(d.id);
      const s = spoken(d, `${file} ${d.id}`);
      const key = lexiconKey(d.word);
      usedKeys.add(key);
      const at = s.tokens.findIndex((t) => t.key === key);
      if (at < 0) {
        errors.push(`${file} ${d.id}: the word "${d.word}" does not appear in "${d.en}"`);
        continue;
      }
      daily.push({
        ...s,
        id: d.id,
        word: key,
        scene: d.scene,
        ...(d.note ? { note: d.note } : {}),
        ...(d.accept ? { accept: d.accept } : {}),
        slot: [at, at + 1],
      });
    }
    const dialogue = compileDialogue(u.dialogue, file, errors, spoken, plain);
    const usesPattern = Object.values(dialogue.nodes).some((n) =>
      n.replies.some((r) => matchFrames(u.patterns.frames, r.tokens)),
    );
    if (!usesPattern) warnings.push(`${file}: no dialogue reply uses the unit's pattern`);

    unitItems[u.id] = {
      id: u.id,
      kind: u.kind,
      week,
      title: u.title,
      titleEn: u.titleEn,
      goal: u.goal,
      chunks,
      words: u.words.map(lexiconKey),
      patterns: { frames: u.patterns.frames, examples },
      daily,
      // Stories are compiled below, in curriculum order, once we know what has been taught.
      stories: EMPTY_STORIES,
      ...(u.grammar
        ? { grammar: { title: u.grammar.title, body: u.grammar.body, examples: u.grammar.examples.map((s) => plain(s)) } }
        : {}),
      ...(u.phonics ? { phonics: u.phonics } : {}),
      dialogue,
      task: u.task,
    };
  }
  for (const uid of unitWeek.keys()) {
    if (!unitItems[uid] && !units.some((x) => x.u.id === uid)) errors.push(`curriculum: unit ${uid} has no content file`);
  }

  // ---- stories: only words taught so far (in curriculum order) are expected
  const rawUnit = new Map(units.map((x) => [x.u.id, x]));
  const weekStories = new Map<number, { stories: Stories; file: string }>();
  for (const { w, file } of weekFiles) {
    if (weekStories.has(w.week)) errors.push(`${file}: duplicate stories for week ${w.week}`);
    weekStories.set(w.week, { stories: w.stories, file });
  }
  const taught = new Set<string>();
  const teach = (sentences: SpokenSentence[]) => {
    for (const s of sentences) for (const t of s.tokens) if (t.key) taught.add(t.key);
  };
  const story = (st: Stories, where: string): StoriesItem => {
    // Names of the people in the story are not vocabulary.
    const names = new Set(st.dialogue.cast.flatMap((c) => tokenize(c.name).flatMap((t) => (t.key ? [t.key] : []))));
    const line = (l: { en: string; zh: string; speaker?: string }, v: Voice | undefined, w: string) => {
      const s = spoken(l, w);
      // spoken() voices her lines; other speakers get their own voice.
      const audio = v && v !== voice ? clip(l.en, v) : s.audio;
      for (const t of s.tokens) {
        if (t.key && lexicon[t.key] && !taught.has(t.key) && !names.has(t.key)) {
          warnings.push(`${w}: "${t.surface}" has not been taught by this point`);
        }
      }
      return { ...s, audio, ...(l.speaker ? { speaker: l.speaker } : {}) };
    };
    const narrative: StoryItem = {
      kind: 'narrative',
      title: st.narrative.title,
      lines: st.narrative.lines.map((l, i) => line(l, undefined, `${where} narrative line ${i + 1}`)),
    };
    const cast = new Map(st.dialogue.cast.map((c) => [c.name, c.voice]));
    const play: StoryItem = {
      kind: 'dialogue',
      title: st.dialogue.title,
      setting: st.dialogue.setting,
      lines: st.dialogue.lines.map((l, i) => {
        const w = `${where} dialogue line ${i + 1}`;
        if (l.speaker !== 'Amy' && !cast.has(l.speaker)) errors.push(`${w}: speaker "${l.speaker}" is not in the cast`);
        return line(l, cast.get(l.speaker), w);
      }),
    };
    return { narrative, dialogue: play };
  };
  const weeks: Record<string, WeekItem> = {};
  for (const w of curriculum.weeks) {
    for (const uid of w.units) {
      const item = unitItems[uid];
      const src = rawUnit.get(uid);
      if (!item || !src) continue;
      teach([
        ...item.chunks,
        ...item.patterns.examples,
        ...item.daily,
        ...Object.values(item.dialogue.nodes).flatMap((n) => n.replies),
      ]);
      item.stories = story(src.u.stories, `${src.file} stories`);
    }
    const ws = weekStories.get(w.week);
    if (!ws) {
      errors.push(`curriculum: week ${w.week} has no content file (content/weeks/w${String(w.week).padStart(2, '0')}.json)`);
      continue;
    }
    weeks[String(w.week)] = { week: w.week, unitIds: [...w.units], stories: story(ws.stories, `${ws.file}`) };
  }
  for (const wk of weekStories.keys()) {
    if (!curriculum.weeks.some((w) => w.week === wk)) errors.push(`content/weeks: week ${wk} is not in the curriculum`);
  }

  // ---- challenges
  const challenges: Record<string, ChallengeItem> = {};
  for (const c of curriculum.challenges) {
    if (challenges[c.id]) errors.push(`curriculum: duplicate challenge ${c.id}`);
    challenges[c.id] = { ...c, prompts: c.prompts.map((s) => plain(s)) };
  }

  const parts = buildParts(curriculum, unitItems, challenges, errors);

  for (const key of Object.keys(lexicon)) {
    if (!usedKeys.has(key)) warnings.push(`lexicon: "${lexicon[key]?.text}" is never used`);
  }

  if (errors.length) return { errors, warnings };

  const bundle: ContentBundle = {
    contentVersion: curriculum.contentVersion,
    contentHash: hash(JSON.stringify(raw)),
    lexicon,
    units: unitItems,
    phonics,
    challenges,
    weeks,
    parts,
    clips,
  };
  return { bundle, errors, warnings };
}

const EMPTY_STORY: StoryItem = { kind: 'narrative', title: '', lines: [] };
const EMPTY_STORIES: StoriesItem = { narrative: EMPTY_STORY, dialogue: { ...EMPTY_STORY, kind: 'dialogue' } };

function compileDialogue(
  d: z.infer<typeof Unit>['dialogue'],
  file: string,
  errors: string[],
  spoken: (s: { en: string; zh: string }, where: string) => SpokenSentence,
  plain: (s: { en: string; zh: string }, v?: Voice) => Sentence,
): DialogueItem {
  const nodes: DialogueItem['nodes'] = {};
  for (const n of d.nodes) {
    if (nodes[n.id]) errors.push(`${file}: duplicate dialogue node ${n.id}`);
    nodes[n.id] = {
      id: n.id,
      npc: plain(n.npc, d.npcVoice),
      replies: n.replies.map((r) => ({ ...spoken(r, `${file} dialogue ${n.id}`), next: r.next })),
    };
  }
  if (!nodes[d.start]) errors.push(`${file}: dialogue start "${d.start}" does not exist`);
  for (const n of Object.values(nodes)) {
    for (const r of n.replies) {
      if (!nodes[r.next]) errors.push(`${file}: dialogue node ${n.id} points to missing node "${r.next}"`);
    }
  }
  // Every node must be reachable, and every path must be able to finish.
  const seen = new Set<string>();
  const stack = [d.start];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id) || !nodes[id]) continue;
    seen.add(id);
    for (const r of nodes[id].replies) stack.push(r.next);
  }
  for (const id of Object.keys(nodes)) if (!seen.has(id)) errors.push(`${file}: dialogue node ${id} is unreachable`);
  if (!Object.values(nodes).some((n) => n.replies.length === 0)) errors.push(`${file}: dialogue has no closing node`);
  return { title: d.title, setting: d.setting, npcName: d.npcName, start: d.start, nodes };
}

function buildParts(
  curriculum: z.infer<typeof Curriculum>,
  units: Record<string, UnitItem>,
  challenges: Record<string, ChallengeItem>,
  errors: string[],
): Part[] {
  const parts: Part[] = [];
  let prevWeek = 0;
  const challenge = (id: string, week: number, day: number) => {
    const c = challenges[id];
    if (!c) {
      errors.push(`curriculum: week ${week} refers to missing challenge ${id}`);
      return;
    }
    parts.push({ id, kind: 'challenge', week, day, title: c.title, unitIds: [], challengeId: id, light: true });
  };
  for (const w of curriculum.weeks) {
    if (w.week !== prevWeek + 1) errors.push(`curriculum: week ${w.week} is out of order`);
    prevWeek = w.week;
    if (w.challengeBefore) challenge(w.challengeBefore, w.week, 1);
    let day = 1;
    for (const uid of w.units) {
      const u = units[uid];
      const title = u?.title ?? uid;
      parts.push({ id: `${uid}:learn`, kind: 'learn', week: w.week, day: day++, title: `${title} · 学新句子`, unitIds: [uid], light: false });
      parts.push({ id: `${uid}:practice`, kind: 'practice', week: w.week, day: day++, title: `${title} · 句型课`, unitIds: [uid], light: false });
      parts.push({ id: `${uid}:apply`, kind: 'apply', week: w.week, day: day++, title: `${title} · 实战对话`, unitIds: [uid], light: false });
    }
    const weekId = `w${String(w.week).padStart(2, '0')}:review`;
    parts.push({ id: weekId, kind: 'review', week: w.week, day, title: `第 ${w.week} 周复习`, unitIds: [...w.units], light: false });
    if (w.challengeAfter) challenge(w.challengeAfter, w.week, day);
  }
  return parts;
}
