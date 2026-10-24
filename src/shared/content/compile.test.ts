import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { compileContent, type RawContent } from './compile';
import { tokenize } from './tokenize';

const sha1 = (t: string) => createHash('sha1').update(t).digest('hex');

const word = (text: string, grade: 'green' | 'yellow' | 'red' = 'green') => ({
  text,
  zh: '测试',
  hint: grade === 'red' ? { grade, note: '口型说明' } : grade === 'yellow' ? { grade, hanzi: '测', note: '注意' } : { grade, hanzi: '测' },
});

const lexicon = ['hi', 'hello', 'bye', 'good', 'morning', 'afternoon', 'evening', 'night', "I'm", 'Amy', 'see', 'you', 'a', 'cup', 'of', 'tea'].map(
  (w) => word(w),
);

function unit(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    kind: 'life',
    title: '打招呼',
    titleEn: 'Hello',
    goal: '会打招呼',
    chunks: [
      { id: `${id}.c01`, en: 'Hi!', zh: '你好' },
      { id: `${id}.c02`, en: "I'm Amy.", zh: '我是Amy' },
      { id: `${id}.c03`, en: 'See you!', zh: '再见' },
      { id: `${id}.c04`, en: 'Bye!', zh: '拜拜' },
    ],
    words: ['hi', 'bye', 'see'],
    drill: {
      pattern: 'Good ___!',
      zh: '问候',
      fills: [
        { en: 'morning', zh: '早上好' },
        { en: 'afternoon', zh: '下午好' },
        { en: 'evening', zh: '晚上好' },
      ],
    },
    dialogue: {
      title: '打招呼',
      setting: '在门口',
      npcName: 'Jason',
      npcVoice: 'bm_george',
      start: 'n1',
      nodes: [
        { id: 'n1', npc: { en: 'Hi there!', zh: '你好' }, replies: [{ en: 'Hello!', zh: '你好', next: 'end' }] },
        { id: 'end', npc: { en: 'Bye!', zh: '再见' }, replies: [] },
      ],
    },
    task: '说一次 Hi',
    ...overrides,
  };
}

function raw(overrides: Partial<RawContent> = {}): RawContent {
  return {
    curriculum: {
      file: 'curriculum.json',
      data: {
        contentVersion: '0.1.0',
        defaultVoice: 'bf_emma',
        weeks: [{ week: 1, units: ['u01'], challengeBefore: 'ch01' }],
        challenges: [
          { id: 'ch01', title: '第一次录音', intro: '说说你自己', prompts: [{ en: 'Hi', zh: '你好' }, { en: 'I am', zh: '我是' }], maxSeconds: 30 },
        ],
      },
    },
    lexicon: [{ file: 'lexicon.json', data: lexicon }],
    units: [{ file: 'u01.json', data: unit('u01') }],
    phonics: [],
    ...overrides,
  };
}

describe('tokenize', () => {
  it('separates punctuation and keeps apostrophes inside words', () => {
    expect(tokenize("Hi, I'm Amy.")).toEqual([
      { surface: 'Hi', key: 'hi', lead: '', trail: ',' },
      { surface: "I'm", key: "i'm", lead: '', trail: '' },
      { surface: 'Amy', key: 'amy', lead: '', trail: '.' },
    ]);
  });
  it('marks numbers, prices and times as needing no lexicon entry', () => {
    const keys = tokenize('It is $280 at 4pm on the 3rd').map((t) => t.key);
    expect(keys).toEqual(['it', 'is', undefined, 'at', undefined, 'on', 'the', undefined]);
  });
  it('normalises curly apostrophes', () => {
    expect(tokenize('I’m')[0]?.key).toBe("i'm");
  });
});

describe('compileContent', () => {
  it('compiles valid content into a bundle', () => {
    const r = compileContent(raw(), sha1);
    expect(r.errors).toEqual([]);
    const b = r.bundle!;
    expect(Object.keys(b.units)).toEqual(['u01']);
    expect(b.units.u01?.drill.items.map((i) => i.en)).toEqual(['Good morning!', 'Good afternoon!', 'Good evening!']);
    expect(b.parts.map((p) => p.id)).toEqual(['ch01', 'u01:learn', 'u01:practice', 'u01:apply', 'w01:review']);
    expect(b.parts[0]?.light).toBe(true);
  });

  it('gives every sentence and word an audio clip, with the NPC voice for NPC lines', () => {
    const b = compileContent(raw(), sha1).bundle!;
    const chunk = b.units.u01!.chunks[0]!;
    expect(b.clips[chunk.audio]).toEqual({ text: 'Hi!', voice: 'bf_emma' });
    const npc = b.units.u01!.dialogue.nodes.n1!.npc;
    expect(b.clips[npc.audio]).toEqual({ text: 'Hi there!', voice: 'bm_george' });
    expect(b.clips[b.lexicon.hello!.audio]?.text).toBe('hello');
  });

  it('produces the same clip keys for the same text (so audio is reused)', () => {
    const a = compileContent(raw(), sha1).bundle!;
    const b = compileContent(raw(), sha1).bundle!;
    expect(Object.keys(a.clips)).toEqual(Object.keys(b.clips));
  });

  it('rejects a learner sentence with a word missing from the lexicon', () => {
    const bad = unit('u01', { chunks: [...unit('u01').chunks, { id: 'u01.c05', en: 'Thank you!', zh: '谢谢' }] });
    const r = compileContent(raw({ units: [{ file: 'u01.json', data: bad }] }), sha1);
    expect(r.bundle).toBeUndefined();
    expect(r.errors.join('\n')).toMatch(/"Thank" is not in the lexicon/);
  });

  it('rejects red hints that carry a 谐音', () => {
    const lex = [...lexicon, { text: 'thank', zh: '谢谢', hint: { grade: 'red', hanzi: '三克', note: 'x' } }];
    const r = compileContent(raw({ lexicon: [{ file: 'lexicon.json', data: lex }] }), sha1);
    expect(r.errors.join('\n')).toMatch(/red hints must not carry a 谐音/);
  });

  it('rejects dialogue dead ends and unreachable nodes', () => {
    const d = unit('u01').dialogue;
    const broken = unit('u01', {
      dialogue: {
        ...d,
        nodes: [
          { id: 'n1', npc: { en: 'Hi', zh: '你好' }, replies: [{ en: 'Hello!', zh: '你好', next: 'nowhere' }] },
          { id: 'orphan', npc: { en: 'Bye', zh: '再见' }, replies: [] },
        ],
      },
    });
    const errors = compileContent(raw({ units: [{ file: 'u01.json', data: broken }] }), sha1).errors.join('\n');
    expect(errors).toMatch(/points to missing node "nowhere"/);
    expect(errors).toMatch(/node orphan is unreachable/);
  });

  it('rejects chunk ids that do not belong to their unit, and duplicates', () => {
    const chunks = unit('u01').chunks.map((c) => ({ ...c, id: 'u02.c01' }));
    const errors = compileContent(raw({ units: [{ file: 'u01.json', data: unit('u01', { chunks }) }] }), sha1).errors.join('\n');
    expect(errors).toMatch(/must start with u01\./);
    expect(errors).toMatch(/duplicate chunk id/);
  });

  it('reports units scheduled without a file and files not scheduled', () => {
    const r = compileContent(raw({ units: [{ file: 'u02.json', data: unit('u02') }] }), sha1);
    const errors = r.errors.join('\n');
    expect(errors).toMatch(/unit u02 is not scheduled/);
    expect(errors).toMatch(/unit u01 has no content file/);
  });

  it('warns about unused lexicon entries without failing', () => {
    const r = compileContent(raw(), sha1);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toContain('lexicon: "cup" is never used');
  });
});
