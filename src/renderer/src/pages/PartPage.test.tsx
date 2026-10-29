// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { fixtureBundle } from '../api/mockApi';
import { renderWithApp } from '../test-utils';
import { PartPage } from './PartPage';

afterEach(cleanup);
it.each(['learn', 'practice', 'apply', 'review', 'challenge'] as const)(
  'keeps the %s lesson page reachable',
  (kind) => {
    const bundle = fixtureBundle();
    bundle.challenges.c1 = { id: 'c1', title: '开口挑战', intro: '介绍自己', maxSeconds: 30, prompts: [] };
    bundle.parts = [
      {
        id: 'test',
        kind,
        title: `课程 ${kind}`,
        week: 1,
        day: 1,
        unitIds: ['u01'],
        light: false,
        challengeId: 'c1',
      },
    ];
    renderWithApp(<PartPage partId="test" from="course" />, { bundle });
    expect(screen.getByRole('heading', { name: `课程 ${kind}` })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /返回/ }).length).toBeGreaterThan(0);
  },
);
