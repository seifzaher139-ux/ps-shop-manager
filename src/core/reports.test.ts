import { describe, expect, it } from 'vitest';
import { defaults, type State, type Session } from './model';
import { buildReport, calculate, reconcileRooms } from './logic';
import {
  buildReportDocument,
  dateRangeShiftIds,
  reportRows,
  shiftName,
} from './reports';
import { ar } from '../i18n/ar';
function fixture(): State {
  const state = defaults();
  state.rooms = reconcileRooms(state);
  state.users = [
    {
      id: 'u',
      username: 'Seif',
      admin: true,
      active: true,
      password: 'unused',
      permissions: [],
    },
  ];
  state.shifts = [
    {
      id: 'first',
      date: '2026-11-25',
      start: Date.UTC(2026, 10, 25, 8),
      end: Date.UTC(2026, 10, 25, 12),
      openedBy: 'u',
      closedBy: 'u',
      note: '',
    },
    {
      id: 'second',
      date: '2026-11-25',
      start: Date.UTC(2026, 10, 25, 13),
      end: Date.UTC(2026, 10, 25, 16),
      openedBy: 'u',
      closedBy: 'u',
      note: '',
    },
    {
      id: 'open',
      date: '2026-11-26',
      start: Date.UTC(2026, 10, 26, 8),
      openedBy: 'u',
      note: '',
    },
  ];
  const session: Session = {
    id: 's',
    shiftId: 'first',
    roomId: 'ps4-1',
    roomName: 'PS4 روم 1',
    mode: 'single',
    rate: 2500,
    start: Date.UTC(2026, 10, 25, 9),
    end: Date.UTC(2026, 10, 25, 10),
    status: 'finished',
    timezone: 'Africa/Cairo',
    note: '',
    createdBy: 'u',
    services: [{ id: 'tea', name: 'tea', price: 1000, quantity: 1 }],
    discount: { kind: 'fixed', value: 500, reason: 'loyalty' },
    pricing: {
      roundTime: true,
      priceRound: 'pound',
      thresholds: { half: 35, quarter: 45 },
    },
  };
  session.bill = calculate(session, session.end!, 4000);
  state.sessions = [session];
  state.expenses = [
    {
      id: 'expense',
      shiftId: 'first',
      description: 'food',
      amount: 1000,
      category: 'other',
      voided: false,
      createdBy: 'u',
    },
  ];
  return state;
}
const now = Date.UTC(2026, 10, 26, 10);
describe('three report documents', () => {
  it('selects inclusive opening dates and rejects reversed or missing ranges', () => {
    const d = fixture();
    expect(dateRangeShiftIds(d.shifts, '2026-11-25', '2026-11-25')).toEqual([
      'first',
      'second',
    ]);
    expect(
      dateRangeShiftIds(d.shifts, '2026-11-25', '2026-11-26'),
    ).toHaveLength(3);
    expect(() =>
      dateRangeShiftIds(d.shifts, '2026-11-26', '2026-11-25'),
    ).toThrow();
    expect(() => dateRangeShiftIds(d.shifts, '', '2026-11-25')).toThrow();
  });
  it('shows exactly six ordered numeric metrics with no details in totals', () => {
    const d = fixture();
    const doc = buildReportDocument(
      buildReport(d, ['first', 'second'], now, '', 'dates'),
      'totals',
    );
    expect(doc.blocks).toHaveLength(1);
    const b = doc.blocks[0];
    expect(b.type).toBe('metrics');
    if (b.type !== 'metrics') throw new Error();
    expect(b.fields.map((f) => f.label)).toEqual([
      ar.play,
      ar.services,
      ar.discounts,
      ar.expenses,
      ar.net,
      ar.shiftCount,
    ]);
    expect(b.fields.map((f) => f.value)).toEqual([
      2500, 1000, 500, 1000, 2000, 2,
    ]);
    expect(reportRows(doc).some((r) => r.cells.includes('loyalty'))).toBe(
      false,
    );
  });
  it('shows just one five-column row per shift and net deducts discounts once', () => {
    const d = fixture();
    const doc = buildReportDocument(
      buildReport(d, ['first', 'second'], now, '', 'day'),
      'shifts',
    );
    expect(doc.blocks).toHaveLength(1);
    const b = doc.blocks[0];
    if (b.type !== 'table') throw new Error();
    expect(b.columns.map((c) => c.label)).toEqual([
      ar.name,
      ar.from,
      ar.to,
      ar.revenue,
      ar.net,
    ]);
    expect(b.rows).toHaveLength(2);
    expect(b.rows[0].slice(-2)).toEqual([3000, 2000]);
    expect(b.rows[1][0]).toBe(`${ar.shift} 2`);
    expect(doc.footer).toEqual([]);
    expect(doc.notes).toEqual([]);
    expect(shiftName(d.shifts[1], d.shifts)).toBe(`${ar.shift} 2`);
  });
  it('hides empty sections but retains all six zero metrics for an empty range', () => {
    const d = fixture();
    const empty = buildReport(d, [], now, '', 'empty');
    expect(buildReportDocument(empty, 'shifts').blocks).toEqual([]);
    expect(buildReportDocument(empty, 'shift').blocks).toEqual([]);
    const doc = buildReportDocument(empty, 'totals');
    const b = doc.blocks[0];
    if (b.type !== 'metrics') throw new Error();
    expect(b.fields.map((f) => f.value)).toEqual([0, 0, 0, 0, 0, 0]);
  });
  it('includes live accrual without turning it into finalized revenue or unpaid debt', () => {
    const d = fixture();
    d.sessions = [
      {
        ...d.sessions[0],
        id: 'running',
        shiftId: 'open',
        start: d.shifts[2].start,
        end: undefined,
        status: 'running',
        bill: undefined,
        services: [],
        discount: undefined,
      },
    ];
    const doc = buildReportDocument(
      buildReport(d, ['open'], now, '', ''),
      'shift',
      d.shifts,
    );
    expect(doc.title).toBe(ar.liveShiftReport);
    expect(doc.notes).toContain(ar.liveShiftHint);
    const b = doc.blocks.find((b) => b.type === 'session');
    if (!b || b.type !== 'session') throw new Error();
    expect(b.fields.find((f) => f.label === ar.total)?.value).toBe(5000);
    expect(b.fields.some((f) => f.label === ar.unpaid)).toBe(false);
    expect(
      b.fields.some(
        (f) =>
          f.label === ar.services ||
          f.label === ar.discount ||
          f.label === ar.reason,
      ),
    ).toBe(false);
  });
  it('renders old frozen reports through the new presentation without mutating snapshots', () => {
    const d = fixture();
    const frozen = buildReport(d, ['first'], now, 'old title', '2026-11-25');
    const original = structuredClone(frozen);
    const doc = buildReportDocument(frozen, 'shift', d.shifts);
    expect(doc.title).toBe(ar.closingReport);
    expect(doc.notes).toContain(ar.finalShiftHint);
    expect(doc.footer).toEqual([
      { label: ar.closedBy, value: 'Seif', format: 'text' },
    ]);
    expect(frozen).toEqual(original);
    const b = doc.blocks.find((b) => b.type === 'session');
    if (!b || b.type !== 'session') throw new Error();
    const labels = b.fields.map((f) => f.label);
    const rows = reportRows(doc);
    const sectionIndex = rows.findIndex((r) => r.cells[0] === b.title);
    expect(
      rows
        .slice(sectionIndex + 1, sectionIndex + 1 + b.fields.length)
        .map((r) => r.cells[0]),
    ).toEqual(labels);
    expect(rows.some((r) => r.cells[0] === ar.total && r.cells[1] === 30)).toBe(
      true,
    );
  });
});
