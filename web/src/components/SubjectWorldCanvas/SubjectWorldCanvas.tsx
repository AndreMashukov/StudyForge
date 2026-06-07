import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { ISceneMarker, ISceneModel } from '../../pages/SubjectWorldPage/utils/subjectWorldSceneAdapter';

interface ISubjectWorldCanvasProps {
  sceneModel: ISceneModel;
  onNearMarkerChange: (marker: ISceneMarker | null) => void;
}

const INTERACT_DISTANCE = 3.5;

function PlayerMovement() {
  const { camera } = useThree();
  const keys = useRef({ forward: false, backward: false, left: false, right: false });
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());

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
    },
    [],
  );
  return null;
}

function SceneContent({
  sceneModel,
  onNearMarkerChange,
}: ISubjectWorldCanvasProps) {
  const { camera } = useThree();

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
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} />
      {sceneModel.blocks.map((block) => (
        <mesh key={block.id} position={[block.x, block.y + 0.5, block.z]}>
          <boxGeometry args={[0.95, 0.95, 0.95]} />
          <meshStandardMaterial color={block.color} />
        </mesh>
      ))}
      {sceneModel.markers.map((marker) => (
        <group key={marker.id} position={[marker.x, marker.y + 1.2, marker.z]}>
          <mesh>
            <boxGeometry args={[0.6, 0.6, 0.6]} />
            <meshStandardMaterial
              color={marker.kind === 'gate' ? (marker.locked ? '#ef4444' : '#f59e0b') : '#22c55e'}
              emissive={marker.kind === 'gate' ? (marker.locked ? '#7f1d1d' : '#78350f') : '#14532d'}
              emissiveIntensity={0.4}
            />
          </mesh>
          <Text position={[0, 0.8, 0]} fontSize={0.25} color="#ffffff" anchorX="center">
            {marker.label}
          </Text>
        </group>
      ))}
      <PlayerMovement />
      <PointerLockControls />
      <PointerLockCleanup />
    </>
  );
}

export const SubjectWorldCanvas: React.FC<ISubjectWorldCanvasProps> = ({
  sceneModel,
  onNearMarkerChange,
}) => {
  const cameraPosition = useMemo(
    () => [sceneModel.spawn.x, sceneModel.spawn.y, sceneModel.spawn.z] as [number, number, number],
    [sceneModel.spawn.x, sceneModel.spawn.y, sceneModel.spawn.z]
  );

  return (
    <Canvas
      camera={{ position: cameraPosition, fov: 75, near: 0.1, far: 500 }}
      className="h-full w-full bg-black"
    >
      <SceneContent sceneModel={sceneModel} onNearMarkerChange={onNearMarkerChange} />
    </Canvas>
  );
};
