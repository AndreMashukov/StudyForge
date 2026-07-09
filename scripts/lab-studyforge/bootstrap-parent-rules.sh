#!/usr/bin/env bash
# Create and attach GCP lab parent rules to lF9Hgmxxc42NdXKqKadY (idempotent).
# Requires: STUDYFORGE_API_KEY, jq, curl

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RULES_PARENT_DIR="lF9Hgmxxc42NdXKqKadY"

sf() { "$SCRIPT_DIR/sf-api.sh" "$@"; }

create_and_attach_rule() {
  local name="$1"
  local color="$2"
  local tags_json="$3"
  local applicable_json="$4"
  local content="$5"

  local existing_id
  existing_id="$(sf GET /rules | jq -r --arg n "$name" '.data[] | select(.name == $n) | .id' | head -1)"

  local rule_id
  if [[ -n "$existing_id" ]]; then
    echo "  ↷ Rule exists: $name ($existing_id)"
    rule_id="$existing_id"
  else
    local payload
    payload="$(jq -nc \
      --arg name "$name" \
      --arg color "$color" \
      --arg content "$content" \
      --argjson tags "$tags_json" \
      --argjson applicableTo "$applicable_json" \
      '{name: $name, content: $content, color: $color, tags: $tags, applicableTo: $applicableTo}')"
    rule_id="$(sf POST /rules "$payload" | jq -r '.data.id')"
    echo "  ✓ Created: $name ($rule_id)"
  fi

  sf POST "/directories/$RULES_PARENT_DIR/rules" "$(jq -nc --arg ruleId "$rule_id" '{ruleId: $ruleId}')" >/dev/null
  echo "  ✓ Attached to parent directory"
}

echo "Bootstrapping GCP lab parent rules → $RULES_PARENT_DIR"
echo ""

create_and_attach_rule \
  "GCP Lab — Study Document" \
  "blue" \
  '["gcp-lab", "document", "hands-on"]' \
  '["prompt", "upload"]' \
  "You are writing a study document for a Google Cloud / Qwiklabs hands-on lab.

Structure:
1. Task summaries — one subsection per task with property tables
2. Command reference — fenced bash blocks for every command
3. Verification checklist — confirm after each task
4. Common mistakes — scorer failures
5. Key concepts — exam-worthy takeaways

Preserve exact resource names. Use Mermaid flowchart for architecture. Never invent GCP resource names."

create_and_attach_rule \
  "GCP Lab — Quiz" \
  "purple" \
  '["gcp-lab", "quiz"]' \
  '["quiz"]' \
  "Generate quiz questions for a GCP hands-on lab. Test exact config values, behavior under load, and verification steps. All options similar length; vary correct answer positions. Wrong answers = plausible lab misconceptions. Avoid generic cloud trivia."

create_and_attach_rule \
  "GCP Lab — Flashcards" \
  "green" \
  '["gcp-lab", "flashcard"]' \
  '["flashcard", "flashcard_desc"]' \
  "Create flashcards for a GCP hands-on lab. Front: term or resource name. Back: concise definition with exact lab values. Cover named resources, IP ranges, balancing modes, network tags, and CLI commands. Backs under 2 sentences."

create_and_attach_rule \
  "GCP Lab — Diagram Quiz" \
  "orange" \
  '["gcp-lab", "diagram"]' \
  '["diagram_quiz"]' \
  "Generate diagram quiz items for GCP network labs. Show traffic flow, firewall paths, multi-region failover, Cloud Armor enforcement. Labels use exact lab resource names."

create_and_attach_rule \
  "GCP Lab — Sequence Quiz" \
  "yellow" \
  '["gcp-lab", "sequence"]' \
  '["sequence_quiz"]' \
  "Generate sequence quiz items for GCP hands-on labs. Focus on correct task order and setup dependencies: firewalls before templates, templates before MIGs, MIGs before load balancer, LB healthy before stress test, stress test before Cloud Armor. Steps use exact lab resource names. 4-6 questions per lab."

create_and_attach_rule \
  "GCP Lab — Slide Deck" \
  "red" \
  '["gcp-lab", "slides", "gcp-design"]' \
  '["slide_deck"]' \
  "Generate slide deck outlines for GCP labs. One concept per slide, max 3 bullets, exact resource names. GCP design language: palette blue #4285F4, green #34A853, yellow #FBBC04, red #EA4335, grey #F1F3F4 backgrounds. Flat vector style with GCP product icons (Compute Engine, VPC, Load Balancing, Cloud Armor, Logging). When additionalPrompt specifies exactly N slides, produce exactly N in order."

create_and_attach_rule \
  "GCP Lab — Follow-up" \
  "indigo" \
  '["gcp-lab", "followup", "chat"]' \
  '["followup", "chat"]' \
  "GCP lab tutor. Reference exact resource names. Explain why each step is needed. For progress-check failures, compare student names to lab spec. Suggest verification commands. Keep answers focused."

echo ""
echo "Done. Verify:"
sf GET "/directories/$RULES_PARENT_DIR/rules" | jq '.data.rules | map({id, name})'
