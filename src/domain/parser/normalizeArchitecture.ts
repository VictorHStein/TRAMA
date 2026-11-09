import type {
  ArchitectureInput,
  ArchitectureRelation,
  NormalizedArchitecture,
  TraceChain,
} from '../model/ArchitectureTypes';
import { evaluateModel } from '../engine/evaluate';
import { computeTraceSets } from '../analysis/trace';

/**
 * Build lookup tables and derived counters from a validated ArchitectureInput.
 * The output is what every visualization actually consumes.
 *
 * Derived data added here:
 *  - lookups by id (entities, relationTypes, categories)
 *  - relationsByEntity (both directions)
 *  - maxStep
 *  - breakdownCodes (PBS/RBS-style hierarchical numbering)
 *  - traceById (Mission → Req → Fn → Sub → Comp + Verifs per entity)
 */
export function normalizeArchitecture(input: ArchitectureInput): NormalizedArchitecture {
  const entitiesById = Object.fromEntries(input.entities.map((e) => [e.id, e]));
  const relationTypesById = Object.fromEntries(input.relationTypes.map((r) => [r.id, r]));
  const categoriesById = Object.fromEntries(input.categories.map((c) => [c.id, c]));

  const relationsByEntity: Record<string, { incoming: ArchitectureRelation[]; outgoing: ArchitectureRelation[] }> = {};
  for (const e of input.entities) {
    relationsByEntity[e.id] = { incoming: [], outgoing: [] };
  }
  for (const r of input.relations) {
    if (relationsByEntity[r.source]) relationsByEntity[r.source].outgoing.push(r);
    if (relationsByEntity[r.target]) relationsByEntity[r.target].incoming.push(r);
  }

  const declaredMax = input.views?.maxStep ?? 0;
  const scannedMax = Math.max(
    0,
    ...input.entities.map((e) => e.step),
    ...input.relations.map((r) => r.step),
  );
  const maxStep = Math.max(declaredMax, scannedMax, 1);

  const breakdownCodes = computeBreakdownCodes(input);
  const traceById = computeTraceChains(input);
  const traceAll = computeTraceSets(input);
  const evaluation = evaluateModel(input);

  return {
    ...input,
    entitiesById,
    relationTypesById,
    categoriesById,
    relationsByEntity,
    maxStep,
    breakdownCodes,
    traceById,
    traceAll,
    evaluation,
  };
}

/* ── PBS / WBS codes ────────────────────────────────────────── */

const CATEGORY_PREFIX: Record<string, string> = {
  mission: '1',
  subsystem: '',     // chained under its segment, or under the mission
  component: '',     // chained under subsystem
  requirement: 'R',
  function: 'F',
  verification: 'V',
  objective: 'OBJ',
  segment: '',       // product-tree level 1 when present
};

function computeBreakdownCodes(input: ArchitectureInput): Record<string, string> {
  const codes: Record<string, string> = {};

  const mission = input.entities.find((e) => e.category === 'mission');
  const segments = input.entities.filter((e) => e.category === 'segment');

  if (segments.length > 0) {
    // Product tree with segments: mission = level 0, segments "1", "2", "3",
    // subsystems "1.1", "2.1"… under their segment.
    if (mission) codes[mission.id] = '0';
    segments.forEach((s, i) => { codes[s.id] = String(i + 1); });
    const counter = new Map<string, number>();
    for (const s of input.entities.filter((e) => e.category === 'subsystem')) {
      const base = s.parentId && codes[s.parentId] && segments.some((g) => g.id === s.parentId) ? codes[s.parentId] : '0';
      const next = (counter.get(base) ?? 0) + 1;
      counter.set(base, next);
      codes[s.id] = `${base}.${next}`;
    }
  } else {
    // Legacy tree: mission "1", subsystems "1.1", "1.2", "1.3"…
    const missionCode = mission ? '1' : '';
    if (mission) codes[mission.id] = missionCode;
    input.entities.filter((e) => e.category === 'subsystem').forEach((s, i) => {
      codes[s.id] = `${missionCode || '1'}.${i + 1}`;
    });
  }
  const missionCode = mission ? codes[mission.id] : '';

  // Components → child of their parent subsystem code, in declaration order
  const components = input.entities.filter((e) => e.category === 'component');
  const childCounter = new Map<string, number>();
  for (const c of components) {
    const parentCode = c.parentId ? codes[c.parentId] : undefined;
    const base = parentCode ?? `${missionCode || '1'}.0`;
    const next = (childCounter.get(base) ?? 0) + 1;
    childCounter.set(base, next);
    codes[c.id] = `${base}.${next}`;
  }

  // Flat counters per category prefix
  const sequential = (catId: string, prefix: string, pad = 3) => {
    input.entities
      .filter((e) => e.category === catId)
      .forEach((e, i) => {
        codes[e.id] = `${prefix}-${String(i + 1).padStart(pad, '0')}`;
      });
  };
  sequential('requirement', 'R');
  sequential('function', 'F');
  sequential('verification', 'V');

  // Anything else: derive prefix from category id (first 3 letters uppercase)
  for (const e of input.entities) {
    if (codes[e.id]) continue;
    const prefix = (CATEGORY_PREFIX[e.category] || e.category.slice(0, 3).toUpperCase());
    const n = (codes[`__cnt_${prefix}`] ? Number(codes[`__cnt_${prefix}`]) : 0) + 1;
    codes[`__cnt_${prefix}`] = String(n);
    codes[e.id] = `${prefix}-${String(n).padStart(3, '0')}`;
  }
  for (const k of Object.keys(codes)) {
    if (k.startsWith('__cnt_')) delete codes[k];
  }

  // An explicit official code (REQ-001, IF-PWR-01, …) always wins over the generated one.
  for (const e of input.entities) {
    if (e.code) codes[e.id] = e.code;
  }

  return codes;
}

/* ── Trace chains ───────────────────────────────────────────── */

function computeTraceChains(input: ArchitectureInput): Record<string, TraceChain> {
  const out: Record<string, TraceChain> = {};

  const mission = input.entities.find((e) => e.category === 'mission');
  const missionId = mission?.id;

  // Index relations by type for quick lookup
  const byType = (t: string) => input.relations.filter((r) => r.type === t);
  const allocatedTo = byType('allocated_to');     // source → target
  const satisfies = byType('satisfies');          // source satisfies target (target = req)
  const verifies = byType('verifies');            // verification → req

  for (const e of input.entities) {
    const trace: TraceChain = { verifications: [] };
    if (missionId) trace.mission = missionId;

    if (e.category === 'requirement') {
      trace.requirement = e.id;
    } else if (e.category === 'function') {
      trace.function = e.id;
      // Find the requirement this function is allocated from (req allocated_to func)
      const incoming = allocatedTo.find((r) => r.target === e.id);
      if (incoming) trace.requirement = incoming.source;
    } else if (e.category === 'subsystem') {
      trace.subsystem = e.id;
      // Find via function: function allocated_to subsystem
      const fnRel = allocatedTo.find((r) => r.target === e.id);
      if (fnRel) {
        trace.function = fnRel.source;
        const reqRel = allocatedTo.find((r) => r.target === fnRel.source);
        if (reqRel) trace.requirement = reqRel.source;
      }
      // Or via satisfies relation
      const satRel = satisfies.find((r) => r.source === e.id);
      if (satRel && !trace.requirement) trace.requirement = satRel.target;
    } else if (e.category === 'component') {
      trace.component = e.id;
      if (e.parentId) {
        trace.subsystem = e.parentId;
        const fnRel = allocatedTo.find((r) => r.target === e.parentId);
        if (fnRel) {
          trace.function = fnRel.source;
          const reqRel = allocatedTo.find((r) => r.target === fnRel.source);
          if (reqRel) trace.requirement = reqRel.source;
        }
      }
    } else if (e.category === 'verification') {
      const verRel = verifies.find((r) => r.source === e.id);
      if (verRel) trace.requirement = verRel.target;
      trace.verifications.push(e.id);
    }

    // Verifications attached to this entity's requirement
    if (trace.requirement) {
      for (const v of verifies) {
        if (v.target === trace.requirement && !trace.verifications.includes(v.source)) {
          trace.verifications.push(v.source);
        }
      }
    }

    out[e.id] = trace;
  }

  return out;
}
