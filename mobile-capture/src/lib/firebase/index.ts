import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import {
  FIREBASE_FUNCTIONS_REGION,
  getEmulatorHost,
  getFirebasePublicConfig,
  useFirebaseEmulator,
} from './config';

const firebaseConfig = getFirebasePublicConfig();

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, FIREBASE_FUNCTIONS_REGION);

let emulatorsConnected = false;

if (useFirebaseEmulator() && !emulatorsConnected) {
  emulatorsConnected = true;
  const host = getEmulatorHost();
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  connectFunctionsEmulator(functions, host, 5001);
}

export default app;
