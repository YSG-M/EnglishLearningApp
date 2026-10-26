// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderWithApp } from '../test-utils';
import { UnitSummaryPage, WeekSummaryPage } from './SummaryPage';

afterEach(cleanup);

describe('<UnitSummaryPage>', () => {
  it('shows every sentence of the unit and both stories on one page', () => {
    renderWithApp(<UnitSummaryPage unitId="u01" />);
    expect(screen.getByText(/📖 句子/)).toBeInTheDocument();
    expect(screen.getByText(/🔑 句型/)).toBeInTheDocument();
    expect(screen.getByText(/🏠 日常用词/)).toBeInTheDocument();
    expect(screen.getByText(/💬 对话里你说的话/)).toBeInTheDocument();
    expect(screen.getByText(/📚 小故事：Amy 的早上/)).toBeInTheDocument();
    expect(screen.getByText(/🎭 小剧本：新邻居/)).toBeInTheDocument();
    expect(screen.getByText('Mrs Tan：')).toBeInTheDocument();
    expect(screen.getByText(/早上到补习中心，看到同事。/)).toBeInTheDocument();
  });

  it('lets her shadow any line', () => {
    renderWithApp(<UnitSummaryPage unitId="u01" />);
    fireEvent.click(screen.getAllByRole('button', { name: /跟读/ })[0]!);
    expect(screen.getAllByRole('button', { name: /按一下，开始说/ }).length).toBeGreaterThan(0);
  });
});

describe('<WeekSummaryPage>', () => {
  it('lists the week units and the week stories', () => {
    renderWithApp(<WeekSummaryPage week={1} />);
    expect(screen.getByText(/第 1 周汇总/)).toBeInTheDocument();
    expect(screen.getByText(/打招呼/, { selector: 'summary' })).toBeInTheDocument();
    expect(screen.getByText(/📚 小故事/)).toBeInTheDocument();
  });
});
