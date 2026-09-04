import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import defaultConfig from '../../firebase-applet-config.json';

const env = (import.meta as any).env || {};

const clean = (val?: string) => val ? val.replace(/^["']|["']$/g, '').trim() : undefined;

const firebaseConfig = {
  apiKey: clean(env.VITE_FIREBASE_API_KEY) || defaultConfig.apiKey,
  authDomain: clean(env.VITE_FIREBASE_AUTH_DOMAIN) || defaultConfig.authDomain,
  projectId: clean(env.VITE_FIREBASE_PROJECT_ID) || defaultConfig.projectId,
  storageBucket: clean(env.VITE_FIREBASE_STORAGE_BUCKET) || defaultConfig.storageBucket,
  messagingSenderId: clean(env.VITE_FIREBASE_MESSAGING_SENDER_ID) || defaultConfig.messagingSenderId,
  appId: clean(env.VITE_FIREBASE_APP_ID) || defaultConfig.appId,
  firestoreDatabaseId: clean(env.VITE_FIREBASE_DATABASE_ID) || defaultConfig.firestoreDatabaseId,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Explicitly configure browserLocalPersistence to preserve login state across page reloads & browser restarts
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('Firebase Auth persistence setup notice:', err);
});

// Initialize Firestore with IndexedDB persistent offline cache & multi-tab coordination
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    ignoreUndefinedProperties: true,
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, firebaseConfig.firestoreDatabaseId || undefined);
} catch (e) {
  try {
    firestoreDb = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
      ignoreUndefinedProperties: true
    }, firebaseConfig.firestoreDatabaseId || undefined);
  } catch (err) {
    firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
  }
}
export const db = firestoreDb;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Operation Notice:', JSON.stringify(errInfo));
}

