import type { Report, Session } from './model';
import { calculate, totals } from './logic';
import { ar, dateTime } from '../i18n/ar';
export function reportBill(session: Session, at: number) {
  return session.bill ?? calculate(session, Math.max(at, session.start), 0);
}
export function reportRows(report: Report): (string | number)[][] {
  const rows: (string | number)[][] = [
    [report.settings.shopName],
    [report.title, report.period],
    [ar.device, report.settings.device],
    [ar.generated, dateTime(report.generatedAt, report.settings.timezone)],
    [ar.totalsFinal],
    [ar.currency, report.settings.currency],
    [],
    [ar.shift, ar.from, ar.to, ar.openedBy, ar.closedBy, ar.status],
  ];
  for (const shift of report.shifts)
    rows.push([
      shift.date,
      dateTime(shift.start, report.settings.timezone),
      shift.end ? dateTime(shift.end, report.settings.timezone) : ar.shiftOpen,
      report.users.find((u) => u.id === shift.openedBy)?.username ?? '',
      report.users.find((u) => u.id === shift.closedBy)?.username ?? '',
      shift.end ? ar.shiftClosed : ar.shiftOpen,
    ]);
  rows.push(
    [],
    [ar.shift],
    [
      ar.from,
      ar.to,
      ar.play,
      ar.services,
      ar.discounts,
      ar.expenses,
      ar.net,
      ar.unpaid,
    ],
  );
  for (const shift of report.shifts) {
    const t = totals(
      report.sessions.filter((s) => s.shiftId === shift.id),
      report.expenses.filter((e) => e.shiftId === shift.id),
      report.generatedAt,
    );
    rows.push([
      dateTime(shift.start, report.settings.timezone),
      shift.end ? dateTime(shift.end, report.settings.timezone) : ar.shiftOpen,
      t.play / 100,
      t.services / 100,
      t.discounts / 100,
      t.expenses / 100,
      t.net / 100,
      t.unpaid / 100,
    ]);
  }
  rows.push(
    [],
    [ar.sessions],
    [
      ar.room,
      ar.mode,
      ar.from,
      ar.to,
      ar.billed,
      ar.play,
      ar.services,
      ar.discount,
      ar.total,
      ar.paid,
      ar.unpaid,
      ar.status,
    ],
  );
  for (const s of report.sessions.filter(
    (s) => s.status === 'running' || s.status === 'finished',
  )) {
    const b = reportBill(s, report.generatedAt);
    rows.push([
      s.roomName,
      ar[s.mode],
      dateTime(s.start, s.timezone),
      s.end ? dateTime(s.end, s.timezone) : ar.running,
      b.billedMinutes,
      b.play / 100,
      b.services / 100,
      b.discount / 100,
      b.total / 100,
      b.paid / 100,
      b.unpaid / 100,
      ar[s.status],
    ]);
  }
  rows.push(
    [],
    [ar.auditSessions],
    [ar.room, ar.status, ar.from, ar.to, ar.reason, ar.total],
  );
  for (const s of report.sessions.filter(
    (s) => s.status === 'cancelled' || s.status === 'voided',
  ))
    rows.push([
      s.roomName,
      ar[s.status],
      dateTime(s.start, s.timezone),
      s.end ? dateTime(s.end, s.timezone) : '',
      s.reason ?? '',
      s.status === 'cancelled' ? 0 : (s.bill?.total ?? 0) / 100,
    ]);
  rows.push(
    [],
    [ar.roomSummary],
    [
      ar.room,
      ar.count,
      ar.period,
      ar.play,
      ar.services,
      ar.discounts,
      ar.total,
    ],
  );
  for (const id of new Set([
    ...(report.rooms ?? []).filter((r) => r.active).map((r) => r.id),
    ...report.sessions.map((s) => s.roomId),
  ])) {
    const ss = report.sessions.filter((s) => s.roomId === id);
    const t = totals(ss, [], report.generatedAt);
    rows.push([
      ss[0]?.roomName ?? report.rooms.find((r) => r.id === id)!.name,
      t.count,
      ss
        .map(
          (s) =>
            `${dateTime(s.start)} - ${s.end ? dateTime(s.end, s.timezone) : ar.running}`,
        )
        .join(' / '),
      t.play / 100,
      t.services / 100,
      t.discounts / 100,
      (t.play + t.services - t.discounts) / 100,
    ]);
  }
  rows.push([], [ar.servicesSold], [ar.name, ar.quantity, ar.amount]);
  const sold = new Map<string, { quantity: number; amount: number }>();
  for (const s of report.sessions.filter((s) => s.status === 'finished'))
    for (const l of s.services) {
      const prev = sold.get(l.name) ?? { quantity: 0, amount: 0 };
      sold.set(l.name, {
        quantity: prev.quantity + l.quantity,
        amount: prev.amount + l.price * l.quantity,
      });
    }
  for (const [name, x] of sold) rows.push([name, x.quantity, x.amount / 100]);
  rows.push([], [ar.discounts], [ar.room, ar.discount, ar.reason]);
  for (const s of report.sessions.filter(
    (s) => s.status === 'finished' && s.bill?.discount,
  ))
    rows.push([s.roomName, s.bill!.discount / 100, s.discount?.reason ?? '']);
  rows.push(
    [],
    [ar.expenses],
    [ar.description, ar.category, ar.amount, ar.status],
  );
  for (const e of report.expenses)
    rows.push([
      e.description,
      e.category,
      e.amount / 100,
      e.voided ? ar.voided : ar.active,
    ]);
  rows.push([], [ar.expenseSummary], [ar.category, ar.amount]);
  for (const c of new Set(report.expenses.map((e) => e.category)))
    rows.push([
      c,
      report.expenses
        .filter((e) => e.category === c && !e.voided)
        .reduce((n, e) => n + e.amount, 0) / 100,
    ]);
  rows.push(
    [],
    [ar.total],
    [ar.count, report.totals.count],
    [ar.cancelled, report.totals.cancelled],
    [ar.voided, report.totals.voided],
  );
  for (const [label, key] of [
    [ar.play, 'play'],
    [ar.services, 'services'],
    [ar.discounts, 'discounts'],
    [ar.expenses, 'expenses'],
    [ar.net, 'net'],
    [ar.unpaid, 'unpaid'],
  ] as const)
    rows.push([label, report.totals[key] / 100]);
  rows.push([
    ar.signature,
    report.shifts
      .map((s) => report.users.find((u) => u.id === s.closedBy)?.username ?? '')
      .join(' / '),
  ]);
  return rows;
}
