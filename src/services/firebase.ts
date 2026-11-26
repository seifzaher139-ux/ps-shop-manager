import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  initializeFirestore,
  memoryLocalCache,
  connectFirestoreEmulator,
} from 'firebase/firestore';
export const firebaseConfig = {
  apiKey: 'AIzaSyCQ5LVA1u3J0PxzUzIqbe2WaqBfW9u1Knk',
  authDomain: 'ps-shop-manager-c47a5.firebaseapp.com',
  projectId: 'ps-shop-manager-c47a5',
  storageBucket: 'ps-shop-manager-c47a5.firebasestorage.app',
  messagingSenderId: '930484147947',
  appId: '1:930484147947:web:cf991357bd9fc35292d0ae',
};
let client: ReturnType<typeof initializeClient> | undefined;
function initializeClient() {
  const app =
    getApps()[0] ??
    initializeApp(
      import.meta.env.VITE_FIREBASE_EMULATORS === 'true'
        ? {
            ...firebaseConfig,
            apiKey: 'demo-key',
            projectId: 'demo-ps-shop-manager',
          }
        : firebaseConfig,
    );
  const auth = getAuth(app);
  const db = initializeFirestore(app, {
    localCache: memoryLocalCache(),
    ignoreUndefinedProperties: true,
  });
  // Emulator endpoints are a build-time development option. Production builds never set it.
  if (import.meta.env.VITE_FIREBASE_EMULATORS === 'true') {
    const host = import.meta.env.VITE_FIREBASE_EMULATOR_HOST || '127.0.0.1';
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, 8080);
  }
  return { app, auth, db };
}
export function firebaseClient() {
  return (client ??= initializeClient());
}
