import {
  SubjectWorldGate,
  SubjectWorldPoi,
  SubjectWorldSpec,
  SubjectWorldZone,
} from '@shared-types';

export interface ISceneBlock {
  id: string;
  x: number;
  y: number;
  z: number;
  color: string;
  zoneId: string;
}

export interface ISceneMarker {
  id: string;
  x: number;
  y: number;
  z: number;
  label: string;
  kind: 'poi' | 'gate';
  zoneId: string;
  locked?: boolean;
}

export interface ISceneModel {
  blocks: ISceneBlock[];
  markers: ISceneMarker[];
  spawn: { x: number; y: number; z: number };
  zones: SubjectWorldZone[];
  pois: SubjectWorldPoi[];
  gates: SubjectWorldGate[];
}

const ZONE_COLORS = ['#8b5cf6', '#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#14b8a6'];

function zoneColor(index: number): string {
  return ZONE_COLORS[index % ZONE_COLORS.length];
}

export function adaptSubjectWorldSpecToSceneModel(
  spec: SubjectWorldSpec,
  unlockedGateIds: string[]
): ISceneModel {
  const blocks: ISceneBlock[] = [];
  const markers: ISceneMarker[] = [];

  spec.zones.forEach((zone, zoneIndex) => {
    const color = zoneColor(zoneIndex);
    const { origin, size } = zone;

    for (let x = 0; x < size.width; x += 1) {
      for (let z = 0; z < size.depth; z += 1) {
        blocks.push({
          id: `${zone.id}-floor-${x}-${z}`,
          x: origin.x + x,
          y: origin.y,
          z: origin.z + z,
          color,
          zoneId: zone.id,
        });
      }
    }

    for (let x = 0; x < size.width; x += 1) {
      blocks.push({
        id: `${zone.id}-wall-front-${x}`,
        x: origin.x + x,
        y: origin.y + 1,
        z: origin.z,
        color: '#27272a',
        zoneId: zone.id,
      });
      blocks.push({
        id: `${zone.id}-wall-back-${x}`,
        x: origin.x + x,
        y: origin.y + 1,
        z: origin.z + size.depth - 1,
        color: '#27272a',
        zoneId: zone.id,
      });
    }
  });

  spec.pois.forEach((poi) => {
    markers.push({
      id: poi.id,
      x: poi.position.x,
      y: poi.position.y,
      z: poi.position.z,
      label: poi.label,
      kind: 'poi',
      zoneId: poi.zoneId,
    });
  });

  spec.gates.forEach((gate) => {
    const locked = gate.unlocksZoneId
      ? !unlockedGateIds.includes(gate.id)
      : false;
    markers.push({
      id: gate.id,
      x: gate.position.x,
      y: gate.position.y,
      z: gate.position.z,
      label: gate.label,
      kind: 'gate',
      zoneId: gate.zoneId,
      locked,
    });
  });

  return {
    blocks,
    markers,
    spawn: {
      x: spec.spawn.position.x,
      y: spec.spawn.position.y,
      z: spec.spawn.position.z,
    },
    zones: spec.zones,
    pois: spec.pois,
    gates: spec.gates,
  };
}
