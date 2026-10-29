import type { ContentBundle, StoriesItem } from '../../shared/content/bundle';

export function recordingItemIds(bundle: ContentBundle): Set<string> {
  const ids = new Set([...Object.keys(bundle.clips), ...Object.keys(bundle.lexicon)]);
  const stories = (items: StoriesItem, prefix: string) => {
    items.narrative.lines.forEach((_, i) => ids.add(`${prefix}.story1.${i + 1}`));
    items.dialogue.lines.forEach((_, i) => ids.add(`${prefix}.story2.${i + 1}`));
  };
  for (const unit of Object.values(bundle.units)) {
    for (const item of [...unit.chunks, ...unit.daily, ...unit.patterns.examples]) ids.add(item.id);
    const seen = new Set<string>();
    for (const node of Object.values(unit.dialogue.nodes)) {
      ids.add(node.id);
      for (const reply of node.replies) {
        const key = reply.en.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          ids.add(`${unit.id}.reply.${seen.size}`);
        }
      }
    }
    stories(unit.stories, unit.id);
  }
  for (const week of Object.values(bundle.weeks)) stories(week.stories, `w${week.week}`);
  for (const phonics of Object.values(bundle.phonics)) for (const pair of phonics.pairs) ids.add(pair.id);
  return ids;
}
