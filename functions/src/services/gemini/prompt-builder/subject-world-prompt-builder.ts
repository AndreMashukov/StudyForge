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
Create an explorable learning world with zones (mapped to document sections), points of interest (POIs), quiz gates, and quests. The client renders zones as separate floor areas connected by portals; gates with unlocksZoneId block access to later zones until passed.

**THEME (pick one — do not default to voxel unless content is generic):**
- museum — arts, history, literature, galleries, archives
- lab — science, experiments, medicine, engineering
- outdoor — nature, geography, ecology, field study
- space — astronomy, physics, cosmology
- voxel — generic / mixed topics when no other theme fits

**PROGRESSION & ZONE LAYOUT (required):**
- Use 3 to 6 zones; zone 1 is the spawn hub (layout "hub")
- Place zones side-by-side with a **2-unit gap** between footprints (e.g. if zone-1 is origin {x:0,z:0} width 12, place zone-2 at origin.x = 14, same z)
- **Do not overlap** zone footprints; keep all coordinates within -40 to 40 on x/z
- Zone 1 must include at least one POI before the first progression gate
- Every zone after the first MUST be gated: assign a quiz gate in the **previous** zone with unlocksZoneId set to that zone's id
- Each zone MUST include connections[] to the next zone with a short label (e.g. "East wing", "Deep dive")
- When a connection leads to a gated zone, set requiresGateId to the gate id that unlocks it
- Place POIs and gates **inside** their zone bounds (position within origin .. origin+size)
- Mix POI types: include at least one collectible and one checkpoint in multi-zone worlds

**OUTPUT FORMAT:**
Return ONLY valid JSON matching this structure:
{
  "title": "World title",
  "theme": "museum",
  "spawn": { "zoneId": "zone-1", "position": { "x": 2, "y": 1.6, "z": 2 } },
  "zones": [
    {
      "id": "zone-1",
      "name": "Entrance Gallery",
      "description": "What the learner explores here",
      "sectionHeading": "Matching H2/H3 heading",
      "layout": "hub",
      "origin": { "x": 0, "y": 0, "z": 0 },
      "size": { "width": 12, "depth": 12, "height": 4 },
      "connections": [{ "toZoneId": "zone-2", "label": "Next gallery", "requiresGateId": "gate-1" }],
      "documentId": "${documentIds[0] ?? 'doc-1'}"
    },
    {
      "id": "zone-2",
      "name": "Second wing",
      "description": "Deeper concepts",
      "sectionHeading": "Second section heading",
      "layout": "room",
      "origin": { "x": 14, "y": 0, "z": 0 },
      "size": { "width": 12, "depth": 12, "height": 4 },
      "connections": [],
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
      "position": { "x": 9, "y": 1, "z": 6 },
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
- 2 to 6 quiz gates; at least one gate per zone transition after zone 1
- 1 to 4 quests tying POIs, gates, and zoneIds together
- theme must be one of: voxel, museum, outdoor, lab, space (choose by subject, not always voxel)
- layout must be one of: hub, room, path, platform
- poi type must be one of: read, collectible, checkpoint
- gate type must be one of: quiz, door, bridge
- spawn position must be inside zone 1 footprint at y = 1.6
- Do not wrap JSON in markdown code fences

Generate the complete world spec now:`;
  }
}
