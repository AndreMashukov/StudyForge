#!/usr/bin/env npx tsx
/**
 * Upload scripts/langsmith-eval/datasets/workspace-agent-final-response.json
 * to LangSmith. Uses LANGSMITH_API_KEY and LANGSMITH_PROJECT from env files.
 */
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import { Client } from 'langsmith';

config({ path: path.join(process.cwd(), '.env.local') });
config({ path: path.join(process.cwd(), 'functions/.env.local') });

const DATASET_NAME = 'Workspace Agent: Final Response';
const DATASET_PATH = path.join(
  process.cwd(),
  'scripts/langsmith-eval/datasets/workspace-agent-final-response.json',
);

interface IDatasetExample {
  trace_id?: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
}

function readExamples(): IDatasetExample[] {
  const parsed: unknown = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8'));
  if (!Array.isArray(parsed)) {
    throw new Error('Dataset file must be a JSON array');
  }
  return parsed.filter((entry): entry is IDatasetExample => {
    return (
      typeof entry === 'object' &&
      entry !== null &&
      'inputs' in entry &&
      typeof entry.inputs === 'object' &&
      entry.inputs !== null
    );
  });
}

async function main(): Promise<void> {
  const apiKey = process.env.LANGSMITH_API_KEY;
  const project = process.env.LANGSMITH_PROJECT;
  if (!apiKey || apiKey.includes('your-langsmith')) {
    throw new Error('LANGSMITH_API_KEY is missing');
  }
  if (!project || project.includes('your-langsmith')) {
    throw new Error('LANGSMITH_PROJECT is missing');
  }

  const examples = readExamples();
  const client = new Client({ apiKey });

  let datasetId: string;
  try {
    const existing = await client.readDataset({ datasetName: DATASET_NAME });
    datasetId = existing.id;
    console.log(`Dataset already exists: ${DATASET_NAME} (${datasetId})`);
  } catch {
    const created = await client.createDataset(DATASET_NAME, {
      description:
        'Labeled workspace-agent final_response examples from browser QA traces.',
    });
    datasetId = created.id;
    console.log(`Created dataset: ${DATASET_NAME} (${datasetId})`);
  }

  const existingByCaseId = new Map<string, string>();
  for await (const existing of client.listExamples({ datasetId })) {
    const outputs = existing.outputs;
    const caseId =
      outputs &&
      typeof outputs === 'object' &&
      'caseId' in outputs &&
      typeof outputs.caseId === 'string'
        ? outputs.caseId
        : undefined;
    if (caseId && existing.id) {
      existingByCaseId.set(caseId, existing.id);
    }
  }

  let updated = 0;
  let created = 0;
  for (const example of examples) {
    const caseId =
      typeof example.outputs.caseId === 'string'
        ? example.outputs.caseId
        : undefined;
    const existingId = caseId ? existingByCaseId.get(caseId) : undefined;
    const metadata = example.trace_id
      ? { trace_id: example.trace_id }
      : undefined;

    if (existingId) {
      await client.updateExample(existingId, {
        inputs: example.inputs,
        outputs: example.outputs,
        metadata,
        dataset_id: datasetId,
      });
      updated += 1;
      continue;
    }

    await client.createExamples([
      {
        dataset_id: datasetId,
        inputs: example.inputs,
        outputs: example.outputs,
        metadata,
      },
    ]);
    created += 1;
  }

  console.log(
    `Upserted ${examples.length} examples to ${DATASET_NAME} (${updated} updated, ${created} created)`,
  );
  console.log(`Project (traces): ${project}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
