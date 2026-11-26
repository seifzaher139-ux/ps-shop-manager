import { totals } from '../core/logic';
import Dexie, { type Table } from 'dexie';
import { defaults, permissions, type State, type Audit } from '../core/model';
export interface Repository {
  load(): Promise<State>;
  save(state: State): Promise<void>;
  update(change: (state: State) => void): Promise<State>;
}
class Database extends Dexie {
  snapshots!: Table<State & { id: string }, string>;
  audit!: Table<Audit, string>;
  constructor(name: string) {
    super(name);
    this.version(1).stores({ snapshots: 'id' });
    this.version(2)
      .stores({ snapshots: 'id', audit: 'id,at,userId,action' })
      .upgrade((tx) =>
        tx
          .table('snapshots')
          .toCollection()
          .modify((row) => {
            Object.assign(row, migrate({ ...row, schemaVersion: 1 }));
          }),
      );
  }
}
export class DexieRepository implements Repository {
  private db: Database;
  constructor(name = 'ps-shop-manager') {
    this.db = new Database(name);
  }
  async load() {
    const row = await this.db.snapshots.get('main');
    if (!row) return defaults();
    const { id: _id, ...state } = row;
    return migrate(state);
  }
  async update(change: (state: State) => void) {
    return this.db.transaction(
      'rw',
      [this.db.snapshots, this.db.audit],
      async () => {
        const row = await this.db.snapshots.get('main');
        const state = row ? migrate(row) : defaults();
        change(state);
        validate(state);
        await this.db.snapshots.put({ ...structuredClone(state), id: 'main' });
        await this.db.audit.clear();
        await this.db.audit.bulkPut(structuredClone(state.audit));
        return state;
      },
    );
  }
  async save(state: State) {
    validate(state);
    await this.db.transaction(
      'rw',
      [this.db.snapshots, this.db.audit],
      async () => {
        await this.db.snapshots.put({ ...structuredClone(state), id: 'main' });
        await this.db.audit.clear();
        await this.db.audit.bulkPut(structuredClone(state.audit));
      },
    );
  }
}
export function migrate(input: unknown): State {
  if (!input || typeof input !== 'object') throw new Error('invalid-backup');
  const data = structuredClone(input) as State;
  if (
    !Number.isInteger(data.schemaVersion) ||
    data.schemaVersion < 1 ||
    data.schemaVersion > 2
  )
    throw new Error('backup-version');
  if (data.schemaVersion === 1) {
    data.settings = { ...defaults().settings, ...data.settings };
    data.schemaVersion = 2;
    data.appVersion = '1.0.0';
  }
  validate(data);
  return {
    schemaVersion: data.schemaVersion,
    appVersion: data.appVersion,
    settings: data.settings,
    users: data.users,
    rooms: data.rooms,
    sessions: data.sessions,
    shifts: data.shifts,
    expenses: data.expenses,
    audit: data.audit,
  };
}
function validate(s: State) {
  const fail = () => {
    throw new Error('invalid-backup');
  };
  const text = (x: unknown) => typeof x === 'string' && x.length <= 10000000;
  const int = (x: unknown) => Number.isSafeInteger(x) && Number(x) >= 0;
  const time = (x: unknown) =>
    typeof x === 'number' &&
    Number.isFinite(x) &&
    x >= 0 &&
    x <= 8640000000000000;
  const settings = s.settings;
  if (!settings || typeof settings !== 'object') fail();
  for (const x of [
    settings.shopName,
    settings.device,
    settings.currency,
    settings.logo,
    settings.timezone,
    settings.lastReminder,
  ])
    if (!text(x)) fail();
  if (
    !['pound', 'half', 'none'].includes(settings.priceRound) ||
    typeof settings.roundTime !== 'boolean' ||
    typeof settings.indic !== 'boolean' ||
    typeof settings.persistent !== 'boolean' ||
    !int(settings.idleMinutes)
  )
    fail();
  if (
    !settings.thresholds ||
    !int(settings.thresholds.half) ||
    !int(settings.thresholds.quarter) ||
    settings.thresholds.half < 30 ||
    settings.thresholds.half >= settings.thresholds.quarter ||
    settings.thresholds.quarter >= 60
  )
    fail();
  try {
    new Intl.DateTimeFormat('en', { timeZone: settings.timezone });
  } catch {
    fail();
  }
  if (
    !Array.isArray(settings.types) ||
    !Array.isArray(settings.services) ||
    !Array.isArray(settings.categories) ||
    !settings.categories.length
  )
    fail();
  for (const t of settings.types)
    if (
      !t ||
      !text(t.id) ||
      !text(t.name) ||
      !int(t.single) ||
      !int(t.double) ||
      !int(t.count) ||
      t.count > 100
    )
      fail();
  for (const l of settings.services)
    if (
      !l ||
      !text(l.id) ||
      !text(l.name) ||
      !int(l.price) ||
      typeof l.active !== 'boolean'
    )
      fail();
  for (const c of settings.categories) if (!text(c)) fail();
  for (const items of [settings.types, settings.services])
    if (new Set(items.map((x) => x.id)).size !== items.length) fail();
  if (
    typeof s.appVersion !== 'string' ||
    !/^\d+\.\d+\.\d+$/.test(s.appVersion) ||
    !s.settings ||
    !Array.isArray(s.users) ||
    !Array.isArray(s.rooms) ||
    !Array.isArray(s.sessions) ||
    !Array.isArray(s.shifts) ||
    !Array.isArray(s.expenses) ||
    !Array.isArray(s.audit)
  )
    throw new Error('invalid-backup');
  const d = defaults().settings;
  for (const key of Object.keys(d))
    if (!(key in s.settings)) throw new Error('invalid-backup');
  if (
    !s.users.length ||
    !s.users.some((u) => u.admin && u.active) ||
    s.users.some(
      (u) =>
        typeof u.id !== 'string' ||
        typeof u.username !== 'string' ||
        typeof u.password !== 'string' ||
        !Array.isArray(u.permissions),
    )
  )
    throw new Error('invalid-backup');
  for (const list of [
    s.users,
    s.rooms,
    s.sessions,
    s.shifts,
    s.expenses,
    s.audit,
  ])
    if (new Set(list.map((x) => x.id)).size !== list.length)
      throw new Error('invalid-backup');
  if (s.shifts.filter((x) => !x.end).length > 1)
    throw new Error('invalid-backup');
  const running = s.sessions.filter((x) => x.status === 'running');
  if (new Set(running.map((x) => x.roomId)).size !== running.length)
    throw new Error('invalid-backup');
  for (const u of s.users) {
    if (
      typeof u.admin !== 'boolean' ||
      typeof u.active !== 'boolean' ||
      u.permissions.some((p) => !permissions.includes(p)) ||
      !text(u.username) ||
      !/^pbkdf2:210000:[a-f0-9]{32}:[a-f0-9]{64}$/.test(u.password) ||
      (u.recovery !== undefined &&
        !/^pbkdf2:210000:[a-f0-9]{32}:[a-f0-9]{64}$/.test(u.recovery))
    )
      fail();
  }
  for (const room of s.rooms)
    if (
      !room ||
      !text(room.id) ||
      !text(room.name) ||
      !settings.types.some((t) => t.id === room.typeId) ||
      typeof room.active !== 'boolean'
    )
      fail();
  for (const shift of s.shifts)
    if (
      !shift ||
      !text(shift.id) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(shift.date) ||
      !time(shift.start) ||
      (shift.end !== undefined &&
        (!time(shift.end) || shift.end < shift.start)) ||
      !s.users.some((u) => u.id === shift.openedBy)
    )
      fail();
  for (const log of s.audit)
    if (
      !log ||
      !text(log.id) ||
      !time(log.at) ||
      !text(log.action) ||
      !text(log.detail) ||
      !text(log.userId)
    )
      fail();
  for (const x of s.sessions) {
    if (
      !['single', 'double'].includes(x.mode) ||
      !text(x.id) ||
      !text(x.roomName) ||
      !text(x.note) ||
      !text(x.timezone) ||
      !time(x.start) ||
      (x.end !== undefined && (!time(x.end) || x.end < x.start)) ||
      !s.users.some((u) => u.id === x.createdBy)
    )
      fail();
    if (x.status === 'running' && s.shifts.find((a) => a.id === x.shiftId)?.end)
      fail();
    if (x.status !== 'running' && (!x.bill || x.end === undefined)) fail();
    if (
      !x.pricing ||
      typeof x.pricing.roundTime !== 'boolean' ||
      !['pound', 'half', 'none'].includes(x.pricing.priceRound) ||
      !x.pricing.thresholds ||
      !int(x.pricing.thresholds.half) ||
      !int(x.pricing.thresholds.quarter)
    )
      fail();
    if (
      x.discount &&
      (!['fixed', 'percent'].includes(x.discount.kind) ||
        !int(x.discount.value) ||
        !text(x.discount.reason) ||
        (x.discount.kind === 'percent' && x.discount.value > 10000))
    )
      fail();
    if (
      !s.shifts.some((a) => a.id === x.shiftId) ||
      !s.rooms.some((a) => a.id === x.roomId) ||
      !Number.isFinite(x.start) ||
      !['running', 'finished', 'cancelled', 'voided'].includes(x.status) ||
      !Number.isSafeInteger(x.rate) ||
      x.rate < 0 ||
      !Array.isArray(x.services) ||
      !x.pricing
    )
      throw new Error('invalid-backup');
    for (const l of x.services)
      if (
        !Number.isSafeInteger(l.price) ||
        l.price < 0 ||
        !Number.isSafeInteger(l.quantity) ||
        l.quantity < 1
      )
        throw new Error('invalid-backup');
    if (x.bill) {
      for (const key of [
        'minutes',
        'billedMinutes',
        'play',
        'services',
        'discount',
        'total',
        'paid',
        'change',
        'unpaid',
      ] as const)
        if (!int(x.bill[key])) fail();
      if (
        x.bill.total !== x.bill.play + x.bill.services - x.bill.discount ||
        x.bill.change !== Math.max(0, x.bill.paid - x.bill.total) ||
        x.bill.unpaid !== Math.max(0, x.bill.total - x.bill.paid)
      )
        fail();
    }
    if (x.bill)
      for (const n of Object.values(x.bill))
        if (!Number.isSafeInteger(n) || n < 0)
          throw new Error('invalid-backup');
  }
  for (const shift of s.shifts) {
    const frozen = shift.frozen;
    if (!frozen) continue;
    if (
      !text(frozen.title) ||
      !text(frozen.period) ||
      !time(frozen.generatedAt) ||
      !Array.isArray(frozen.users) ||
      frozen.shifts?.some((sh) => sh.frozen) ||
      !frozen.totals
    )
      fail();
    validate({
      schemaVersion: s.schemaVersion,
      appVersion: s.appVersion,
      settings: frozen.settings,
      rooms: frozen.rooms ?? s.rooms,
      users: s.users,
      sessions: frozen.sessions,
      shifts: frozen.shifts,
      expenses: frozen.expenses,
      audit: [],
    });
    const expected = totals(
      frozen.sessions,
      frozen.expenses,
      frozen.generatedAt,
    );
    for (const key of Object.keys(expected) as (keyof typeof expected)[])
      if (expected[key] !== frozen.totals[key]) fail();
  }
  for (const e of s.expenses)
    if (
      !text(e.id) ||
      !text(e.description) ||
      !text(e.category) ||
      typeof e.voided !== 'boolean' ||
      !s.users.some((u) => u.id === e.createdBy) ||
      !Number.isSafeInteger(e.amount) ||
      e.amount < 0 ||
      !s.shifts.some((a) => a.id === e.shiftId)
    )
      throw new Error('invalid-backup');
}
export function backup(state: State): string {
  return JSON.stringify(
    {
      format: 'ps-shop-manager',
      createdAt: new Date().toISOString(),
      ...state,
    },
    null,
    2,
  );
}
export function restore(text: string): State {
  const raw = JSON.parse(text);
  if (raw.format !== 'ps-shop-manager') throw new Error('invalid-backup');
  try {
    return migrate(raw);
  } catch (error) {
    if (error instanceof Error && error.message === 'backup-version')
      throw error;
    throw new Error('invalid-backup');
  }
}
