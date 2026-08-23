export function formatUsagePlanLabel(
  setupName: string | undefined,
): string | undefined {
  if (!setupName) {
    return undefined;
  }

  const name = setupName.trim();
  if (!name) {
    return undefined;
  }

  return /plan$/i.test(name) ? name : `${name} plan`;
}
