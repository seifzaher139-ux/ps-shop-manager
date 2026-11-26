# Security — Firebase edition

Firebase Authentication validates the shop email/password. Cloud Firestore is authoritative and the checked-in firestore.rules must be published to the supplied project. Public client config/API keys identify the project; they are not administrator credentials or a substitute for rules. No service-account private key, owner password or Firebase auth token is committed or put in backups.

Each shop path is the authenticated owner's UID. Rules deny unsigned reads/writes, cross-owner paths, shop listing and ownership changes. Root revisions advance exactly one step. Only known record collections and chunk/change-log formats are allowed. Financial records/root documents cannot be hard-deleted by the client; unused rooms may be removed. Rules tests verify denied and allowed requests against a real emulator.

These rules isolate owners; they intentionally do not validate all financial JSON or enforce staff permissions against an owner token. The owner can change their own ledger, and local role controls do not defend against someone with that signed-in owner's developer-tools/device access. Existing shift-user passwords/permissions provide UI-level access control within the owner session, not separate Firebase membership. Close/logout shared browsers appropriately.

Staff and legacy credentials retain random-salted PBKDF2-SHA256 hashes (210,000 iterations). Firebase owner password change/recovery uses Firebase re-authentication and email. An offline recovery code cannot reset a Firebase password. Old manager password/recovery can authorize a one-time legacy import; it cannot access a different cloud account.

Browser data is not the sole financial store. Normal writes are server transactions and offline writes are rejected. Successful commands are not just queued in a local cache. Memory views and Firebase auth persistence can exist on the device; clearing site data signs out but does not delete Firestore. Unmigrated legacy IndexedDB history can still be lost by clearing the old browser before import: migrate or export first.

JSON backups are unencrypted and contain business history, staff password hashes, owner UID/email and the logo; they contain no Firebase password/token. Keep them private. Cloud restore replaces the current ledger for all devices, retains original generations and offers a safety download. Audit/history is useful operational evidence, not an immutable ledger against a malicious owner.

The app now makes intentional Firebase Auth/Firestore requests. It still has no analytics, tracking, CDN fonts or remote runtime scripts. SDK code, Cairo and icons are bundled. Production must use HTTPS; Firebase project provider/domain/rules setup remains an owner Console action documented in FIREBASE_SETUP.md.

At validation, npm audit --omit=dev reports zero runtime advisories after pinning patched grpc-js. Developer-tool advisories are recorded in VALIDATION.md. Keep browser, dependencies and Firebase configuration updated. Test data uses demo emulators and is not written to the production project.
