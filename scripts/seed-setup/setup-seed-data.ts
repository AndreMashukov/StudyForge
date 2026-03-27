#!/usr/bin/env node
/**
 * E2E test data setup — single script that wires the full local environment.
 *
 * Steps performed:
 *   1. Create / update Auth user with a fixed UID in the Auth emulator
 *   2. Ensure Firestore user document exists
 *   3. Create "Study Materials" directory in Firestore
 *   4. Create a general prompt rule and attach it to the directory
 *   5. Inject a "Machine Learning" document into the directory in Firestore
 *   6. Upload the document content file to the Storage emulator
 *
 * Usage:
 *   npx tsx scripts/seed-setup/setup-seed-data.ts
 *
 * All emulator hosts default to localhost — override via env if needed:
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
 *   FIRESTORE_EMULATOR_HOST=localhost:8080
 *   FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199
 *
 * Prerequisites:
 *   - Firebase emulators running (Auth:9099, Firestore:8080, Storage:9199)
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import { config } from 'dotenv';

config({ path: path.join(process.cwd(), '.env.local') });

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'code-insights-quiz-ai';
const STORAGE_BUCKET = 'code-insights-quiz-ai.appspot.com';
const TARGET_UID = '4ZBsEPIUJ4jrlylcXkg7t3sFdPZv';
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'Test123456!';
const DOC_ID = 'perfect-doc-ml';
const DIR_ID = 'e2e-study-materials';
const RULE_ID = 'e2e-prompt-rule';

const RULE_CONTENT = `Focus on key concepts and use clear, concise language in all responses.
When summarising or generating content from this material, highlight the most important ideas first.
Avoid unnecessary jargon and always explain technical terms when they first appear.`;

const DOCUMENT_CONTENT = `# Machine Learning

Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed. It focuses on developing computer programs that can access data and use it to learn for themselves.

## Key Concepts

### Supervised Learning
In supervised learning, the algorithm learns from labeled training data. Common applications include:
- **Classification**: Categorizing emails as spam or not spam
- **Regression**: Predicting house prices based on features

### Unsupervised Learning
Unsupervised learning finds hidden patterns in data without labeled responses. Examples include:
- **Clustering**: Grouping customers by purchasing behavior
- **Dimensionality Reduction**: Reducing features for visualization

### Neural Networks
Neural networks are inspired by the human brain. They consist of layers of interconnected nodes that process information. Deep learning uses neural networks with many hidden layers to solve complex problems like image recognition and natural language processing.

## Applications

Machine learning powers many modern applications:
- Recommendation systems (Netflix, Spotify)
- Voice assistants (Siri, Alexa)
- Fraud detection in finance
- Medical diagnosis support
- Autonomous vehicles

## Summary

Machine learning continues to transform industries by enabling computers to learn from data and make intelligent decisions. Understanding its fundamentals is essential for anyone working in technology.
`;


const DOC_ID_2 = 'doc-ruby-vs-js';
const DOC_ID_3 = 'doc-system-design';
const DOC_ID_4 = 'doc-react-patterns';

const DOCUMENT_CONTENT_2 = `# Ruby vs JavaScript

Ruby and JavaScript are both dynamic, object-oriented programming languages, but they differ significantly in their design philosophy and primary use cases.

## Ruby

Ruby was designed with developer happiness in mind. It follows the principle of least surprise, meaning the language behaves in ways most developers expect.

### Key Features
- **Pure OOP**: Everything in Ruby is an object, including numbers and booleans
- **Metaprogramming**: Ruby excels at dynamic code generation
- **Blocks and Iterators**: Elegant iteration patterns with blocks, procs, and lambdas
- **Rails Framework**: Ruby on Rails revolutionized web development with convention over configuration

## JavaScript

JavaScript was originally designed for browser scripting but has evolved into a full-stack language.

### Key Features
- **Asynchronous**: Event-driven, non-blocking I/O with Promises and async/await
- **Prototype-based**: Object inheritance through prototypal chain
- **Universal**: Runs in browsers and on servers (Node.js)
- **Ecosystem**: Largest package ecosystem via npm

## Comparison

| Aspect | Ruby | JavaScript |
|--------|------|------------|
| Primary Use | Web backend (Rails) | Full-stack, browser |
| Typing | Dynamic | Dynamic |
| Concurrency | Multi-threading | Event loop |
| Learning Curve | Moderate | Moderate |

## Conclusion

Both languages are powerful choices. Ruby shines in rapid web application development, while JavaScript's versatility and ubiquity make it indispensable for modern web development.
`;

const DOCUMENT_CONTENT_3 = `# System Design Fundamentals

System design is the process of defining the architecture, components, modules, interfaces, and data flow of a system to satisfy specified requirements.

## Core Concepts

### Scalability
Scalability is the ability of a system to handle growing amounts of work.
- **Horizontal Scaling**: Adding more machines (scale out)
- **Vertical Scaling**: Adding more power to existing machines (scale up)

### Load Balancing
Distributes incoming traffic across multiple servers to ensure no single server bears too much load.
- Round Robin
- Least Connections
- IP Hash

### Caching
Stores copies of frequently accessed data in fast storage.
- **Redis**: In-memory data store, ideal for caching and sessions
- **CDN**: Content Delivery Networks for static assets
- **Browser Cache**: Client-side caching

### Databases
- **SQL**: Relational databases (PostgreSQL, MySQL) — ACID compliant
- **NoSQL**: Document stores (MongoDB), Key-value (Redis), Column (Cassandra)
- **Sharding**: Partitioning data across multiple databases

### Microservices
Breaking applications into small, independent services that communicate via APIs.

## Design Patterns

1. **Event Sourcing**: Store state changes as events
2. **CQRS**: Separate read and write models
3. **Circuit Breaker**: Prevent cascading failures
4. **Saga Pattern**: Manage distributed transactions

## Summary

Good system design balances performance, reliability, scalability, and maintainability. Understanding these fundamentals is crucial for building production-grade systems.
`;

const DOCUMENT_CONTENT_4 = `# React Design Patterns

React design patterns are reusable solutions to common problems in React application development.

## Component Patterns

### Compound Components
Allows components to share state implicitly while giving users full control over rendering.

\`\`\`tsx
<Select>
  <Select.Option value="a">Option A</Select.Option>
  <Select.Option value="b">Option B</Select.Option>
</Select>
\`\`\`

### Render Props
Share code between components using a prop whose value is a function.

### Higher-Order Components (HOC)
Functions that take a component and return a new enhanced component.

## State Management Patterns

### Context + useReducer
Combine React Context with useReducer for scalable state management without external libraries.

### Custom Hooks
Extract and reuse stateful logic across components.

\`\`\`tsx
function useDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  // ...
  return { documents, loading };
}
\`\`\`

## Performance Patterns

- **Code Splitting**: Lazy load components with React.lazy and Suspense
- **Memoization**: Use React.memo, useMemo, useCallback to prevent re-renders
- **Virtualization**: Render only visible items in long lists (react-window)

## Summary

Mastering these patterns leads to more maintainable, performant, and scalable React applications. Choose patterns based on your specific use case rather than applying them universally.
`;

async function main() {
  // --- Emulator hosts (must be set before admin.initializeApp) ---
  process.env.FIREBASE_AUTH_EMULATOR_HOST =
    process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';
  process.env.FIRESTORE_EMULATOR_HOST =
    process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
  process.env.FIREBASE_STORAGE_EMULATOR_HOST =
    process.env.FIREBASE_STORAGE_EMULATOR_HOST || 'localhost:9199';

  console.log('Emulator hosts:');
  console.log(`  Auth:     ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
  console.log(`  Firestore: ${process.env.FIRESTORE_EMULATOR_HOST}`);
  console.log(`  Storage:  ${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`);

  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: PROJECT_ID,
      storageBucket: STORAGE_BUCKET,
    });
  }

  const auth = admin.auth();
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  // ── Step 1: Auth user ────────────────────────────────────────────────────
  console.log('\n[1] Setting up Auth user …');

  // Remove any existing user with the same email but a different UID
  try {
    const existingByEmail = await auth.getUserByEmail(TEST_EMAIL);
    if (existingByEmail.uid !== TARGET_UID) {
      console.log(`   Deleting existing user ${existingByEmail.uid} (wrong UID) …`);
      await auth.deleteUser(existingByEmail.uid);
    }
  } catch {
    // No user with that email — fine
  }

  // Create or update the user with the target UID
  try {
    await auth.getUser(TARGET_UID);
    await auth.updateUser(TARGET_UID, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      emailVerified: true,
    });
    console.log(`   ✅ Auth user updated: ${TEST_EMAIL} (UID: ${TARGET_UID})`);
  } catch {
    await auth.createUser({
      uid: TARGET_UID,
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      emailVerified: true,
    });
    console.log(`   ✅ Auth user created: ${TEST_EMAIL} (UID: ${TARGET_UID})`);
  }

  // ── Step 2: Firestore user document ─────────────────────────────────────
  console.log('\n[2] Ensuring Firestore user document …');
  await db.doc(`users/${TARGET_UID}`).set(
    { email: TEST_EMAIL, createdAt: now },
    { merge: true }
  );
  console.log('   ✅ User document ready');

  // ── Step 3: Directory ──────────────────────────────────────────────────
  console.log('\n[3] Creating "Study Materials" directory …');
  const dirData = {
    id: DIR_ID,
    userId: TARGET_UID,
    name: 'Study Materials',
    description: 'Core study materials for learning key CS and ML topics',
    parentId: null as string | null,
    path: '/Study Materials',
    level: 0,
    color: 'blue',
    documentCount: 4,
    childCount: 0,
    quizCount: 0,
    flashcardSetCount: 0,
    slideDeckCount: 0,
    ruleIds: [RULE_ID],
    createdAt: now,
    updatedAt: now,
  };
  await db.doc(`users/${TARGET_UID}/directories/${DIR_ID}`).set(dirData);
  console.log(`   ✅ Directory created: ${dirData.name} (ID: ${DIR_ID})`);

  // ── Step 4: Rule ─────────────────────────────────────────────────────────
  console.log('\n[4] Creating general prompt rule …');
  const ruleData = {
    id: RULE_ID,
    userId: TARGET_UID,
    name: 'General Study Rule',
    description: 'Default prompt rule for study materials',
    content: RULE_CONTENT,
    color: 'blue',
    tags: ['study', 'general'],
    applicableTo: ['prompt', 'quiz', 'flashcard', 'slide_deck'],
    isDefault: true,
    directoryIds: [DIR_ID],
    createdAt: now,
    updatedAt: now,
  };
  await db.doc(`users/${TARGET_UID}/rules/${RULE_ID}`).set(ruleData);
  console.log(`   ✅ Rule created: ${ruleData.name} (ID: ${RULE_ID})`);

  // ── Step 5: Firestore document metadata ─────────────────────────────────
  console.log('\n[5] Injecting document into Firestore …');
  console.log(`   User: ${TARGET_UID}`);
  console.log(`   Document ID: ${DOC_ID}`);

  const docData = {
    id: DOC_ID,
    userId: TARGET_UID,
    directoryId: DIR_ID,
    title: 'Machine Learning',
    description: 'A comprehensive introduction to machine learning concepts and applications.',
    sourceType: 'generated',
    status: 'active',
    wordCount: DOCUMENT_CONTENT.split(/\s+/).length,
    storagePath: `users/${TARGET_UID}/documents/${DOC_ID}/content.md`,
    storageUrl: `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}/v0/b/${STORAGE_BUCKET}/o/users%2F${encodeURIComponent(TARGET_UID)}%2Fdocuments%2F${DOC_ID}%2Fcontent.md?alt=media`,
    tags: ['machine-learning', 'AI', 'neural-networks'],
    createdAt: now,
    updatedAt: now,
  };

  await db.doc(`users/${TARGET_UID}/documents/${DOC_ID}`).set(docData);
  console.log('   ✅ Document metadata written');


  // ── Step 5b: Additional documents ───────────────────────────────────────
  console.log('\n[5b] Injecting additional documents ...');

  const additionalDocs = [
    {
      id: DOC_ID_2,
      title: 'Ruby vs JavaScript',
      description: 'A comparison of Ruby and JavaScript programming languages.',
      content: DOCUMENT_CONTENT_2,
      tags: ['ruby', 'javascript', 'programming', 'comparison'],
    },
    {
      id: DOC_ID_3,
      title: 'System Design Fundamentals',
      description: 'Core concepts and patterns for designing scalable systems.',
      content: DOCUMENT_CONTENT_3,
      tags: ['system-design', 'architecture', 'scalability'],
    },
    {
      id: DOC_ID_4,
      title: 'React Design Patterns',
      description: 'Reusable patterns for building scalable React applications.',
      content: DOCUMENT_CONTENT_4,
      tags: ['react', 'design-patterns', 'frontend'],
    },
  ];

  for (const doc of additionalDocs) {
    const additionalDocData = {
      id: doc.id,
      userId: TARGET_UID,
      directoryId: DIR_ID,
      title: doc.title,
      description: doc.description,
      sourceType: 'generated',
      status: 'active',
      wordCount: doc.content.split(/\s+/).length,
      storagePath: `users/${TARGET_UID}/documents/${doc.id}/content.md`,
      storageUrl: `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}/v0/b/${STORAGE_BUCKET}/o/users%2F${encodeURIComponent(TARGET_UID)}%2Fdocuments%2F${doc.id}%2Fcontent.md?alt=media`,
      tags: doc.tags,
      createdAt: now,
      updatedAt: now,
    };
    await db.doc(`users/${TARGET_UID}/documents/${doc.id}`).set(additionalDocData);

    const additionalFilePath = `users/${TARGET_UID}/documents/${doc.id}/content.md`;
    const additionalFile = admin.storage().bucket(STORAGE_BUCKET).file(additionalFilePath);
    await additionalFile.save(Buffer.from(doc.content, 'utf8'), {
      metadata: { contentType: 'text/markdown; charset=utf-8' },
      resumable: false,
    });
    console.log(`   ✅ Document seeded: ${doc.title} (ID: ${doc.id})`);
  }
  // ── Step 6: Storage content file ────────────────────────────────────────
  console.log('\n[6] Uploading content to Storage emulator …');
  const filePath = `users/${TARGET_UID}/documents/${DOC_ID}/content.md`;
  const file = admin.storage().bucket(STORAGE_BUCKET).file(filePath);

  await file.save(Buffer.from(DOCUMENT_CONTENT, 'utf8'), {
    metadata: { contentType: 'text/markdown; charset=utf-8' },
    resumable: false,
  });
  console.log(`   ✅ Content uploaded to: ${filePath}`);

  console.log('\n✅ E2E setup complete. Ready to run tests.');
}

main().catch((err) => {
  console.error('\n❌ Setup failed:', err);
  process.exit(1);
});
