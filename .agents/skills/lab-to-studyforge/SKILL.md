---
name: lab-to-studyforge
description: >-
  Convert GCP/Qwiklabs lab instructions into StudyForge learning materials via
  the External API and local interactive HTML explainers. Creates a per-lab
  subdirectory, uploads a study document, generates artifacts (quiz, flashcards,
  sequence quiz, diagram quiz, slide deck with local GCP images), attaching parent
  prompt rules explicitly on every generation call. Use when the user asks to
  publish a lab to StudyForge, create lab study materials, or run /lab-to-studyforge.
---

# lab-to-studyforge

Read and follow [the shared lab-to-studyforge workflow](../../../.claude/skills/lab-to-studyforge/SKILL.md). Resolve its supporting files relative to that workflow. Treat Claude slash commands and `$ARGUMENTS` as the corresponding Codex skills and the user’s supplied arguments. Apply the current session’s permissions and tool instructions.
