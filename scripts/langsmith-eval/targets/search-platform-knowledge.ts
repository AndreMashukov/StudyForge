import '../shared/emulator-env';
import * as admin from 'firebase-admin';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { PlatformAgentKnowledgeIndexService } from '../../../libs/backend/agent/src/knowledge/platform-agent-knowledge-index-service';
import {
  PLATFORM_KNOWLEDGE_DOC_ID,
  SEED_EVAL_UID,
} from '../shared/constants';

const DOCUMENTS_COLLECTION = 'platformAgentKnowledgeDocuments';

export interface IPlatformKnowledgePin {
  documentId: string;
  publishedContentHash: string;
}

export interface IPlatformKnowledgeSearchResult extends IPlatformKnowledgePin {
  retrievedTexts: string[];
}

function resolveProjectId(): string {
  return (
    process.env.NX_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    'study-forge-202604'
  );
}

export function initPlatformKnowledgeAdmin(): void {
  process.env.FIRESTORE_EMULATOR_HOST =
    process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
  process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || resolveProjectId();
  const projectId = resolveProjectId();

  if (getApps().length === 0) {
    initializeApp({ projectId });
  }

  try {
    if (!admin.apps || admin.apps.length === 0) {
      admin.initializeApp({ projectId });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('already exists') && !message.includes('duplicate-app')) {
      throw error;
    }
  }
}

export async function readPlatformKnowledgePin(): Promise<IPlatformKnowledgePin> {
  initPlatformKnowledgeAdmin();
  const snap = await getFirestore()
    .collection(DOCUMENTS_COLLECTION)
    .doc(PLATFORM_KNOWLEDGE_DOC_ID)
    .get();
  const data = snap.data();
  if (!snap.exists || !data) {
    throw new Error(
      `Missing ${DOCUMENTS_COLLECTION}/${PLATFORM_KNOWLEDGE_DOC_ID}. Run npx tsx scripts/seed-setup/setup-seed-data.ts`,
    );
  }
  if (data.status !== 'published' || data.indexingStatus !== 'indexed') {
    throw new Error(
      `Platform knowledge ${PLATFORM_KNOWLEDGE_DOC_ID} is not published/indexed (status=${String(data.status)} indexingStatus=${String(data.indexingStatus)})`,
    );
  }
  const publishedContentHash = data.publishedContentHash;
  if (typeof publishedContentHash !== 'string' || !publishedContentHash) {
    throw new Error(
      `Platform knowledge ${PLATFORM_KNOWLEDGE_DOC_ID} is missing publishedContentHash`,
    );
  }
  return {
    documentId: PLATFORM_KNOWLEDGE_DOC_ID,
    publishedContentHash,
  };
}

export async function searchPlatformKnowledgeForEval(
  objective: string,
  userId: string = SEED_EVAL_UID,
): Promise<IPlatformKnowledgeSearchResult> {
  const pin = await readPlatformKnowledgePin();
  const matches =
    await PlatformAgentKnowledgeIndexService.searchPlatformKnowledge({
      userId,
      query: objective,
    });
  return {
    ...pin,
    retrievedTexts: matches.map((match) => match.text),
  };
}
