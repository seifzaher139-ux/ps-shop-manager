import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { Reports } from './Reports';
import { defaults, permissions, type Session } from '../core/model';
import { buildReport, calculate } from '../core/logic';
import { useStore } from '../services/store';
import { clock } from '../services/platform';
import { ar } from '../i18n/ar';
const now = Date.UTC(2026, 10, 26, 12);
beforeEach(() => {
  vi.spyOn(clock, 'now').mockReturnValue(now);
  window.location.hash = '/reports';
  const data = defaults();
  data.users = [
    {
      id: 'u',
      username: 'Seif',
      admin: true,
      active: true,
      password: 'unused',
      permissions: [...permissions],
    },
  ];
  data.shifts = [
    {
      id: 'closed',
      date: '2026-11-25',
      start: now - 86400000,
      end: now - 82800000,
      openedBy: 'u',
      closedBy: 'u',
      note: '',
    },
    {
      id: 'open',
      date: '2026-11-26',
      start: now - 3600000,
      openedBy: 'u',
      note: '',
    },
  ];
  const s: Session = {
    id: 'finished',
    shiftId: 'closed',
    roomId: 'ps4-1',
    roomName: 'PS4 روم 1',
    mode: 'single',
    start: data.shifts[0].start,
    end: data.shifts[0].end,
    rate: 2500,
    status: 'finished',
    timezone: 'Africa/Cairo',
    createdBy: 'u',
    services: [],
    note: '',
    pricing: {
      roundTime: true,
      priceRound: 'pound',
      thresholds: { half: 35, quarter: 45 },
    },
  };
  s.bill = calculate(s, s.end!, 2500);
  data.sessions = [
    s,
    {
      ...s,
      id: 'running',
      shiftId: 'open',
      start: now - 3600000,
      end: undefined,
      status: 'running',
      bill: undefined,
    },
  ];
  data.shifts[0].frozen = buildReport(
    data,
    ['closed'],
    data.shifts[0].end!,
    'legacy',
    '2026-11-25',
  );
  data.settings.shopName = 'Changed shop';
  useStore.setState({ data, userId: 'u', ready: true });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('has exactly three reports and inclusive totals filters without detailed sections', () => {
  const { container } = render(<Reports />);
  expect(screen.getAllByRole('tab')).toHaveLength(3);
  expect(screen.getByRole('tab', { name: ar.totalsReport })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(container.querySelectorAll('[data-metric]')).toHaveLength(6);
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(ar.fromDate), {
    target: { value: '2026-11-25' },
  });
  fireEvent.change(screen.getByLabelText(ar.toDate), {
    target: { value: '2026-11-25' },
  });
  expect(
    container.querySelector(`[data-metric="${ar.play}"]`),
  ).toHaveTextContent('25');
  expect(
    container.querySelector(`[data-metric="${ar.shiftCount}"]`),
  ).toHaveTextContent('1');
  expect(container.querySelector('.session-report-card')).toBeNull();
  fireEvent.change(screen.getByLabelText(ar.fromDate), {
    target: { value: '2026-11-26' },
  });
  expect(screen.getByRole('alert')).toHaveTextContent(ar.invalidDateRange);
  expect(screen.getByRole('button', { name: ar.excel })).toBeDisabled();
});
it('lists each selected-day shift in just five columns with no session detail', () => {
  const { container } = render(<Reports />);
  fireEvent.click(screen.getByRole('tab', { name: ar.shiftsReport }));
  fireEvent.change(screen.getByLabelText(ar.date), {
    target: { value: '2026-11-25' },
  });
  const table = screen.getByRole('table');
  expect(
    within(table)
      .getAllByRole('columnheader')
      .map((el) => el.textContent),
  ).toEqual([ar.name, ar.from, ar.to, ar.revenue, ar.net]);
  expect(within(table).getAllByRole('row')).toHaveLength(2);
  expect(container.querySelector('[data-metric]')).toBeNull();
  expect(container.querySelector('.session-report-card')).toBeNull();
  fireEvent.change(screen.getByLabelText(ar.date), {
    target: { value: '2026-11-24' },
  });
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
it('opens current live details by default and reads a historical frozen closing report', () => {
  const { container } = render(<Reports />);
  fireEvent.click(screen.getByRole('tab', { name: ar.closingReport }));
  expect(
    screen.getByRole('heading', { name: ar.liveShiftReport }),
  ).toBeVisible();
  expect(container.querySelectorAll('.session-report-card')).toHaveLength(1);
  expect(screen.getByText(ar.liveShiftHint)).toBeVisible();
  expect(container.querySelector('.session-report-card')).not.toHaveTextContent(
    ar.serviceDetails,
  );
  fireEvent.change(screen.getByLabelText(ar.date), {
    target: { value: '2026-11-25' },
  });
  expect(screen.getByRole('heading', { name: ar.closingReport })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'بلايستيشن' })).toBeVisible();
  expect(
    screen.queryByRole('heading', { name: 'Changed shop' }),
  ).not.toBeInTheDocument();
  expect(screen.getByText(ar.finalShiftHint)).toBeVisible();
  expect(screen.getByRole('button', { name: ar.currentShift })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: ar.currentShift }));
  expect(
    screen.getByRole('heading', { name: ar.liveShiftReport }),
  ).toBeVisible();
});
it('follows a closing deep link to a shift from its opening date, even after midnight', () => {
  window.location.hash = '/reports?closing=1&shift=closed';
  render(<Reports />);
  expect(screen.getByRole('tab', { name: ar.closingReport })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(screen.getByLabelText(ar.date)).toHaveValue('2026-11-25');
  expect(screen.getByRole('heading', { name: ar.closingReport })).toBeVisible();
});
