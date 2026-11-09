import { useMemo } from 'react';
import type {
  ArchitectureEntity,
  NormalizedArchitecture,
} from '../../domain/model/ArchitectureTypes';

export interface ThreeDPosition {
  x: number;
  y: number;
  z: number;
}

export interface ThreeDLayoutResult {
  positions: Map<string, ThreeDPosition>;
  /** Radius of the ring this category was placed on (0 = center). */
  ringByCategory: Map<string, number>;
}

/**
 * Radial-fan layout for the 3D scene.
 *
 *  Center: mission
 *  Ring 1: requirements (objectives sit on a small ring just above them)
 *  Ring 2: functions
 *  Ring 3: subsystems (segments on a ring just inside them)
 *  Ring 4: components (orbiting their parent subsystem when known)
 *  Ring 5: verifications (outer ring)
 *
 * If an entity already has `position3D`, that wins.
 */
export function compute3DLayout(architecture: NormalizedArchitecture): ThreeDLayoutResult {
  const positions = new Map<string, ThreeDPosition>();
  const ringByCategory = new Map<string, number>();

  // Categories ordered by ring number. We honour the JSON-declared order, but
  // map known semantic categories to specific rings.
  const RING_BY_ID: Record<string, number> = {
    mission: 0,
    objective: 0.5,
    requirement: 1,
    function: 2,
    segment: 2.5,
    subsystem: 3,
    component: 4,
    verification: 5,
  };
  const FALLBACK_RING = 3;

  // Determine ring index for each category.
  const orderedCats = [...architecture.categories]
    .map((c, idx) => ({
      ...c,
      ring: RING_BY_ID[c.id] ?? idx + 1,
    }))
    .sort((a, b) => a.ring - b.ring);

  orderedCats.forEach((c) => ringByCategory.set(c.id, c.ring));

  // Ring radius and elevation per ring index
  const ringConfig: Record<number, { radius: number; y: number }> = {
    0: { radius: 0, y: 3.0 },
    0.5: { radius: 2.8, y: 2.6 },
    1: { radius: 5.0, y: 2.0 },
    2.5: { radius: 8.2, y: 0.5 },
    2: { radius: 7.0, y: 1.0 },
    3: { radius: 9.5, y: 0.0 },
    4: { radius: 12.5, y: -1.5 },
    5: { radius: 14.5, y: -3.0 },
  };

  // Group visible-eligible entities by category
  const byCategory = new Map<string, ArchitectureEntity[]>();
  for (const e of architecture.entities) {
    const list = byCategory.get(e.category) ?? [];
    list.push(e);
    byCategory.set(e.category, list);
  }

  // Place each category's entities on their ring
  for (const cat of orderedCats) {
    const list = byCategory.get(cat.id);
    if (!list || list.length === 0) continue;

    const ring = ringConfig[cat.ring] ?? { radius: FALLBACK_RING * 3, y: 0 };
    const n = list.length;

    if (cat.id === 'component') {
      // Cluster components around their parent subsystem
      placeComponents(list, architecture, positions, ring.radius, ring.y);
    } else if (n === 1 && cat.ring === 0) {
      const e = list[0];
      const pos = e.position3D ?? { x: 0, y: ring.y, z: 0 };
      positions.set(e.id, pos);
    } else {
      const startAngle = -Math.PI / 2; // start at top
      list.forEach((e, i) => {
        if (e.position3D) {
          positions.set(e.id, e.position3D);
          return;
        }
        const angle = startAngle + (i / n) * Math.PI * 2;
        const r = ring.radius;
        positions.set(e.id, {
          x: Math.cos(angle) * r,
          y: ring.y,
          z: Math.sin(angle) * r,
        });
      });
    }
  }

  return { positions, ringByCategory };
}

function placeComponents(
  components: ArchitectureEntity[],
  arch: NormalizedArchitecture,
  positions: Map<string, ThreeDPosition>,
  defaultRadius: number,
  defaultY: number,
): void {
  // Group by parentId; orphans go onto the outer ring evenly spaced.
  const byParent = new Map<string | undefined, ArchitectureEntity[]>();
  for (const c of components) {
    const key = c.parentId;
    const list = byParent.get(key) ?? [];
    list.push(c);
    byParent.set(key, list);
  }

  for (const [parentId, list] of byParent.entries()) {
    if (parentId && positions.has(parentId)) {
      const p = positions.get(parentId)!;
      const r = 2.0;
      list.forEach((c, i) => {
        if (c.position3D) { positions.set(c.id, c.position3D); return; }
        const angle = (i / list.length) * Math.PI * 2;
        positions.set(c.id, {
          x: p.x + Math.cos(angle) * r,
          y: p.y - 1.5,
          z: p.z + Math.sin(angle) * r,
        });
      });
    } else {
      // Orphans: place evenly on the default ring
      list.forEach((c, i) => {
        if (c.position3D) { positions.set(c.id, c.position3D); return; }
        const angle = (i / Math.max(list.length, arch.entities.length)) * Math.PI * 2;
        positions.set(c.id, {
          x: Math.cos(angle) * defaultRadius,
          y: defaultY,
          z: Math.sin(angle) * defaultRadius,
        });
      });
    }
  }
}

export function use3DLayout(architecture: NormalizedArchitecture | null): ThreeDLayoutResult {
  return useMemo(
    () => {
      if (!architecture) return { positions: new Map(), ringByCategory: new Map() };
      return compute3DLayout(architecture);
    },
    [architecture],
  );
}
