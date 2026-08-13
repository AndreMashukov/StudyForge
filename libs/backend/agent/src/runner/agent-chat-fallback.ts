export interface AgentToolOutcome {
  name: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function summarizeDirectoryEntry(entry: unknown): string | undefined {
  if (!isRecord(entry)) {
    return undefined;
  }
  const path = asString(entry.path);
  const name = asString(entry.name);
  if (path) {
    return path;
  }
  if (name) {
    return name;
  }
  return asString(entry.id);
}

function summarizeListDirectories(result: unknown): string {
  if (!Array.isArray(result)) {
    return 'Listed directories.';
  }
  const paths = result
    .map((entry) => summarizeDirectoryEntry(entry))
    .filter((value): value is string => Boolean(value));
  if (paths.length === 0) {
    return 'Listed directories: none found in scope.';
  }
  const preview = paths.slice(0, 12);
  const more =
    paths.length > preview.length
      ? ` (+${paths.length - preview.length} more)`
      : '';
  return `Listed ${paths.length} directories: ${preview.join(', ')}${more}`;
}

function summarizeListRules(result: unknown): string {
  if (!Array.isArray(result)) {
    return 'Listed rules.';
  }
  const names = result
    .map((entry) =>
      isRecord(entry)
        ? (asString(entry.name) ?? asString(entry.id))
        : undefined,
    )
    .filter((value): value is string => Boolean(value));
  if (names.length === 0) {
    return 'Listed rules: none found.';
  }
  const preview = names.slice(0, 12);
  const more =
    names.length > preview.length
      ? ` (+${names.length - preview.length} more)`
      : '';
  return `Listed ${names.length} rules: ${preview.join(', ')}${more}`;
}

function summarizeListDocuments(result: unknown): string {
  if (!Array.isArray(result)) {
    return 'Listed documents.';
  }
  const titles = result
    .map((entry) =>
      isRecord(entry)
        ? (asString(entry.title) ?? asString(entry.id))
        : undefined,
    )
    .filter((value): value is string => Boolean(value));
  if (titles.length === 0) {
    return 'Listed documents: none found in scope.';
  }
  const preview = titles.slice(0, 12);
  const more =
    titles.length > preview.length
      ? ` (+${titles.length - preview.length} more)`
      : '';
  return `Listed ${titles.length} documents: ${preview.join(', ')}${more}`;
}

function summarizeCreateDirectory(result: unknown): string {
  if (!isRecord(result)) {
    return 'Created a directory.';
  }
  const name = asString(result.name) ?? 'directory';
  const path = asString(result.path);
  return path
    ? `Created directory "${name}" at ${path}`
    : `Created directory "${name}"`;
}

function summarizeCreateRule(result: unknown): string {
  if (!isRecord(result)) {
    return 'Created a rule.';
  }
  const name = asString(result.name) ?? 'rule';
  return `Created rule "${name}"`;
}

function summarizeCreateDocument(result: unknown): string {
  if (!isRecord(result)) {
    return 'Started document generation.';
  }
  const title = asString(result.title) ?? 'document';
  return `Started generating document "${title}"`;
}

function summarizeAttachRule(result: unknown): string {
  if (!isRecord(result)) {
    return 'Attached rule to directory.';
  }
  const directoryId = asString(result.directoryId);
  const ruleId = asString(result.ruleId);
  if (directoryId && ruleId) {
    return `Attached rule ${ruleId} to directory ${directoryId}`;
  }
  return 'Attached rule to directory.';
}

function summarizeDetachRule(result: unknown): string {
  if (!isRecord(result)) {
    return 'Detached rule from directory.';
  }
  const directoryId = asString(result.directoryId);
  const ruleId = asString(result.ruleId);
  if (directoryId && ruleId) {
    return `Detached rule ${ruleId} from directory ${directoryId}`;
  }
  return 'Detached rule from directory.';
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function summarizeQuizStatistics(result: unknown): string {
  if (!isRecord(result)) {
    return 'Retrieved quiz statistics.';
  }
  const metrics = isRecord(result.metrics) ? result.metrics : undefined;
  const accuracy = metrics ? asNumber(metrics.accuracyPercentage) : undefined;
  const quizCount = asNumber(result.quizCount);
  const parts: string[] = [];
  if (quizCount !== undefined) {
    parts.push(`${quizCount} quizzes with attempts`);
  }
  if (accuracy !== undefined) {
    parts.push(`${accuracy}% accuracy`);
  }
  if (parts.length === 0) {
    return 'Retrieved quiz statistics.';
  }
  return `Retrieved quiz statistics: ${parts.join(', ')}.`;
}

function summarizeQuizAnswerDetails(result: unknown): string {
  if (!isRecord(result)) {
    return 'Retrieved quiz answer details.';
  }
  if (Array.isArray(result.questionBreakdown)) {
    const wrongCount = asNumber(result.wrongAnswerCount) ?? 0;
    const questionCount = result.questionBreakdown.length;
    return `Retrieved answer details for ${questionCount} questions (${wrongCount} wrong answers).`;
  }
  const wrongCount = asNumber(result.wrongAnswerCount);
  if (wrongCount !== undefined) {
    return `Retrieved ${wrongCount} recent wrong answers.`;
  }
  return 'Retrieved quiz answer details.';
}

function summarizeToolOutcome(outcome: AgentToolOutcome): string {
  if (!outcome.ok) {
    return `${outcome.name} failed: ${outcome.error ?? 'unknown error'}`;
  }

  switch (outcome.name) {
    case 'list_directories':
      return summarizeListDirectories(outcome.result);
    case 'list_rules':
      return summarizeListRules(outcome.result);
    case 'list_documents':
      return summarizeListDocuments(outcome.result);
    case 'list_quizzes':
      return Array.isArray(outcome.result)
        ? `Listed ${outcome.result.length} quizzes.`
        : 'Listed quizzes.';
    case 'get_quiz_statistics':
      return summarizeQuizStatistics(outcome.result);
    case 'get_quiz_answer_details':
      return summarizeQuizAnswerDetails(outcome.result);
    case 'create_directory':
      return summarizeCreateDirectory(outcome.result);
    case 'create_rule':
      return summarizeCreateRule(outcome.result);
    case 'update_rule':
      return isRecord(outcome.result) && asString(outcome.result.name)
        ? `Updated rule "${asString(outcome.result.name)}"`
        : 'Updated a rule.';
    case 'create_document':
      return summarizeCreateDocument(outcome.result);
    case 'attach_rule_to_directory':
      return summarizeAttachRule(outcome.result);
    case 'detach_rule_from_directory':
      return summarizeDetachRule(outcome.result);
    case 'search_knowledge':
      return Array.isArray(outcome.result)
        ? `Retrieved ${outcome.result.length} knowledge chunks.`
        : 'Searched knowledge.';
    case 'generate_quiz':
      return 'Started quiz generation.';
    case 'propose_delete_rule':
    case 'propose_delete_directory':
    case 'propose_delete_documents':
      return 'Proposed a delete for confirmation.';
    default:
      return `Completed ${outcome.name}.`;
  }
}

/**
 * When the model finishes tool rounds with empty content, synthesize a useful
 * user-facing reply from tool outcomes instead of a generic failure line.
 */
export function buildEmptyModelFallback(outcomes: AgentToolOutcome[]): string {
  if (outcomes.length === 0) {
    return 'I finished, but the model returned no text for this turn.';
  }

  const lines = outcomes.map((outcome) => `- ${summarizeToolOutcome(outcome)}`);
  return ['Here is what I found from the tool steps:', ...lines].join('\n');
}
