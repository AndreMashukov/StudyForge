process.env.FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
process.env.GCLOUD_PROJECT =
  process.env.GCLOUD_PROJECT ||
  process.env.NX_PUBLIC_FIREBASE_PROJECT_ID ||
  process.env.GCP_PROJECT ||
  'study-forge-202604';
