import type { DirectoryChatMessage } from '@shared-types';
import {
  SUMMARY_MAX_CHARS,
  SUMMARY_RECENT_MESSAGE_COUNT,
  SUMMARY_TRIGGER_MESSAGE_COUNT,
} from '../directory-chat-constants';

export function buildRollingSummary(
  messages: DirectoryChatMessage[],
  currentSummary?: string
): string | undefined {
  if (messages.length <= SUMMARY_TRIGGER_MESSAGE_COUNT) {
    return currentSummary;
  }

  const olderMessages = messages.slice(0, -SUMMARY_RECENT_MESSAGE_COUNT);
  const summaryText = olderMessages
    .map((message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`)
    .join('\n\n');

  return summaryText.length > SUMMARY_MAX_CHARS
    ? `${summaryText.slice(summaryText.length - SUMMARY_MAX_CHARS)}\n[Earlier chat compressed]`
    : summaryText;
}
