import { it, expect } from 'vitest';
import Dexie from 'dexie';
import { defaults, type State } from '../core/model';
import { reconcileRooms } from '../core/logic';
import { DexieRepository, backup, restore } from './repository';
function fixture() {
  const d = defaults();
  d.users = [
    {
      id: 'u',
      username: 'admin',
      admin: true,
      active: true,
      permissions: [],
      password: `pbkdf2:210000:${'a'.repeat(32)}:${'b'.repeat(64)}`,
    },
  ];
  d.rooms = reconcileRooms(d);
  return d;
}
it('migrates an existing v1 IndexedDB database', async () => {
  const name = 'migration-test';
  const old = new Dexie(name);
  old.version(1).stores({ snapshots: 'id' });
  const data = fixture();
  const settings = { ...data.settings } as Partial<State['settings']>;
  delete settings.lastReminder;
  await old
    .table('snapshots')
    .put({ ...data, schemaVersion: 1, settings, id: 'main' });
  old.close();
  const repo = new DexieRepository(name);
  expect((await repo.load()).settings.lastReminder).toBe('');
  expect((await repo.load()).schemaVersion).toBe(2);
});
it('rejects inconsistent and malformed backups and removes envelope metadata', () => {
  const d = fixture();
  expect(restore(backup(d))).toEqual(d);
  for (const change of [
    { settings: { ...d.settings, priceRound: 'wrong' } },
    { rooms: [null] },
    { users: [{ ...d.users[0], password: 'plaintext' }] },
    {
      settings: {
        ...d.settings,
        types: [...d.settings.types, d.settings.types[0]],
      },
    },
  ])
    expect(() =>
      restore(JSON.stringify({ format: 'ps-shop-manager', ...d, ...change })),
    ).toThrow();
});
