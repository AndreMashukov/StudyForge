import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Html, Outlines, PointerLockControls, Sparkles, Text } from '@react-three/drei';
import * as THREE from 'three';
import { SubjectWorldZone } from '@shared-types';
import {
  getZoneAtPosition,
  isPlayerPositionAllowed,
  ISceneMarker,
  ISceneModel,
  IScenePortal,
} from '../../pages/SubjectWorldPage/utils/subjectWorldSceneAdapter';

export interface ISubjectWorldUnlockCelebration {
  gateId: string;
  x: number;
  y: number;
  z: number;
}

interface ISubjectWorldCanvasProps {
  sceneModel: ISceneModel;
  nearestMarkerId: string | null;
  onNearMarkerChange: (marker: ISceneMarker | null) => void;
  onMarkerClick: (marker: ISceneMarker) => void;
  onZoneEnter?: (zone: SubjectWorldZone | null) => void;
  unlockCelebration?: ISubjectWorldUnlockCelebration | null;
}

const INTERACT_DISTANCE = 3.5;

interface ISceneMarkerMeshProps {
  marker: ISceneMarker;
  isNearest: boolean;
  onMarkerClick: (marker: ISceneMarker) => void;
}

function SceneMarkerMesh({ marker, isNearest, onMarkerClick }: ISceneMarkerMeshProps) {
  const canInteract =
    isNearest && (marker.kind === 'poi' || marker.locked === true);

  const baseColor =
    marker.kind === 'gate'
      ? marker.locked
        ? '#ef4444'
        : '#f59e0b'
      : '#22c55e';
  const emissiveColor =
    marker.kind === 'gate'
      ? marker.locked
        ? '#7f1d1d'
        : '#78350f'
      : '#14532d';

  const mesh = (
    <mesh
      onClick={(event) => {
        event.stopPropagation();
        if (canInteract) {
          onMarkerClick(marker);
        }
      }}
      onPointerOver={(event) => {
        if (canInteract) {
          event.stopPropagation();
          document.body.style.cursor = 'pointer';
        }
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
      }}
    >
      <boxGeometry args={[0.6, 0.6, 0.6]} />
      <meshStandardMaterial
        color={baseColor}
        emissive={emissiveColor}
        emissiveIntensity={isNearest ? 0.7 : 0.4}
      />
      {isNearest && canInteract && (
        <Outlines thickness={0.04} color="#ffffff" screenspace />
      )}
    </mesh>
  );

  return (
    <group position={[marker.x, marker.y + 1.2, marker.z]}>
      {isNearest && canInteract ? (
        <Float speed={2} rotationIntensity={0.2} floatIntensity={0.6}>
          {mesh}
        </Float>
      ) : (
        mesh
      )}
      <Text position={[0, 0.8, 0]} fontSize={0.25} color="#ffffff" anchorX="center">
        {marker.label}
      </Text>
      {isNearest && canInteract && (
        <Html position={[0, 1.6, 0]} center distanceFactor={12} zIndexRange={[100, 0]}>
          <div className="pointer-events-none whitespace-nowrap rounded-md border border-border bg-background/90 px-2 py-1 text-xs text-foreground shadow-md">
            Press E or Click
          </div>
        </Html>
      )}
    </group>
  );
}

interface IScenePortalMeshProps {
  portal: IScenePortal;
  openColor: string;
  lockedColor: string;
}

function ScenePortalMesh({ portal, openColor, lockedColor }: IScenePortalMeshProps) {
  const color = portal.locked ? lockedColor : openColor;

  return (
    <group position={[portal.x, portal.y + 0.5, portal.z]}>
      <mesh position={[-0.5, 0.75, 0]}>
        <boxGeometry args={[0.35, 1.5, 0.35]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0.5, 0.75, 0]}>
        <boxGeometry args={[0.35, 1.5, 0.35]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 1.55, 0]}>
        <boxGeometry args={[1.2, 0.2, 0.4]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
      {!portal.locked && (
        <Sparkles count={12} scale={1.2} size={2} speed={0.3} color={openColor} />
      )}
      <Text position={[0, 2.2, 0]} fontSize={0.2} color="#ffffff" anchorX="center">
        {portal.label}
      </Text>
      {portal.locked && (
        <Html position={[0, 2.6, 0]} center distanceFactor={14} zIndexRange={[100, 0]}>
          <div className="pointer-events-none whitespace-nowrap rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs text-destructive shadow-md">
            Locked — pass the gate
          </div>
        </Html>
      )}
    </group>
  );
}

function UnlockCelebrationSparkles({
  celebration,
}: {
  celebration: ISubjectWorldUnlockCelebration;
}) {
  return (
    <group position={[celebration.x, celebration.y, celebration.z]}>
      <Sparkles count={40} scale={2.5} size={4} speed={0.6} color="#22c55e" />
      <Sparkles count={20} scale={1.8} size={3} speed={0.4} color="#fbbf24" />
    </group>
  );
}

function SceneAtmosphere({ sceneModel }: { sceneModel: ISceneModel }) {
  const { scene } = useThree();
  const palette = sceneModel.themePalette;

  React.useEffect(() => {
    scene.background = new THREE.Color(palette.skyColor);
    scene.fog = new THREE.Fog(palette.fogColor, 20, 80);
    return () => {
      scene.background = null;
      scene.fog = null;
    };
  }, [palette.fogColor, palette.skyColor, scene]);

  return null;
}

interface IPlayerMovementProps {
  sceneModel: ISceneModel;
}

function PlayerMovement({ sceneModel }: IPlayerMovementProps) {
  const { camera } = useThree();
  const keys = useRef({ forward: false, backward: false, left: false, right: false });
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  const lastValidPosition = useRef(new THREE.Vector3());

  React.useEffect(() => {
    lastValidPosition.current.copy(camera.position);
  }, [camera]);

  useFrame((_, delta) => {
    direction.current.set(0, 0, 0);
    if (keys.current.forward) direction.current.z -= 1;
    if (keys.current.backward) direction.current.z += 1;
    if (keys.current.left) direction.current.x -= 1;
    if (keys.current.right) direction.current.x += 1;

    if (direction.current.lengthSq() > 0) {
      direction.current.normalize();
      direction.current.applyEuler(camera.rotation);
      direction.current.y = 0;
      velocity.current.copy(direction.current.multiplyScalar(8 * delta));
      camera.position.add(velocity.current);
    }

    const allowed = isPlayerPositionAllowed(
      camera.position.x,
      camera.position.z,
      sceneModel.blocks,
      sceneModel.zones,
      sceneModel.accessibleZoneIds
    );

    if (!allowed) {
      camera.position.copy(lastValidPosition.current);
    } else {
      lastValidPosition.current.copy(camera.position);
    }
  });

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'KeyW') keys.current.forward = true;
      if (event.code === 'KeyS') keys.current.backward = true;
      if (event.code === 'KeyA') keys.current.left = true;
      if (event.code === 'KeyD') keys.current.right = true;
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'KeyW') keys.current.forward = false;
      if (event.code === 'KeyS') keys.current.backward = false;
      if (event.code === 'KeyA') keys.current.left = false;
      if (event.code === 'KeyD') keys.current.right = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return null;
}

function PointerLockCleanup() {
  React.useEffect(
    () => () => {
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
      document.body.style.cursor = 'default';
    },
    [],
  );
  return null;
}

function SceneContent({
  sceneModel,
  nearestMarkerId,
  onNearMarkerChange,
  onMarkerClick,
  onZoneEnter,
  unlockCelebration,
}: ISubjectWorldCanvasProps) {
  const { camera } = useThree();
  const currentZoneIdRef = useRef<string | null>(null);
  const palette = sceneModel.themePalette;

  useFrame(() => {
    let nearest: ISceneMarker | null = null;
    let nearestDist = INTERACT_DISTANCE;

    for (const marker of sceneModel.markers) {
      const dx = camera.position.x - marker.x;
      const dz = camera.position.z - marker.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < nearestDist) {
        nearest = marker;
        nearestDist = dist;
      }
    }

    onNearMarkerChange(nearest);

    const zone = getZoneAtPosition(camera.position.x, camera.position.z, sceneModel.zones);
    const zoneId = zone?.id ?? null;
    if (zoneId !== currentZoneIdRef.current) {
      currentZoneIdRef.current = zoneId;
      onZoneEnter?.(zone);
    }
  });

  return (
    <>
      <SceneAtmosphere sceneModel={sceneModel} />
      <ambientLight intensity={palette.ambientIntensity} />
      <directionalLight position={[10, 20, 10]} intensity={palette.directionalIntensity} />
      {sceneModel.blocks.map((block) => (
        <mesh
          key={block.id}
          position={[block.x, block.y + (block.kind === 'barrier' ? 1 : 0.5), block.z]}
        >
          <boxGeometry
            args={
              block.kind === 'barrier'
                ? [0.95, 2, 0.95]
                : [0.95, 0.95, 0.95]
            }
          />
          <meshStandardMaterial
            color={block.color}
            transparent={block.kind === 'barrier'}
            opacity={block.kind === 'barrier' ? 0.85 : 1}
          />
        </mesh>
      ))}
      {sceneModel.portals.map((portal) => (
        <ScenePortalMesh
          key={portal.id}
          portal={portal}
          openColor={palette.portalOpenColor}
          lockedColor={palette.portalLockedColor}
        />
      ))}
      {sceneModel.markers.map((marker) => (
        <SceneMarkerMesh
          key={marker.id}
          marker={marker}
          isNearest={nearestMarkerId === marker.id}
          onMarkerClick={onMarkerClick}
        />
      ))}
      {unlockCelebration && (
        <UnlockCelebrationSparkles celebration={unlockCelebration} />
      )}
      <PlayerMovement sceneModel={sceneModel} />
      <PointerLockControls />
      <PointerLockCleanup />
    </>
  );
}

export const SubjectWorldCanvas: React.FC<ISubjectWorldCanvasProps> = ({
  sceneModel,
  nearestMarkerId,
  onNearMarkerChange,
  onMarkerClick,
  onZoneEnter,
  unlockCelebration,
}) => {
  const cameraPosition = useMemo(
    () => [sceneModel.spawn.x, sceneModel.spawn.y, sceneModel.spawn.z] as [number, number, number],
    [sceneModel.spawn.x, sceneModel.spawn.y, sceneModel.spawn.z]
  );

  return (
    <Canvas
      camera={{ position: cameraPosition, fov: 75, near: 0.1, far: 500 }}
      className="h-full w-full"
    >
      <SceneContent
        sceneModel={sceneModel}
        nearestMarkerId={nearestMarkerId}
        onNearMarkerChange={onNearMarkerChange}
        onMarkerClick={onMarkerClick}
        onZoneEnter={onZoneEnter}
        unlockCelebration={unlockCelebration}
      />
    </Canvas>
  );
};
