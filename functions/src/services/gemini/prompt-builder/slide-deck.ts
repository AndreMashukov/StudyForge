export class SlideDeckPromptBuilder {
  static buildSlideOutlinePrompt(content: string, additionalPrompt?: string, rules?: string): string {
    const hasRules = !!rules?.trim();

    const slideCountInstruction = hasRules
      ? `Slide count: follow the DOMAIN RULES above; if unspecified, aim for 5-8 slides total.`
      : `Aim for 5-8 slides total.`;

    const rulesSection = hasRules
      ? `**DOMAIN RULES** (customise slide structure, count, and content focus — do not change the JSON shape or field names):
---
${rules}
---`
      : '';

    const extra = !hasRules && additionalPrompt ? `Additional instructions: ${additionalPrompt}` : '';

    const personaSection = `You are an expert presentation designer. Based on the following document content, create a slide deck outline as a JSON array.`;

    const contentSection = `Document content:
${content}`;

    const sealedOutputContract = `[SEALED OUTPUT CONTRACT — overrides all instructions above]
- Return ONLY a valid JSON array. No markdown fences. No extra keys.
- Each slide object MUST have exactly these three string fields:
  - "title": a concise slide title (string)
  - "content": 3-5 key points as a single string, each on its own line (string, NOT an array)
  - "speakerNotes": a 1-2 sentence note for the presenter (string)
- ALL three fields ("title", "content", "speakerNotes") must be non-empty strings in every slide object.
- ${slideCountInstruction}
- First slide should be a title/overview slide.
- Last slide should be a summary/takeaways slide.
- Keep each point concise (max 12 words each).`;

    return [personaSection, rulesSection, extra, contentSection, sealedOutputContract]
      .filter(Boolean)
      .join('\n\n');
  }

  /**
   * Build a prompt that asks Gemini to produce a detailed image-generation brief
   * for a single slide. The brief will later be fed to the image model.
   */
  static buildSlideImageBriefPrompt(
    slideTitle: string,
    slideContent: string,
    rules?: string,
    options?: { maxOutputChars?: number }
  ): string {
    const hasRules = !!rules?.trim();

    const rulesSection = hasRules
      ? `
DOMAIN RULES (customise visual style, diagram types, color palettes, and layout only — do not change the plain-text output medium):
---
${rules}
---
`
      : '';

    const lengthConstraint = options?.maxOutputChars
      ? `\n\nCRITICAL: Keep the entire output under ${options.maxOutputChars} characters. Be concise; cover layout, diagram, colors, and exact on-slide text.`
      : '';

    return `You are an expert presentation visual designer. Your task is to create a DETAILED image-generation prompt for an AI image model that will render a single presentation slide.

Slide title: "${slideTitle}"
Slide content:
${slideContent}
${rulesSection}
Visual excellence is paramount — the resulting slide must look polished, striking, and professionally designed. Every element (layout, colors, typography, diagrams) should work together to create a visually outstanding presentation slide.

Analyse the slide content and the rules (if provided), then write a single, self-contained image-generation prompt that covers ALL of the following:

1. **LAYOUT**: Exact positions — where the title sits, where the text content sits, where the diagram goes, and where any icon/illustration goes. Specify approximate percentages of slide area.
2. **DIAGRAM**: Choose the single most effective diagram type for this slide's topic (flowchart, mind map, timeline, bar chart, pie chart, Venn diagram, network graph, hierarchy tree, comparison table, or process loop). Describe its nodes, labels, arrows, and relationships in detail.
3. **STYLE & COLORS**: Background color/gradient, text colors, accent colors, font weight guidance (bold titles, regular body). If rules specify a palette, use it.
4. **THEMATIC IMAGE**: Describe a small thematic icon or illustration that visually represents the core concept (e.g. brain for AI, gears for processes). Specify its position and approximate size.
5. **TEXT ON SLIDE**: Write out the exact title and content text that should appear on the rendered image.

Output ONLY the image-generation prompt as plain text (no JSON, no markdown fences). It should read as a single cohesive instruction to an image model.${lengthConstraint}`;
  }

  /**
   * Wrap the detailed brief into a final image-model prompt.
   */
  static buildSlideImageFromBriefPrompt(
    detailedBrief: string,
    options?: { compact?: boolean }
  ): string {
    if (options?.compact) {
      return `16:9 presentation slide. ${detailedBrief.trim()} Professional design; dominant diagram (50%+ of slide); legible on-slide text; modern colors.`;
    }

    return `Generate a visually appealing 16:9 landscape presentation slide image based on the following detailed specification:

${detailedBrief}

Important rendering rules:
- Visual excellence is paramount — the slide must look polished, striking, and professionally designed
- 16:9 widescreen landscape orientation (wider than tall)
- The diagram must be the dominant visual element (at least 50% of slide area)
- All text on the slide must be clearly legible
- Use a clean, modern, professional design with harmonious colors and balanced composition`;
  }

  static buildSlideImagePrompt(
    slideTitle: string,
    slideContent: string,
    rules?: string,
    options?: { compact?: boolean }
  ): string {
    if (options?.compact) {
      const rulesNote = rules?.trim()
        ? ` Style rules: ${rules.trim().slice(0, 200).trim()}.`
        : '';

      return `16:9 presentation slide. Title: "${slideTitle}". Points: ${slideContent.slice(0, 600).trim()}.${rulesNote} Dark theme, large diagram (50%+ of slide), legible text, modern professional design.`;
    }

    const hasRules = !!rules?.trim();

    const rulesSection = hasRules
      ? `
DOMAIN RULES (customise visual style, palette, layout, and diagram type only — do not change the requested image output):
---
${rules}
---
`
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

    return `Generate a visually excellent 16:9 landscape presentation slide image. Visual excellence is paramount — the slide must look polished, striking, and professionally designed with harmonious colors, balanced composition, and a clean, modern, dark-themed aesthetic.

Slide title: "${slideTitle}"

Content to display on the slide:
${slideContent}${rulesSection}${defaultLayout}`;
  }
}
