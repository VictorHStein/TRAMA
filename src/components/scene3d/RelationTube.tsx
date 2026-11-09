import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { RelationVisualStyle } from '../../domain/parser/relationStyle';

interface RelationTubeProps {
  relationId: string;
  relationIndex: number;
  from: [number, number, number];
  to: [number, number, number];
  style: RelationVisualStyle;
  selected: boolean;
  emphasizedByFilter: boolean;
  /**
   * True when the user has SOMETHING selected and this tube does NOT
   * connect to it. Treated like the 2D dimmed case: the tube is rendered
   * extremely faint with no badge so the active relations dominate.
   */
  dimmed: boolean;
  showBadge: boolean;
  /**
   * Symmetric offset for parallel tubes between the same node pair
   * (… −1, 0, +1 …). The bend direction rotates by `pairOffset × 28°`
   * around the source→target axis, so multiple relations between EPS
   * and OBC don't stack on top of each other.
   */
  pairOffset: number;
  onSelect: (id: string) => void;
}

/**
 * Curved tube connecting two entity centers in 3D. Color and thickness come
 * from the unified relation style (so 2D and 3D look the same).
 *
 * Parallel tubes between the same pair fan out by rotating their bend
 * direction around the source→target axis, so they no longer overlap.
 */
export function RelationTube({
  relationId,
  relationIndex,
  from,
  to,
  style,
  selected,
  emphasizedByFilter,
  dimmed,
  showBadge,
  pairOffset,
  onSelect,
}: RelationTubeProps) {
  // Bend direction + midpoint, accounting for pair offset
  const { tubeGeom, midPoint } = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const lineLen = start.distanceTo(end) || 1;
    // Bigger base bend → tubes arch higher and don't crowd the straight
    // line between endpoints. Adjacent tubes can pass through different
    // altitudes instead of sliding past each other at the same height.
    const baseBend = lineLen * 0.3;

    // Start with the world-up direction
    const bendDir = new THREE.Vector3(0, 1, 0);

    // Rotate the bend direction around the source→target axis. The
    // multiplier was 0.5 rad (~28°) — bumped to 0.85 rad (~49°) so
    // parallels go to clearly distinct sides of the line.
    if (pairOffset !== 0) {
      const lineDir = end.clone().sub(start).normalize();
      if (Math.abs(lineDir.y) > 0.999) lineDir.set(0, 0, 1);
      const angle = pairOffset * 0.85;
      bendDir.applyAxisAngle(lineDir, angle);
    }

    // Outer parallels arch a bit higher than the inner ones so they
    // never touch even when angles overlap visually from one viewpoint.
    const bendMag = baseBend * (1 + Math.abs(pairOffset) * 0.45);

    const mid = start.clone().add(end).multiplyScalar(0.5);
    mid.add(bendDir.multiplyScalar(bendMag));

    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    // Tubes themselves are slightly thinner, so they read as lines, not
    // pipes — less chance of two lit-up tubes blurring into one blob.
    const geom = new THREE.TubeGeometry(curve, 28, style.strokeWidth * 0.022, 8, false);

    const t05 = start.clone().multiplyScalar(0.25)
      .add(mid.clone().multiplyScalar(0.5))
      .add(end.clone().multiplyScalar(0.25));

    return {
      tubeGeom: geom,
      midPoint: [t05.x, t05.y, t05.z] as [number, number, number],
    };
  }, [from, to, style.strokeWidth, pairOffset]);

  if (dimmed) return null;

  return (
    <group onClick={(e) => { e.stopPropagation(); onSelect(relationId); }}>
      <mesh geometry={tubeGeom}>
        <meshStandardMaterial
          color={style.color}
          emissive={style.color}
          emissiveIntensity={selected ? 1.0 : emphasizedByFilter ? 0.55 : 0.25}
          transparent
          opacity={style.opacity}
          metalness={0.4}
          roughness={0.5}
        />
      </mesh>

      {showBadge && (
        <Html
          center
          position={midPoint}
          distanceFactor={9}
          zIndexRange={[15, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <span
            className={`num-badge relation-tube-badge${selected ? ' is-selected' : ''}`}
            style={{ background: style.color }}
            title={`${relationIndex}`}
          >
            {relationIndex}
          </span>
        </Html>
      )}
    </group>
  );
}
