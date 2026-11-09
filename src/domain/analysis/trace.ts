/**
 * Multi-path traceability.
 *
 * The TG1 chain (`traceById`) kept only the FIRST requirement/function found
 * for an entity. Real architectures are DAGs: one component implements
 * several functions that satisfy several requirements. `computeTraceSets`
 * keeps every path, so the inspector can list all of them and the audit can
 * measure coverage honestly.
 *
 * Relation semantics (same ids the TG1 demo established):
 *   allocated_to : requirement → function, function → subsystem | component
 *   satisfies    : X → requirement
 *   verifies     : verification → requirement
 *   parentId     : component ⊂ subsystem ⊂ segment; objective ⊂ mission
 *   derives_from : requirement → objective (or segment constraint)
 *   requirement.derivesFrom : requirement → parent requirement
 */
import type { ArchitectureInput } from '../model/ArchitectureTypes';

export interface TraceSets {
  mission?: string;
  /** Mission objectives the requirements derive from. */
  objectives: string[];
  /** Segments (product-tree level 1) that contain the physical elements. */
  segments: string[];
  requirements: string[];
  functions: string[];
  subsystems: string[];
  components: string[];
  verifications: string[];
}

const empty = (mission?: string): TraceSets => ({
  mission,
  objectives: [],
  segments: [],
  requirements: [],
  functions: [],
  subsystems: [],
  components: [],
  verifications: [],
});

function uniq(xs: string[]): string[] {
  return [...new Set(xs)];
}

export function computeTraceSets(input: ArchitectureInput): Record<string, TraceSets> {
  const byId = Object.fromEntries(input.entities.map((e) => [e.id, e]));
  const cat = (id: string) => byId[id]?.category;
  const missionId = input.entities.find((e) => e.category === 'mission')?.id;

  const allocatedFrom = new Map<string, string[]>(); // source → targets
  const allocatedTo = new Map<string, string[]>();   // target → sources
  const satisfiesOf = new Map<string, string[]>();   // requirement → satisfiers
  const verifiesOf = new Map<string, string[]>();    // requirement → verifications
  const push = (m: Map<string, string[]>, k: string, v: string) => m.set(k, [...(m.get(k) ?? []), v]);

  const derivedFrom = new Map<string, string[]>();   // requirement → origins
  for (const r of input.relations) {
    if (r.type === 'allocated_to') { push(allocatedFrom, r.source, r.target); push(allocatedTo, r.target, r.source); }
    else if (r.type === 'satisfies') push(satisfiesOf, r.target, r.source);
    else if (r.type === 'verifies') push(verifiesOf, r.target, r.source);
    else if (r.type === 'derives_from') push(derivedFrom, r.source, r.target);
  }
  for (const v of input.verifications ?? []) {
    if (v.verifierId) push(verifiesOf, v.requirementId, v.verifierId);
  }
  const children = new Map<string, string[]>();
  for (const e of input.entities) if (e.parentId) push(children, e.parentId, e.id);

  // Objectives a requirement comes from (directly, or through a parent requirement).
  const objectivesOfReq = (req: string, seen = new Set<string>()): string[] => {
    if (seen.has(req)) return [];
    seen.add(req);
    const origins = [...(derivedFrom.get(req) ?? []), ...(byId[req]?.requirement?.derivesFrom ?? [])];
    return uniq(origins.flatMap((o) => (cat(o) === 'objective' ? [o] : cat(o) === 'requirement' ? objectivesOfReq(o, seen) : [])));
  };
  // Segment that contains a physical element (first ancestor of category segment).
  const segmentOf = (id: string): string | undefined => {
    let cur: (typeof input.entities)[number] | undefined = byId[id];
    for (let guard = 0; cur && guard < 20; guard++) {
      if (cur.category === 'segment') return cur.id;
      cur = cur.parentId ? byId[cur.parentId] : undefined;
    }
    return undefined;
  };
  const segmentsOf = (ids: string[]) => uniq(ids.map(segmentOf).filter((s): s is string => !!s));
  const descendants = (id: string): string[] => (children.get(id) ?? []).flatMap((c) => [c, ...descendants(c)]);

  // Downstream of a requirement: functions → subsystems/components (+ satisfiers), verifications.
  const reqDown = new Map<string, TraceSets>();
  for (const e of input.entities) {
    if (e.category !== 'requirement') continue;
    const t = empty(missionId);
    t.requirements = [e.id];
    const fns = (allocatedFrom.get(e.id) ?? []).filter((x) => cat(x) === 'function');
    t.functions = uniq(fns);
    const targets = fns.flatMap((f) => allocatedFrom.get(f) ?? []);
    const satisfiers = satisfiesOf.get(e.id) ?? [];
    t.subsystems = uniq([...targets, ...satisfiers].filter((x) => cat(x) === 'subsystem'));
    t.components = uniq([...targets, ...satisfiers].filter((x) => cat(x) === 'component'));
    t.verifications = uniq(verifiesOf.get(e.id) ?? []);
    t.objectives = objectivesOfReq(e.id);
    t.segments = uniq([...segmentsOf([...t.subsystems, ...t.components]), ...satisfiers.filter((x) => cat(x) === 'segment')]);
    reqDown.set(e.id, t);
  }
  const objectivesOf = (reqs: string[]) => uniq(reqs.flatMap((r) => objectivesOfReq(r)));

  // Upstream requirements of every function / subsystem / component.
  const reqsOfFunction = (f: string) => (allocatedTo.get(f) ?? []).filter((x) => cat(x) === 'requirement');
  const fnsOfPhysical = (p: string) => (allocatedTo.get(p) ?? []).filter((x) => cat(x) === 'function');
  const satisfiedBy = (p: string) =>
    input.relations.filter((r) => r.type === 'satisfies' && r.source === p).map((r) => r.target);

  const out: Record<string, TraceSets> = {};
  for (const e of input.entities) {
    let t: TraceSets;
    switch (e.category) {
      case 'requirement': {
        t = { ...reqDown.get(e.id)! };
        // Parent requirements (derivesFrom) are part of the upstream story.
        t.requirements = uniq([e.id, ...(e.requirement?.derivesFrom ?? [])]);
        break;
      }
      case 'function': {
        t = empty(missionId);
        t.functions = [e.id];
        t.requirements = uniq(reqsOfFunction(e.id));
        const targets = allocatedFrom.get(e.id) ?? [];
        t.subsystems = uniq(targets.filter((x) => cat(x) === 'subsystem'));
        t.components = uniq(targets.filter((x) => cat(x) === 'component'));
        t.verifications = uniq(t.requirements.flatMap((r) => verifiesOf.get(r) ?? []));
        t.objectives = objectivesOf(t.requirements);
        t.segments = segmentsOf(targets);
        break;
      }
      case 'subsystem': {
        t = empty(missionId);
        t.subsystems = [e.id];
        t.functions = uniq(fnsOfPhysical(e.id));
        t.requirements = uniq([...t.functions.flatMap(reqsOfFunction), ...satisfiedBy(e.id)]);
        t.components = uniq(children.get(e.id) ?? []);
        t.verifications = uniq(t.requirements.flatMap((r) => verifiesOf.get(r) ?? []));
        t.objectives = objectivesOf(t.requirements);
        t.segments = segmentsOf([e.id]);
        break;
      }
      case 'segment': {
        t = empty(missionId);
        t.segments = [e.id];
        const inside = descendants(e.id);
        t.subsystems = inside.filter((x) => cat(x) === 'subsystem');
        t.components = inside.filter((x) => cat(x) === 'component');
        t.functions = uniq(inside.flatMap(fnsOfPhysical));
        t.requirements = uniq([...satisfiedBy(e.id), ...inside.flatMap(satisfiedBy), ...t.functions.flatMap(reqsOfFunction)]);
        t.verifications = uniq(t.requirements.flatMap((r) => verifiesOf.get(r) ?? []));
        t.objectives = objectivesOf(t.requirements);
        break;
      }
      case 'objective': {
        t = empty(missionId);
        t.objectives = [e.id];
        const reqs = input.entities.filter((x) => x.category === 'requirement' && objectivesOfReq(x.id).includes(e.id)).map((x) => x.id);
        const downs = reqs.map((r) => reqDown.get(r)).filter(Boolean) as TraceSets[];
        t.requirements = reqs;
        t.functions = uniq(downs.flatMap((d) => d.functions));
        t.subsystems = uniq(downs.flatMap((d) => d.subsystems));
        t.components = uniq(downs.flatMap((d) => d.components));
        t.segments = uniq(downs.flatMap((d) => d.segments));
        t.verifications = uniq(downs.flatMap((d) => d.verifications));
        break;
      }
      case 'component': {
        t = empty(missionId);
        t.components = [e.id];
        const parent = e.parentId && cat(e.parentId) === 'subsystem' ? e.parentId : undefined;
        t.subsystems = parent ? [parent] : [];
        const ownFns = fnsOfPhysical(e.id);
        const parentFns = parent ? fnsOfPhysical(parent) : [];
        t.functions = uniq([...ownFns, ...parentFns]);
        t.requirements = uniq([
          ...t.functions.flatMap(reqsOfFunction),
          ...satisfiedBy(e.id),
          ...(parent ? satisfiedBy(parent) : []),
        ]);
        t.verifications = uniq(t.requirements.flatMap((r) => verifiesOf.get(r) ?? []));
        t.objectives = objectivesOf(t.requirements);
        t.segments = segmentsOf([e.id]);
        break;
      }
      case 'verification': {
        t = empty(missionId);
        t.verifications = [e.id];
        const reqs = input.relations.filter((r) => r.type === 'verifies' && r.source === e.id).map((r) => r.target);
        t.requirements = uniq(reqs);
        const downs = reqs.map((r) => reqDown.get(r)).filter(Boolean) as TraceSets[];
        t.functions = uniq(downs.flatMap((d) => d.functions));
        t.subsystems = uniq(downs.flatMap((d) => d.subsystems));
        t.components = uniq(downs.flatMap((d) => d.components));
        t.objectives = objectivesOf(reqs);
        t.segments = uniq(downs.flatMap((d) => d.segments));
        break;
      }
      default: {
        t = empty(missionId);
        if (e.category === 'mission') {
          t.requirements = input.entities.filter((x) => x.category === 'requirement').map((x) => x.id);
          t.objectives = input.entities.filter((x) => x.category === 'objective').map((x) => x.id);
          t.segments = input.entities.filter((x) => x.category === 'segment').map((x) => x.id);
        }
      }
    }
    out[e.id] = t;
  }
  return out;
}
