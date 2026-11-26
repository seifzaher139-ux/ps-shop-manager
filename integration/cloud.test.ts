import { beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  type Firestore,
} from 'firebase/firestore';
import { readFile } from 'node:fs/promises';
import { FirestoreRepository } from '../src/data/cloud-repository';
import {
  defaults,
  permissions,
  type State,
  type Session,
} from '../src/core/model';
import { reconcileRooms } from '../src/core/logic';
let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-ps-shop-manager',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: await readFile('firestore.rules', 'utf8'),
    },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
});
afterAll(async () => {
  await env.cleanup();
});
function db(uid?: string) {
  return (uid
    ? env.authenticatedContext(uid).firestore()
    : env.unauthenticatedContext().firestore()) as unknown as Firestore;
}
function fixture(uid = 'owner-a'): State {
  const s = defaults();
  s.users = [
    {
      id: uid,
      username: uid,
      admin: true,
      active: true,
      permissions: [...permissions],
      password: '',
      authProvider: 'firebase',
    },
  ];
  s.rooms = reconcileRooms(s);
  return s;
}
function repo(uid = 'owner-a', database = db(uid)) {
  return new FirestoreRepository(
    () => database,
    () => uid,
  );
}
it('persists the full shop and loads it from a fresh client, without browser storage', async () => {
  const first = repo();
  const state = fixture();
  await first.create(state);
  const fresh = repo('owner-a', db('owner-a'));
  expect(await fresh.load()).toEqual(state);
  await fresh.update((s) => {
    s.settings.shopName = 'Cloud name';
  });
  expect((await first.load()).settings.shopName).toBe('Cloud name');
});
it('isolates two owners and denies unauthenticated reads/writes, spoofed ownership and shop listing', async () => {
  await repo().create(fixture());
  const a = db('owner-a'),
    b = db('owner-b'),
    guest = db();
  const root = (database: Firestore) => doc(database, 'shops', 'owner-a');
  const head = (await getDoc(root(a))).data()!;
  const path = [
    'shops',
    'owner-a',
    'generations',
    head.generation,
    'users',
    'owner-a',
  ];
  await assertFails(getDoc(root(b)));
  await assertFails(getDoc(root(guest)));
  await assertFails(getDoc(doc(b, path[0], ...path.slice(1))));
  await assertFails(
    setDoc(doc(b, path[0], ...path.slice(1)), {
      id: 'owner-a',
      order: 0,
      payload: '{}',
    }),
  );
  await assertFails(
    setDoc(doc(guest, 'shops', 'guest'), { ...head, ownerId: 'guest' }),
  );
  await assertFails(
    setDoc(doc(b, 'shops', 'owner-b'), {
      ...head,
      ownerId: 'owner-a',
      revision: 0,
    }),
  );
  await assertFails(
    setDoc(root(a), {
      ...head,
      ownerId: 'owner-b',
      revision: head.revision + 1,
    }),
  );
  await assertFails(getDocs(collection(a, 'shops')));
  await assertSucceeds(getDoc(root(a)));
});
it('only allows known tables and prevents financial hard deletes', async () => {
  await repo().create(fixture());
  const a = db('owner-a');
  const head = (await getDoc(doc(a, 'shops', 'owner-a'))).data()!;
  await assertFails(
    setDoc(
      doc(
        a,
        'shops',
        'owner-a',
        'generations',
        head.generation,
        'unknown',
        'x',
      ),
      { id: 'x', order: 0, payload: '{}' },
    ),
  );
  await assertFails(
    deleteDoc(
      doc(
        a,
        'shops',
        'owner-a',
        'generations',
        head.generation,
        'users',
        'owner-a',
      ),
    ),
  );
  await assertFails(deleteDoc(doc(a, 'shops', 'owner-a')));
});
it('retries concurrent updates without losing the other device write', async () => {
  const one = repo();
  await one.create(fixture());
  const two = repo('owner-a', db('owner-a'));
  await Promise.all([
    one.update((s) => {
      s.settings.idleMinutes++;
    }),
    two.update((s) => {
      s.settings.idleMinutes++;
    }),
  ]);
  expect((await one.load()).settings.idleMinutes).toBe(2);
});
it('prevents starting a second session in the same room on another device', async () => {
  const one = repo();
  const state = fixture();
  state.shifts = [
    {
      id: 'shift',
      date: '2026-11-26',
      start: 1000,
      openedBy: 'owner-a',
      note: '',
    },
  ];
  await one.create(state);
  const two = repo('owner-a', db('owner-a'));
  function start(s: State) {
    if (s.sessions.some((x) => x.status === 'running' && x.roomId === 'ps4-1'))
      throw new Error('busy-room');
    s.sessions.push({
      id: crypto.randomUUID(),
      shiftId: 'shift',
      roomId: 'ps4-1',
      roomName: 'PS4 room 1',
      mode: 'single',
      rate: 2500,
      start: 1000,
      status: 'running',
      timezone: 'Africa/Cairo',
      note: '',
      services: [],
      createdBy: 'owner-a',
      pricing: {
        roundTime: true,
        priceRound: 'pound',
        thresholds: { half: 35, quarter: 45 },
      },
    });
  }
  const results = await Promise.allSettled([
    one.update(start),
    two.update(start),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([
    'fulfilled',
    'rejected',
  ]);
  expect((await one.load()).sessions).toHaveLength(1);
});
it('preserves ordered records across reloads and atomically switches restore generations', async () => {
  const one = repo();
  const state = fixture();
  state.audit = [
    {
      id: 'z-last-sort',
      at: 1,
      userId: 'owner-a',
      action: 'first',
      detail: '',
    },
    {
      id: 'a-first-sort',
      at: 2,
      userId: 'owner-a',
      action: 'second',
      detail: '',
    },
  ];
  await one.create(state);
  expect((await one.load()).audit.map((a) => a.id)).toEqual([
    'z-last-sort',
    'a-first-sort',
  ]);
  await one.save({
    ...state,
    settings: { ...state.settings, shopName: 'Restored' },
  });
  expect((await one.load()).settings.shopName).toBe('Restored');
  expect((await one.load()).audit).toHaveLength(2);
});
it('chunks oversized records and round trips Arabic and emoji losslessly', async () => {
  const one = repo();
  const state = fixture();
  state.shifts = [
    {
      id: 'shift',
      date: '2026-11-26',
      start: 1000,
      openedBy: 'owner-a',
      note: '',
    },
  ];
  const session: Session = {
    id: 'huge',
    shiftId: 'shift',
    roomId: 'ps4-1',
    roomName: 'PS4',
    mode: 'single',
    rate: 2500,
    start: 1000,
    status: 'running',
    timezone: 'Africa/Cairo',
    note: 'شاي 🎮'.repeat(70000),
    services: [],
    createdBy: 'owner-a',
    pricing: {
      roundTime: true,
      priceRound: 'pound',
      thresholds: { half: 35, quarter: 45 },
    },
  };
  state.sessions = [session];
  await one.create(state);
  expect((await one.load()).sessions[0].note).toBe(session.note);
});

it('rejects in-place record writes that skip the root revision protocol', async () => {
  await repo().create(fixture());
  const a = db('owner-a');
  const head = (await getDoc(doc(a, 'shops', 'owner-a'))).data()!;
  await assertFails(
    setDoc(
      doc(
        a,
        'shops',
        'owner-a',
        'generations',
        head.generation,
        'users',
        'owner-a',
      ),
      { id: 'owner-a', order: 0, payload: JSON.stringify(fixture().users[0]) },
    ),
  );
});
