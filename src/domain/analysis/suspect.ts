/**
 * Suspect links, as in DOORS ("link validity"), Jama and Doorstop: a
 * traceability link stores a fingerprint of both ends when it is reviewed;
 * when either end changes afterwards, the link becomes suspect until someone
 * checks that it still holds and marks it as reviewed again.
 *
 * The fingerprint covers what an engineer would call the content of an
 * element (name, description, code, requirement text and rule, declared
 * parameters) and, for an element that contains others, the content of its
 * descendants: a new battery capacity is a change in the EPS that satisfies
 * the autonomy requirement.
 */
import type { ArchitectureEntity, ArchitectureInput, ArchitectureRelation, NormalizedArchitecture } from '../model/ArchitectureTypes';
import { TRACE_TYPES } from './matrices';

function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function ownContent(e: ArchitectureEntity): unknown {
  return {
    name: e.name,
    description: e.description ?? null,
    code: e.code ?? null,
    requirement: e.requirement ? { text: e.requirement.text ?? null, rule: e.requirement.rule ?? null, type: e.requirement.type ?? null } : null,
    parameters: [...(e.parameters ?? [])]
      .map((p) => ({ id: p.id, value: p.value ?? null, formula: p.formula ?? null, unit: p.unit }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}

/** Fingerprint of an element and everything it contains. */
export function entityFingerprint(entities: ArchitectureEntity[], id: string): string {
  const byParent = new Map<string, ArchitectureEntity[]>();
  for (const e of entities) if (e.parentId) byParent.set(e.parentId, [...(byParent.get(e.parentId) ?? []), e]);
  const self = entities.find((e) => e.id === id);
  if (!self) return '';
  const parts: unknown[] = [ownContent(self)];
  const stack = [...(byParent.get(id) ?? [])];
  const seen = new Set<string>([id]);
  const inside: ArchitectureEntity[] = [];
  while (stack.length) {
    const c = stack.pop()!;
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    inside.push(c);
    stack.push(...(byParent.get(c.id) ?? []));
  }
  inside.sort((a, b) => a.id.localeCompare(b.id));
  for (const c of inside) parts.push([c.id, ownContent(c)]);
  return fnv1a(JSON.stringify(parts));
}

export interface SuspectLink {
  relationId: string;
  /** Which ends changed since the last review. */
  changed: ('source' | 'target')[];
}

export type LinkReviewState = 'reviewed' | 'suspect' | 'untracked';

export function linkReviewState(arch: NormalizedArchitecture | ArchitectureInput, relation: ArchitectureRelation): { state: LinkReviewState; changed: ('source' | 'target')[] } {
  if (!relation.reviewed) return { state: 'untracked', changed: [] };
  const changed: ('source' | 'target')[] = [];
  if (entityFingerprint(arch.entities, relation.source) !== relation.reviewed.source) changed.push('source');
  if (entityFingerprint(arch.entities, relation.target) !== relation.reviewed.target) changed.push('target');
  return { state: changed.length > 0 ? 'suspect' : 'reviewed', changed };
}

/** Links whose ends changed since they were last reviewed. */
export function computeSuspectLinks(arch: NormalizedArchitecture | ArchitectureInput): SuspectLink[] {
  const out: SuspectLink[] = [];
  for (const r of arch.relations) {
    const s = linkReviewState(arch, r);
    if (s.state === 'suspect') out.push({ relationId: r.id, changed: s.changed });
  }
  return out;
}

/**
 * Stamps the current fingerprints on the given relations (by default, every
 * traceability relation), so they start (or go back to) the reviewed state.
 * Mutates the input document; returns how many links were stamped.
 */
export function stampReview(doc: ArchitectureInput, relationIds?: string[], at = new Date().toISOString().slice(0, 10)): number {
  const wanted = relationIds ? new Set(relationIds) : null;
  let n = 0;
  for (const r of doc.relations) {
    if (wanted ? !wanted.has(r.id) : !TRACE_TYPES.has(r.type)) continue;
    r.reviewed = { source: entityFingerprint(doc.entities, r.source), target: entityFingerprint(doc.entities, r.target), at };
    n++;
  }
  return n;
}
