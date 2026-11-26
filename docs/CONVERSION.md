# Future native wrappers

Wrappers are intentionally not implemented. Reuse core rules, commands and backup format; swap platform adapters and test physical devices.

## Windows with Tauri

1. Install compatible Rust, Microsoft C++ build tools, WebView2 and Tauri CLI.
2. Add a Tauri shell on a separate branch. Configure Vite's dev URL and `npm run dev`, build with `npm run build`, and use frontend distribution `../dist` relative to the shell.
3. Keep HashRouter. Disable PWA service-worker registration inside the native shell because packaged assets and native upgrades provide offline delivery. Treat WebView2's origin/storage as a new installation.
4. Use the same Firebase Auth/Firestore repository and owner account. Implement `FileSaver.saveFile(name, blob)` with native save dialogs/filesystem, minimal capabilities, and a file-open restore adapter.
5. For later SQLite storage, implement the same Repository contract with atomic operations and migrate using validated JSON. Domain code stays unchanged.
6. Configure stable app identifier, Arabic display name, icon, signing and installer targets. Build a signed installer; verify Arabic printing, backups, offline startup and running timers after restart.

## Windows with Electron

1. Add main/preload shell code and package `dist` with an installer tool.
2. Enable sandboxing and contextIsolation, disable nodeIntegration, restrict navigation and use a secure local protocol. Never expose raw filesystem/Node access to React.
3. Keep HashRouter and disable service-worker registration.
4. Provide a minimal typed preload/IPC FileSaver and restore bridge with OS dialogs. Retain the cloud Repository or provide an equivalent native Firebase adapter.
5. Sign/package the installer and test native print, updates, backups and cold offline launch.

## Android with Capacitor

1. Install compatible current Capacitor core/CLI/Android, Android Studio and required JDK. Initialize a stable application ID, Arabic name and `webDir: 'dist'`.
2. Build, add Android, sync and open Android Studio. Do not configure a remote server URL in release builds.
3. Keep HashRouter and disable PWA registration; assets are packaged. Verify WebCrypto on the native WebView origin before allowing setup.
4. Use Firebase Auth/Firestore under a supported WebView origin, or native Firebase adapters. Implement native FileSaver through Filesystem/Share or Android Storage Access Framework. Feed document-picker text to the existing restore validator. Minimize file permissions.
5. WebView may not support browser printing. Add an Android print-framework adapter for the same RTL HTML and bundled Cairo font. Verify Arabic visually; do not use unshaped jsPDF text.
6. Configure RTL, icons, SDK targets, signing and version codes. Build signed APK/AAB, preserve the signing key, and test offline cold start, background timers, clock changes, file sharing and restoration on a phone.

## Move legacy browser-only data

1. Export JSON in the web app and verify the download; copy manually using Drive, USB or file transfer.
2. Choose restore during native first-run, review counts/date range and confirm replacement. Sign in to the owning Firebase shop first; legacy staff credentials are restored as local role profiles.
3. Compare room state and shift/day reports; create a new native backup. Retain the original until verified.
4. Web/native origins do not share local browser storage. Both wrappers load the same Firebase shop; legacy JSON restore replaces that shared ledger, rather than merging. Normal server transactions support concurrent clients.

## Cloud-edition updates

Wrappers should sign in to the same Firebase shop and load its cloud data directly. Backup import is optional safety/legacy migration, not required to move the ledger to another device. Configure allowed domains/origins and native Firebase auth integrations for the wrapper, verify reauthentication and reset email links, and preserve server-acknowledged write behavior. Do not quietly replace Cloud Firestore with a native-only database. Old wrapper notes about independent IndexedDB origins apply only to the retired browser-only edition.
