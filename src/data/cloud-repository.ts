import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  onSnapshot,
  runTransaction,
  writeBatch,
  type Firestore,
  type DocumentReference,
  type DocumentData,
} from 'firebase/firestore';
import { defaults, type State } from '../core/model';
import { migrate, type Repository } from './repository';
export const TABLES = [
  'users',
  'rooms',
  'sessions',
  'shifts',
  'expenses',
  'audit',
] as const;
type TableName = (typeof TABLES)[number];
interface Head {
  ownerId: string;
  generation: string;
  revision: number;
  schemaVersion: number;
  appVersion: string;
  settings: State['settings'];
}
interface Loaded {
  state: State;
  head: Head;
}
interface Change {
  table: TableName;
  id: string;
  remove?: boolean;
}
interface Write {
  ref: DocumentReference;
  data?: Record<string, unknown>;
  remove?: boolean;
}
function encodeRecord(record: { id: string }): {
  body: Record<string, unknown>;
  parts: string[];
} {
  const payload = JSON.stringify(record);
  if (new TextEncoder().encode(payload).length < 600000)
    return { body: { id: record.id, payload }, parts: [] };
  const bytes = new TextEncoder().encode(payload);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  const encoded = btoa(binary),
    parts: string[] = [];
  for (let i = 0; i < encoded.length; i += 400000)
    parts.push(encoded.slice(i, i + 400000));
  return {
    body: { id: record.id, encoding: 'base64', parts: parts.length },
    parts,
  };
}
export class FirestoreRepository implements Repository {
  private cached: Loaded | undefined;
  clearCache() {
    this.cached = undefined;
  }
  constructor(
    private database: () => Firestore,
    private owner: () => string | null,
  ) {}
  private shop() {
    const uid = this.owner();
    if (!uid) throw new Error('cloud-auth-required');
    return doc(this.database(), 'shops', uid);
  }
  private async decode(
    ref: DocumentReference,
    data: DocumentData,
  ): Promise<{ id: string }> {
    let payload: string;
    if (typeof data.payload === 'string') payload = data.payload;
    else {
      if (
        data.encoding !== 'base64' ||
        !Number.isInteger(data.parts) ||
        data.parts < 1 ||
        data.parts > 10000
      )
        throw new Error('invalid-backup');
      const chunks = await Promise.all(
        Array.from({ length: data.parts }, (_, i) =>
          getDocFromServer(doc(ref, 'parts', String(i))),
        ),
      );
      if (chunks.some((part) => !part.exists()))
        throw new Error('cloud-incomplete');
      const binary = atob(chunks.map((part) => part.data()!.payload).join(''));
      payload = new TextDecoder().decode(
        Uint8Array.from(binary, (c) => c.charCodeAt(0)),
      );
    }
    const value = JSON.parse(payload);
    if (!value || value.id !== ref.id) throw new Error('invalid-backup');
    return value;
  }
  private async read(): Promise<Loaded | null> {
    const shop = this.shop();
    for (let attempt = 0; attempt < 6; attempt++) {
      const first = await getDocFromServer(shop);
      if (!first.exists()) {
        this.cached = undefined;
        return null;
      }
      const head = first.data() as Head;
      if (head.ownerId !== shop.id) throw new Error('denied');
      const cached =
        this.cached?.head.ownerId === shop.id &&
        this.cached.head.generation === head.generation
          ? structuredClone(this.cached)
          : undefined;
      if (cached?.head.revision === head.revision) return cached;
      const state = {
        ...defaults(),
        schemaVersion: head.schemaVersion,
        appVersion: head.appVersion,
        settings: head.settings,
      };
      const gap = cached ? head.revision - cached.head.revision : 0;
      let changes: Change[] | undefined;
      if (cached && gap > 0 && gap <= 20) {
        const logs = await Promise.all(
          Array.from({ length: gap }, (_, i) =>
            getDocFromServer(
              doc(
                shop,
                'generations',
                head.generation,
                'changes',
                String(cached.head.revision + i + 1),
              ),
            ),
          ),
        );
        if (
          logs.every((log) => log.exists() && Array.isArray(log.data().changes))
        )
          changes = logs.flatMap((log) => log.data()!.changes as Change[]);
      }
      if (cached && changes) {
        for (const table of TABLES) {
          const map = new Map(
            cached.state[table].map((value, order) => [
              value.id,
              { value, order },
            ]),
          );
          const ids = new Set(
            changes
              .filter((change) => change.table === table)
              .map((change) => change.id),
          );
          await Promise.all(
            [...ids].map(async (id) => {
              const row = await getDocFromServer(
                doc(shop, 'generations', head.generation, table, id),
              );
              if (row.exists())
                map.set(id, {
                  value: (await this.decode(
                    row.ref,
                    row.data(),
                  )) as (typeof cached.state)[typeof table][number],
                  order: row.data().order,
                });
              else map.delete(id);
            }),
          );
          Object.assign(state, {
            [table]: [...map.values()]
              .sort((a, b) => a.order - b.order)
              .map((row) => row.value),
          });
        }
      } else {
        const records = await Promise.all(
          TABLES.map(async (table) => {
            const rows = await getDocsFromServer(
              collection(shop, 'generations', head.generation, table),
            );
            return [
              table,
              await Promise.all(
                rows.docs
                  .sort((a, b) => a.data().order - b.data().order)
                  .map((row) => this.decode(row.ref, row.data())),
              ),
            ] as const;
          }),
        );
        for (const [table, values] of records)
          Object.assign(state, { [table]: values });
      }
      const last = await getDocFromServer(shop);
      if (
        !last.exists() ||
        last.data().revision !== head.revision ||
        last.data().generation !== head.generation
      )
        continue;
      if (this.owner() !== shop.id) throw new Error('cloud-auth-required');
      if (
        this.cached?.head.ownerId === shop.id &&
        this.cached.head.generation === head.generation &&
        this.cached.head.revision > head.revision
      )
        continue;
      this.cached = { state: migrate(state), head };
      return structuredClone(this.cached);
    }
    throw new Error('cloud-conflict');
  }
  async load(): Promise<State> {
    return (await this.read())?.state ?? defaults();
  }
  async loadVersion() {
    return this.read();
  }
  private writes(
    shop: DocumentReference,
    generation: string,
    table: TableName,
    record: { id: string },
    order: number,
  ): Write[] {
    const ref = doc(shop, 'generations', generation, table, record.id);
    const { body, parts } = encodeRecord(record);
    return [
      ...parts.map((payload, i) => ({
        ref: doc(ref, 'parts', String(i)),
        data: { payload },
      })),
      { ref, data: { ...body, order } },
    ];
  }
  async update(change: (state: State) => void): Promise<State> {
    const shop = this.shop();
    for (let attempt = 0; attempt < 6; attempt++) {
      const loaded = await this.read();
      if (!loaded) throw new Error('cloud-shop-missing');
      const state = structuredClone(loaded.state);
      change(state);
      const clean = migrate(state);
      const writes: Write[] = [];
      const changes: Change[] = [];
      for (const table of TABLES) {
        const old = new Map(
          loaded.state[table].map((row) => [row.id, JSON.stringify(row)]),
        );
        const positions = new Map(
          loaded.state[table].map((row, index) => [row.id, index]),
        );
        for (const [index, row] of clean[table].entries()) {
          if (
            old.get(row.id) !== JSON.stringify(row) ||
            positions.get(row.id) !== index
          ) {
            changes.push({ table, id: row.id });
            writes.push(
              ...this.writes(shop, loaded.head.generation, table, row, index),
            );
          }
          old.delete(row.id);
        }
        for (const id of old.keys()) {
          if (table !== 'rooms') throw new Error('financial-delete-forbidden');
          changes.push({ table, id, remove: true });
          writes.push({
            ref: doc(shop, 'generations', loaded.head.generation, table, id),
            remove: true,
          });
        }
      }
      if (writes.length > 440) throw new Error('cloud-action-too-large');
      try {
        await runTransaction(this.database(), async (transaction) => {
          const current = await transaction.get(shop);
          if (
            !current.exists() ||
            current.data().revision !== loaded.head.revision ||
            current.data().generation !== loaded.head.generation
          )
            throw new Error('cloud-conflict');
          if (this.owner() !== shop.id) throw new Error('cloud-auth-required');
          for (const write of writes) {
            if (write.remove) transaction.delete(write.ref);
            else transaction.set(write.ref, write.data!);
          }
          transaction.set(
            doc(
              shop,
              'generations',
              loaded.head.generation,
              'changes',
              String(loaded.head.revision + 1),
            ),
            { revision: loaded.head.revision + 1, changes },
          );
          transaction.update(shop, {
            settings: clean.settings,
            schemaVersion: clean.schemaVersion,
            appVersion: clean.appVersion,
            revision: loaded.head.revision + 1,
          });
        });
        const head = {
          ...loaded.head,
          settings: clean.settings,
          schemaVersion: clean.schemaVersion,
          appVersion: clean.appVersion,
          revision: loaded.head.revision + 1,
        };
        if (
          !this.cached ||
          this.cached.head.ownerId !== shop.id ||
          this.cached.head.generation !== head.generation ||
          this.cached.head.revision <= head.revision
        )
          this.cached = { state: structuredClone(clean), head };
        return clean;
      } catch (error) {
        if (error instanceof Error && error.message === 'cloud-conflict')
          continue;
        const code =
          error && typeof error === 'object' && 'code' in error
            ? String(error.code)
            : '';
        if (code === 'permission-denied' || code === 'aborted') {
          // Rules can reject a stale optimistic revision before the SDK retries it.
          const latest = await getDocFromServer(shop);
          if (
            latest.exists() &&
            (latest.data().revision !== loaded.head.revision ||
              latest.data().generation !== loaded.head.generation)
          )
            continue;
        }
        throw error;
      }
    }
    throw new Error('cloud-conflict');
  }
  async create(state: State) {
    await this.replace(state, true);
  }
  async save(state: State) {
    await this.replace(state, false);
  }
  async replace(state: State, create = false) {
    const shop = this.shop();
    const before = await getDocFromServer(shop);
    if (create && before.exists()) throw new Error('cloud-shop-exists');
    if (!create && !before.exists()) throw new Error('cloud-shop-missing');
    const clean = migrate(state),
      generation = crypto.randomUUID();
    const writes = TABLES.flatMap((table) =>
      clean[table].flatMap((row, index) =>
        this.writes(shop, generation, table, row, index),
      ),
    );
    for (let i = 0; i < writes.length; i += 100) {
      const batch = writeBatch(this.database());
      for (const write of writes.slice(i, i + 100))
        batch.set(write.ref, write.data!);
      await batch.commit();
    }
    await runTransaction(this.database(), async (transaction) => {
      const current = await transaction.get(shop);
      if (
        current.exists() !== before.exists() ||
        (current.exists() &&
          current.data().revision !== before.data()!.revision)
      )
        throw new Error('cloud-restore-conflict');
      if (this.owner() !== shop.id) throw new Error('cloud-auth-required');
      transaction.set(shop, {
        ownerId: shop.id,
        generation,
        revision: (before.data()?.revision ?? -1) + 1,
        schemaVersion: clean.schemaVersion,
        appVersion: clean.appVersion,
        settings: clean.settings,
      });
    });
    this.cached = {
      state: structuredClone(clean),
      head: {
        ownerId: shop.id,
        generation,
        revision: (before.data()?.revision ?? -1) + 1,
        schemaVersion: clean.schemaVersion,
        appVersion: clean.appVersion,
        settings: clean.settings,
      },
    };
    return clean;
  }
  observe(next: () => void, error: (error: Error) => void) {
    return onSnapshot(
      this.shop(),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!snapshot.metadata.fromCache) next();
      },
      error,
    );
  }
}
