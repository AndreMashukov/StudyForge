#!/usr/bin/env bash
# Resolve parent lab rule IDs from lF9Hgmxxc42NdXKqKadY (source in shell: rule-ids.sh)
# Requires: STUDYFORGE_API_KEY, jq, sf-api.sh on PATH or SCRIPT_DIR

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PARENT_DIR="lF9Hgmxxc42NdXKqKadY"

# Pipe directly — rule bodies contain control chars that break jq when stored in bash vars
_rules_json="$("${SCRIPT_DIR}/sf-api.sh" GET "/directories/${PARENT_DIR}/rules" \
  | jq -c '[.data.rules[]? | {id, name}]')"

_rule_id() {
  local pattern="$1"
  echo "$_rules_json" | jq -r --arg p "$pattern" '.[] | select(.name | test($p)) | .id' | head -1
}

export RULE_STUDY_DOCUMENT="$(_rule_id 'Study Document$')"
export RULE_QUIZ="$(_rule_id 'ACE — Quiz$')"
export RULE_FLASHCARDS="$(_rule_id 'ACE — Flashcards$')"
export RULE_FLASHCARD_DESC="$(_rule_id 'Flashcard Description')"
export RULE_SEQUENCE_QUIZ="$(_rule_id 'Sequence Quiz$')"
export RULE_DIAGRAM_QUIZ="$(_rule_id 'Diagram Quiz$')"
export RULE_SLIDE_DECK="$(_rule_id 'Slide Deck$')"
export RULE_FOLLOWUP="$(_rule_id 'Follow-up$')"

missing=0
for var in RULE_QUIZ RULE_FLASHCARDS RULE_SEQUENCE_QUIZ RULE_DIAGRAM_QUIZ; do
  eval "val=\${$var:-}"
  if [[ -z "$val" || "$val" == "null" ]]; then
    echo "Missing parent rule for $var — run bootstrap-parent-rules.sh" >&2
    missing=1
  fi
done
[[ "$missing" -eq 0 ]] || exit 1
