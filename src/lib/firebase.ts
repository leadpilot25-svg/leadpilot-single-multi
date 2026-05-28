import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth,
  initializeAuth, 
  browserLocalPersistence, 
  browserPopupRedirectResolver 
} from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import configJson from "../../firebase-applet-config.json";

const metaEnv = (import.meta as any).env || {};

const getCustomConfig = () => {
  try {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("leadpilot_custom_firebase_config");
      return saved ? JSON.parse(saved) : null;
    }
  } catch (e) {
    console.error("Error reading custom firebase config:", e);
  }
  return null;
};

const customConfig = getCustomConfig();

const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || customConfig?.apiKey || configJson.apiKey,
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || customConfig?.authDomain || configJson.authDomain,
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || customConfig?.projectId || configJson.projectId,
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || customConfig?.storageBucket || configJson.storageBucket,
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || customConfig?.messagingSenderId || configJson.messagingSenderId,
  appId: metaEnv.VITE_FIREBASE_APP_ID || customConfig?.appId || configJson.appId,
};

// Singleton init to prevent multi-instantiation inside hot module reloading
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
});
export default app;

