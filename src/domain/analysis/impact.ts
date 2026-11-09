/**
 * Impact analysis: "if I change X, what is affected?" and "what does X depend on?".
 *
 * Walks three kinds of edges:
 *   - directed relations (source → target) in both directions,
 *   - the product tree (parentId),
 *   - parameter dependencies from the engine (A.p uses B.q ⇒ A depends on B).
 */
import type { NormalizedArchitecture } from '../model/ArchitectureTypes';

export interface ImpactResult {
  /** Entities that X depends on (changing them changes X). */
  upstream: string[];
  /** Entities affected by a change in X. */
  downstream: string[];
  /** Subset of downstream reached only through parameter formulas. */
  viaParameters: string[];
  /** Relation ids on any path. */
  relationIds: string[];
}

export function computeImpact(arch: NormalizedArchitecture, entityId: string): ImpactResult {
  const succ = new Map<string, Set<string>>();
  const pred = new Map<string, Set<string>>();
  const paramSucc = new Map<string, Set<string>>();
  const add = (m: Map<string, Set<string>>, a: string, b: string) => {
    if (!m.has(a)) m.set(a, new Set());
    m.get(a)!.add(b);
  };
  for (const r of arch.relations) {
    add(succ, r.source, r.target);
    add(pred, r.target, r.source);
  }
  for (const e of arch.entities) {
    if (e.parentId) {
      // A child changing affects its parent (roll-ups); a parent changing affects its children.
      add(succ, e.id, e.parentId);
      add(pred, e.parentId, e.id);
      add(succ, e.parentId, e.id);
      add(pred, e.id, e.parentId);
    }
  }
  for (const p of Object.values(arch.evaluation.params)) {
    for (const dep of p.dependencies) {
      const depEntity = dep.split('.')[0];
      if (depEntity !== p.entityId) {
        add(succ, depEntity, p.entityId);
        add(pred, p.entityId, depEntity);
        add(paramSucc, depEntity, p.entityId);
      }
    }
  }

  const bfs = (start: string, m: Map<string, Set<string>>): string[] => {
    const seen = new Set<string>([start]);
    const queue = [start];
    const out: string[] = [];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const n of m.get(cur) ?? []) {
        if (seen.has(n)) continue;
        seen.add(n);
        out.push(n);
        queue.push(n);
      }
    }
    return out;
  };

  const downstream = bfs(entityId, succ);
  const upstream = bfs(entityId, pred);
  const viaParameters = bfs(entityId, paramSucc);
  const involved = new Set([entityId, ...downstream, ...upstream]);
  const relationIds = arch.relations
    .filter((r) => involved.has(r.source) && involved.has(r.target))
    .map((r) => r.id);
  return { upstream, downstream, viaParameters, relationIds };
}
