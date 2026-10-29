// usage: npx tsx taught.ts <uid> [word ...]   | --dump | --story <file.json> (lines with en)
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tokenize } from 'D:/Projects/English Learning APP/EnglishLearningApp/src/shared/content/tokenize';

const root = 'D:/Projects/English Learning APP/EnglishLearningApp/content';
const lex = new Map<string, string>();
for (const f of readdirSync(join(root, 'lexicon'))) {
  for (const e of JSON.parse(readFileSync(join(root, 'lexicon', f), 'utf8'))) lex.set(e.text.toLowerCase(), f);
}
const cur = JSON.parse(readFileSync(join(root, 'curriculum.json'), 'utf8'));
const files = readdirSync(join(root, 'units'));
const order: string[] = cur.weeks.flatMap((w: any) => w.units);
const target = process.argv[2];
const firstAt = new Map<string, string>();
for (const uid of order) {
  const f = files.find((x) => x.startsWith(uid + '-'))!;
  const u = JSON.parse(readFileSync(join(root, 'units', f), 'utf8'));
  const sents = [
    ...u.chunks, ...(u.patterns?.examples ?? []), ...(u.daily ?? []),
    ...u.dialogue.nodes.flatMap((n: any) => n.replies),
  ];
  for (const s of sents) for (const t of tokenize(s.en)) if (t.key && !firstAt.has(t.key)) firstAt.set(t.key, uid);
  if (uid === target) break;
}
const args = process.argv.slice(3);
if (args[0] === '--dump') {
  console.log([...firstAt.keys()].sort().join(' '));
} else if (args[0] === '--story') {
  const data = JSON.parse(readFileSync(args[1], 'utf8'));
  const names = new Set<string>((args[2] ?? '').split(',').filter(Boolean).map((s) => s.toLowerCase()));
  const lines: any[] = Array.isArray(data) ? data : [...data.narrative.lines, ...data.dialogue.lines];
  if (!Array.isArray(data)) for (const c of data.dialogue.cast) for (const t of tokenize(c.name)) names.add(t.key!);
  for (const l of lines) {
    const bad = tokenize(l.en).filter((t) => t.key && !names.has(t.key) && (!lex.has(t.key) || !firstAt.has(t.key)))
      .map((t) => (lex.has(t.key!) ? `${t.key}(untaught)` : `${t.key}(NOLEX)`));
    const n = tokenize(l.en).length;
    if (bad.length || n > 10) console.log(`${n}w ${l.en}  -> ${bad.join(' ')}`);
  }
} else {
  for (const w of args) {
    const k = w.toLowerCase();
    console.log(`${w}: lex=${lex.get(k) ?? '-'} taught=${firstAt.get(k) ?? '-'}`);
  }
}
