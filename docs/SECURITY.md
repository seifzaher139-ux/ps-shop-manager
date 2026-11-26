# Security model

This is entirely client-side. Login and permissions protect against casual or accidental UI use, not someone with full device/browser-profile access, developer tools or modified code. Such a person can read/modify IndexedDB or replace hashes. Audit history is not tamper-proof.

Passwords and recovery codes use WebCrypto PBKDF2-SHA256, 210,000 iterations, fresh random 16-byte salts and 256-bit hashes. Plaintext secrets are never saved. Recovery is shown once and works offline. Password changes verify the current password; admins can reset users. Login state stays in memory. Idle lock defaults off and does not stop sessions.

Commands enforce active-user permissions and domain invariants. Closed shifts are immutable. IndexedDB and JSON backups are **unencrypted**, including financial history, password hashes and recovery hashes. A backup permits reading history and offline password guessing. Use strong passwords, device encryption/screen lock and private or encrypted backup storage. Never publish a backup or recovery code.

There are no analytics, remote fonts, runtime APIs or tracking. Browser/OS traffic and hosting logs are outside the app. Static build artifacts contain no users, secrets or shop financial data. Private source does not necessarily imply private hosting; check visibility before enabling Pages.

Storage can disappear through clearing site data, changing origin/profile, private browsing cleanup, uninstall behavior or storage pressure. Persistent storage is requested, not guaranteed. Make regular off-device copies and test restores. Devices do not merge or sync.

The dependency lockfile is committed. Serve production over HTTPS, avoid exposing the development server to untrusted networks, and update browser/dependencies. See validation notes for dependency and platform verification limits.
