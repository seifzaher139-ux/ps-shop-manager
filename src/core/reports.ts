import type { Report, Session, Shift, Settings } from './model';
import { calculate, totals } from './logic';
import { ar, dateTime, dayKey, timeOfDay, number } from '../i18n/ar';

export type ReportKind = 'totals' | 'shifts' | 'shift';
export type ValueFormat = 'text' | 'money' | 'number';
export interface ReportField {
  label: string;
  value: string | number;
  format: ValueFormat;
}
export interface ReportColumn {
  label: string;
  format: ValueFormat;
}
export type ReportBlock =
  | { type: 'metrics'; fields: ReportField[] }
  | { type: 'table'; columns: ReportColumn[]; rows: (string | number)[][] }
  | {
      type: 'session';
      id: string;
      title: string;
      status: Session['status'];
      fields: ReportField[];
    };
export interface ReportDocument {
  source: Report;
  kind: ReportKind;
  title: string;
  period: string;
  generatedAt: number;
  settings: Settings;
  notes: string[];
  blocks: ReportBlock[];
  footer: ReportField[];
}
export interface ExportRow {
  cells: (string | number)[];
  style: 'heading' | 'header' | 'body';
  formats?: ValueFormat[];
}
export function reportBill(session: Session, at: number) {
  return session.bill ?? calculate(session, Math.max(at, session.start), 0);
}
export function shiftName(shift: Shift, allShifts: Shift[]): string {
  const sameDay = allShifts
    .filter((s) => s.date === shift.date)
    .sort((a, b) => a.start - b.start);
  return `${ar.shift} ${number(sameDay.findIndex((s) => s.id === shift.id) + 1)}`;
}
export function dateRangeShiftIds(
  shifts: Shift[],
  from: string,
  to: string,
): string[] {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
    from > to
  )
    throw new Error('invalid-date-range');
  return shifts.filter((s) => s.date >= from && s.date <= to).map((s) => s.id);
}
function field(
  label: string,
  value: string | number,
  format: ValueFormat = 'text',
): ReportField {
  return { label, value, format };
}
function metrics(report: Report, includeShiftCount: boolean): ReportField[] {
  const result = (
    ['play', 'services', 'discounts', 'expenses', 'net'] as const
  ).map((key) => field(ar[key], report.totals[key], 'money'));
  if (includeShiftCount)
    result.push(field(ar.shiftCount, report.shifts.length, 'number'));
  else if (report.totals.unpaid)
    result.push(field(ar.unpaid, report.totals.unpaid, 'money'));
  return result;
}
export function buildReportDocument(
  report: Report,
  kind: ReportKind,
  allShifts: Shift[] = report.shifts,
): ReportDocument {
  const shift = report.shifts[0];
  const closed = kind === 'shift' && !!shift?.end;
  const doc: ReportDocument = {
    source: report,
    kind,
    title:
      kind === 'totals'
        ? ar.totalsReport
        : kind === 'shifts'
          ? ar.shiftsReport
          : closed
            ? ar.closingReport
            : ar.liveShiftReport,
    period: report.period,
    generatedAt: report.generatedAt,
    settings: report.settings,
    notes: [],
    blocks: [],
    footer: [],
  };
  if (kind === 'totals') {
    doc.blocks.push({ type: 'metrics', fields: metrics(report, true) });
    return doc;
  }
  if (kind === 'shifts') {
    if (report.shifts.length)
      doc.blocks.push({
        type: 'table',
        columns: [
          { label: ar.name, format: 'text' },
          { label: ar.from, format: 'text' },
          { label: ar.to, format: 'text' },
          { label: ar.revenue, format: 'money' },
          { label: ar.expenses, format: 'money' },
          { label: ar.net, format: 'money' },
        ],
        rows: report.shifts.map((s) => {
          const t = totals(
            report.sessions.filter((x) => x.shiftId === s.id),
            report.expenses.filter((e) => e.shiftId === s.id),
            report.generatedAt,
          );
          return [
            shiftName(s, allShifts),
            timeOfDay(s.start, report.settings.timezone),
            s.end
              ? dayKey(s.end, report.settings.timezone) === s.date
                ? timeOfDay(s.end, report.settings.timezone)
                : dateTime(s.end, report.settings.timezone)
              : ar.running,
            t.play + t.services - t.discounts,
            t.expenses,
            t.net,
          ];
        }),
      });
    return doc;
  }
  if (!shift) return doc;
  doc.period = `${shiftName(shift, allShifts)} · ${shift.date}`;
  doc.notes.push(
    closed
      ? ar.finalShiftHint
      : report.sessions.some((s) => s.status === 'running')
        ? ar.liveShiftHint
        : ar.liveReportHint,
  );
  const opener = report.users.find((u) => u.id === shift.openedBy)?.username;
  if (opener) doc.notes.push(`${ar.openedBy}: ${opener}`);
  doc.blocks.push({ type: 'metrics', fields: metrics(report, false) });
  for (const [index, s] of [...report.sessions]
    .sort((a, b) => a.start - b.start)
    .entries()) {
    const active = s.status === 'running' || s.status === 'finished';
    const b = reportBill(s, report.generatedAt);
    const fields: ReportField[] = [
      field(ar.status, s.status === 'running' ? ar.running : ar[s.status]),
      field(ar.mode, ar[s.mode]),
      field(ar.from, dateTime(s.start, s.timezone)),
      field(ar.to, s.end ? dateTime(s.end, s.timezone) : ar.running),
    ];
    if (active) {
      fields.push(
        field(ar.billedMinutesLabel, b.billedMinutes, 'number'),
        field(ar.play, b.play, 'money'),
      );
      if (b.services) fields.push(field(ar.services, b.services, 'money'));
      if (b.discount) fields.push(field(ar.discount, b.discount, 'money'));
      if (s.discount?.reason)
        fields.push(field(ar.discountReason, s.discount.reason));
      fields.push(field(ar.total, b.total, 'money'));
      if (s.status === 'finished') {
        fields.push(field(ar.paid, b.paid, 'money'));
        if (b.change) fields.push(field(ar.change, b.change, 'money'));
        if (b.unpaid) fields.push(field(ar.unpaid, b.unpaid, 'money'));
      }
      if (s.services.length)
        fields.push(
          field(
            ar.serviceDetails,
            s.services
              .map((l) => `${l.name} × ${number(l.quantity)}`)
              .join('، '),
          ),
        );
    } else fields.push(field(ar.total, 0, 'money'));
    if (s.reason) fields.push(field(ar.reason, s.reason));
    if (s.note) fields.push(field(ar.note, s.note));
    doc.blocks.push({
      type: 'session',
      id: s.id,
      status: s.status,
      title: `${ar.session} ${number(index + 1)} · ${s.roomName}`,
      fields,
    });
  }
  if (closed) {
    const closer = report.users.find((u) => u.id === shift.closedBy)?.username;
    if (closer) doc.footer.push(field(ar.closedBy, closer));
  }
  return doc;
}
export function reportRows(doc: ReportDocument): ExportRow[] {
  const rows: ExportRow[] = [
    { cells: [doc.settings.shopName], style: 'heading' },
    { cells: [doc.title, doc.period], style: 'heading' },
    { cells: [ar.device, doc.settings.device], style: 'body' },
    {
      cells: [ar.generated, dateTime(doc.generatedAt, doc.settings.timezone)],
      style: 'body',
    },
  ];
  for (const note of doc.notes) rows.push({ cells: [note], style: 'body' });
  const exportValue = (f: ReportField) =>
    f.format === 'money' ? Number(f.value) / 100 : f.value;
  for (const block of doc.blocks) {
    rows.push({ cells: [], style: 'body' });
    if (block.type === 'table') {
      rows.push({ cells: [ar.currency, doc.settings.currency], style: 'body' });
      rows.push({ cells: block.columns.map((c) => c.label), style: 'header' });
      for (const row of block.rows)
        rows.push({
          cells: row.map((value, i) =>
            block.columns[i].format === 'money' ? Number(value) / 100 : value,
          ),
          formats: block.columns.map((c) => c.format),
          style: 'body',
        });
    } else {
      if (block.type === 'session')
        rows.push({ cells: [block.title], style: 'heading' });
      for (const f of block.fields)
        rows.push({
          cells: [f.label, exportValue(f)],
          formats: ['text', f.format],
          style: 'body',
        });
    }
  }
  for (const f of doc.footer)
    rows.push({
      cells: [f.label, exportValue(f)],
      formats: ['text', f.format],
      style: 'body',
    });
  return rows;
}
