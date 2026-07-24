#!/usr/bin/env node
/**
 * Trigger artifact generation via Firebase callable functions (emulator).
 *
 * Usage:
 *   npx tsx scripts/seed-setup/generate-artifacts-local.ts
 *
 * Prerequisites:
 *   - Emulators running (Auth, Firestore, Functions, Storage)
 *   - setup-seed-data.ts and seed-llm-setup.ts already run
 *   - functions/.secret.local has LLM_SETTINGS_ENCRYPTION_KEY (+ restart emulators)
 */
import * as path from 'path';
import { config } from 'dotenv';

config({ path: path.join(process.cwd(), '.env.local') });
config({ path: path.join(process.cwd(), 'web/.env') });

const PROJECT_ID =
  process.env.GCLOUD_PROJECT ??
  process.env.NX_PUBLIC_FIREBASE_PROJECT_ID ??
  'study-forge-202604';
const API_KEY = process.env.NX_PUBLIC_FIREBASE_API_KEY ?? 'demo-api-key-for-emulator';
const REGION = 'asia-east1';
const QUIZ_REGION = 'us-central1'; // legacy emulator registration until functions rebuild
const FUNCTIONS_BASE = (region: string) =>
  `http://127.0.0.1:5001/${PROJECT_ID}/${region}`;

const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'Test123456!';
const DOC_ID = 'perfect-doc-ml';
const DIR_ID = 'e2e-study-materials';

interface AuthSignInResponse {
  idToken?: string;
  localId?: string;
  error?: { message?: string };
}

interface CallableEnvelope<T> {
  result?: T;
  error?: { message?: string; status?: string };
}

interface StartGenerationResult {
  success?: boolean;
  data?: {
    recordId?: string;
    id?: string;
    quizId?: string;
    jobId?: string;
    generationStatus?: string;
    success?: boolean;
  };
  error?: { message?: string; code?: string; retryAfterSeconds?: number };
  message?: string;
}

function extractRecordId(result: StartGenerationResult): string | undefined {
  return result.data?.recordId ?? result.data?.quizId ?? result.data?.id;
}

async function clearRateLimits(): Promise<void> {
  process.env.FIRESTORE_EMULATOR_HOST =
    process.env.FIRESTORE_EMULATOR_HOST ?? 'localhost:8080';
  const admin = await import('firebase-admin');
  if (admin.default.apps.length === 0) {
    admin.default.initializeApp({ projectId: PROJECT_ID });
  }
  const snap = await admin.default
    .firestore()
    .collection(`users/4ZBsEPIUJ4jrlylcXkg7t3sFdPZv/apiRateLimits`)
    .get();
  if (snap.empty) {
    return;
  }
  const batch = admin.default.firestore().batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}

async function signIn(): Promise<string> {
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? 'localhost:9099';
  const url = `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      returnSecureToken: true,
    }),
  });

  const data = (await response.json()) as AuthSignInResponse;
  if (!response.ok || !data.idToken) {
    throw new Error(data.error?.message ?? 'Failed to sign in test user');
  }

  return data.idToken;
}

async function callCallable<T>(
  name: string,
  idToken: string,
  payload: unknown,
  region = REGION
): Promise<T> {
  const response = await fetch(`${FUNCTIONS_BASE(region)}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data: payload }),
  });

  const body = (await response.json()) as CallableEnvelope<T>;
  if (!response.ok || body.error) {
    throw new Error(body.error?.message ?? `Callable ${name} failed (${response.status})`);
  }

  if (body.result === undefined) {
    throw new Error(`Callable ${name} returned no result`);
  }

  return body.result;
}

async function pollQuiz(idToken: string, quizId: string, attempts = 60): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    const result = await callCallable<{
      success?: boolean;
      data?: { quiz?: { generationStatus?: string; questions?: unknown[] } };
    }>('getQuiz', idToken, { quizId }, QUIZ_REGION);

    const status = result.data?.quiz?.generationStatus;
    const questionCount = result.data?.quiz?.questions?.length ?? 0;

    if (status === 'ready' && questionCount > 0) {
      console.log(`   ✅ Quiz ready (${questionCount} questions)`);
      return;
    }

    if (status === 'failed') {
      throw new Error(`Quiz generation failed for ${quizId}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new Error(`Timed out waiting for quiz ${quizId}`);
}

async function main(): Promise<void> {
  console.log('Signing in as test user …');
  const idToken = await signIn();
  console.log('   ✅ Authenticated');

  await clearRateLimits();

  console.log('\nGenerating quiz (MiniMax M3) …');
  const quizResult = await callCallable<StartGenerationResult>(
    'generateQuiz',
    idToken,
    {
      documentIds: [DOC_ID],
      directoryId: DIR_ID,
      quizName: 'Machine Learning — MiniMax M3 Quiz',
    },
    QUIZ_REGION
  );

  if (!quizResult.success) {
    const retryAfter = quizResult.error?.retryAfterSeconds;
    throw new Error(
      quizResult.error?.message ??
        quizResult.message ??
        `generateQuiz failed${retryAfter ? ` (retry after ${retryAfter}s)` : ''}`
    );
  }

  const quizId = extractRecordId(quizResult);
  if (!quizId) {
    throw new Error('generateQuiz did not return a quiz id');
  }

  console.log(`   ⏳ Quiz job enqueued: ${quizId}`);
  await pollQuiz(idToken, quizId);

  await clearRateLimits();
  await new Promise((resolve) => setTimeout(resolve, 11_000));

  console.log('\nGenerating flashcards (MiniMax M3 agentic) …');
  const fcResult = await callCallable<StartGenerationResult>('generateFlashcards', idToken, {
    documentIds: [DOC_ID],
    directoryId: DIR_ID,
    title: 'Machine Learning — MiniMax M3 Flashcards',
  });

  if (!fcResult.success) {
    throw new Error(fcResult.error?.message ?? fcResult.message ?? 'generateFlashcards failed');
  }

  const flashcardId = extractRecordId(fcResult);
  if (!flashcardId) {
    throw new Error('generateFlashcards did not return a flashcard set id');
  }

  console.log(`   ⏳ Flashcard job enqueued: ${flashcardId}`);
  console.log('   (Flashcards use agentic workflow — check emulator logs / app for completion)');

  console.log('\n✅ Artifact generation started successfully.');
}

main().catch((err) => {
  console.error('\n❌ Artifact generation failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
