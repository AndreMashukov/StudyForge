import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import {
  getJobStaleReferenceTime,
  getRecordStaleReferenceTime,
  isStaleByAge,
  STALE_ORPHAN_PENDING_MS,
  STALE_PROCESSING_JOB_MS,
} from './generation-stale';
import type { GenerationJob } from './generation-jobs';

describe('generation-stale', () => {
  it('treats processing jobs older than threshold as stale', () => {
    const now = Date.now();
    const job: GenerationJob = {
      id: 'job-1',
      kind: 'documentFromPrompt',
      status: 'processing',
      userId: 'user-1',
      directoryId: 'dir-1',
      recordId: 'doc-1',
      payloadStoragePath: 'payload.json',
      attempts: 1,
      startedAt: Timestamp.fromMillis(now - STALE_PROCESSING_JOB_MS - 1_000),
    };

    expect(isStaleByAge(getJobStaleReferenceTime(job), STALE_PROCESSING_JOB_MS, now)).toBe(true);
  });

  it('does not treat active processing jobs as stale', () => {
    const now = Date.now();
    const job: GenerationJob = {
      id: 'job-1',
      kind: 'documentFromPrompt',
      status: 'processing',
      userId: 'user-1',
      directoryId: 'dir-1',
      recordId: 'doc-1',
      payloadStoragePath: 'payload.json',
      attempts: 1,
      startedAt: Timestamp.fromMillis(now - 60_000),
    };

    expect(isStaleByAge(getJobStaleReferenceTime(job), STALE_PROCESSING_JOB_MS, now)).toBe(false);
  });

  it('treats orphan pending records older than threshold as stale', () => {
    const now = Date.now();
    const createdAt = Timestamp.fromMillis(now - STALE_ORPHAN_PENDING_MS - 1_000);
    expect(isStaleByAge(getRecordStaleReferenceTime(createdAt), STALE_ORPHAN_PENDING_MS, now)).toBe(true);
  });
});
