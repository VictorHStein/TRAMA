import type { ArchitectureRelation, NormalizedArchitecture } from '../model/ArchitectureTypes';

export interface FocusedNeighbors {
  entityIds: Set<string>;
  relationIds: Set<string>;
}

/**
 * Entities and relations that stay emphasized while something is selected
 * or focused. Shared by the 2D graph and the 3D scene so both views dim
 * exactly the same elements.
 *
 *   - Selection (click on a node)  → the entity + the endpoints of its
 *     declared relations. Children-via-parentId are NOT auto-included:
 *     only the selected element is marked, together with its relations
 *     to other parts.
 *   - Focus (HUD "Focar este elemento") → additionally its parentId
 *     children, so a subsystem can be isolated with its components.
 */
export function computeFocusedNeighbors(
  architecture: NormalizedArchitecture | null,
  selectedEntityId: string | null,
  focusedSubsystemId: string | null,
): FocusedNeighbors | null {
  if (!architecture || (!selectedEntityId && !focusedSubsystemId)) return null;
  const focusId = selectedEntityId ?? focusedSubsystemId!;
  const entityIds = new Set<string>([focusId]);
  const relationIds = new Set<string>();
  for (const r of architecture.relations) {
    if (r.source === focusId) { entityIds.add(r.target); relationIds.add(r.id); }
    if (r.target === focusId) { entityIds.add(r.source); relationIds.add(r.id); }
  }
  if (focusedSubsystemId === focusId) {
    for (const e of architecture.entities) {
      if (e.parentId === focusId) entityIds.add(e.id);
    }
  }
  return { entityIds, relationIds };
}

/**
 * For every relation, its index within the group of relations that share
 * the same (undirected) node pair, centred on zero: three parallels get
 * -1, 0, +1. Views use it to fan parallel edges/tubes apart so they never
 * draw on top of each other.
 */
export function computePairOffsets(relations: ArchitectureRelation[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const [id, g] of computePairGroups(relations)) out.set(id, g.offset);
  return out;
}

/** Same as computePairOffsets but also returns how many relations share the pair. */
export function computePairGroups(
  relations: ArchitectureRelation[],
): Map<string, { offset: number; total: number }> {
  const pairKey = (r: ArchitectureRelation) =>
    r.source < r.target ? `${r.source}|${r.target}` : `${r.target}|${r.source}`;
  const totals = new Map<string, number>();
  const order = new Map<string, number>();
  for (const r of relations) {
    const key = pairKey(r);
    order.set(r.id, totals.get(key) ?? 0);
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }
  const out = new Map<string, { offset: number; total: number }>();
  for (const r of relations) {
    const total = totals.get(pairKey(r)) ?? 1;
    const idx = order.get(r.id) ?? 0;
    out.set(r.id, { offset: total > 1 ? idx - (total - 1) / 2 : 0, total });
  }
  return out;
}
