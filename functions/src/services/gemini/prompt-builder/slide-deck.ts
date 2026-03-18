export class SlideDeckPromptBuilder {
  static buildSlideOutlinePrompt(content: string, additionalPrompt?: string, rules?: string): string {
    const hasRules = !!rules?.trim();

    const slideCountInstruction = hasRules
      ? `- The number of slides and their structure is determined by the injected rules — follow them exactly.
- If the rules do not specify the number of slides, aim for 5-8 slides total.`
      : `- Aim for 5-8 slides total.`;

    const rulesSection = hasRules
      ? `\nINJECTED RULES (take priority over default instructions):\n---\n${rules}\n---\n`
      : '';

    const extra = !hasRules && additionalPrompt ? `\n\nAdditional instructions: ${additionalPrompt}` : '';

    return `You are an expert presentation designer. Based on the following document content, create a slide deck outline as a JSON array.

Each slide object MUST have exactly these three string fields:
- "title": a concise slide title (string)
- "content": 3-5 key points as a single string, each on its own line (string, NOT an array)
- "speakerNotes": a 1-2 sentence note for the presenter (string)

Rules:
- First slide should be a title/overview slide.
- Last slide should be a summary/takeaways slide.
${slideCountInstruction}
- Keep each point concise (max 12 words each).
- ALL three fields ("title", "content", "speakerNotes") must be non-empty strings in every slide object.
- Return ONLY a valid JSON array, no markdown fences, no extra keys.${rulesSection}${extra}

Document content:
${content}`;
  }

  /**
   * Build a prompt that asks Gemini to produce a detailed image-generation brief
   * for a single slide. The brief will later be fed to the image model.
   */
  static buildSlideImageBriefPrompt(slideTitle: string, slideContent: string, rules?: string): string {
    const hasRules = !!rules?.trim();

    const rulesSection = hasRules
      ? `\nINJECTED RULES (these rules define the visual style, diagram types, color palettes, and layout. Follow them exactly):\n---\n${rules}\n---\n`
      : '';

    return `You are an expert presentation visual designer. Your task is to create a DETAILED image-generation prompt for an AI image model that will render a single presentation slide.

Slide title: "${slideTitle}"
Slide content:
${slideContent}
${rulesSection}
Analyse the slide content and the rules (if provided), then write a single, self-contained image-generation prompt that covers ALL of the following:

1. **LAYOUT**: Exact positions — where the title sits, where the text content sits, where the diagram goes, and where any icon/illustration goes. Specify approximate percentages of slide area.
2. **DIAGRAM**: Choose the single most effective diagram type for this slide's topic (flowchart, mind map, timeline, bar chart, pie chart, Venn diagram, network graph, hierarchy tree, comparison table, or process loop). Describe its nodes, labels, arrows, and relationships in detail.
3. **STYLE & COLORS**: Background color/gradient, text colors, accent colors, font weight guidance (bold titles, regular body). If rules specify a palette, use it.
4. **THEMATIC IMAGE**: Describe a small thematic icon or illustration that visually represents the core concept (e.g. brain for AI, gears for processes). Specify its position and approximate size.
5. **TEXT ON SLIDE**: Write out the exact title and content text that should appear on the rendered image.

Output ONLY the image-generation prompt as plain text (no JSON, no markdown fences). It should read as a single cohesive instruction to an image model.`;
  }

  /**
   * Wrap the detailed brief into a final image-model prompt.
   */
  static buildSlideImageFromBriefPrompt(detailedBrief: string): string {
    return `Generate a visually appealing 16:9 landscape presentation slide image based on the following detailed specification:

${detailedBrief}

Important rendering rules:
- 16:9 widescreen landscape orientation (wider than tall)
- The diagram must be the dominant visual element (at least 50% of slide area)
- All text on the slide must be clearly legible
- Use a clean, modern, professional design`;
  }

  static buildSlideImagePrompt(slideTitle: string, slideContent: string, rules?: string): string {
    const hasRules = !!rules?.trim();

    const rulesSection = hasRules
      ? `\nINJECTED RULES (take priority over default layout/visual instructions below):\n---\n${rules}\n---\n`
      : '';

    const defaultLayout = hasRules ? '' : `
Layout requirements:
- 16:9 widescreen landscape orientation (wider than tall)
- Dark background (deep navy or charcoal)
- White/light text for readability
- Title should be small and compact (not dominant) — use a modest font size, positioned at the top-left or top-center
- Content text should be small and concise — use a compact font size, tightly spaced, occupying minimal vertical space
- The text block (title + content) should take up no more than 30% of the slide area, leaving the majority of space for visuals
- Subtle accent colors (purple or blue highlights)
- The diagram MUST occupy at least 50% of the slide area — make it large, detailed, and visually dominant

Mandatory visual elements (both must appear on every slide):
1. DIAGRAM — include a relevant diagram that best illustrates the slide content. Choose the most appropriate type for the topic: flowchart, mind map, timeline, bar/line chart, pie chart, Venn diagram, network graph, hierarchy tree, comparison table, or process loop. The diagram must be large, clearly labelled, and take up at least half the slide (e.g. the right half, or the full lower two-thirds).
2. THEMATIC IMAGE — include a small, thematic icon or illustration that visually represents the core concept of the slide (e.g. a brain for AI, gears for processes, a magnifying glass for analysis). Place it in a corner or alongside the title as a visual anchor.`;

    return `Generate a visually appealing 16:9 landscape presentation slide image with a clean, modern, dark-themed design.

Slide title: "${slideTitle}"

Content to display on the slide:
${slideContent}${rulesSection}${defaultLayout}`;
  }
}
