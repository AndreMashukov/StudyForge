#!/usr/bin/env bash
# Regenerate quiz, flashcards, sequence quiz, and diagram quiz with explicit parent rules.
# Does NOT touch documents or slide decks.
#
# Usage:
#   regenerate-artifacts.sh DOC_ID LAB_DIR_ID "Lab Title" [ADDITIONAL_PROMPT_SUFFIX]
#
# Requires: STUDYFORGE_API_KEY, jq

set -euo pipefail

DOC_ID="${1:?DOC_ID required}"
LAB_DIR_ID="${2:?LAB_DIR_ID required}"
LAB_TITLE="${3:?LAB_TITLE required}"
EXTRA_PROMPT="${4:-Focus on exact resource names, verification steps, and lab-specific gotchas from this hands-on lab.}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=rule-ids.sh
source "${SCRIPT_DIR}/rule-ids.sh"

MODE="inherit-plus-explicit"

echo "Regenerating artifacts for: $LAB_TITLE"
echo "  doc=$DOC_ID dir=$LAB_DIR_ID"
echo "  rules: quiz=$RULE_QUIZ flashcards=$RULE_FLASHCARDS sequence=$RULE_SEQUENCE_QUIZ diagram=$RULE_DIAGRAM_QUIZ"

"${SCRIPT_DIR}/sf-api.sh" POST /quizzes/generate \
  "$(jq -nc \
    --argjson ids "[\"$DOC_ID\"]" \
    --arg dir "$LAB_DIR_ID" \
    --arg name "$LAB_TITLE Quiz" \
    --arg prompt "$EXTRA_PROMPT" \
    --arg mode "$MODE" \
    --arg quizRule "$RULE_QUIZ" \
    --arg followup "$RULE_FOLLOWUP" \
    '{
      documentIds: $ids,
      directoryId: $dir,
      quizName: $name,
      additionalPrompt: $prompt,
      ruleIds: [$quizRule],
      followupRuleIds: [$followup],
      ruleResolutionMode: $mode
    }')" | jq '{artifact: "quiz", success}'

"${SCRIPT_DIR}/sf-api.sh" POST /flashcard-sets/generate \
  "$(jq -nc \
    --argjson ids "[\"$DOC_ID\"]" \
    --arg dir "$LAB_DIR_ID" \
    --arg title "$LAB_TITLE Flashcards" \
    --arg mode "$MODE" \
    --arg fc "$RULE_FLASHCARDS" \
    '{
      documentIds: $ids,
      directoryId: $dir,
      title: $title,
      ruleIds: [$fc],
      ruleResolutionMode: $mode
    }')" | jq '{artifact: "flashcards", success}'

"${SCRIPT_DIR}/sf-api.sh" POST /sequence-quizzes/generate \
  "$(jq -nc \
    --argjson ids "[\"$DOC_ID\"]" \
    --arg dir "$LAB_DIR_ID" \
    --arg prompt "Focus on correct task order, setup dependencies, and verification sequence from this lab. $EXTRA_PROMPT" \
    --arg mode "$MODE" \
    --arg seq "$RULE_SEQUENCE_QUIZ" \
    '{
      documentIds: $ids,
      directoryId: $dir,
      additionalPrompt: $prompt,
      ruleIds: [$seq],
      ruleResolutionMode: $mode
    }')" | jq '{artifact: "sequence-quiz", success}'

"${SCRIPT_DIR}/sf-api.sh" POST /diagram-quizzes/generate \
  "$(jq -nc \
    --argjson ids "[\"$DOC_ID\"]" \
    --arg dir "$LAB_DIR_ID" \
    --arg mode "$MODE" \
    --arg diag "$RULE_DIAGRAM_QUIZ" \
    '{
      documentIds: $ids,
      directoryId: $dir,
      ruleIds: [$diag],
      ruleResolutionMode: $mode
    }')" | jq '{artifact: "diagram-quiz", success}'

echo "Done — generation is async; new artifacts appear as pending in the app."
