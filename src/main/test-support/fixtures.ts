/**
 * Test-only helpers: a tiny but complete content set compiled with the real compiler, and an
 * in-memory app wired the same way index.ts wires the real one.
 */
import { createHash } from 'node:crypto';
import type { ContentBundle } from '../../shared/content/bundle';
import { compileContent, type RawContent } from '../../shared/content/compile';
import type { AppApi } from '../../shared/ipc';
import { createAppApi } from '../api';
import { FakeClock } from '../clock';
import { openDatabase, type Database } from '../db/database';
import { createRepositories, type Repositories } from '../db/repositories';
import { silentLogger } from '../logger';
import { ContentService } from '../services/contentService';
import { DiagnosticsService } from '../services/diagnosticsService';
import { LearningService } from '../services/learningService';
import { RecordingService } from '../services/recordingService';
import { FakeAsrProvider, type AsrProvider } from '../speech/asrProvider';

const g = (hanzi: string) => ({ grade: 'green' as const, hanzi });

const lexicon = [
  { text: 'a', zh: '一个', hint: g('呃') },
  { text: 'Amy', zh: 'Amy', hint: g('埃米') },
  { text: 'bye', zh: '再见', hint: g('拜') },
  { text: 'can', zh: '能', hint: g('肯') },
  { text: 'coffee', zh: '咖啡', hint: g('靠飞') },
  { text: 'good', zh: '好', hint: { grade: 'yellow' as const, hanzi: '古', note: 'd 轻轻收住' } },
  { text: 'have', zh: '有', hint: g('嗨') },
  { text: 'hi', zh: '嗨', hint: g('嗨') },
  { text: 'I', zh: '我', hint: g('爱') },
  { text: "I'm", zh: '我是', hint: g('爱') },
  { text: 'meet', zh: '见面', hint: g('米') },
  { text: 'morning', zh: '早上', hint: g('摸宁') },
  { text: 'nice', zh: '好的', hint: g('奈') },
  { text: 'please', zh: '请', hint: g('普利斯') },
  { text: 'see', zh: '见', hint: g('西') },
  { text: 'tea', zh: '茶', hint: g('踢') },
  { text: 'thank', zh: '谢谢', hint: { grade: 'red' as const, note: '舌尖放在上下牙之间' } },
  { text: 'to', zh: '到', hint: g('吐') },
  { text: 'water', zh: '水', hint: g('沃特') },
  { text: 'you', zh: '你', hint: g('优') },
];

const dialogue = (reply: string) => ({
  title: '对话',
  setting: '测试',
  npcName: 'Jason',
  npcVoice: 'bm_george',
  start: 'n1',
  nodes: [
    {
      id: 'n1',
      npc: { en: 'Hello there!', zh: '你好！' },
      replies: [{ en: reply, zh: '回答', next: 'end' }],
    },
    { id: 'end', npc: { en: 'Bye!', zh: '再见！' }, replies: [] },
  ],
});

const drill = {
  pattern: 'Can I have ___, please?',
  zh: '点东西',
  fills: [
    { en: 'a coffee', zh: '一杯咖啡' },
    { en: 'a tea', zh: '一杯茶' },
    { en: 'water', zh: '水' },
  ],
};

export const MINI_CONTENT: RawContent = {
  curriculum: {
    file: 'curriculum.json',
    data: {
      contentVersion: '0.0.1',
      defaultVoice: 'bf_emma',
      weeks: [{ week: 1, units: ['u01', 'u02'], challengeBefore: 'ch01' }],
      challenges: [
        {
          id: 'ch01',
          title: '第一次录音',
          intro: '说几句',
          prompts: [
            { en: 'Hi, my name is ...', zh: '你好' },
            { en: "I'm from ...", zh: '我来自' },
          ],
          maxSeconds: 45,
        },
      ],
    },
  },
  lexicon: [{ file: 'lexicon.json', data: lexicon }],
  units: [
    {
      file: 'u01.json',
      data: {
        id: 'u01',
        kind: 'life',
        title: '打招呼',
        titleEn: 'Hello',
        goal: '打招呼',
        chunks: [
          { id: 'u01.c01', en: "Hi, I'm Amy.", zh: '你好，我是 Amy。' },
          { id: 'u01.c02', en: 'Nice to meet you.', zh: '很高兴认识你。' },
          { id: 'u01.c03', en: 'Good morning!', zh: '早上好！' },
          { id: 'u01.c04', en: 'Bye!', zh: '再见！' },
        ],
        words: ['hi', 'nice', 'meet'],
        drill,
        phonics: 'p01',
        dialogue: dialogue("Hi, I'm Amy."),
        task: '说 Good morning',
      },
    },
    {
      file: 'u02.json',
      data: {
        id: 'u02',
        kind: 'work',
        title: '点饮料',
        titleEn: 'Coffee',
        goal: '点饮料',
        chunks: [
          { id: 'u02.c01', en: 'Can I have a coffee, please?', zh: '我可以要一杯咖啡吗？' },
          { id: 'u02.c02', en: 'Thank you.', zh: '谢谢。' },
          { id: 'u02.c03', en: 'See you!', zh: '再见！' },
          { id: 'u02.c04', en: 'Can I have a tea, please?', zh: '我可以要一杯茶吗？' },
        ],
        words: ['coffee', 'tea', 'please'],
        drill,
        dialogue: dialogue('Thank you.'),
        task: '点一杯咖啡',
      },
    },
  ],
  phonics: [
    {
      file: 'p01.json',
      data: {
        id: 'p01',
        title: '长短音',
        rule: 'ee 读长音',
        examples: [
          { en: 'see', zh: '看见' },
          { en: 'tea', zh: '茶' },
          { en: 'meet', zh: '见面' },
        ],
        pairs: [
          { id: 'p01.m01', a: { en: 'ship', zh: '船' }, b: { en: 'sheep', zh: '羊' } },
          { id: 'p01.m02', a: { en: 'sit', zh: '坐' }, b: { en: 'seat', zh: '座位' } },
        ],
      },
    },
  ],
};

export function miniBundle(): ContentBundle {
  const r = compileContent(MINI_CONTENT, (t) => createHash('sha1').update(t).digest('hex'));
  if (!r.bundle) throw new Error(`fixture content does not compile:\n${r.errors.join('\n')}`);
  return r.bundle;
}

export interface TestApp {
  api: AppApi;
  db: Database;
  repos: Repositories;
  clock: FakeClock;
  learning: LearningService;
  asr: AsrProvider;
  bundle: ContentBundle;
}

export function createTestApp(opts: {
  start?: string;
  recordingsDir: string;
  logsDir?: string;
  asr?: AsrProvider;
  speechAvailable?: boolean;
  bundle?: ContentBundle | null;
}): TestApp {
  const clock = new FakeClock(opts.start ?? '2026-11-02T09:00:00');
  const db = openDatabase(':memory:');
  const repos = createRepositories(db);
  const bundle = opts.bundle === undefined ? miniBundle() : opts.bundle;
  const content = new ContentService('bundle.json', silentLogger, () => {
    if (!bundle) throw new Error('ENOENT');
    return JSON.stringify(bundle);
  });
  const asr = opts.asr ?? new FakeAsrProvider();
  const learning = new LearningService({
    db,
    repos,
    content: () => content.bundle(),
    clock,
    logger: silentLogger,
    speechAvailable: () => opts.speechAvailable ?? true,
  });
  const recordings = new RecordingService(opts.recordingsDir, repos.recordings, clock, silentLogger);
  const diagnostics = new DiagnosticsService({
    logsDir: opts.logsDir ?? opts.recordingsDir,
    desktopDir: opts.recordingsDir,
    db,
    clock,
    logger: silentLogger,
    info: () => ({ test: true }),
    openPath: () => Promise.resolve(''),
  });
  const api = createAppApi({
    info: () => ({
      appVersion: '0.0.0',
      contentVersion: content.version(),
      dataDir: '',
      logsDir: '',
      isDev: true,
    }),
    content,
    learning,
    recordings,
    asr,
    diagnostics,
    logger: silentLogger,
    rendererLog: () => {},
  });
  return { api, db, repos, clock, learning, asr, bundle: bundle as ContentBundle };
}
