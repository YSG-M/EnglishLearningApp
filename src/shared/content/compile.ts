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
  ClipSpec,
  ContentBundle,
  DialogueItem,
  Part,
  PhonicsItem,
  Sentence,
  SpokenSentence,
  UnitItem,
  WordEntry,
} from './bundle';
import { Curriculum, Lexicon, PhonicsUnit, Unit } from './schema';
import type { Voice } from './schema';
import { lexiconKey, tokenize } from './tokenize';

export interface RawContent {
  curriculum: { file: string; data: unknown };
  lexicon: { file: string; data: unknown }[];
  units: { file: string; data: unknown }[];
  phonics: { file: string; data: unknown }[];
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
  if (!curriculum || errors.length) return { errors, warnings };

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
      return {
        ...spoken(c, `${file} ${c.id}`),
        id: c.id,
        ...(c.note ? { note: c.note } : {}),
        ...(c.accept ? { accept: c.accept } : {}),
      };
    });
    for (const w of u.words) {
      const key = lexiconKey(w);
      usedKeys.add(key);
      if (!lexicon[key]) errors.push(`${file}: word "${w}" is not in the lexicon`);
    }
    if (u.phonics && !phonics[u.phonics]) errors.push(`${file}: phonics ${u.phonics} does not exist`);

    const drillItems = u.drill.fills.map((f) => ({
      ...spoken({ en: u.drill.pattern.replace('___', f.en), zh: f.zh }, `${file} drill`),
      fillZh: f.zh,
    }));

    unitItems[u.id] = {
      id: u.id,
      kind: u.kind,
      week,
      title: u.title,
      titleEn: u.titleEn,
      goal: u.goal,
      chunks,
      words: u.words.map(lexiconKey),
      drill: { pattern: u.drill.pattern, zh: u.drill.zh, items: drillItems },
      ...(u.grammar
        ? { grammar: { title: u.grammar.title, body: u.grammar.body, examples: u.grammar.examples.map((s) => plain(s)) } }
        : {}),
      ...(u.phonics ? { phonics: u.phonics } : {}),
      dialogue: compileDialogue(u.dialogue, file, errors, spoken, plain),
      task: u.task,
    };
  }
  for (const uid of unitWeek.keys()) {
    if (!unitItems[uid] && !units.some((x) => x.u.id === uid)) errors.push(`curriculum: unit ${uid} has no content file`);
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
    parts,
    clips,
  };
  return { bundle, errors, warnings };
}

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
      parts.push({ id: `${uid}:practice`, kind: 'practice', week: w.week, day: day++, title: `${title} · 句型和发音`, unitIds: [uid], light: false });
      parts.push({ id: `${uid}:apply`, kind: 'apply', week: w.week, day: day++, title: `${title} · 实战对话`, unitIds: [uid], light: false });
    }
    const weekId = `w${String(w.week).padStart(2, '0')}:review`;
    parts.push({ id: weekId, kind: 'review', week: w.week, day, title: `第 ${w.week} 周复习`, unitIds: [...w.units], light: false });
    if (w.challengeAfter) challenge(w.challengeAfter, w.week, day);
  }
  return parts;
}
