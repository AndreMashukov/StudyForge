export class SlideDeckPromptBuilder {
  static buildSlideOutlinePrompt(content: string, additionalPrompt?: string): string {
    const extra = additionalPrompt ? `\n\nAdditional instructions: ${additionalPrompt}` : '';

    return `You are an expert presentation designer. Based on the following document content, create a slide deck outline as a JSON array.

Each slide object must have:
- "title": a concise slide title
- "content": 3-5 bullet points (each on its own line, prefixed with "• ")
- "speakerNotes": a 1-2 sentence note for the presenter

Rules:
- First slide should be a title/overview slide.
- Last slide should be a summary/takeaways slide.
- Aim for 5-8 slides total.
- Keep bullet points concise (max 12 words each).
- Return ONLY a valid JSON array, no markdown fences.${extra}

Document content:
${content}`;
  }

  static buildSlideImagePrompt(slideTitle: string, slideContent: string): string {
    return `Generate a visually appealing presentation slide image with a clean, modern, dark-themed design.

Slide title: "${slideTitle}"

Content to display on the slide:
${slideContent}

Requirements:
- Dark background (deep navy or charcoal)
- White/light text for readability
- Professional typography hierarchy (large title, smaller bullets)
- Subtle accent colors (purple or blue highlights)
- Clean, minimal layout with adequate spacing
- The text must be readable and accurately rendered on the slide`;
  }
}
