/** Lookups over the content bundle used by several screens. */
import type {
  ChunkItem,
  ContentBundle,
  Part,
  PhonicsItem,
  PhonicsPairItem,
  SpokenSentence,
  UnitItem,
  WordEntry,
} from '@shared/content/bundle';

export function partById(bundle: ContentBundle, id: string): Part | undefined {
  return bundle.parts.find((p) => p.id === id);
}

export function unitOfChunk(bundle: ContentBundle, chunkId: string): UnitItem | undefined {
  return bundle.units[chunkId.split('.')[0] ?? ''];
}

export function findChunk(
  bundle: ContentBundle,
  chunkId: string,
): { unit: UnitItem; chunk: ChunkItem } | undefined {
  const unit = unitOfChunk(bundle, chunkId);
  const chunk = unit?.chunks.find((c) => c.id === chunkId);
  return unit && chunk ? { unit, chunk } : undefined;
}

export function unitsOfWord(bundle: ContentBundle, key: string): UnitItem[] {
  return Object.values(bundle.units).filter((u) => u.words.includes(key));
}

export function findPair(
  bundle: ContentBundle,
  pairId: string,
): { phonics: PhonicsItem; pair: PhonicsPairItem } | undefined {
  const phonics = bundle.phonics[pairId.split('.')[0] ?? ''];
  const pair = phonics?.pairs.find((p) => p.id === pairId);
  return phonics && pair ? { phonics, pair } : undefined;
}

export type ReviewItem =
  | { kind: 'chunk'; unit: UnitItem; chunk: ChunkItem }
  | { kind: 'word'; word: WordEntry; units: UnitItem[] }
  | { kind: 'pair'; phonics: PhonicsItem; pair: PhonicsPairItem };

export function resolveItem(
  bundle: ContentBundle,
  kind: 'chunk' | 'word' | 'pair',
  itemId: string,
): ReviewItem | undefined {
  if (kind === 'chunk') {
    const f = findChunk(bundle, itemId);
    return f ? { kind, ...f } : undefined;
  }
  if (kind === 'word') {
    const word = bundle.lexicon[itemId];
    return word ? { kind, word, units: unitsOfWord(bundle, itemId) } : undefined;
  }
  const p = findPair(bundle, itemId);
  return p ? { kind, ...p } : undefined;
}

/** Short display text for a card, e.g. in the trouble list. */
export function cardLabel(bundle: ContentBundle, cardId: string): { en: string; zh: string } | undefined {
  const i = cardId.indexOf(':');
  const kind = cardId.slice(0, i) as 'chunk' | 'word' | 'pair';
  const item = resolveItem(bundle, kind, cardId.slice(i + 1));
  if (!item) return undefined;
  if (item.kind === 'chunk') return { en: item.chunk.en, zh: item.chunk.zh };
  if (item.kind === 'word') return { en: item.word.text, zh: item.word.zh };
  return { en: `${item.pair.a.en} / ${item.pair.b.en}`, zh: item.phonics.title };
}

export interface PhraseHit {
  sentence: SpokenSentence;
  unit: UnitItem;
  source: 'chunk' | 'drill' | 'reply';
}

/** Every sentence she might want to look up at work, de-duplicated by English text. */
export function allPhrases(bundle: ContentBundle): PhraseHit[] {
  const seen = new Set<string>();
  const out: PhraseHit[] = [];
  const add = (sentence: SpokenSentence, unit: UnitItem, source: PhraseHit['source']) => {
    const key = sentence.en.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ sentence, unit, source });
  };
  const units = Object.values(bundle.units).sort((a, b) => a.id.localeCompare(b.id));
  for (const u of units) {
    for (const c of u.chunks) add(c, u, 'chunk');
    for (const d of u.drill.items) add(d, u, 'drill');
    for (const n of Object.values(u.dialogue.nodes)) for (const r of n.replies) add(r, u, 'reply');
  }
  return out;
}

export function searchPhrases(phrases: PhraseHit[], query: string, limit = 50): PhraseHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/);
  const scored: { hit: PhraseHit; score: number }[] = [];
  for (const hit of phrases) {
    const hay = `${hit.sentence.en} ${hit.sentence.zh} ${hit.unit.title}`.toLowerCase();
    if (!terms.every((t) => hay.includes(t))) continue;
    // Prefer matches in the sentence itself over matches in the unit title, and shorter sentences.
    const direct = `${hit.sentence.en} ${hit.sentence.zh}`.toLowerCase().includes(q) ? 0 : 100;
    scored.push({ hit, score: direct + hit.sentence.en.length });
  }
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((s) => s.hit);
}

export function lexiconKeysOf(sentence: SpokenSentence): string[] {
  return [...new Set(sentence.tokens.flatMap((t) => (t.key ? [t.key] : [])))];
}
