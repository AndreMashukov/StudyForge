import {
  SubjectWorldGate,
  SubjectWorldPoi,
  SubjectWorldPosition,
  SubjectWorldQuest,
  SubjectWorldSpec,
  SubjectWorldZone,
} from '@shared-types';

const MAX_ZONES = 8;
const MAX_POIS = 24;
const MAX_GATES = 12;
const MAX_QUESTS = 6;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizePosition(pos: SubjectWorldPosition | undefined, fallback: SubjectWorldPosition): SubjectWorldPosition {
  if (!pos || typeof pos !== 'object') {
    return fallback;
  }
  return {
    x: clamp(typeof pos.x === 'number' ? pos.x : fallback.x, -48, 48),
    y: clamp(typeof pos.y === 'number' ? pos.y : fallback.y, 0, 16),
    z: clamp(typeof pos.z === 'number' ? pos.z : fallback.z, -48, 48),
  };
}

function defaultZone(index: number, sectionHeading: string): SubjectWorldZone {
  const offset = index * 14;
  return {
    id: `zone-${index + 1}`,
    name: sectionHeading || `Zone ${index + 1}`,
    description: `Explore concepts from ${sectionHeading || `section ${index + 1}`}.`,
    sectionHeading: sectionHeading || `Section ${index + 1}`,
    layout: index === 0 ? 'hub' : 'room',
    origin: { x: offset, y: 0, z: 0 },
    size: { width: 12, depth: 12, height: 4 },
    connections: [],
  };
}

export function normalizeSubjectWorldSpec(
  raw: SubjectWorldSpec,
  documentIds: string[],
  fallbackTitle: string
): SubjectWorldSpec {
  const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : fallbackTitle;
  const theme = raw.theme === 'museum' || raw.theme === 'outdoor' || raw.theme === 'lab' || raw.theme === 'space'
    ? raw.theme
    : 'voxel';

  let zones = Array.isArray(raw.zones) ? raw.zones.slice(0, MAX_ZONES) : [];
  if (zones.length === 0) {
    zones = [defaultZone(0, 'Overview')];
  }

  zones = zones.map((zone, index) => {
    const id = typeof zone.id === 'string' && zone.id.trim() ? zone.id.trim() : `zone-${index + 1}`;
    const origin = normalizePosition(zone.origin, { x: index * 14, y: 0, z: 0 });
    const size = zone.size && typeof zone.size === 'object'
      ? {
          width: clamp(zone.size.width ?? 12, 6, 24),
          depth: clamp(zone.size.depth ?? 12, 6, 24),
          height: clamp(zone.size.height ?? 4, 2, 8),
        }
      : { width: 12, depth: 12, height: 4 };
    return {
      id,
      name: typeof zone.name === 'string' && zone.name.trim() ? zone.name.trim() : `Zone ${index + 1}`,
      description: typeof zone.description === 'string' ? zone.description : '',
      sectionHeading: typeof zone.sectionHeading === 'string' ? zone.sectionHeading : `Section ${index + 1}`,
      layout: zone.layout === 'hub' || zone.layout === 'path' || zone.layout === 'platform' || zone.layout === 'room'
        ? zone.layout
        : 'room',
      origin,
      size,
      connections: Array.isArray(zone.connections) ? zone.connections : [],
      documentId: typeof zone.documentId === 'string' ? zone.documentId : documentIds[index % documentIds.length],
    };
  });

  const zoneIds = new Set(zones.map((z) => z.id));
  const primaryDocId = documentIds[0] ?? 'unknown';

  const pois: SubjectWorldPoi[] = (Array.isArray(raw.pois) ? raw.pois : [])
    .slice(0, MAX_POIS)
    .map((poi, index) => {
      const zoneId = typeof poi.zoneId === 'string' && zoneIds.has(poi.zoneId)
        ? poi.zoneId
        : zones[index % zones.length].id;
      const zone = zones.find((z) => z.id === zoneId) ?? zones[0];
      return {
        id: typeof poi.id === 'string' && poi.id.trim() ? poi.id.trim() : `poi-${index + 1}`,
        label: typeof poi.label === 'string' && poi.label.trim() ? poi.label.trim() : `Concept ${index + 1}`,
        summary: typeof poi.summary === 'string' ? poi.summary : '',
        fullExcerpt: typeof poi.fullExcerpt === 'string' ? poi.fullExcerpt : poi.summary ?? '',
        position: normalizePosition(poi.position, {
          x: zone.origin.x + (index % 3) * 3 - 3,
          y: 1,
          z: zone.origin.z + Math.floor(index / 3) * 3 - 3,
        }),
        zoneId,
        type: poi.type === 'collectible' || poi.type === 'checkpoint' ? poi.type : 'read',
        sourceRef: {
          documentId: poi.sourceRef?.documentId ?? zone.documentId ?? primaryDocId,
          sectionHeading: poi.sourceRef?.sectionHeading ?? zone.sectionHeading,
          excerpt: poi.sourceRef?.excerpt ?? poi.summary ?? '',
        },
      };
    });

  const gates: SubjectWorldGate[] = (Array.isArray(raw.gates) ? raw.gates : [])
    .slice(0, MAX_GATES)
    .map((gate, index) => {
      const zoneId = typeof gate.zoneId === 'string' && zoneIds.has(gate.zoneId)
        ? gate.zoneId
        : zones[Math.min(index, zones.length - 1)].id;
      const zone = zones.find((z) => z.id === zoneId) ?? zones[0];
      const options = Array.isArray(gate.options) && gate.options.length >= 2
        ? gate.options.slice(0, 4).map((o) => String(o))
        : ['Option A', 'Option B', 'Option C', 'Option D'];
      const correctAnswer = clamp(typeof gate.correctAnswer === 'number' ? gate.correctAnswer : 0, 0, options.length - 1);
      return {
        id: typeof gate.id === 'string' && gate.id.trim() ? gate.id.trim() : `gate-${index + 1}`,
        label: typeof gate.label === 'string' && gate.label.trim() ? gate.label.trim() : `Gate ${index + 1}`,
        zoneId,
        position: normalizePosition(gate.position, {
          x: zone.origin.x + zone.size.width / 2 - 1,
          y: 1,
          z: zone.origin.z,
        }),
        type: gate.type === 'bridge' || gate.type === 'door' ? gate.type : 'quiz',
        question: typeof gate.question === 'string' ? gate.question : 'Answer to proceed.',
        options,
        correctAnswer,
        explanation: typeof gate.explanation === 'string' ? gate.explanation : '',
        unlocksZoneId: typeof gate.unlocksZoneId === 'string' && zoneIds.has(gate.unlocksZoneId)
          ? gate.unlocksZoneId
          : undefined,
        sourceRef: {
          documentId: gate.sourceRef?.documentId ?? zone.documentId ?? primaryDocId,
          sectionHeading: gate.sourceRef?.sectionHeading ?? zone.sectionHeading,
          excerpt: gate.sourceRef?.excerpt ?? '',
        },
      };
    });

  const poiIds = new Set(pois.map((p) => p.id));
  const gateIds = new Set(gates.map((g) => g.id));

  const quests: SubjectWorldQuest[] = (Array.isArray(raw.quests) ? raw.quests : [])
    .slice(0, MAX_QUESTS)
    .map((quest, index) => ({
      id: typeof quest.id === 'string' && quest.id.trim() ? quest.id.trim() : `quest-${index + 1}`,
      title: typeof quest.title === 'string' && quest.title.trim() ? quest.title.trim() : `Quest ${index + 1}`,
      description: typeof quest.description === 'string' ? quest.description : '',
      poiIds: Array.isArray(quest.poiIds) ? quest.poiIds.filter((id) => poiIds.has(id)) : [],
      gateIds: Array.isArray(quest.gateIds) ? quest.gateIds.filter((id) => gateIds.has(id)) : [],
      zoneIds: Array.isArray(quest.zoneIds) ? quest.zoneIds.filter((id) => zoneIds.has(id)) : [zones[0].id],
    }));

  const spawnZoneId = typeof raw.spawn?.zoneId === 'string' && zoneIds.has(raw.spawn.zoneId)
    ? raw.spawn.zoneId
    : zones[0].id;
  const spawnZone = zones.find((z) => z.id === spawnZoneId) ?? zones[0];

  return {
    title,
    theme,
    spawn: {
      zoneId: spawnZoneId,
      position: normalizePosition(raw.spawn?.position, {
        x: spawnZone.origin.x,
        y: 1.6,
        z: spawnZone.origin.z,
      }),
    },
    zones,
    pois,
    gates,
    quests,
  };
}
