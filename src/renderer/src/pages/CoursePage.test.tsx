// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createMockApi } from '../api/mockApi';
import { renderWithApp } from '../test-utils';
import { CoursePage } from './CoursePage';

afterEach(cleanup);

describe('<CoursePage>', () => {
  it('lets her take a finished lesson again and start the next one', async () => {
    renderWithApp(<CoursePage />, { api: createMockApi({ completed: ['u01:learn'] }) });
    expect(await screen.findByRole('button', { name: /再上一次/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始上课' })).toBeInTheDocument();
    expect(screen.getByText(/打招呼 · 学新句子/)).toBeInTheDocument();
  });
});
