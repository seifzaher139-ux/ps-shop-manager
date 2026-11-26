import { create } from 'zustand';
import { DexieRepository, backup, restore } from '../data/repository';
import {
  defaults,
  permissions,
  type State,
  type User,
  type Permission,
  type Session,
  type Discount,
  type Settings,
  type Expense,
} from '../core/model';
import {
  can,
  calculate,
  buildReport,
  reconcileRooms,
  integer,
} from '../core/logic';
import { clock, fileSaver, safeFilename } from './platform';
import { hashSecret, verifySecret, recoveryCode } from './auth';
import { ar, dayKey } from '../i18n/ar';
const repository = new DexieRepository();
interface Store {
  data: State;
  ready: boolean;
  userId: string | null;
  message: string;
  load(): Promise<void>;
  notify(message: string): void;
  login(username: string, password: string): Promise<void>;
  logout(): void;
  setup(username: string, password: string): Promise<string>;
  mutate(
    permission: Permission | 'admin' | 'self',
    action: string,
    detail: string,
    change: (draft: State, user: User) => void,
  ): Promise<void>;
}
let queue: Promise<unknown> = Promise.resolve();
export const useStore = create<Store>((set, get) => ({
  data: defaults(),
  ready: false,
  userId: null,
  message: '',
  notify: (message) => set({ message }),
  async load() {
    const data = await repository.load();
    set({ data, ready: true });
  },
  logout() {
    set({ userId: null });
  },
  async login(username, password) {
    const user = get().data.users.find(
      (u) => u.username === username && u.active,
    );
    if (!user || !(await verifySecret(password, user.password)))
      throw new Error('auth');
    set({ userId: user.id });
    await get().mutate('self', 'login', username, () => {});
  },
  async setup(username, password) {
    if (get().data.users.length) throw new Error('denied');
    checkCredentials(username, password);
    const code = recoveryCode();
    const user: User = {
      id: crypto.randomUUID(),
      username,
      admin: true,
      active: true,
      permissions: [...permissions],
      password: await hashSecret(password),
      recovery: await hashSecret(code),
    };
    const data = defaults();
    data.users = [user];
    data.rooms = reconcileRooms(data);
    data.settings.persistent =
      (await navigator.storage?.persist?.().catch(() => false)) ?? false;
    data.audit.push({
      id: crypto.randomUUID(),
      at: clock.now(),
      userId: user.id,
      action: 'setup',
      detail: username,
    });
    await repository.save(data);
    set({ data, userId: null });
    return code;
  },
  mutate(permission, action, detail, change) {
    const execute = async () => {
      const state = get();
      const user = state.data.users.find(
        (u) => u.id === state.userId && u.active,
      );
      if (
        !user ||
        (permission === 'admin'
          ? !user.admin
          : permission === 'self'
            ? false
            : !can(user, permission))
      )
        throw new Error('denied');
      const data = await repository.update((draft) => {
        const actor = draft.users.find((u) => u.id === user.id && u.active);
        if (
          !actor ||
          (permission === 'admin'
            ? !actor.admin
            : permission === 'self'
              ? false
              : !can(actor, permission))
        )
          throw new Error('denied');
        change(draft, actor);
        draft.audit.push({
          id: crypto.randomUUID(),
          at: clock.now(),
          userId: actor.id,
          action,
          detail,
        });
      });
      set({ data });
    };
    const promise = queue.then(execute);
    queue = promise.catch(() => {});
    return promise;
  },
}));
export function currentUser() {
  const { data, userId } = useStore.getState();
  return data.users.find((u) => u.id === userId);
}
export function checkCredentials(username: string, password: string) {
  if (username.trim().length < 2 || password.length < 8)
    throw new Error('invalid');
}
function openShift(data: State) {
  const shift = data.shifts.find((s) => !s.end);
  if (!shift) throw new Error('shift-required');
  return shift;
}
function running(data: State, id: string) {
  const s = data.sessions.find((s) => s.id === id);
  if (!s || s.status !== 'running') throw new Error('invalid');
  const shift = data.shifts.find((a) => a.id === s.shiftId);
  if (!shift || shift.end) throw new Error('closed-shift');
  return s;
}
function mutate(
  permission: Permission | 'admin' | 'self',
  action: string,
  detail: string,
  fn: (data: State, user: User) => void,
) {
  return useStore.getState().mutate(permission, action, detail, fn);
}
export const commands = {
  async open(note: string) {
    await mutate('openCloseShift', 'open', note, (data, user) => {
      if (data.shifts.some((s) => !s.end)) throw new Error('invalid');
      const now = clock.now();
      data.shifts.push({
        id: crypto.randomUUID(),
        date: dayKey(now, data.settings.timezone),
        start: now,
        openedBy: user.id,
        note,
      });
    });
  },
  async close() {
    await mutate('openCloseShift', 'close', '', (data, user) => {
      const shift = openShift(data);
      if (
        data.sessions.some(
          (s) => s.shiftId === shift.id && s.status === 'running',
        )
      )
        throw new Error('running-sessions');
      shift.end = clock.now();
      shift.closedBy = user.id;
      shift.frozen = buildReport(
        data,
        [shift.id],
        shift.end,
        ar.closingReport,
        shift.date,
      );
    });
  },
  async start(
    roomId: string,
    mode: Session['mode'],
    start: number,
    note: string,
  ) {
    await mutate('startSession', 'start', roomId, (data, user) => {
      const shift = openShift(data);
      if (start > clock.now() || start < shift.start) throw new Error('future');
      if (
        data.sessions.some((s) => s.roomId === roomId && s.status === 'running')
      )
        throw new Error('busy-room');
      const room = data.rooms.find((r) => r.id === roomId && r.active);
      const type = data.settings.types.find((t) => t.id === room?.typeId);
      if (!room || !type) throw new Error('invalid');
      data.sessions.push({
        id: crypto.randomUUID(),
        shiftId: shift.id,
        roomId,
        roomName: room.name,
        mode,
        rate: type[mode],
        start,
        note,
        timezone: data.settings.timezone,
        status: 'running',
        services: [],
        createdBy: user.id,
        pricing: {
          roundTime: data.settings.roundTime,
          priceRound: data.settings.priceRound,
          thresholds: structuredClone(data.settings.thresholds),
        },
      });
    });
  },
  async service(id: string, serviceId: string, quantity: number) {
    await mutate('startSession', 'service', id, (data) => {
      const session = running(data, id);
      integer(quantity);
      const service = data.settings.services.find(
        (s) => s.id === serviceId && s.active,
      );
      const existing = session.services.find((s) => s.id === serviceId);
      if (!service && !existing) throw new Error('invalid');
      session.services = session.services.filter((s) => s.id !== serviceId);
      if (quantity > 0)
        session.services.push(
          existing
            ? { ...existing, quantity }
            : {
                id: service!.id,
                name: service!.name,
                price: service!.price,
                quantity,
              },
        );
    });
  },
  async time(id: string, start: number) {
    await mutate('editSessionTime', 'time', id, (data) => {
      const s = running(data, id);
      const shift = data.shifts.find((a) => a.id === s.shiftId)!;
      if (!Number.isFinite(start) || start > clock.now() || start < shift.start)
        throw new Error('future');
      s.start = start;
    });
  },
  async end(
    id: string,
    paid: number,
    discount: Discount | undefined,
    acceptUnpaid: boolean,
    end: number,
  ) {
    await mutate('endSession', 'end', id, (data, user) => {
      const s = running(data, id);
      if (end > clock.now()) throw new Error('future');
      if (discount && discount.value && !can(user, 'applyDiscount'))
        throw new Error('denied');
      if (discount?.kind === 'percent' && discount.value > 10000)
        throw new Error('invalid');
      s.discount = discount;
      s.bill = calculate(s, end, paid);
      if (s.bill.unpaid && !acceptUnpaid) throw new Error('invalid');
      s.status = 'finished';
      s.end = end;
      s.endedBy = user.id;
      if (s.bill.discount)
        data.audit.push({
          id: crypto.randomUUID(),
          at: clock.now(),
          userId: user.id,
          action: 'discount',
          detail: `${id}: ${s.bill.discount}`,
        });
    });
  },
  async cancel(id: string, reason: string) {
    await mutate('cancelSession', 'cancel', reason, (data, user) => {
      const s = running(data, id);
      s.status = 'cancelled';
      s.end = clock.now();
      s.reason = reason;
      s.endedBy = user.id;
      s.bill = {
        minutes: 0,
        billedMinutes: 0,
        play: 0,
        services: 0,
        discount: 0,
        total: 0,
        paid: 0,
        change: 0,
        unpaid: 0,
      };
    });
  },
  async void(id: string, reason: string) {
    await mutate('voidSession', 'void', reason, (data) => {
      const s = data.sessions.find((a) => a.id === id);
      if (!s || s.status !== 'finished' || !reason.trim())
        throw new Error('invalid');
      if (data.shifts.find((x) => x.id === s.shiftId)?.end)
        throw new Error('closed-shift');
      s.status = 'voided';
      s.reason = reason;
    });
  },
  async expense(
    expense: Omit<Expense, 'id' | 'shiftId' | 'voided' | 'createdBy'>,
    id?: string,
    voided = false,
  ) {
    await mutate(
      'manageExpenses',
      voided ? 'expenseVoid' : id ? 'expenseEdit' : 'expense',
      expense.description,
      (data, user) => {
        integer(expense.amount);
        if (
          !expense.amount ||
          !expense.description.trim() ||
          !data.settings.categories.includes(expense.category)
        )
          throw new Error('invalid');
        const shift = openShift(data);
        if (id) {
          const existing = data.expenses.find(
            (e) => e.id === id && e.shiftId === shift.id && !e.voided,
          );
          if (!existing) throw new Error('closed-shift');
          Object.assign(existing, expense, { voided });
        } else
          data.expenses.push({
            ...expense,
            id: crypto.randomUUID(),
            shiftId: shift.id,
            voided: false,
            createdBy: user.id,
          });
      },
    );
  },
  async settings(settings: Settings) {
    await mutate('editSettings', 'settings', '', (data) => {
      if (
        !settings.shopName.trim() ||
        !settings.device.trim() ||
        !settings.currency.trim() ||
        !settings.categories.length ||
        !Number.isSafeInteger(settings.idleMinutes) ||
        settings.idleMinutes < 0
      )
        throw new Error('invalid');
      for (const t of settings.types) {
        if (!t.name.trim()) throw new Error('invalid');
        integer(t.single);
        integer(t.double);
        integer(t.count);
      }
      for (const s of settings.services) {
        if (!s.name.trim()) throw new Error('invalid');
        integer(s.price);
      }
      new Intl.DateTimeFormat('en', { timeZone: settings.timezone });
      data.settings = structuredClone(settings);
      data.rooms = reconcileRooms(data);
    });
  },
  async user(user: User, password?: string) {
    if (password) checkCredentials(user.username, password);
    const passwordHash = password ? await hashSecret(password) : user.password;
    await mutate('admin', 'user', user.username, (data, actor) => {
      if (
        data.users.some(
          (u) => u.username === user.username && u.id !== user.id,
        ) ||
        !user.username.trim() ||
        !passwordHash ||
        (user.id === actor.id && !user.active)
      )
        throw new Error('invalid');
      const existing = data.users.find((u) => u.id === user.id);
      if (existing?.admin) {
        user.admin = true;
        user.permissions = [...permissions];
        user.active = existing.active;
        user.recovery = existing.recovery;
      }
      const next = { ...user, password: passwordHash };
      data.users = existing
        ? data.users.map((u) => (u.id === user.id ? next : u))
        : [...data.users, next];
    });
  },
  async password(current: string, next: string) {
    const user = currentUser();
    if (!user || !(await verifySecret(current, user.password)))
      throw new Error('auth');
    checkCredentials(user.username, next);
    const hash = await hashSecret(next);
    await mutate('self', 'user', user.username, (data, actor) => {
      data.users.find((u) => u.id === actor.id)!.password = hash;
    });
  },
  async recovery(password: string) {
    const user = currentUser();
    if (!user?.admin || !(await verifySecret(password, user.password)))
      throw new Error('auth');
    const code = recoveryCode();
    const hash = await hashSecret(code);
    await mutate('admin', 'user', ar.newRecovery, (data, actor) => {
      data.users.find((u) => u.id === actor.id)!.recovery = hash;
    });
    return code;
  },
  async recover(username: string, code: string, password: string) {
    checkCredentials(username, password);
    const data = structuredClone(useStore.getState().data);
    const user = data.users.find(
      (u) => u.admin && u.active && u.username === username,
    );
    if (
      !user?.recovery ||
      !(await verifySecret(code.trim().toUpperCase(), user.recovery))
    )
      throw new Error('auth');
    user.password = await hashSecret(password);
    data.audit.push({
      id: crypto.randomUUID(),
      at: clock.now(),
      userId: user.id,
      action: 'user',
      detail: ar.recoveryReset,
    });
    await repository.save(data);
    useStore.setState({ data, userId: null });
  },
  async backup() {
    await mutate('manageBackup', 'backup', '', () => {});
    const data = useStore.getState().data;
    const name = `psshop-backup-${dayKey(clock.now(), data.settings.timezone)}-${safeFilename(data.settings.device)}.json`;
    await fileSaver.saveFile(
      name,
      new Blob([backup(data)], { type: 'application/json' }),
    );
    return name;
  },
  async restore(text: string) {
    const existing = useStore.getState().data;
    if (existing.users.length && !currentUser()?.admin)
      throw new Error('denied');
    const data = restore(text);
    data.audit.push({
      id: crypto.randomUUID(),
      at: clock.now(),
      userId: data.users.find((u) => u.admin)!.id,
      action: 'restore',
      detail: '',
    });
    await repository.save(data);
    useStore.setState({ data, userId: null });
  },
  async reminder() {
    await mutate('openCloseShift', 'settings', ar.backupReminder, (data) => {
      data.settings.lastReminder = dayKey(clock.now(), data.settings.timezone);
    });
  },
};
