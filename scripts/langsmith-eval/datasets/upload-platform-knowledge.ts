#!/usr/bin/env npx tsx
/**
 * Upload scripts/langsmith-eval/datasets/workspace-agent-platform-knowledge.json
 * to LangSmith. Does not attach LLM-as-judge evaluators.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'langsmith';
import { PLATFORM_KNOWLEDGE_DATASET_NAME } from '../shared/constants';
import { loadEvalEnv } from '../shared/env';

loadEvalEnv();

const DATASET_PATH = path.join(
  process.cwd(),
  'scripts/langsmith-eval/datasets/workspace-agent-platform-knowledge.json',
);

interface IDatasetExample {
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
      entry.inputs !== null &&
      'outputs' in entry &&
      typeof entry.outputs === 'object' &&
      entry.outputs !== null
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
    const existing = await client.readDataset({
      datasetName: PLATFORM_KNOWLEDGE_DATASET_NAME,
    });
    datasetId = existing.id;
    console.log(
      `Dataset already exists: ${PLATFORM_KNOWLEDGE_DATASET_NAME} (${datasetId})`,
    );
  } catch {
    const created = await client.createDataset(
      PLATFORM_KNOWLEDGE_DATASET_NAME,
      {
        description:
          'Workspace-agent platform knowledge: retrieval phrase recall and policy facts. Not the Final Response dataset.',
      },
    );
    datasetId = created.id;
    console.log(
      `Created dataset: ${PLATFORM_KNOWLEDGE_DATASET_NAME} (${datasetId})`,
    );
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

    if (existingId) {
      await client.updateExample(existingId, {
        inputs: example.inputs,
        outputs: example.outputs,
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
      },
    ]);
    created += 1;
  }

  console.log(
    `Upserted ${examples.length} examples to ${PLATFORM_KNOWLEDGE_DATASET_NAME} (${updated} updated, ${created} created)`,
  );
  console.log(`Project (traces): ${project}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
