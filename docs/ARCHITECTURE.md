# Architecture — cloud edition (2.0.0)

React UI → permission-checked application commands → pure core rules → FirestoreRepository → authenticated owner's shop. Firebase Authentication manages the shop account; Zustand holds a view of server-confirmed data, never the only financial record.

- `src/core`: integer money, pricing, permissions, room reconciliation, shift/day aggregation and report models. No React, DOM, database access or implicit current time. `ReportDocument.source` preserves the raw live/frozen Report for the session-table Excel export.
- `src/data/cloud-repository.ts`: current primary repository. It uses server reads and transactions, normalizes record collections, checks revisions and applies incremental change logs. It supports consistent fresh-browser reads, concurrent writers, chunked oversized records and atomic restore generations.
- `src/data/repository.ts`: backup validation/migrations and the **legacy-only** Dexie reader/adapter. Normal cloud operation never writes financial data to this browser database. It remains to safely discover/import prior installations and for isolated domain tests.
- `src/services/firebase.ts`: lazy Firebase SDK initialization with the supplied public web config. Firestore cache is memory-only. A build-time demo flag connects tests to local emulators; production verification rejects that target in dist.
- `src/services/cloud.ts`: Firebase email/password create/login/logout/re-auth/password reset/change and the repository instance.
- `src/services/store.ts`: owner account lifecycle, migration, local shift-user roles, command queue, clock and transactional financial invariants. Firebase auth restoration selects the existing owner automatically; an incomplete signup can finish its shop setup without another account.
- `src/services/reports.ts`: Arabic RTL Excel and print adapter. Shift Excel has a compact summary and exactly one 12-column session table with cached total formulas, borders, dark header, frozen rows and numeric/date formats. Excel dates represent shop-local wall-clock time rather than the exporting device timezone.
- `src/ui`: Arabic RTL screens. The start screen offers create/use shop, account recovery is email-based, and a role lock keeps the authenticated shop separate from staff UI permissions. Reports list sessions as tappable summaries; the modal shows detail and PDF prints the full fields.
- `src/i18n`: Arabic UI text and formatting.

## Firestore layout

```
shops/{firebaseOwnerUid}
  ownerId, generation, revision, schemaVersion, appVersion, settings
  generations/{generation}/users/{id}
  generations/{generation}/rooms/{id}
  generations/{generation}/sessions/{id}
  generations/{generation}/shifts/{id}
  generations/{generation}/expenses/{id}
  generations/{generation}/audit/{id}
  generations/{generation}/changes/{revision}
```

Normal record documents contain id, order and JSON payload. The explicit order preserves existing arrays across Firestore's document-ID query ordering. Large payloads are UTF-8/base64 chunked into record `/parts/{partId}` documents below Firestore's document limit. JSON removes undefined optional fields. The shared root settings include all catalogs, rates, categories, logo and the original device label.

## Consistency and cost control

The first load reads the root revision, all active-generation records and the root again; a changed revision retries. A memory projection is used only after confirming its revision from the server. For nearby revisions, immutable change logs identify only the changed records, avoiding rereading years of history for each action. Longer gaps or restore-generation changes trigger a full server reload. Root onSnapshot notifications drive active-device refreshes.

A command validates the latest state, then a transaction rereads the root revision and writes changed records, its change log and revision+1 atomically. A competing device retries against fresh state; busy-room and open-shift invariants run again. Rules may reject stale optimistic revisions before SDK retry; the repository retries that case only after confirming an actual server revision change. It never treats a permission failure as success.

Restore stages a complete fresh generation in bounded batches, then switches the root pointer in a transaction only if the original revision is unchanged. Partial uploads are not visible as the current ledger. A conflicting restore stops for owner review. Old generations remain owner-protected, and no financial records are hard-deleted. Unused room removal is the only normal delete.

## Accounts and security boundary

One Firebase UID owns one shop. Rules restrict the path to that UID and immutable ownerId; listing shops and cross-owner access are denied. Staff roles remain app-level profiles inside the owner-authenticated shop session. They are not Firebase members, and do not get independent Firestore authority. An owner token has full authority over that owner's shop; local UI permissions are not a tamper-proof security boundary against developer tools.

Firebase owner passwords/tokens never enter State or JSON backups. Owner records have `authProvider: firebase` and an empty password field. Legacy/staff hashes remain PBKDF2. Restoring a file rebinds the current authenticated owner and retains historical user references; it does not import a Firebase login or grant access to a foreign UID.

## Offline and deployment

Only static PWA assets are precached. Firestore transactions require a network connection and there is no offline write queue or local-only success. Existing timers can display from the loaded view while disconnected. A cleared/new browser signs in and obtains server data again.

Logical backup schema remains 2; app version is 2.0.0. Older v1/v2 local backups migrate before upload. The cloud physical structure is independent of that logical DTO. HashRouter/relative assets support Pages. CI builds production into dist and emulator UI into dist-e2e, runs Java 21 Auth/Firestore emulators and rules/browser tests, verifies the production project ID, then publishes only dist.
