/**
 * Turns both the target sentence and the recogniser's transcript into comparable word lists.
 *
 * Whisper writes "$280", "4pm", "I'm"; content may write "two hundred and eighty dollars",
 * "4 p.m.", "I am". Both sides go through the same rules so neither form counts as a mistake.
 */

const CONTRACTIONS: Record<string, string> = {
  "i'm": 'i am',
  "you're": 'you are',
  "we're": 'we are',
  "they're": 'they are',
  "he's": 'he is',
  "she's": 'she is',
  "it's": 'it is',
  "that's": 'that is',
  "what's": 'what is',
  "where's": 'where is',
  "who's": 'who is',
  "how's": 'how is',
  "there's": 'there is',
  "here's": 'here is',
  "let's": 'let us',
  "i'll": 'i will',
  "you'll": 'you will',
  "we'll": 'we will',
  "he'll": 'he will',
  "she'll": 'she will',
  "it'll": 'it will',
  "they'll": 'they will',
  "i've": 'i have',
  "you've": 'you have',
  "we've": 'we have',
  "i'd": 'i would',
  "you'd": 'you would',
  "don't": 'do not',
  "doesn't": 'does not',
  "didn't": 'did not',
  "isn't": 'is not',
  "aren't": 'are not',
  "wasn't": 'was not',
  "weren't": 'were not',
  "haven't": 'have not',
  "hasn't": 'has not',
  "can't": 'can not',
  cannot: 'can not',
  "couldn't": 'could not',
  "won't": 'will not',
  "wouldn't": 'would not',
  "shouldn't": 'should not',
  okay: 'ok',
  'o.k.': 'ok',
  "o'clock": 'oclock',
  'mr.': 'mr',
  'mrs.': 'mrs',
  'ms.': 'ms',
  'a.m.': 'am',
  'p.m.': 'pm',
};

const UNITS: Record<string, number> = {
  zero: 0,
  oh: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
const SCALES: Record<string, number> = { hundred: 100, thousand: 1000 };

/** Collapses runs of number words ("two hundred and eighty") into digits ("280"). */
function collapseNumberWords(words: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    const w = words[i]!;
    if (!(w in UNITS)) {
      out.push(w);
      i++;
      continue;
    }
    let total = 0;
    let current = 0;
    let j = i;
    while (j < words.length) {
      const t = words[j]!;
      if (t in UNITS) {
        // "twenty five" is one number; "one two three" (a block number read digit by digit) is three.
        const prev = j > i ? words[j - 1]! : undefined;
        if (prev !== undefined && prev in UNITS) {
          const p = UNITS[prev]!;
          if (!(p >= 20 && p % 10 === 0 && UNITS[t]! < 10)) break;
        }
        current += UNITS[t]!;
      } else if (t in SCALES && j > i) {
        const scale = SCALES[t]!;
        if (scale === 100) current *= 100;
        else {
          total += current * scale;
          current = 0;
        }
      } else if (
        t === 'and' &&
        j > i &&
        words[j + 1] !== undefined &&
        words[j + 1]! in UNITS &&
        SCALES[words[j - 1]!]
      ) {
        // "two hundred and eighty": the "and" belongs to the number.
      } else break;
      j++;
    }
    // "oh" alone is an interjection, not zero.
    if (j === i + 1 && w === 'oh') {
      out.push(w);
      i++;
      continue;
    }
    out.push(String(total + current));
    i = j;
  }
  return out;
}

function expandToken(token: string): string[] {
  const t = token.replace(/[’‘]/g, "'");
  const mapped = CONTRACTIONS[t];
  if (mapped) return mapped.split(' ');
  // "$280" -> "280 dollars"; "$12.50" -> "12.50 dollars"
  const money = /^\$(\d[\d,]*(?:\.\d+)?)$/.exec(t);
  if (money) return [money[1]!.replace(/,/g, ''), 'dollars'];
  // "4pm" -> "4 pm"; "10:30am" -> "10:30 am"
  const time = /^(\d{1,2}(?::\d{2})?)(am|pm)$/.exec(t);
  if (time) return [time[1]!, time[2]!];
  // "15th" -> "15"; "10%" is split from "%" earlier, which becomes "percent".
  const ordinal = /^(\d+)(st|nd|rd|th)$/.exec(t);
  if (ordinal) return [ordinal[1]!];
  if (/^\d[\d,]*$/.test(t)) return [t.replace(/,/g, '')];
  return [t];
}

/**
 * Integers are compared digit by digit, so "123", "one two three" and "one hundred and
 * twenty three" all agree. Times ("10:30") and decimals ("12.50") stay whole.
 */
function splitDigits(words: string[]): string[] {
  return words.flatMap((w) => (/^\d{2,}$/.test(w) ? [...w] : [w]));
}

export function normalizeWords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    // Keep apostrophes, $, digits, colons and dots inside numbers; everything else separates words.
    .replace(/(\d)\.(\d)/g, '$1§$2')
    .replace(/(a|p)\.m\./g, '$1m')
    .replace(/%/g, ' percent')
    .replace(/[^a-z0-9'$:§\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/§/g, '.')
    .split(/\s+/)
    .filter(Boolean)
    .flatMap(expandToken)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
  return splitDigits(collapseNumberWords(words)).map((w) => (w === 'dollar' ? 'dollars' : w));
}
