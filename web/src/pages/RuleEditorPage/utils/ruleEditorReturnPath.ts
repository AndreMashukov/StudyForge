import { buildDirectoryPathWithOptionalName } from '../../../utils/directoryUrl';

const GLOBAL_RULES_PATH = '/rules';

/** Where to go after leaving the rule editor (Back, save, delete). */
export function resolveRuleEditorReturnPath(directoryId: string | null | undefined): string {
  const trimmed = directoryId?.trim();
  if (trimmed) {
    return buildDirectoryPathWithOptionalName(trimmed, undefined, 'rules');
  }
  return GLOBAL_RULES_PATH;
}