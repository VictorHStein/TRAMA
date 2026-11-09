import { useMemo } from 'react';
import type {
  ArchitectureEntity,
  ArchitectureRelation,
  NormalizedArchitecture,
} from '../../domain/model/ArchitectureTypes';

export const NODE_WIDTH = 184;
export const NODE_HEIGHT = 56;
const COL_GAP = 44;         // horizontal gap between unrelated cards on a row
const SIBLING_STEP = NODE_WIDTH + 24;  // step between siblings of the same parent
const GROUP_GAP = 56;       // extra gap between groups belonging to different parents
const ROW_GAP = 128;        // vertical room between rows for the curved edges

/**
 * Layered top-to-bottom layout.
 *
 *  • Each category is a horizontal row.
 *  • Within a row, entities WITHOUT a parent are spread evenly across the row.
 *  • Entities WITH a parent are clustered directly under that parent: their
 *    group is centred on the parent's X, with `SIBLING_STEP` between siblings.
 *
 *  Result: subsystems read 1.1 → 1.7 left-to-right, and the components of
 *  each subsystem sit visually right below it (1.X.1, 1.X.2, …).
 *
 *  Sibling groups that would overlap each other on the X axis are pushed
 *  apart by `GROUP_GAP` so neighbouring families never crash.
 *
 *  If an entity already has `position2D`, that wins.
 */
export interface LayoutPosition {
  x: number;
  y: number;
  row: number;
  col: number;
}

export interface FamilyBox {
  parentId: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FlowLayoutResult {
  positions: Map<string, LayoutPosition>;
  rows: Array<{ id: string; label: string; color: string; y: number; height: number }>;
  /** Bounding boxes of sibling groups (components of one subsystem). */
  families: FamilyBox[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

export function computeFlowLayout(
  architecture: NormalizedArchitecture,
  visibleEntities: ArchitectureEntity[],
): FlowLayoutResult {
  const positions = new Map<string, LayoutPosition>();
  const rowsOut: FlowLayoutResult['rows'] = [];
  const familyBoxes: FamilyBox[] = [];

  const categoryOrder = architecture.categories.map((c) => c.id);

  // Ordinal per entity in JSON declaration order — same order PBS codes use.
  const ordinal = new Map<string, number>();
  architecture.entities.forEach((e, i) => ordinal.set(e.id, i));

  // Group visible entities by category
  const byCategory = new Map<string, ArchitectureEntity[]>();
  for (const e of visibleEntities) {
    const list = byCategory.get(e.category) ?? [];
    list.push(e);
    byCategory.set(e.category, list);
  }

  let rowIndex = 0;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  for (const catId of categoryOrder) {
    const list = byCategory.get(catId);
    if (!list || list.length === 0) continue;

    const cat = architecture.categoriesById[catId];
    const rowY = rowIndex * (NODE_HEIGHT + ROW_GAP);

    // Split into rooted (have a placed parent) vs orphans (no parent or
    // parent not yet placed — e.g. siblings on the same row).
    const rooted: ArchitectureEntity[] = [];
    const orphans: ArchitectureEntity[] = [];
    for (const e of list) {
      if (e.parentId && positions.has(e.parentId)) rooted.push(e);
      else orphans.push(e);
    }

    // Stable sub-sort by declaration ordinal so the visible order matches
    // 1.X.1, 1.X.2 …
    const byOrdinal = (a: ArchitectureEntity, b: ArchitectureEntity) =>
      (ordinal.get(a.id) ?? 0) - (ordinal.get(b.id) ?? 0);
    rooted.sort(byOrdinal);
    orphans.sort(byOrdinal);

    // Cluster rooted entities by parent so each family stays together.
    const families = new Map<string, ArchitectureEntity[]>();
    for (const e of rooted) {
      const list = families.get(e.parentId!) ?? [];
      list.push(e);
      families.set(e.parentId!, list);
    }

    // Compute each family's centred range under its parent
    type Placement = { entity: ArchitectureEntity; x: number };
    const placements: Placement[] = [];

    // First, families ordered by parent X (so left-to-right children groups)
    const familyEntries = [...families.entries()].sort((a, b) => {
      const ax = positions.get(a[0])?.x ?? 0;
      const bx = positions.get(b[0])?.x ?? 0;
      return ax - bx;
    });

    // Each family is centred under its parent; a family that would overlap the
    // previous one shifts right as a block, so families stay contiguous and in
    // their parents' order (a wide family never swallows a small neighbour).
    let prevEnd = -Infinity;
    for (const [parentId, members] of familyEntries) {
      const parentPos = positions.get(parentId)!;
      const px = parentPos.x + NODE_WIDTH / 2; // parent centre X
      const n = members.length;
      const groupSpan = n * SIBLING_STEP - (SIBLING_STEP - NODE_WIDTH);
      const startX = Math.max(px - groupSpan / 2, prevEnd + GROUP_GAP);
      members.forEach((e, i) => {
        placements.push({ entity: e, x: startX + i * SIBLING_STEP });
      });
      prevEnd = startX + groupSpan;
    }

    // Place orphans evenly. If there are also rooted, sit them on the
    // left side of the row so they don't conflict.
    if (orphans.length > 0) {
      const orphanCount = orphans.length;
      const step = NODE_WIDTH + COL_GAP;
      const totalW = orphanCount * step - COL_GAP;
      const start = placements.length > 0
        ? Math.min(...placements.map((p) => p.x)) - totalW - GROUP_GAP
        : -totalW / 2;
      orphans.forEach((e, i) => {
        placements.push({ entity: e, x: start + i * step });
      });
    }

    // Centre the whole row around X=0 (for nicer fitView)
    if (placements.length > 0) {
      const allX = placements.map((p) => p.x);
      const rowMin = Math.min(...allX);
      const rowMax = Math.max(...allX) + NODE_WIDTH;
      const rowCentre = (rowMin + rowMax) / 2;
      for (const p of placements) p.x -= rowCentre;
    }

    // Commit positions
    placements.sort((a, b) => a.x - b.x);
    placements.forEach((p, i) => {
      let x = p.x;
      let y = rowY;
      if (p.entity.position2D) {
        x = p.entity.position2D.x;
        y = p.entity.position2D.y;
      }
      positions.set(p.entity.id, { x, y, row: rowIndex, col: i });
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + NODE_WIDTH);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + NODE_HEIGHT);
    });

    rowsOut.push({
      id: catId,
      label: cat?.label ?? catId,
      color: cat?.color ?? '#94a3b8',
      y: rowY - 26,
      height: NODE_HEIGHT + 52,
    });

    // Family outlines: the committed positions of each parent's children.
    for (const [parentId, members] of familyEntries) {
      const xs = members.map((e) => positions.get(e.id)?.x).filter((x): x is number => x !== undefined);
      if (xs.length === 0) continue;
      const fx = Math.min(...xs) - 10;
      const fw = Math.max(...xs) + NODE_WIDTH + 10 - fx;
      familyBoxes.push({ parentId, color: cat?.color ?? '#94a3b8', x: fx, y: rowY - 10, width: fw, height: NODE_HEIGHT + 20 });
    }

    rowIndex += 1;
  }

  if (!isFinite(minX)) {
    minX = 0; maxX = 0; minY = 0; maxY = 0;
  }

  return { positions, rows: rowsOut, families: familyBoxes, bounds: { minX, maxX, minY, maxY } };
}

export function useFlowLayout(
  architecture: NormalizedArchitecture | null,
  visibleEntities: ArchitectureEntity[],
  _relations: ArchitectureRelation[],
): FlowLayoutResult {
  return useMemo(
    () => {
      if (!architecture) return { positions: new Map(), rows: [], families: [], bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } };
      return computeFlowLayout(architecture, visibleEntities);
    },
    [architecture, visibleEntities],
  );
}
