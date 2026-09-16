import { Client, type Example } from 'langsmith';

export function readMaxExamples(): number | undefined {
  const raw = process.env.LANGSMITH_EVAL_MAX_EXAMPLES?.trim();
  if (!raw) {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error('LANGSMITH_EVAL_MAX_EXAMPLES must be a positive integer');
  }
  return parsed;
}

export async function loadDatasetEvalData(
  client: Client,
  datasetName: string,
  maxExamples: number | undefined,
): Promise<string | Example[]> {
  const dataset = await client.readDataset({ datasetName });
  if (maxExamples === undefined) {
    return datasetName;
  }

  const examples: Example[] = [];
  for await (const example of client.listExamples({
    datasetId: dataset.id,
  })) {
    examples.push(example);
    if (examples.length >= maxExamples) {
      break;
    }
  }
  if (examples.length === 0) {
    throw new Error(`No examples in dataset ${datasetName}`);
  }
  console.log(
    `Using first ${examples.length} example(s) (LANGSMITH_EVAL_MAX_EXAMPLES).`,
  );
  return examples;
}
