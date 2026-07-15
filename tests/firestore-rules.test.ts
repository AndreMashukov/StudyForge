import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const PROJECT_ID = 'demo-study-forge-rules-test';
const OWNER_UID = 'owner-user';
const OTHER_UID = 'other-user';

const RULES_PATH = resolve(__dirname, '../firestore.rules');

let testEnv: RulesTestEnvironment;

async function seedDocument(
  userId: string,
  documentId: string,
  data: Record<string, unknown> = { title: 'Seed document' },
): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `users/${userId}/documents/${documentId}`), data);
  });
}

async function seedProgress(
  userId: string,
  subjectWorldId: string,
  progress: Record<string, unknown> = { completedGates: [] },
): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(
        context.firestore(),
        `users/${userId}/subjectWorlds/${subjectWorldId}/progress/${userId}`,
      ),
      { userId, subjectWorldId, progress },
    );
  });
}

describe('firestore.rules client write hardening', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: readFileSync(RULES_PATH, 'utf8'),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  describe('documents', () => {
    const documentId = 'doc-1';

    beforeEach(async () => {
      await seedDocument(OWNER_UID, documentId);
    });

    it('allows owner get', async () => {
      const owner = testEnv.authenticatedContext(OWNER_UID);
      await assertSucceeds(
        getDoc(doc(owner.firestore(), `users/${OWNER_UID}/documents/${documentId}`)),
      );
    });

    it('denies other-user get', async () => {
      const other = testEnv.authenticatedContext(OTHER_UID);
      await assertFails(
        getDoc(doc(other.firestore(), `users/${OWNER_UID}/documents/${documentId}`)),
      );
    });

    it('denies unauthenticated get', async () => {
      const anon = testEnv.unauthenticatedContext();
      await assertFails(
        getDoc(doc(anon.firestore(), `users/${OWNER_UID}/documents/${documentId}`)),
      );
    });

    it('allows bounded owner list', async () => {
      const owner = testEnv.authenticatedContext(OWNER_UID);
      const docsQuery = query(
        collection(owner.firestore(), `users/${OWNER_UID}/documents`),
        limit(100),
      );
      await assertSucceeds(getDocs(docsQuery));
    });

    it('denies owner list without limit', async () => {
      const owner = testEnv.authenticatedContext(OWNER_UID);
      const docsQuery = query(collection(owner.firestore(), `users/${OWNER_UID}/documents`));
      await assertFails(getDocs(docsQuery));
    });

    it('denies owner list above max limit', async () => {
      const owner = testEnv.authenticatedContext(OWNER_UID);
      const docsQuery = query(
        collection(owner.firestore(), `users/${OWNER_UID}/documents`),
        limit(101),
      );
      await assertFails(getDocs(docsQuery));
    });

    it('denies client create, update, and delete', async () => {
      const owner = testEnv.authenticatedContext(OWNER_UID);
      const docRef = doc(owner.firestore(), `users/${OWNER_UID}/documents/new-doc`);

      await assertFails(setDoc(docRef, { title: 'blocked create' }));
      await assertFails(
        updateDoc(doc(owner.firestore(), `users/${OWNER_UID}/documents/${documentId}`), {
          title: 'blocked update',
        }),
      );
      await assertFails(
        deleteDoc(doc(owner.firestore(), `users/${OWNER_UID}/documents/${documentId}`)),
      );
    });

    it('denies owner access to unknown nested subcollections', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(
          doc(
            context.firestore(),
            `users/${OWNER_UID}/documents/${documentId}/notes/note-1`,
          ),
          { body: 'server-only note' },
        );
      });

      const owner = testEnv.authenticatedContext(OWNER_UID);
      await assertFails(
        getDoc(
          doc(
            owner.firestore(),
            `users/${OWNER_UID}/documents/${documentId}/notes/note-1`,
          ),
        ),
      );
      await assertFails(
        setDoc(
          doc(
            owner.firestore(),
            `users/${OWNER_UID}/documents/${documentId}/notes/new-note`,
          ),
          { body: 'blocked create' },
        ),
      );
    });
  });

  describe('rules collection', () => {
    const ruleId = 'rule-1';

    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), `users/${OWNER_UID}/rules/${ruleId}`), {
          name: 'Seed rule',
          content: 'Always explain concepts clearly.',
        });
      });
    });

    it('allows bounded owner list', async () => {
      const owner = testEnv.authenticatedContext(OWNER_UID);
      const rulesQuery = query(
        collection(owner.firestore(), `users/${OWNER_UID}/rules`),
        limit(100),
      );
      await assertSucceeds(getDocs(rulesQuery));
    });

    it('denies client writes', async () => {
      const owner = testEnv.authenticatedContext(OWNER_UID);
      await assertFails(
        setDoc(doc(owner.firestore(), `users/${OWNER_UID}/rules/new-rule`), {
          name: 'blocked',
          content: 'blocked',
        }),
      );
    });
  });

  describe('artifacts (quizzes)', () => {
    const quizId = 'quiz-1';

    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), `users/${OWNER_UID}/quizzes/${quizId}`), {
          title: 'Seed quiz',
        });
      });
    });

    it('allows bounded owner list up to 50', async () => {
      const owner = testEnv.authenticatedContext(OWNER_UID);
      const quizzesQuery = query(
        collection(owner.firestore(), `users/${OWNER_UID}/quizzes`),
        limit(50),
      );
      await assertSucceeds(getDocs(quizzesQuery));
    });

    it('denies owner list above artifact max', async () => {
      const owner = testEnv.authenticatedContext(OWNER_UID);
      const quizzesQuery = query(
        collection(owner.firestore(), `users/${OWNER_UID}/quizzes`),
        limit(51),
      );
      await assertFails(getDocs(quizzesQuery));
    });

    it('denies client writes', async () => {
      const owner = testEnv.authenticatedContext(OWNER_UID);
      await assertFails(
        setDoc(doc(owner.firestore(), `users/${OWNER_UID}/quizzes/new-quiz`), {
          title: 'blocked',
        }),
      );
    });
  });

  describe('subject world progress', () => {
    const subjectWorldId = 'world-1';

    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(
          doc(context.firestore(), `users/${OWNER_UID}/subjectWorlds/${subjectWorldId}`),
          { title: 'Seed world' },
        );
      });
      await seedProgress(OWNER_UID, subjectWorldId);
    });

    it('allows owner get when progressId matches userId', async () => {
      const owner = testEnv.authenticatedContext(OWNER_UID);
      await assertSucceeds(
        getDoc(
          doc(
            owner.firestore(),
            `users/${OWNER_UID}/subjectWorlds/${subjectWorldId}/progress/${OWNER_UID}`,
          ),
        ),
      );
    });

    it('denies owner get when progressId does not match userId', async () => {
      const owner = testEnv.authenticatedContext(OWNER_UID);
      await assertFails(
        getDoc(
          doc(
            owner.firestore(),
            `users/${OWNER_UID}/subjectWorlds/${subjectWorldId}/progress/other-progress`,
          ),
        ),
      );
    });

    it('denies progress list and client writes', async () => {
      const owner = testEnv.authenticatedContext(OWNER_UID);
      const progressCollection = collection(
        owner.firestore(),
        `users/${OWNER_UID}/subjectWorlds/${subjectWorldId}/progress`,
      );

      await assertFails(getDocs(query(progressCollection, limit(1))));
      await assertFails(
        setDoc(
          doc(
            owner.firestore(),
            `users/${OWNER_UID}/subjectWorlds/${subjectWorldId}/progress/${OWNER_UID}`,
          ),
          { progress: { completedGates: ['gate-1'] } },
        ),
      );
    });

    it('denies other-user progress get', async () => {
      const other = testEnv.authenticatedContext(OTHER_UID);
      await assertFails(
        getDoc(
          doc(
            other.firestore(),
            `users/${OWNER_UID}/subjectWorlds/${subjectWorldId}/progress/${OWNER_UID}`,
          ),
        ),
      );
    });
  });

  describe('server-only collections', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const firestore = context.firestore();
        await setDoc(doc(firestore, `users/${OWNER_UID}/generationJobs/job-1`), {
          status: 'completed',
        });
        await setDoc(doc(firestore, `users/${OWNER_UID}/interactionStats/stat-1`), {
          totalSeconds: 120,
        });
        await setDoc(doc(firestore, `users/${OWNER_UID}/learningEvents/event-1`), {
          type: 'quiz_answer',
        });
      });
    });

    it('denies owner read, list, and write on generationJobs', async () => {
      const owner = testEnv.authenticatedContext(OWNER_UID);
      await assertFails(
        getDoc(doc(owner.firestore(), `users/${OWNER_UID}/generationJobs/job-1`)),
      );
      await assertFails(
        getDocs(
          query(collection(owner.firestore(), `users/${OWNER_UID}/generationJobs`), limit(1)),
        ),
      );
      await assertFails(
        setDoc(doc(owner.firestore(), `users/${OWNER_UID}/generationJobs/new-job`), {
          status: 'pending',
        }),
      );
    });

    it('denies owner read on interactionStats and learningEvents', async () => {
      const owner = testEnv.authenticatedContext(OWNER_UID);
      await assertFails(
        getDoc(doc(owner.firestore(), `users/${OWNER_UID}/interactionStats/stat-1`)),
      );
      await assertFails(
        getDoc(doc(owner.firestore(), `users/${OWNER_UID}/learningEvents/event-1`)),
      );
    });
  });

  describe('directory chat', () => {
    const directoryId = 'dir-1';

    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const firestore = context.firestore();
        await setDoc(doc(firestore, `users/${OWNER_UID}/directories/${directoryId}`), {
          name: 'Study folder',
          level: 0,
        });
        await setDoc(
          doc(firestore, `users/${OWNER_UID}/directories/${directoryId}/chat/thread`),
          { summary: 'Previous chat summary' },
        );
        await setDoc(
          doc(
            firestore,
            `users/${OWNER_UID}/directories/${directoryId}/chat/thread/messages/msg-1`,
          ),
          { role: 'user', content: 'Hello' },
        );
      });
    });

    it('denies owner read and write on chat thread and messages', async () => {
      const owner = testEnv.authenticatedContext(OWNER_UID);
      await assertFails(
        getDoc(
          doc(owner.firestore(), `users/${OWNER_UID}/directories/${directoryId}/chat/thread`),
        ),
      );
      await assertFails(
        getDoc(
          doc(
            owner.firestore(),
            `users/${OWNER_UID}/directories/${directoryId}/chat/thread/messages/msg-1`,
          ),
        ),
      );
      await assertFails(
        setDoc(
          doc(
            owner.firestore(),
            `users/${OWNER_UID}/directories/${directoryId}/chat/thread/messages/new-msg`,
          ),
          { role: 'user', content: 'blocked' },
        ),
      );
    });
  });
});
