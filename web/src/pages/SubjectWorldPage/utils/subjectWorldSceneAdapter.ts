import {
  SubjectWorldGate,
  SubjectWorldPoi,
  SubjectWorldSpec,
  SubjectWorldTheme,
  SubjectWorldZone,
} from '@shared-types';
import { getThemePalette, ISceneThemePalette } from './subjectWorldTheme';

export interface ISceneBlock {
  id: string;
  x: number;
  y: number;
  z: number;
  color: string;
  zoneId: string;
  kind: 'floor' | 'wall' | 'path' | 'barrier' | 'bridge';
}

export interface ISceneMarker {
  id: string;
  x: number;
  y: number;
  z: number;
  label: string;
  kind: 'poi' | 'gate' | 'npc';
  zoneId: string;
  locked?: boolean;
  poiType?: SubjectWorldPoi['type'];
  gateType?: SubjectWorldGate['type'];
}

export interface IScenePortal {
  id: string;
  fromZoneId: string;
  toZoneId: string;
  label: string;
  x: number;
  y: number;
  z: number;
  locked: boolean;
  requiresGateId?: string;
}

export interface ISceneModel {
  blocks: ISceneBlock[];
  markers: ISceneMarker[];
  portals: IScenePortal[];
  spawn: { x: number; y: number; z: number };
  spawnZoneId: string;
  zones: SubjectWorldZone[];
  pois: SubjectWorldPoi[];
  gates: SubjectWorldGate[];
  theme: SubjectWorldTheme;
  themePalette: ISceneThemePalette;
  accessibleZoneIds: string[];
}

function zoneColor(palette: ISceneThemePalette, zoneIndex: number): string {
  return palette.zoneColors[zoneIndex % palette.zoneColors.length];
}

function portalPosition(fromZone: SubjectWorldZone, toZone: SubjectWorldZone): { x: number; y: number; z: number } {
  const fromCenterX = fromZone.origin.x + fromZone.size.width / 2;
  const fromCenterZ = fromZone.origin.z + fromZone.size.depth / 2;
  const toCenterX = toZone.origin.x + toZone.size.width / 2;
  const toCenterZ = toZone.origin.z + toZone.size.depth / 2;

  return {
    x: (fromCenterX + toCenterX) / 2,
    y: fromZone.origin.y + 1,
    z: (fromCenterZ + toCenterZ) / 2,
  };
}

function isConnectionLocked(
  connection: SubjectWorldZone['connections'][number],
  toZoneId: string,
  unlockedGateIds: string[],
  gates: SubjectWorldGate[]
): boolean {
  if (connection.requiresGateId && !unlockedGateIds.includes(connection.requiresGateId)) {
    return true;
  }

  const zoneUnlockGate = gates.find((gate) => gate.unlocksZoneId === toZoneId);
  if (zoneUnlockGate && !unlockedGateIds.includes(zoneUnlockGate.id)) {
    return true;
  }

  return false;
}

export function computeAccessibleZoneIds(
  spawnZoneId: string,
  zones: SubjectWorldZone[],
  gates: SubjectWorldGate[],
  unlockedGateIds: string[]
): string[] {
  const accessible = new Set<string>([spawnZoneId]);

  for (;;) {
    let changed = false;

    for (const zone of zones) {
      if (!accessible.has(zone.id)) {
        continue;
      }

      for (const connection of zone.connections) {
        if (isConnectionLocked(connection, connection.toZoneId, unlockedGateIds, gates)) {
          continue;
        }
        if (!accessible.has(connection.toZoneId)) {
          accessible.add(connection.toZoneId);
          changed = true;
        }
      }
    }

    for (const gate of gates) {
      if (
        gate.unlocksZoneId &&
        unlockedGateIds.includes(gate.id) &&
        !accessible.has(gate.unlocksZoneId)
      ) {
        accessible.add(gate.unlocksZoneId);
        changed = true;
      }
    }

    if (!changed) {
      break;
    }
  }

  return [...accessible];
}

export function getZoneAtPosition(
  x: number,
  z: number,
  zones: SubjectWorldZone[]
): SubjectWorldZone | null {
  for (const zone of zones) {
    const inX = x >= zone.origin.x && x < zone.origin.x + zone.size.width;
    const inZ = z >= zone.origin.z && z < zone.origin.z + zone.size.depth;
    if (inX && inZ) {
      return zone;
    }
  }
  return null;
}

function buildPathBlocks(
  portal: IScenePortal,
  fromZone: SubjectWorldZone,
  toZone: SubjectWorldZone,
  palette: ISceneThemePalette,
  bridgeStyle: boolean
): ISceneBlock[] {
  const blocks: ISceneBlock[] = [];
  const steps = 4;

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const fromCenterX = fromZone.origin.x + fromZone.size.width / 2;
    const fromCenterZ = fromZone.origin.z + fromZone.size.depth / 2;
    const toCenterX = toZone.origin.x + toZone.size.width / 2;
    const toCenterZ = toZone.origin.z + toZone.size.depth / 2;
    const x = fromCenterX + (toCenterX - fromCenterX) * t;
    const z = fromCenterZ + (toCenterZ - fromCenterZ) * t;

    if (portal.locked) {
      blocks.push({
        id: `${portal.id}-path-${i}`,
        x: Math.round(x),
        y: fromZone.origin.y,
        z: Math.round(z),
        color: palette.portalLockedColor,
        zoneId: portal.toZoneId,
        kind: 'barrier',
      });
    } else if (bridgeStyle) {
      blocks.push({
        id: `${portal.id}-bridge-${i}`,
        x: Math.round(x),
        y: fromZone.origin.y + 0.5,
        z: Math.round(z),
        color: palette.pathColor,
        zoneId: portal.toZoneId,
        kind: 'bridge',
      });
    } else {
      blocks.push({
        id: `${portal.id}-path-${i}`,
        x: Math.round(x),
        y: fromZone.origin.y,
        z: Math.round(z),
        color: palette.pathColor,
        zoneId: portal.toZoneId,
        kind: 'path',
      });
    }
  }

  return blocks;
}

function isBridgeConnection(
  connection: SubjectWorldZone['connections'][number],
  gates: SubjectWorldGate[]
): boolean {
  if (connection.requiresGateId) {
    const gate = gates.find((g) => g.id === connection.requiresGateId);
    if (gate?.type === 'bridge') return true;
  }

  const zoneUnlockGate = gates.find((gate) => gate.unlocksZoneId === connection.toZoneId);
  return zoneUnlockGate?.type === 'bridge';
}

export function adaptSubjectWorldSpecToSceneModel(
  spec: SubjectWorldSpec,
  unlockedGateIds: string[]
): ISceneModel {
  const palette = getThemePalette(spec.theme);
  const blocks: ISceneBlock[] = [];
  const markers: ISceneMarker[] = [];
  const portals: IScenePortal[] = [];
  const zoneById = new Map(spec.zones.map((zone) => [zone.id, zone]));
  const accessibleZoneIds = computeAccessibleZoneIds(
    spec.spawn.zoneId,
    spec.zones,
    spec.gates,
    unlockedGateIds
  );

  spec.zones.forEach((zone, zoneIndex) => {
    const isAccessible = accessibleZoneIds.includes(zone.id);
    const color = isAccessible
      ? zoneColor(palette, zoneIndex)
      : '#3f3f46';
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
          kind: 'floor',
        });
      }
    }

    for (let x = 0; x < size.width; x += 1) {
      blocks.push({
        id: `${zone.id}-wall-front-${x}`,
        x: origin.x + x,
        y: origin.y + 1,
        z: origin.z,
        color: palette.wallColor,
        zoneId: zone.id,
        kind: 'wall',
      });
      blocks.push({
        id: `${zone.id}-wall-back-${x}`,
        x: origin.x + x,
        y: origin.y + 1,
        z: origin.z + size.depth - 1,
        color: palette.wallColor,
        zoneId: zone.id,
        kind: 'wall',
      });
    }

    zone.connections.forEach((connection) => {
      const toZone = zoneById.get(connection.toZoneId);
      if (!toZone) return;

      const position = portalPosition(zone, toZone);
      const locked = isConnectionLocked(connection, connection.toZoneId, unlockedGateIds, spec.gates);
      const portal: IScenePortal = {
        id: `${zone.id}-to-${connection.toZoneId}`,
        fromZoneId: zone.id,
        toZoneId: connection.toZoneId,
        label: connection.label,
        x: position.x,
        y: position.y,
        z: position.z,
        locked,
        requiresGateId: connection.requiresGateId,
      };
      portals.push(portal);
      blocks.push(
        ...buildPathBlocks(
          portal,
          zone,
          toZone,
          palette,
          isBridgeConnection(connection, spec.gates)
        )
      );
    });
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
      poiType: poi.type,
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
      gateType: gate.type,
    });
  });

  (spec.npcs ?? []).forEach((npc) => {
    markers.push({
      id: npc.id,
      x: npc.position.x,
      y: npc.position.y,
      z: npc.position.z,
      label: npc.label,
      kind: 'npc',
      zoneId: npc.zoneId,
    });
  });

  return {
    blocks,
    markers,
    portals,
    spawn: {
      x: spec.spawn.position.x,
      y: spec.spawn.position.y,
      z: spec.spawn.position.z,
    },
    spawnZoneId: spec.spawn.zoneId,
    zones: spec.zones,
    pois: spec.pois,
    gates: spec.gates,
    theme: spec.theme,
    themePalette: palette,
    accessibleZoneIds,
  };
}

export function isPlayerPositionAllowed(
  x: number,
  z: number,
  blocks: ISceneBlock[],
  zones: SubjectWorldZone[],
  accessibleZoneIds: string[]
): boolean {
  const floorY = zones[0]?.origin.y ?? 0;
  const tileX = Math.round(x);
  const tileZ = Math.round(z);
  const block = blocks.find(
    (candidate) =>
      candidate.x === tileX &&
      candidate.z === tileZ &&
      candidate.y === floorY &&
      (candidate.kind === 'floor' || candidate.kind === 'path' || candidate.kind === 'barrier' || candidate.kind === 'bridge')
  );

  if (block?.kind === 'barrier') {
    return false;
  }

  const zone = getZoneAtPosition(x, z, zones);
  if (zone) {
    return accessibleZoneIds.includes(zone.id);
  }

  return block?.kind === 'path' || block?.kind === 'bridge';
}

export function findGateMarkerPosition(
  sceneModel: ISceneModel,
  gateId: string
): { x: number; y: number; z: number } | null {
  const marker = sceneModel.markers.find((m) => m.id === gateId && m.kind === 'gate');
  if (!marker) return null;
  return { x: marker.x, y: marker.y + 1.2, z: marker.z };
}

export function findPortalForGateUnlock(
  sceneModel: ISceneModel,
  gateId: string
): IScenePortal | null {
  const gate = sceneModel.gates.find((g) => g.id === gateId);
  if (!gate?.unlocksZoneId) return null;

  return (
    sceneModel.portals.find(
      (portal) => portal.toZoneId === gate.unlocksZoneId || portal.fromZoneId === gate.zoneId
    ) ?? null
  );
}
