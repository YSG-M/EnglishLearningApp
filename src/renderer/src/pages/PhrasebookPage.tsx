import { useMemo, useState } from 'react';
import { PlayRow } from '../components/AudioButtons';
import { TokenLine } from '../components/TokenLine';
import { Button, Card, PageHeader } from '../components/ui';
import { zh } from '../i18n/zh';
import { useApp } from '../state/AppContext';
import { allPhrases, searchPhrases } from '../state/content';

export function PhrasebookPage() {
  const { bundle, hintProgress, settings } = useApp();
  const [query, setQuery] = useState('');
  const phrases = useMemo(() => allPhrases(bundle), [bundle]);
  const results = useMemo(() => searchPhrases(phrases, query), [phrases, query]);

  return (
    <div className="page">
      <PageHeader title={`🔍 ${zh.phrasebook.title}`} subtitle={zh.phrasebook.hint} />
      <input
        className="search-input"
        type="search"
        value={query}
        placeholder={zh.phrasebook.placeholder}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={zh.phrasebook.title}
      />
      {query.trim() ? (
        <p className="muted small">
          {results.length ? zh.phrasebook.results(results.length) : zh.phrasebook.noResults}
        </p>
      ) : null}
      {query && !results.length ? <Button onClick={() => setQuery('')}>清除搜索</Button> : null}
      <ul className="phrase-results">
        {results.map((r) => (
          <li key={r.sentence.audio}>
            <Card>
              <p className="muted small">
                {r.unit.kind === 'work' ? '🏫' : '🏠'} {r.unit.title}
              </p>
              <TokenLine
                tokens={r.sentence.tokens}
                lexicon={bundle.lexicon}
                hintProgress={hintProgress}
                showHints={settings.showHints}
                size="md"
              />
              <p className="zh">{r.sentence.zh}</p>
              <PlayRow sentence={r.sentence} size="sm" />
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
