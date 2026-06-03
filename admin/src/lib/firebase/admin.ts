import 'server-only';

import * as admin from 'firebase-admin';

function getProjectId(): string {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    'study-forge-202604'
  );
}

function isEmulatorMode(): boolean {
  return Boolean(
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||
      process.env.FIRESTORE_EMULATOR_HOST
  );
}

function initializeAdminApp(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const projectId = getProjectId();

  if (isEmulatorMode()) {
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
    }
    return admin.initializeApp({ projectId });
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (clientEmail && privateKey) {
    return admin.initializeApp({
      projectId,
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  return admin.initializeApp({ projectId });
}

export function getAdminApp(): admin.app.App {
  return initializeAdminApp();
}

export function getAdminAuth(): admin.auth.Auth {
  return getAdminApp().auth();
}

export function getAdminFirestore(): admin.firestore.Firestore {
  return getAdminApp().firestore();
}
