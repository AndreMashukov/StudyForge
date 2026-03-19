export const RulePromptBuilder = {
  buildGeneratePrompt(
    topic: string,
    description?: string,
    applicableTo?: string[],
  ): string {
    const descSection = description
      ? `\n**Description / Context:**\n${description}`
      : '';

    const applicableSection =
      applicableTo && applicableTo.length > 0
        ? `\n**Applicable to:** ${applicableTo.join(', ')}`
        : '';

    return `You are an expert instructional designer and prompt engineer. Your task is to create a high-quality rule that can be injected into AI prompts to improve their output quality.

A good rule is:
- Clear, specific, and actionable
- Written in the imperative mood (e.g., "Use bullet points", "Always include examples")
- Focused on a single concern (not a grab-bag of unrelated instructions)
- Self-contained — it should make sense without additional context
- Written in Markdown for readability (headings, lists, bold emphasis where helpful)

${descSection}${applicableSection}

**Topic:** ${topic}

**Instructions:**
1. Generate a concise, descriptive **name** for this rule (max 80 characters).
2. Write a short **description** summarising what the rule does (1-2 sentences, max 200 characters).
3. Write the full **content** of the rule in Markdown. The content should be detailed enough that an AI can follow it without ambiguity.

**CRITICAL OUTPUT RULES:**
- Return ONLY valid JSON — no markdown code blocks, no extra text.
- All string values must use double quotes.
- Do NOT use backticks or escaped quotes inside string values.

**Required JSON format:**
{"name": "Rule Name", "description": "Short description.", "content": "Full markdown rule content here."}

Generate the rule now:`;
  },

  buildImprovePrompt(
    existingContent: string,
    topic?: string,
    description?: string,
  ): string {
    const topicSection = topic ? `\n**Topic:** ${topic}` : '';
    const descSection = description
      ? `\n**Description / Context:** ${description}`
      : '';

    return `You are an expert instructional designer and prompt engineer. Your task is to improve an existing rule to make it clearer, more specific, and more effective.

A good rule is:
- Clear, specific, and actionable
- Written in the imperative mood
- Focused on a single concern
- Self-contained
- Written in Markdown for readability

${topicSection}${descSection}

**Existing rule content:**
---
${existingContent}
---

**Instructions:**
1. Generate an improved, concise **name** for this rule (max 80 characters).
2. Write an improved short **description** (1-2 sentences, max 200 characters).
3. Write the improved full **content** in Markdown. Preserve the original intent but enhance clarity, add missing specifics, remove ambiguity, and improve structure.

**CRITICAL OUTPUT RULES:**
- Return ONLY valid JSON — no markdown code blocks, no extra text.
- All string values must use double quotes.
- Do NOT use backticks or escaped quotes inside string values.

**Required JSON format:**
{"name": "Improved Rule Name", "description": "Improved description.", "content": "Improved full markdown rule content here."}

Improve the rule now:`;
  },
};
