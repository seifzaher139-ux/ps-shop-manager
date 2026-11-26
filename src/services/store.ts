import { create } from 'zustand';
import { DexieRepository, backup, restore, migrate } from '../data/repository';
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
import { cloudIdentity, cloudRepository as repository } from './cloud';
import { ar, dayKey, errorText } from '../i18n/ar';
interface Store {
  data: State;
  ready: boolean;
  userId: string | null;
  message: string;
  cloudUid: string | null;
  ownerEmail: string;
  cloudError: string;
  needsShop: boolean;
  saving: boolean;
  load(): Promise<void>;
  notify(message: string): void;
  login(email: string, password: string): Promise<void>;
  setup(
    email: string,
    password: string,
    shopName?: string,
    legacyPassword?: string,
  ): Promise<void>;
  finishShop(shopName: string, legacyPassword?: string): Promise<void>;
  unlock(id: string, password: string): Promise<void>;
  lock(): void;
  logout(): Promise<void>;
  mutate(
    permission: Permission | 'admin' | 'self',
    action: string,
    detail: string,
    change: (draft: State, user: User) => void,
  ): Promise<void>;
}
let queue: Promise<unknown> = Promise.resolve();
let stopWatch: (() => void) | undefined;
let stopAuth: (() => void) | undefined;
let initial: Promise<void> | undefined;
let serial = 0;
let signingOut = false;
function online() {
  if (typeof navigator !== 'undefined' && !navigator.onLine)
    throw new Error('cloud-offline');
}
export function attachOwner(data: State, uid: string, email: string): State {
  const next = structuredClone(data);
  next.appVersion = '2.0.0';
  for (const u of next.users)
    if (u.authProvider === 'firebase' && u.id !== uid) {
      u.authProvider = undefined;
      u.active = false;
      u.password = `pbkdf2:210000:${'0'.repeat(32)}:${'0'.repeat(64)}`;
    }
  const previous = next.users.find((u) => u.id === uid);
  const owner: User = {
    id: uid,
    username: previous?.username ?? email,
    admin: true,
    active: true,
    permissions: [...permissions],
    password: '',
    authProvider: 'firebase',
  };
  next.users = next.users.some((u) => u.id === uid)
    ? next.users.map((u) => (u.id === uid ? owner : u))
    : [...next.users, owner];
  return migrate(next);
}
async function refreshCloud(resetRole = false) {
  const owner = cloudIdentity.current();
  if (!owner) return;
  const request = ++serial;
  try {
    const loaded = await repository.loadVersion();
    if (request !== serial || cloudIdentity.current()?.uid !== owner.uid)
      return;
    if (!loaded) {
      useStore.setState({
        data: defaults(),
        userId: null,
        needsShop: true,
        cloudError: '',
        ready: true,
      });
      return;
    }
    const current = useStore.getState();
    const role = loaded.state.users.find(
      (u) => u.id === current.userId && u.active,
    );
    const prior = current.data.users.find((u) => u.id === current.userId);
    const ownerRole = loaded.state.users.find(
      (u) => u.id === owner.uid && u.active && u.authProvider === 'firebase',
    );
    if (!ownerRole) throw new Error('cloud-owner-missing');
    useStore.setState({
      data: loaded.state,
      userId: resetRole
        ? owner.uid
        : role && prior?.password === role.password
          ? role.id
          : null,
      needsShop: false,
      cloudError: '',
      ready: true,
    });
  } catch (error) {
    if (request === serial)
      useStore.setState({ cloudError: errorText(error), ready: true });
  }
}
let connection: Promise<void> | undefined;
let connectionUid: string | null | undefined;
async function connectOwner(owner: ReturnType<typeof cloudIdentity.current>) {
  const uid = owner?.uid ?? null;
  if (connection && connectionUid === uid) return connection;
  connectionUid = uid;
  connection = connectOwnerOnce(owner);
  return connection;
}
async function connectOwnerOnce(
  owner: ReturnType<typeof cloudIdentity.current>,
) {
  stopWatch?.();
  stopWatch = undefined;
  repository.clearCache();
  ++serial;
  useStore.setState({
    data: defaults(),
    userId: null,
    cloudUid: owner?.uid ?? null,
    ownerEmail: owner?.email ?? '',
    cloudError: '',
    needsShop: false,
    ready: !owner && !signingOut,
  });
  if (!owner) return;
  await refreshCloud(true);
  if (
    cloudIdentity.current()?.uid === owner.uid &&
    !useStore.getState().needsShop
  )
    observeCloud();
}
function observeCloud() {
  stopWatch?.();
  stopWatch = repository.observe(
    () => {
      void refreshCloud();
    },
    (error) => useStore.setState({ cloudError: errorText(error) }),
  );
}
export const useStore = create<Store>((set, get) => ({
  data: defaults(),
  ready: false,
  userId: null,
  message: '',
  cloudUid: null,
  ownerEmail: '',
  cloudError: '',
  needsShop: false,
  saving: false,
  notify: (message) => set({ message }),
  async load() {
    if (!stopAuth) {
      if (!initial)
        initial = new Promise<void>((resolve) => {
          stopAuth = cloudIdentity.observe(
            (owner) => {
              void connectOwner(owner).finally(resolve);
            },
            (error) => {
              set({ ready: true, cloudError: errorText(error) });
              resolve();
            },
          );
        });
      await initial;
    } else if (cloudIdentity.current())
      await refreshCloud(!get().data.users.length);
  },
  lock() {
    set({ userId: null });
  },
  async logout() {
    signingOut = true;
    ++serial;
    stopWatch?.();
    stopWatch = undefined;
    set({
      data: defaults(),
      userId: null,
      cloudUid: null,
      ownerEmail: '',
      needsShop: false,
      cloudError: '',
      ready: false,
    });
    try {
      await cloudIdentity.logout();
      if (typeof window !== 'undefined') window.location.hash = '/';
    } finally {
      signingOut = false;
      set({ ready: true });
    }
  },
  async login(email, password) {
    online();
    await cloudIdentity.login(email, password);
    await connectOwner(cloudIdentity.current());
  },
  async setup(email, password, shopName = ar.app, legacyPassword) {
    online();
    if (password.length < 8 || !email.includes('@') || !shopName.trim())
      throw new Error('invalid');
    await cloudIdentity.create(email, password);
    await get().finishShop(shopName, legacyPassword);
  },
  async finishShop(shopName, legacyPassword) {
    online();
    const owner = cloudIdentity.current();
    if (!owner?.email) throw new Error('cloud-auth-required');
    if (!shopName.trim()) throw new Error('invalid');
    let data = defaults();
    if (legacyPassword) {
      const old = await new DexieRepository().load();
      const valid = await Promise.all(
        old.users
          .filter((u) => u.admin && u.active)
          .map(
            async (u) =>
              (await verifySecret(legacyPassword, u.password)) ||
              (!!u.recovery &&
                (await verifySecret(
                  legacyPassword.trim().toUpperCase(),
                  u.recovery,
                ))),
          ),
      );
      if (!valid.some(Boolean)) throw new Error('auth');
      data = old;
    }
    data = attachOwner(data, owner.uid, owner.email);
    data.settings.shopName = shopName.trim();
    data.rooms = reconcileRooms(data);
    data.audit.push({
      id: crypto.randomUUID(),
      at: clock.now(),
      userId: owner.uid,
      action: 'setup',
      detail: shopName,
    });
    await repository.create(data);
    if (cloudIdentity.current()?.uid !== owner.uid)
      throw new Error('cloud-auth-required');
    ++serial;
    set({
      data,
      userId: owner.uid,
      cloudUid: owner.uid,
      ownerEmail: owner.email,
      needsShop: false,
      cloudError: '',
      ready: true,
    });
    stopWatch?.();
    stopWatch = repository.observe(
      () => {
        void refreshCloud();
      },
      (error) => set({ cloudError: errorText(error) }),
    );
  },
  async unlock(id, password) {
    online();
    const user = get().data.users.find((u) => u.id === id && u.active);
    if (!user) throw new Error('auth');
    if (user.authProvider === 'firebase') await cloudIdentity.verify(password);
    else if (!(await verifySecret(password, user.password)))
      throw new Error('auth');
    set({ userId: id });
    await get().mutate('self', 'login', user.username, () => {});
  },
  mutate(permission, action, detail, change) {
    const expectedOwner = get().cloudUid;
    const expectedRole = get().userId;
    const execute = async () => {
      online();
      if (get().cloudUid !== expectedOwner || get().userId !== expectedRole)
        throw new Error('cloud-auth-required');
      const uid = get().cloudUid;
      if (!uid || cloudIdentity.current()?.uid !== uid)
        throw new Error('cloud-auth-required');
      const user = get().data.users.find(
        (u) => u.id === get().userId && u.active,
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
      set({ saving: true });
      try {
        const data = await repository.update((draft) => {
          const actor = draft.users.find((u) => u.id === user.id && u.active);
          if (
            !actor ||
            actor.password !== user.password ||
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
        if (get().cloudUid === uid) {
          set({ data, cloudError: '' });
          await refreshCloud();
        }
      } finally {
        set({ saving: false });
      }
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
      if (clock.now() < shift.start) throw new Error('clock-backwards');
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
      if (!Number.isFinite(start) || start > clock.now() || start < shift.start)
        throw new Error('future');
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
      if (clock.now() < s.start) throw new Error('clock-backwards');
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
          Object.assign(existing, {
            description: expense.description,
            amount: expense.amount,
            category: expense.category,
            voided,
          });
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
    if (user.authProvider === 'firebase' && password)
      throw new Error('firebase-recovery');
    if (password) checkCredentials(user.username, password);
    const passwordHash = password ? await hashSecret(password) : user.password;
    await mutate('admin', 'user', user.username, (data, actor) => {
      if (
        data.users.some(
          (u) => u.username === user.username && u.id !== user.id,
        ) ||
        !user.username.trim() ||
        (!passwordHash && user.authProvider !== 'firebase') ||
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
    if (user?.authProvider === 'firebase') {
      if (next.length < 8) throw new Error('invalid');
      await cloudIdentity.password(current, next);
      await mutate('self', 'user', ar.changePassword, () => {});
      return;
    }
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
    if (user?.authProvider === 'firebase') throw new Error('firebase-recovery');
    if (!user?.admin || !(await verifySecret(password, user.password)))
      throw new Error('auth');
    const code = recoveryCode();
    const hash = await hashSecret(code);
    await mutate('admin', 'user', ar.newRecovery, (data, actor) => {
      data.users.find((u) => u.id === actor.id)!.recovery = hash;
    });
    return code;
  },
  async resetOwnerPassword(email: string) {
    online();
    await cloudIdentity.reset(email);
  },
  async recover(username: string, code: string, password: string) {
    online();
    if (!useStore.getState().cloudUid) throw new Error('cloud-auth-required');
    checkCredentials(username, password);
    const latest = await repository.load();
    const user = latest.users.find(
      (u) => u.admin && u.active && u.username === username,
    );
    if (
      !user?.recovery ||
      !(await verifySecret(code.trim().toUpperCase(), user.recovery))
    )
      throw new Error('auth');
    const hash = await hashSecret(password);
    const data = await repository.update((draft) => {
      const target = draft.users.find(
        (u) => u.id === user.id && u.active && u.recovery === user.recovery,
      );
      if (!target) throw new Error('auth');
      target.password = hash;
      draft.audit.push({
        id: crypto.randomUUID(),
        at: clock.now(),
        userId: user.id,
        action: 'user',
        detail: ar.recoveryReset,
      });
    });
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
    online();
    const owner = cloudIdentity.current();
    if (!owner?.email || !currentUser()?.admin) throw new Error('denied');
    const data = attachOwner(restore(text), owner.uid, owner.email);
    data.audit.push({
      id: crypto.randomUUID(),
      at: clock.now(),
      userId: owner.uid,
      action: 'restore',
      detail: '',
    });
    await repository.save(data);
    if (cloudIdentity.current()?.uid !== owner.uid)
      throw new Error('cloud-auth-required');
    useStore.setState({ data, userId: owner.uid, cloudError: '' });
  },
  async reminder() {
    await mutate('openCloseShift', 'settings', ar.backupReminder, (data) => {
      data.settings.lastReminder = dayKey(clock.now(), data.settings.timezone);
    });
  },
};
