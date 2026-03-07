export class SlideDeckPromptBuilder {
  static buildSlideOutlinePrompt(content: string, additionalPrompt?: string): string {
    const extra = additionalPrompt ? `\n\nAdditional instructions: ${additionalPrompt}` : '';

    return `You are an expert presentation designer. Based on the following document content, create a slide deck outline as a JSON array.

Each slide object MUST have exactly these three string fields:
- "title": a concise slide title (string)
- "content": 3-5 bullet points joined into a single string, each bullet on its own line prefixed with "• " (string, NOT an array)
- "speakerNotes": a 1-2 sentence note for the presenter (string)

Rules:
- First slide should be a title/overview slide.
- Last slide should be a summary/takeaways slide.
- Aim for 5-8 slides total.
- Keep bullet points concise (max 12 words each).
- ALL three fields ("title", "content", "speakerNotes") must be non-empty strings in every slide object.
- Return ONLY a valid JSON array, no markdown fences, no extra keys.${extra}

Document content:
${content}`;
  }

  static buildSlideImagePrompt(slideTitle: string, slideContent: string): string {
    return `Generate a visually appealing 16:9 landscape presentation slide image with a clean, modern, dark-themed design.

Slide title: "${slideTitle}"

Content to display on the slide:
${slideContent}

Layout requirements:
- 16:9 widescreen landscape orientation (wider than tall)
- Dark background (deep navy or charcoal)
- White/light text for readability
- Title should be small and compact (not dominant) — use a modest font size, positioned at the top-left or top-center
- Bullet points should be small and concise — use a compact font size, tightly spaced, occupying minimal vertical space
- The text block (title + bullets) should take up no more than 30% of the slide area, leaving the majority of space for visuals
- Subtle accent colors (purple or blue highlights)
- The diagram MUST occupy at least 50% of the slide area — make it large, detailed, and visually dominant

Mandatory visual elements (both must appear on every slide):
1. DIAGRAM — include a relevant diagram that best illustrates the slide content. Choose the most appropriate type for the topic: flowchart, mind map, timeline, bar/line chart, pie chart, Venn diagram, network graph, hierarchy tree, comparison table, or process loop. The diagram must be large, clearly labelled, and take up at least half the slide (e.g. the right half, or the full lower two-thirds).
2. THEMATIC IMAGE — include a small, thematic icon or illustration that visually represents the core concept of the slide (e.g. a brain for AI, gears for processes, a magnifying glass for analysis). Place it in a corner or alongside the title as a visual anchor.`;
  }
}
