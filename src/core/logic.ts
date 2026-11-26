import { ROUNDING_THRESHOLDS } from './model';
import { seedText } from '../i18n/ar';
import {
  type Bill,
  type Discount,
  type Permission,
  type Report,
  type Room,
  type Session,
  type Settings,
  type State,
  type Totals,
  type User,
} from './model';
export function can(user: User | undefined, permission: Permission): boolean {
  return (
    !!user?.active && (user.admin || user.permissions.includes(permission))
  );
}
export function integer(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error('invalid-number');
  return value;
}
export function parseMoney(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error('invalid-money');
  const [whole, fraction = ''] = value.split('.');
  return integer(Number(whole) * 100 + Number(fraction.padEnd(2, '0')));
}
export function ceilDiv(value: number, divisor: number): number {
  integer(value);
  integer(divisor);
  if (!divisor) throw new Error('invalid-number');
  return Math.floor(value / divisor) + (value % divisor ? 1 : 0);
}
export function billedMinutes(
  minutes: number,
  enabled = true,
  thresholds: { half: number; quarter: number } = ROUNDING_THRESHOLDS,
): number {
  integer(minutes);
  if (!enabled) return minutes;
  const h = Math.floor(minutes / 60),
    r = minutes % 60;
  return Math.max(
    30,
    h * 60 +
      (r === 0
        ? 0
        : r <= thresholds.half
          ? 30
          : r <= thresholds.quarter
            ? 45
            : 60),
  );
}
export function roundPrice(
  numerator: number,
  denominator: number,
  mode: Settings['priceRound'],
): number {
  const unit = mode === 'pound' ? 100 : mode === 'half' ? 50 : 1;
  return integer(ceilDiv(numerator, denominator * unit) * unit);
}
export function discountAmount(subtotal: number, discount?: Discount): number {
  integer(subtotal);
  if (!discount) return 0;
  integer(discount.value);
  return Math.min(
    subtotal,
    discount.kind === 'fixed'
      ? discount.value
      : ceilDiv(subtotal * Math.min(discount.value, 10000), 10000),
  );
}
export function calculate(
  session: Session,
  now: number,
  paid?: number,
  discount = session.discount,
): Bill {
  if (now < session.start) throw new Error('clock-backwards');
  const minutes = Math.floor((now - session.start) / 60000);
  const billed = billedMinutes(
    minutes,
    session.pricing.roundTime,
    session.pricing.thresholds,
  );
  const play = roundPrice(
    billed * integer(session.rate),
    60,
    session.pricing.priceRound,
  );
  const services = session.services.reduce(
    (sum, l) => sum + integer(l.price) * integer(l.quantity),
    0,
  );
  const reduction = discountAmount(play + services, discount);
  const total = integer(play + services - reduction);
  const payment = paid === undefined ? total : integer(paid);
  return {
    minutes,
    billedMinutes: billed,
    play,
    services,
    discount: reduction,
    total,
    paid: payment,
    change: Math.max(0, payment - total),
    unpaid: Math.max(0, total - payment),
  };
}
export function totals(
  sessions: Session[],
  expenses: State['expenses'],
  now: number,
): Totals {
  const t: Totals = {
    play: 0,
    services: 0,
    discounts: 0,
    expenses: 0,
    net: 0,
    unpaid: 0,
    count: 0,
    cancelled: 0,
    voided: 0,
  };
  for (const s of sessions) {
    if (s.status === 'cancelled') {
      t.cancelled++;
      continue;
    }
    if (s.status === 'voided') {
      t.voided++;
      continue;
    }
    if (s.status === 'running') continue;
    const b = s.bill ?? calculate(s, s.end ?? now);
    t.play += b.play;
    t.services += b.services;
    t.discounts += b.discount;
    t.unpaid += b.unpaid;
    t.count++;
  }
  t.expenses = expenses
    .filter((e) => !e.voided)
    .reduce((n, e) => n + e.amount, 0);
  t.net = t.play + t.services - t.discounts - t.expenses;
  return t;
}
export function buildReport(
  state: State,
  shiftIds: string[],
  now: number,
  title: string,
  period: string,
): Report {
  const sessions = state.sessions.filter((s) => shiftIds.includes(s.shiftId));
  const expenses = state.expenses.filter((e) => shiftIds.includes(e.shiftId));
  return {
    rooms: structuredClone(state.rooms),
    title,
    period,
    generatedAt: now,
    settings: structuredClone(state.settings),
    shifts: state.shifts
      .filter((s) => shiftIds.includes(s.id))
      .map(({ frozen: _frozen, ...s }) => s),
    sessions: structuredClone(sessions),
    expenses: structuredClone(expenses),
    totals: totals(sessions, expenses, now),
    users: state.users.map(({ id, username }) => ({ id, username })),
  };
}
export function reconcileRooms(state: State): Room[] {
  const rooms = structuredClone(state.rooms);
  for (const type of state.settings.types) {
    integer(type.count);
    if (type.count > 100) throw new Error('invalid-number');
    for (let i = 1; i <= type.count; i++) {
      const id = `${type.id}-${i}`;
      const existing = rooms.find((r) => r.id === id);
      if (existing) {
        existing.active = true;
        existing.name = `${type.name} ${seedText.room} ${i}`;
      } else
        rooms.push({
          id,
          typeId: type.id,
          name: `${type.name} ${seedText.room} ${i}`,
          active: true,
        });
    }
    for (const room of rooms.filter((r) => r.typeId === type.id)) {
      const index = Number(room.id.slice(type.id.length + 1));
      if (index > type.count) {
        if (
          state.sessions.some(
            (s) => s.roomId === room.id && s.status === 'running',
          )
        )
          throw new Error('busy-room');
        room.active = false;
      }
    }
  }
  return rooms.filter(
    (r) => r.active || state.sessions.some((s) => s.roomId === r.id),
  );
}
