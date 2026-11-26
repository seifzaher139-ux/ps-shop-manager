vi.mock('./cloud', async () => {
  const { DexieRepository } = await import('../data/repository');
  const r = new DexieRepository();
  return {
    cloudRepository: {
      clearCache: () => {},
      load: () => r.load(),
      loadVersion: async () => ({
        state: await r.load(),
        head: { revision: 0 },
      }),
      update: (fn: (s: State) => void) => r.update(fn),
      save: (s: State) => r.save(s),
      create: (s: State) => r.save(s),
      observe: () => () => {},
    },
    cloudIdentity: {
      current: () => ({ uid: 'u', email: 'owner@example.com' }),
      observe: () => () => {},
      verify: vi.fn(),
      logout: vi.fn(),
      password: vi.fn(),
      reset: vi.fn(),
    },
  };
});
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { commands, useStore } from './store';
import { DexieRepository } from '../data/repository';
import { defaults, permissions, type State, type User } from '../core/model';
import { reconcileRooms } from '../core/logic';
import { clock } from './platform';
import { hashSecret, verifySecret, recoveryCode } from './auth';
const repo = new DexieRepository();
let now = Date.UTC(2026, 10, 26, 20, 30);
let admin: User;
let seed: State;
beforeEach(async () => {
  vi.stubGlobal('crypto', webcrypto);
  vi.spyOn(clock, 'now').mockImplementation(() => now);
  now = Date.UTC(2026, 10, 26, 20, 30);
  admin = {
    id: 'u',
    username: 'admin',
    admin: true,
    active: true,
    permissions: [...permissions],
    password: `pbkdf2:210000:${'a'.repeat(32)}:${'b'.repeat(64)}`,
  };
  seed = defaults();
  seed.users = [admin];
  seed.rooms = reconcileRooms(seed);
  await repo.save(seed);
  useStore.setState({
    data: seed,
    ready: true,
    userId: 'u',
    cloudUid: 'u',
    ownerEmail: 'owner@example.com',
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function start() {
  await commands.open('night');
  await commands.start('ps4-1', 'single', now, '');
  return useStore.getState().data.sessions[0].id;
}
describe('transactional financial commands', () => {
  it('requires a shift, rejects invalid timestamps and concurrent room starts', async () => {
    await expect(commands.start('ps4-1', 'single', now, '')).rejects.toThrow(
      'shift-required',
    );
    await commands.open('');
    await expect(commands.start('ps4-1', 'single', NaN, '')).rejects.toThrow();
    const results = await Promise.allSettled([
      commands.start('ps4-1', 'single', now, ''),
      commands.start('ps4-1', 'double', now, ''),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    expect((await repo.load()).sessions).toHaveLength(1);
  });
  it('rolls back a payment without explicit unpaid consent and enforces discount permission', async () => {
    const id = await start();
    now += 3600000;
    await expect(
      commands.end(id, 1000, undefined, false, now),
    ).rejects.toThrow();
    expect((await repo.load()).sessions[0].status).toBe('running');
    const worker = {
      ...admin,
      admin: false,
      permissions: ['endSession'] as User['permissions'],
    };
    await repo.update((d) => {
      d.users = [worker, { ...admin, id: 'root', username: 'root' }];
    });
    useStore.setState({
      data: { ...useStore.getState().data, users: [worker] },
    });
    await expect(
      commands.end(
        id,
        1000,
        { kind: 'fixed', value: 100, reason: '' },
        true,
        now,
      ),
    ).rejects.toThrow('denied');
    await commands.end(id, 1000, undefined, true, now);
    expect(useStore.getState().data.sessions[0].bill?.unpaid).toBe(1500);
  });
  it('blocks closing while busy and freezes immutable totals at close across midnight', async () => {
    const id = await start();
    await expect(commands.close()).rejects.toThrow('running-sessions');
    const date = useStore.getState().data.shifts[0].date;
    now += 4 * 3600000;
    await commands.service(id, 'tea', 2);
    await commands.end(
      id,
      12000,
      { kind: 'fixed', value: 1000, reason: 'loyal' },
      false,
      now,
    );
    await commands.expense({
      description: 'food',
      amount: 500,
      category: seed.settings.categories[0],
    });
    await commands.close();
    const closed = structuredClone(useStore.getState().data.shifts[0]);
    expect(closed.date).toBe(date);
    expect(closed.frozen?.totals).toMatchObject({
      play: 10000,
      services: 2000,
      discounts: 1000,
      expenses: 500,
      net: 10500,
    });
    await expect(commands.void(id, 'mistake')).rejects.toThrow('closed-shift');
    await expect(
      commands.expense({
        description: 'food',
        amount: 500,
        category: seed.settings.categories[0],
      }),
    ).rejects.toThrow('shift-required');
    const settings = {
      ...useStore.getState().data.settings,
      shopName: 'new shop',
    };
    await commands.settings(settings);
    expect(useStore.getState().data.shifts[0]).toEqual(closed);
    expect(closed.frozen?.settings.shopName).not.toBe('new shop');
  });
  it('retains cancelled and voided sessions with zero revenue', async () => {
    const id = await start();
    await commands.cancel(id, 'mistake');
    await commands.start('ps4-1', 'double', now, '');
    const second = useStore.getState().data.sessions[1].id;
    now += 3600000;
    await commands.end(second, 5000, undefined, false, now);
    await expect(commands.void(second, '')).rejects.toThrow();
    await commands.void(second, 'duplicate');
    await commands.close();
    expect(useStore.getState().data.sessions).toHaveLength(2);
    expect(useStore.getState().data.shifts[0].frozen?.totals).toMatchObject({
      play: 0,
      count: 0,
      cancelled: 1,
      voided: 1,
    });
  });
  it('refuses changing busy room count and audits expense edit/void', async () => {
    await start();
    const draft = structuredClone(useStore.getState().data.settings);
    draft.types[0].count = 0;
    await expect(commands.settings(draft)).rejects.toThrow('busy-room');
    await commands.expense({
      description: 'food',
      amount: 500,
      category: seed.settings.categories[0],
    });
    const e = useStore.getState().data.expenses[0];
    await commands.expense({ ...e, amount: 600 }, e.id);
    await commands.expense({ ...e, amount: 600 }, e.id, true);
    expect(useStore.getState().data.expenses[0].voided).toBe(true);
    expect(useStore.getState().data.audit.map((a) => a.action)).toEqual(
      expect.arrayContaining(['expense', 'expenseEdit', 'expenseVoid']),
    );
  });
  it('rechecks permissions against storage and handles backward clock changes', async () => {
    const id = await start();
    now -= 60000;
    await expect(commands.cancel(id, '')).rejects.toThrow('clock-backwards');
    await expect(commands.close()).rejects.toThrow();
    now += 120000;
    await repo.update((d) => {
      d.users[0].active = false;
      d.users.push({ ...admin, id: 'other', username: 'other' });
    });
    await expect(commands.end(id, 2500, undefined, false, now)).rejects.toThrow(
      'denied',
    );
  });
});
it('uses salted PBKDF2 hashes and verifies secrets without plaintext storage', async () => {
  const one = await hashSecret('a strong password');
  const two = await hashSecret('a strong password');
  expect(one).not.toBe(two);
  expect(one).toMatch(/^pbkdf2:210000:[a-f0-9]{32}:[a-f0-9]{64}$/);
  expect(one).not.toContain('strong');
  expect(await verifySecret('a strong password', one)).toBe(true);
  expect(await verifySecret('wrong', one)).toBe(false);
  expect(await verifySecret('x', 'bad')).toBe(false);
  expect(recoveryCode().replaceAll('-', '')).toHaveLength(24);
});
it('resets an admin password with an offline recovery code and preserves shop data', async () => {
  const code = 'ABCD-1234-5678-9ABC-DEF0-1234';
  const hash = await hashSecret(code);
  await repo.save({ ...seed, users: [{ ...admin, recovery: hash }] });
  useStore.setState({ data: await repo.load(), userId: null });
  await expect(
    commands.recover('admin', 'wrong', 'new-password'),
  ).rejects.toThrow('auth');
  await commands.recover('admin', code.toLowerCase(), 'new-password');
  expect(
    await verifySecret('new-password', (await repo.load()).users[0].password),
  ).toBe(true);
});
