# Firebase production setup

Project: `ps-shop-manager-c47a5`. The web app config in `src/services/firebase.ts` is public client configuration; it is not an administrator credential. No service-account key is needed in the browser or GitHub.

## Console steps (owner must do once)

1. Open https://console.firebase.google.com/ and select **ps-shop-manager-c47a5** using the Google account that owns the project.
2. Open **Build → Firestore Database**. If the database does not exist, select **Create database**, use the default database ID, choose a suitable location, and start in **Production mode**. Do not publish unrestricted test-mode access.
3. Open the repository's `firestore.rules` file. Click **Raw** or the copy button, and copy the entire file, including `rules_version` and the final closing brace.
4. In **Firestore Database → Rules**, select all existing text and replace it with the file. Click **Publish** and wait for the success message. Do not paste the rules into the Data tab or Firebase Storage rules.
5. Open **Build → Authentication → Sign-in method** (or Sign-in providers), enable **Email/Password**, and click **Save**. Email link/passwordless sign-in is not required.
6. Open **Authentication → Settings → Authorized domains → Add domain**. Add **seifzaher139-ux.github.io** (hostname only, no https or repository path), then save. The public Firebase project config was checked on 2026-11-26: it contained localhost and the Firebase app domains, but not this GitHub Pages hostname.
7. Open https://seifzaher139-ux.github.io/ps-shop-manager/ and accept the PWA update when offered. Choose **إنشاء محل جديد**, enter the shop name, email and password. Later, use **استخدام محل موجود** with that same email/password on any browser or device. A separate manager account is created automatically in the shop data; do not recreate it on other devices.

The app build can be deployed before these console steps, but successful production signup and database access require them. Emulator tests do not publish production rules or enable providers. Public web config cannot perform these administrator actions.

## Keep the existing local history

Use the original browser/profile that contains the old app data. During new-shop creation, select **نقل البيانات القديمة إلى المحل الجديد** and enter the old manager password or recovery code. The app uploads the complete record set, with original IDs/history and closed snapshots, then activates the cloud shop. It does not erase the old browser database. Do this **before** clearing browser/site data.

Alternatively, login to the cloud shop and use Settings → restore to upload an old JSON backup. Restore explicitly replaces the cloud shop for all devices, retains a valid Firebase owner, and offers a safety backup first. Authentication passwords/tokens are never imported from a JSON file. Do not restore another shop's file unless you deliberately intend to replace this shop's records.

## Account boundaries and staff

One Firebase email/password account owns one shop, keyed by its Firebase UID. Different email accounts have separate shops. The rules deny shop enumeration, unsigned access, other owners' paths and ownership changes. Only the owner account can access Firestore. Existing shift-user roles remain within the signed-in owner's session; use **تبديل مستخدم الشفت** to select a staff profile. Staff profiles are not separate Firebase owners and do not independently grant access from a new device. Owner email password recovery uses Firebase email; local staff passwords retain their original hashes/permissions.

## Connectivity and backups

Firestore is authoritative. Financial writes use server transactions and are only acknowledged after a server commit. There is no offline write queue and no local-only success. The PWA shell can be cached and active timers continue displaying, but saving/start/end/restore requires internet. After clearing site data, sign in again to fetch the cloud records. JSON remains an optional safety/export copy, not the primary database.

All settings (including the existing device label) are shared shop settings in Firestore. A fresh browser does not create a new ledger. Keep a private copy of JSON backups and do not commit them to GitHub.

## Optional CLI administration

With the owner's own Firebase CLI login, rules and index exemptions can alternatively be deployed using:

```sh
npx firebase login
npx firebase deploy --only firestore --project ps-shop-manager-c47a5
```

Do not place credentials in source files or GitHub. `firestore.indexes.json` contains payload index exemptions; the app uses no custom query index, so pasting the security rules is sufficient to function.

## Troubleshooting

- Provider disabled/configuration error: enable Email/Password in Authentication.
- Permission denied: verify Rules were published to this project's default Firestore database, and that the app is signed in to its shop account.
- Authorized-domain error: add the hostname above, without a path.
- Signup created an Auth user but Firestore setup failed: fix the console settings, use existing-shop login, then complete the shop-name setup. Do not repeatedly create a new email account.
- Data missing after changing browser: confirm the exact same shop email was used; a different email is a different shop. Old browser-only data appears after explicit migration/restore.
- Offline: reconnect and retry; a rejected save has not been counted as a successful financial operation.
