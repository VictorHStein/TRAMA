import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import type {
  ArchitectureEntity,
  CategoryDef,
} from '../../domain/model/ArchitectureTypes';
import { TextBillboard } from './TextBillboard';

interface EntityMeshProps {
  entity: ArchitectureEntity;
  category: CategoryDef;
  position: [number, number, number];
  breakdownCode?: string;
  isSelected: boolean;
  isHighlighted: boolean;
  isDimmed: boolean;
  showLabel: boolean;
  onSelect: (id: string) => void;
}

const REDUCED_MOTION =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

const SIZE_BY_CATEGORY: Record<string, number> = {
  mission: 1.1,
  requirement: 0.55,
  function: 0.6,
  subsystem: 0.9,
  component: 0.42,
  verification: 0.5,
};

/**
 * Renders a single entity in 3D using a primitive whose shape depends on
 * `category.shape3D`. Hover/select/dim are derived from store flags.
 *
 * Selected entities slowly spin. All entities bob up and down with a gentle
 * sinusoid (different phase per id) so the scene feels alive without being
 * distracting.
 */
export function EntityMesh({
  entity,
  category,
  position,
  breakdownCode,
  isSelected,
  isHighlighted,
  isDimmed,
  showLabel,
  onSelect,
}: EntityMeshProps) {
  const ref = useRef<Mesh>(null);
  const groupRef = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const shape = category.shape3D ?? 'box';
  const baseSize = SIZE_BY_CATEGORY[entity.category] ?? 0.6;

  // Phase per id so each entity bobs differently
  const phase = useMemo(() => {
    let h = 0;
    for (let i = 0; i < entity.id.length; i++) h = (h * 31 + entity.id.charCodeAt(i)) % 360;
    return (h / 360) * Math.PI * 2;
  }, [entity.id]);

  // Dimmed meshes fade almost out so the active relations dominate the
  // scene; selected stays bright; highlighted (directly related) reads
  // somewhere between but is clearly secondary.
  const opacity = isDimmed ? 0.08 : isSelected ? 1 : isHighlighted ? 0.95 : 0.85;
  const emissiveIntensity = isDimmed ? 0.02 : isSelected ? 0.95 : isHighlighted ? 0.45 : hovered ? 0.5 : 0.2;

  // Motion only as a response to selection: the selected mesh turns slowly
  // and floats a little; everything else stays still (and nothing moves
  // when the user asked for reduced motion).
  useFrame((state, dt) => {
    if (!ref.current || !groupRef.current) return;
    if (REDUCED_MOTION || !isSelected) {
      groupRef.current.position.y = position[1];
      return;
    }
    ref.current.rotation.y += dt * 0.4;
    const t = state.clock.elapsedTime;
    groupRef.current.position.y = position[1] + Math.sin(t * 0.8 + phase) * 0.05;
  });

  // If the mesh goes dimmed (or unmounts) while hovered, onPointerOut never
  // fires and the pointer cursor would stick — reset it here.
  useEffect(() => {
    if (isDimmed && hovered) {
      setHovered(false);
      document.body.style.cursor = '';
    }
  }, [isDimmed, hovered]);
  useEffect(() => () => { document.body.style.cursor = ''; }, []);

  // Dimmed entities stay visible as transparent ghosts so you can still
  // see the rest of the architecture's shape; only the tubes pointing at
  // them disappear (handled in RelationTube). No labels and no halo for
  // dimmed meshes — they read as background-only.
  if (isDimmed) {
    return (
      <group position={position}>
        <mesh>
          {renderGeometry(shape, baseSize)}
          <meshBasicMaterial
            color={category.color}
            transparent
            opacity={0.18}
            depthWrite={false}
          />
        </mesh>
      </group>
    );
  }

  return (
    <group ref={groupRef} position={position}>
      <mesh
        ref={ref}
        onClick={(e) => { e.stopPropagation(); onSelect(entity.id); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = ''; }}
      >
        {renderGeometry(shape, baseSize)}
        <meshStandardMaterial
          color={category.color}
          emissive={category.color}
          emissiveIntensity={emissiveIntensity}
          transparent
          opacity={opacity}
          metalness={0.55}
          roughness={0.32}
        />
      </mesh>

      {/* Selection halo + outline ring */}
      {isSelected && (
        <>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[baseSize + 0.45, 0.05, 12, 64]} />
            <meshBasicMaterial color={category.color} transparent opacity={0.85} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[baseSize + 0.7, 0.018, 8, 64]} />
            <meshBasicMaterial color={category.color} transparent opacity={0.4} />
          </mesh>
        </>
      )}

      {showLabel && (
        <>
          {/* Breakdown code chip — always visible for labelled entities */}
          {breakdownCode && (
            <TextBillboard
              position={[0, baseSize + 0.85, 0]}
              text={breakdownCode}
              color={isSelected ? category.color : '#A3AFBF'}
              size={isSelected ? 0.28 : 0.22}
            />
          )}
          <TextBillboard
            position={[0, baseSize + 0.5, 0]}
            text={truncate(entity.name, 28)}
            color={isSelected ? category.color : isHighlighted ? '#E8EDF3' : '#A3AFBF'}
            size={isSelected ? 0.32 : 0.24}
          />
        </>
      )}
    </group>
  );
}

function renderGeometry(shape: string, size: number) {
  switch (shape) {
    case 'sphere':    return <sphereGeometry args={[size, 28, 28]} />;
    case 'flatPanel': return <boxGeometry args={[size * 2.2, size * 0.18, size * 1.4]} />;
    case 'capsule':   return <capsuleGeometry args={[size * 0.55, size * 1.1, 8, 16]} />;
    case 'box':       return <boxGeometry args={[size * 1.5, size * 1.5, size * 1.5]} />;
    case 'smallBox':  return <boxGeometry args={[size * 1.1, size * 1.1, size * 1.1]} />;
    case 'diamond':   return <octahedronGeometry args={[size * 1.1, 0]} />;
    case 'bar':       return <boxGeometry args={[size * 2.4, size * 0.3, size * 0.3]} />;
    default:          return <boxGeometry args={[size, size, size]} />;
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
