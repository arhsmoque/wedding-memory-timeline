import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, type User } from "firebase/auth";
import { getToken, initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from "firebase/app-check";
import { getFirestore, initializeFirestore, persistentLocalCache } from "firebase/firestore";

export const firebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID &&
  import.meta.env.VITE_FIREBASE_APP_ID
);

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo.invalid",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "demo-project.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "0",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "demo-app"
};

export const app = initializeApp(firebaseConfig);
export let appCheck: AppCheck | null = null;

if (import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY) {
  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true
  });
}

export const auth = getAuth(app);

// persistentLocalCache() throws in iOS private browsing; fall back to default (memory) cache
let db: ReturnType<typeof initializeFirestore>;
try {
  db = initializeFirestore(app, { localCache: persistentLocalCache() });
} catch {
  db = getFirestore(app);
}
export { db };

export async function ensureGuestAuth(): Promise<User> {
  if (!firebaseConfigured) throw new Error("Firebase is not configured for this preview.");
  if (auth.currentUser) return auth.currentUser;
  await signInAnonymously(auth);
  return new Promise<User>((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) { unsub(); resolve(user); }
    });
  });
}

export async function getAppCheckToken() {
  if (!appCheck) return null;
  const result = await getToken(appCheck, false);
  return result.token;
}
