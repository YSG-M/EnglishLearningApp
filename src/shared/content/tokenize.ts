export interface Token {
  /** The word as displayed, without surrounding punctuation. */
  surface: string;
  /** Lexicon key (lower-case surface). Absent for numbers, which carry no 谐音. */
  key?: string;
  /** Punctuation displayed before / after the word. */
  lead: string;
  trail: string;
}

const NUMBER = /^\$?\d[\d,]*(\.\d+)?(am|pm|%|st|nd|rd|th|s)?$/i;
const EDGE_PUNCT = /^([("'“‘]*)(.*?)([)"'”’.,!?;:…]*)$/u;

export function normalizeApostrophes(text: string): string {
  return text.replace(/[’‘]/g, "'");
}

export function lexiconKey(word: string): string {
  return normalizeApostrophes(word).toLowerCase();
}

/** Splits an English sentence into displayable word tokens. */
export function tokenize(sentence: string): Token[] {
  const tokens: Token[] = [];
  for (const raw of normalizeApostrophes(sentence).split(/\s+/)) {
    if (!raw) continue;
    const m = EDGE_PUNCT.exec(raw);
    const lead = m?.[1] ?? '';
    const surface = m?.[2] ?? raw;
    const trail = m?.[3] ?? '';
    if (!surface) {
      // A free-standing dash or ellipsis: attach to the previous word.
      const prev = tokens.at(-1);
      if (prev) prev.trail += ` ${raw}`;
      continue;
    }
    tokens.push(NUMBER.test(surface) ? { surface, lead, trail } : { surface, key: lexiconKey(surface), lead, trail });
  }
  return tokens;
}
