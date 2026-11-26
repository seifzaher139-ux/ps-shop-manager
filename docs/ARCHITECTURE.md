# Architecture

React UI calls application commands, which apply pure domain rules and persist through a Repository interface. UI never accesses Dexie.

- `src/core`: types, integer money, billing, permissions, room reconciliation, report builders and aggregation. No React, DOM, IndexedDB, implicit current time or Date.now(). Time is passed in.
- `src/data`: Repository, Dexie, backup codec, version migration and validation. Schema v1 stored snapshots. V2 adds defaults/app version and an indexed audit table. A snapshot is the authoritative aggregate and its audit array is mirrored to the audit table in the same transaction. This prioritizes atomic consistency over multi-table joins; history is retained indefinitely.
- `src/services`: permission-checked commands, PBKDF2 authentication, Clock/FileSaver interfaces, image resizing and report exports. Writes are serialized in-tab and reread current storage inside IndexedDB transactions. Errors roll back the whole operation and its audit event.
- `src/ui`: RTL React screens, Zustand projection and memory-only login. HashRouter supports static subpaths. Timers derive from stored timestamps rather than incrementing counters. Dialog portals permit printing receipts while hiding the main app.
- `src/i18n/ar.ts`: reusable UI text, seed labels, permissions, actions and formatters. User-entered names are data. Pure seed constants are usable by domain defaults.

## Evolution and backups

Current `schemaVersion: 2`, `appVersion: 1.0.0`. The migration entry point clones untrusted input, rejects future versions, migrates v1 to v2, then validates. Backups include a format marker, creation timestamp, schema/app versions, settings/logo, users and hashes, rooms, sessions, shifts/frozen reports, expenses and audit. Restore validates shapes, money integers, references, statuses and concurrency invariants before replacement. It is not digitally signed. Future schema changes must append a migration and test fixture.

Financial records are logically cancelled or voided, never deleted by business actions. Explicit whole-device restore replaces the database and offers a safety copy first. A repository implementation can be swapped without touching domain code.

## Offline lifecycle

Relative Vite base and HashRouter support repository hosting. Workbox precaches HTML, JavaScript (including lazy Excel), CSS, Cairo and icons. Manifest supplies Arabic name/dir/lang, scope, standalone display and maskable icons. Register type is prompt, with Arabic activation UI. First visit needs HTTPS or localhost; subsequent loads use service worker and IndexedDB. No runtime API/CDN requests exist. The browser smoke test asserts no external requests and reloads offline.

## Validation

Typecheck, ESLint, Vitest, build and Playwright run in CI. The browser flow covers setup/recovery, running timer reload, services, discount/payment/change, expense, closing report, Excel download, backup and offline reload. It collects mobile screenshots and a browser-printed Arabic sample PDF. Unit tests cover every rounding boundary, money modes, totals, permissions, backup rejection/migration and persistence; React tests guard recovery acknowledgement.
