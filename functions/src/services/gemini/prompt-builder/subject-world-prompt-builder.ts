import { ScrapedContent } from '@shared-types';

export class SubjectWorldPromptBuilder {
  static buildSubjectWorldPrompt(
    content: ScrapedContent,
    documentIds: string[],
    additionalPrompt?: string
  ): string {
    const docList = documentIds.map((id, i) => `${i + 1}. ${id}`).join('\n');
    const rulesSection = additionalPrompt?.trim()
      ? `\n**ADDITIONAL RULES:**\n${additionalPrompt.trim()}\n`
      : '';

    return `You are an expert educational game designer. Generate a JSON world specification for a browser-based voxel exploration game that teaches the source material below.

${rulesSection}

**SOURCE DOCUMENT IDS:**
${docList}

**SOURCE MATERIAL:**
Title: ${content.title}
Word count: ${content.wordCount}

${content.content}

**TASK:**
Create an explorable learning world with zones (mapped to document sections), points of interest (POIs), quiz gates, and quests.

**OUTPUT FORMAT:**
Return ONLY valid JSON matching this structure:
{
  "title": "World title",
  "theme": "voxel",
  "spawn": { "zoneId": "zone-1", "position": { "x": 0, "y": 1.6, "z": 0 } },
  "zones": [
    {
      "id": "zone-1",
      "name": "Zone name",
      "description": "What the learner explores here",
      "sectionHeading": "Matching H2/H3 heading",
      "layout": "hub",
      "origin": { "x": 0, "y": 0, "z": 0 },
      "size": { "width": 12, "depth": 12, "height": 4 },
      "connections": [{ "toZoneId": "zone-2", "label": "Path name" }],
      "documentId": "${documentIds[0] ?? 'doc-1'}"
    }
  ],
  "pois": [
    {
      "id": "poi-1",
      "label": "Concept name",
      "summary": "1-2 sentence summary",
      "fullExcerpt": "Longer excerpt from source",
      "position": { "x": 2, "y": 1, "z": 2 },
      "zoneId": "zone-1",
      "type": "read",
      "sourceRef": {
        "documentId": "${documentIds[0] ?? 'doc-1'}",
        "sectionHeading": "Section heading",
        "excerpt": "Source excerpt"
      }
    }
  ],
  "gates": [
    {
      "id": "gate-1",
      "label": "Knowledge gate",
      "zoneId": "zone-1",
      "position": { "x": 5, "y": 1, "z": 0 },
      "type": "quiz",
      "question": "Question from source material",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "Why the answer is correct",
      "unlocksZoneId": "zone-2",
      "sourceRef": {
        "documentId": "${documentIds[0] ?? 'doc-1'}",
        "sectionHeading": "Section heading",
        "excerpt": "Relevant excerpt"
      }
    }
  ],
  "quests": [
    {
      "id": "quest-1",
      "title": "Quest title",
      "description": "What to accomplish",
      "poiIds": ["poi-1"],
      "gateIds": ["gate-1"],
      "zoneIds": ["zone-1", "zone-2"]
    }
  ]
}

**CONSTRAINTS:**
- 3 to 6 zones mapped to major sections across all documents
- 6 to 16 POIs with accurate summaries grounded in the source
- 2 to 6 quiz gates that unlock progression
- 1 to 4 quests tying POIs and gates together
- Use theme "voxel" unless rules specify otherwise
- layout must be one of: hub, room, path, platform
- poi type must be one of: read, collectible, checkpoint
- gate type must be one of: quiz, door, bridge
- Keep coordinates within -40 to 40 on x/z
- Do not wrap JSON in markdown code fences

Generate the complete world spec now:`;
  }
}
