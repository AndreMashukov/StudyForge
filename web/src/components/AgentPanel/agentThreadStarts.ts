/**
 * Threads whose first startAgentTurn call is still in flight. A panel that
 * remounts in that window reads the thread as not found; it must keep the
 * thread selected and re-read it once the start lands, not forget it.
 */
const startingThreadIds = new Set<string>();

export function markThreadStarting(threadId: string): void {
  startingThreadIds.add(threadId);
}

export function clearThreadStarting(threadId: string): void {
  startingThreadIds.delete(threadId);
}

export function isThreadStarting(threadId: string): boolean {
  return startingThreadIds.has(threadId);
}
