/**
 * In-memory AppApi for renderer tests (and for trying screens without the main process).
 * Calls are recorded in `calls` so tests can assert what the UI asked for.
 */
import type { ContentBundle, SpokenSentence, WordEntry } from '@shared/content/bundle';
import { tokenize } from '@shared/content/tokenize';
import type { Hint } from '@shared/content/schema';
import type { AppApi, ReviewCardView, TodayView } from '@shared/ipc';
import { defaultSettings, type Settings } from '@shared/settings';

const word = (text: string, zhText: string, hint: Hint): WordEntry => ({
  key: text.toLowerCase(),
  text,
  zh: zhText,
  hint,
  audio: `clip_${text.toLowerCase()}`,
});

const spoken = (en: string, zhText: string): SpokenSentence => ({
  en,
  zh: zhText,
  audio: `clip_${en.replace(/\W+/g, '_').toLowerCase()}`,
  tokens: tokenize(en),
});

export function fixtureBundle(): ContentBundle {
  const lexicon: Record<string, WordEntry> = {};
  for (const w of [
    word('Hi', '你好', { grade: 'green', hanzi: '嗨', pinyin: 'hāi' }),
    word("I'm", '我是', { grade: 'yellow', hanzi: '爱', pinyin: 'ài(m)', note: '结尾 m 闭嘴哼一下' }),
    word('Amy', 'Amy', { grade: 'green', hanzi: '埃米' }),
    word('nice', '好的', { grade: 'yellow', hanzi: '奈', pinyin: 'nài(s)', note: '结尾 s 只吹气' }),
    word('to', '到', { grade: 'green', hanzi: '吐' }),
    word('meet', '见面', { grade: 'yellow', hanzi: '米～', note: 'ee 拉长' }),
    word('you', '你', { grade: 'green', hanzi: '优' }),
    word('thank', '谢谢', { grade: 'red', note: '舌尖放在上下牙齿之间吹气' }),
    word('good', '好', { grade: 'yellow', hanzi: '古', note: 'd 轻轻收住' }),
    word('morning', '早上', { grade: 'yellow', hanzi: '摸宁', note: '嘴巴圆' }),
  ]) {
    lexicon[w.key] = w;
  }
  const c1 = { ...spoken("Hi, I'm Amy.", '你好，我是 Amy。'), id: 'u01.c01', accept: ['Hi, I am Amy.'] };
  const c2 = { ...spoken('Nice to meet you.', '很高兴认识你。'), id: 'u01.c02' };
  const c3 = { ...spoken('Thank you.', '谢谢你。'), id: 'u01.c03' };
  const c4 = {
    ...spoken('Good morning.', '早上好。'),
    id: 'u01.c04',
    pattern: { frame: 0, slot: [1, 2] as [number, number] },
  };
  const r1 = { ...spoken('Nice to meet you.', '很高兴认识你。'), next: 'end' };
  const r2 = { ...spoken('Thank you.', '谢谢你。'), next: 'end' };
  const stories = {
    narrative: {
      kind: 'narrative' as const,
      title: 'Amy 的早上',
      lines: [spoken('Good morning.', '早上好。'), spoken("Hi, I'm Amy.", '你好，我是 Amy。')],
    },
    dialogue: {
      kind: 'dialogue' as const,
      title: '新邻居',
      setting: '在电梯里',
      lines: [
        { ...spoken('Nice to meet you.', '很高兴认识你。'), speaker: 'Mrs Tan' },
        { ...spoken('Thank you.', '谢谢你。'), speaker: 'Amy' },
      ],
    },
  };
  return {
    contentVersion: '0.0.0-test',
    contentHash: 'test',
    lexicon,
    units: {
      u01: {
        id: 'u01',
        kind: 'life',
        week: 1,
        title: '打招呼',
        titleEn: 'Hello',
        goal: '能打招呼',
        chunks: [c1, c2, c3, c4],
        words: ['hi', 'nice', 'meet', 'thank'],
        patterns: {
          frames: [{ frame: 'Good ___.', zh: '……好', usage: '不同时间的问候' }],
          examples: [
            {
              ...spoken('Good morning.', '早上好。'),
              id: 'u01.e01',
              scene: '早上到补习中心，看到同事。',
              pattern: { frame: 0, slot: [1, 2] },
            },
            {
              ...spoken('Good morning, Amy.', '早上好，Amy。'),
              id: 'u01.e02',
              scene: '早上同事先跟你打招呼。',
              note: 'Amy 换成对方的名字',
              pattern: { frame: 0, slot: [1, 3] },
            },
          ],
        },
        daily: [
          {
            ...spoken('Nice to meet you.', '很高兴认识你。'),
            id: 'u01.d01',
            word: 'nice',
            scene: '周末在楼下认识了新邻居。',
            slot: [0, 1],
          },
        ],
        stories,
        phonics: 'p01',
        dialogue: {
          title: '认识新同事',
          setting: '新同事来打招呼',
          npcName: 'Jason',
          start: 'n1',
          nodes: {
            n1: {
              id: 'n1',
              npc: { en: "Hi, I'm Jason.", zh: '你好，我是 Jason。', audio: 'clip_npc1' },
              replies: [r1, r2],
            },
            end: { id: 'end', npc: { en: 'Bye!', zh: '拜拜！', audio: 'clip_npc2' }, replies: [] },
          },
        },
        task: '说一句 Good morning!',
      },
    },
    phonics: {
      p01: {
        id: 'p01',
        title: '长短音',
        rule: 'ee 读长音',
        examples: [{ en: 'see', zh: '看见', audio: 'clip_see' }],
        pairs: [
          {
            id: 'p01.m01',
            a: { en: 'ship', zh: '船', audio: 'clip_ship' },
            b: { en: 'sheep', zh: '羊', audio: 'clip_sheep' },
          },
        ],
      },
    },
    challenges: {},
    weeks: { '1': { week: 1, unitIds: ['u01'], stories } },
    parts: [
      {
        id: 'u01:learn',
        kind: 'learn',
        week: 1,
        day: 1,
        title: '打招呼 · 学新句子',
        unitIds: ['u01'],
        light: false,
      },
      {
        id: 'u01:practice',
        kind: 'practice',
        week: 1,
        day: 2,
        title: '打招呼 · 句型课',
        unitIds: ['u01'],
        light: false,
      },
    ],
    clips: {},
  };
}

export interface MockApi extends AppApi {
  calls: { channel: string; args: unknown[] }[];
}

export function createMockApi(
  opts: {
    bundle?: ContentBundle;
    queue?: ReviewCardView[];
    /** Returned by review.getPracticeSet (defaults to `queue`). */
    practice?: ReviewCardView[];
    completed?: string[];
    recognizeText?: string;
    settings?: Partial<Settings>;
  } = {},
): MockApi {
  const bundle = opts.bundle ?? fixtureBundle();
  let settings: Settings = { ...defaultSettings, ...opts.settings };
  const hints: Record<string, number> = {};
  const completed = new Set(opts.completed ?? []);
  const calls: MockApi['calls'] = [];
  const log = <T>(channel: string, args: unknown[], value: T): Promise<T> => {
    calls.push({ channel, args });
    return Promise.resolve(value);
  };
  const today = (): TodayView => ({
    today: '2026-10-24',
    plan: {
      pace: 'normal',
      welcomeBack: false,
      reviewIds: (opts.queue ?? []).map((c) => c.cardId),
      deferredReviews: 0,
      nextPart: bundle.parts[0] ?? null,
      lightParts: [],
      newPartRecommended: true,
      accuracy: null,
    },
    streak: { totalDays: 3, current: 2, best: 2, lastStudyDay: '2026-10-23', restCards: 1 },
    restCardsUsedToday: 0,
    streakResetToday: false,
    activeMsToday: 0,
    dayCounted: false,
    partsCompletedToday: 0,
    reviewsDoneToday: 0,
  });

  const api: AppApi = {
    app: {
      getInfo: () =>
        log('app.getInfo', [], {
          appVersion: '0.0.0',
          contentVersion: '0',
          dataDir: '/tmp',
          logsDir: '/tmp',
          isDev: true,
        }),
    },
    content: { getBundle: () => log('content.getBundle', [], bundle) },
    today: {
      get: () => log('today.get', [], today()),
      addActiveTime: (ms) => log('today.addActiveTime', [ms], today()),
    },
    parts: {
      complete: (input) => {
        const firstTime = !completed.has(input.partId);
        completed.add(input.partId);
        return log('parts.complete', [input], {
          cardsIntroduced: firstTime ? 2 : 0,
          firstTime,
          today: today(),
        });
      },
      listCompleted: () => log('parts.listCompleted', [], [...completed]),
    },
    review: {
      getQueue: () => log('review.getQueue', [], opts.queue ?? []),
      submit: (input) => log('review.submit', [input], today()),
      getPracticeSet: (scope) => log('review.getPracticeSet', [scope], opts.practice ?? opts.queue ?? []),
    },
    speech: {
      getStatus: () => log('speech.getStatus', [], { state: 'ready' as const }),
      recognize: (input) =>
        log('speech.recognize', [input], {
          text: opts.recognizeText ?? '',
          recordingId: 'rec1',
          durationMs: 1000,
        }),
      annotateRecording: (input) => log('speech.annotateRecording', [input], undefined),
    },
    hints: {
      getProgress: () => log('hints.getProgress', [], { ...hints }),
      recordCorrect: (keys) => {
        for (const k of keys) hints[k] = (hints[k] ?? 0) + 1;
        return log('hints.recordCorrect', [keys], { ...hints });
      },
    },
    recordings: {
      list: (itemId) => log('recordings.list', [itemId], []),
      saveChallenge: (input) =>
        log('recordings.saveChallenge', [input], {
          id: 'c1',
          itemId: input.challengeId,
          createdAt: new Date(0).toISOString(),
          durationMs: 1000,
          url: 'media://rec/c1.wav',
          score: null,
          transcript: null,
        }),
      listChallenges: () => log('recordings.listChallenges', [], []),
    },
    progress: {
      getStats: () =>
        log('progress.getStats', [], {
          streak: today().streak,
          partsCompleted: 0,
          partsTotal: bundle.parts.length,
          cardsLearned: 0,
          cardsMature: 0,
          reviewsTotal: 0,
          accuracy7d: null,
          activity: [],
          troubleItems: [],
        }),
    },
    settings: {
      get: () => log('settings.get', [], settings),
      update: (patch) => {
        settings = { ...settings, ...patch };
        return log('settings.update', [patch], settings);
      },
    },
    diagnostics: {
      openLogsFolder: () => log('diagnostics.openLogsFolder', [], undefined),
      exportBundle: () => log('diagnostics.exportBundle', [], { folder: '/tmp/diag' }),
    },
    log: { write: (level, message, meta) => log('log.write', [level, message, meta], undefined) },
  };
  return Object.assign(api, { calls });
}
