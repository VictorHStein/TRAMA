/**
 * Engineering matrices derived from the normalized model:
 *   - N² (DSM) of physical interfaces between subsystems or components;
 *   - VCRM (Verification Cross Reference Matrix) with propagated status;
 *   - 5×5 risk grid (probability × impact).
 * Pure functions; the Matrizes view and the exports share them.
 */
import type {
  ArchitectureEntity, ArchitectureRelation, NormalizedArchitecture, RiskEntry, VerificationEntry, VerificationStatus,
} from '../model/ArchitectureTypes';

/** Relation types that represent traceability rather than a physical/logical interface. */
export const TRACE_TYPES = new Set(['allocated_to', 'satisfies', 'verifies', 'derives_from', 'refines', 'contains']);

/** Natural order for breakdown codes ("1.2.10" after "1.2.9", "R-002" after "R-001"). */
export function compareCodes(a: string, b: string): number {
  const pa = a.split(/[.-]/);
  const pb = b.split(/[.-]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? '';
    const y = pb[i] ?? '';
    const nx = Number(x);
    const ny = Number(y);
    const c = Number.isFinite(nx) && Number.isFinite(ny) && x !== '' && y !== '' ? nx - ny : x.localeCompare(y);
    if (c !== 0) return c;
  }
  return 0;
}

/* ── N² ───────────────────────────────────────────────────── */

export type N2Level = 'subsystem' | 'component';

export interface N2Cell {
  from: string;
  to: string;
  relations: ArchitectureRelation[];
}

export interface N2Matrix {
  level: N2Level;
  nodes: ArchitectureEntity[];
  /** Keyed by `${from}|${to}`. */
  cells: Record<string, N2Cell>;
  totalInterfaces: number;
  countByType: Record<string, number>;
  /** Entities that appear in the matrix as their own node (rollup target per physical entity). */
  nodeOf: Record<string, string>;
}

export function computeN2(arch: NormalizedArchitecture, level: N2Level): N2Matrix {
  const physical = arch.entities.filter((e) => e.category === 'subsystem' || e.category === 'component');
  const byId = arch.entitiesById;
  const rootSubsystem = (e: ArchitectureEntity): string | null => {
    let cur: ArchitectureEntity | undefined = e;
    while (cur) {
      if (cur.category === 'subsystem') return cur.id;
      cur = cur.parentId ? byId[cur.parentId] : undefined;
    }
    return null;
  };
  const nodeOf: Record<string, string> = {};
  let nodes: ArchitectureEntity[];
  if (level === 'subsystem') {
    const set = new Map<string, ArchitectureEntity>();
    for (const e of physical) {
      const root = rootSubsystem(e) ?? e.id;
      nodeOf[e.id] = root;
      set.set(root, byId[root]);
    }
    nodes = [...set.values()];
  } else {
    nodes = physical;
    for (const e of physical) nodeOf[e.id] = e.id;
  }
  nodes.sort((a, b) => compareCodes(arch.breakdownCodes[a.id] ?? a.id, arch.breakdownCodes[b.id] ?? b.id));

  const cells: Record<string, N2Cell> = {};
  const countByType: Record<string, number> = {};
  let total = 0;
  for (const r of arch.relations) {
    if (TRACE_TYPES.has(r.type)) continue;
    const a = nodeOf[r.source];
    const b = nodeOf[r.target];
    if (!a || !b || a === b) continue;
    const key = `${a}|${b}`;
    (cells[key] ??= { from: a, to: b, relations: [] }).relations.push(r);
    countByType[r.type] = (countByType[r.type] ?? 0) + 1;
    total++;
  }
  return { level, nodes, cells, totalInterfaces: total, countByType, nodeOf };
}

/* ── VCRM ─────────────────────────────────────────────────── */

export const VCRM_METHODS = ['Test', 'Analysis', 'Inspection', 'Review of Design', 'Demonstration', 'Rule'] as const;
export type VcrmMethod = (typeof VCRM_METHODS)[number];
export const VCRM_METHOD_SHORT: Record<VcrmMethod, string> = {
  Test: 'E', Analysis: 'A', Inspection: 'I', 'Review of Design': 'R', Demonstration: 'D', Rule: 'Regra',
};

export type VcrmStatus = 'verified' | 'failed' | 'in_progress' | 'planned' | 'none';

export interface VcrmRow {
  requirementId: string;
  code: string;
  name: string;
  text?: string;
  type?: string;
  priority?: string;
  plannedMethod?: string;
  level?: string;
  rule?: { expression: string; result: 'pass' | 'fail' | 'error' | 'unknown' };
  /** Explicit entries from `verifications` plus synthetic ones from verification entities linked by "verifies". */
  entries: VerificationEntry[];
  byMethod: Record<VcrmMethod, VerificationEntry[]>;
  itemIds: string[];
  verifierIds: string[];
  status: VcrmStatus;
}

export interface Vcrm {
  rows: VcrmRow[];
  summary: Record<VcrmStatus, number>;
  coverage: { withPlan: number; withEvidence: number; closed: number; total: number };
}

const CLOSED: VerificationStatus[] = ['passed', 'verified', 'waived'];

/**
 * Status from verification entries only. A parametric rule is a design
 * prediction (shown in its own column); it never closes a requirement,
 * which needs evidence on the product (ECSS-E-ST-10-02C, NASA SP-2016-6105 §5.3).
 */

function propagate(statuses: VerificationStatus[]): VcrmStatus {
  const all = [...statuses];
  if (all.length === 0) return 'none';
  if (all.includes('failed')) return 'failed';
  if (all.every((s) => CLOSED.includes(s))) return 'verified';
  if (all.includes('in_progress') || all.some((s) => CLOSED.includes(s))) return 'in_progress';
  return 'planned';
}

export function computeVcrm(arch: NormalizedArchitecture): Vcrm {
  const requirements = arch.entities
    .filter((e) => e.category === 'requirement')
    .sort((a, b) => compareCodes(arch.breakdownCodes[a.id] ?? a.id, arch.breakdownCodes[b.id] ?? b.id));
  const entriesByReq = new Map<string, VerificationEntry[]>();
  for (const v of arch.verifications ?? []) {
    (entriesByReq.get(v.requirementId) ?? entriesByReq.set(v.requirementId, []).get(v.requirementId)!).push(v);
  }
  const rows: VcrmRow[] = requirements.map((r) => {
    const explicit = entriesByReq.get(r.id) ?? [];
    const referenced = new Set(explicit.map((v) => v.verifierId).filter(Boolean));
    const linked = arch.traceAll[r.id]?.verifications ?? [];
    const synthetic: VerificationEntry[] = linked
      .filter((vid) => !referenced.has(vid))
      .map((vid) => {
        const v = arch.entitiesById[vid];
        const method = (v?.metadata?.method as VcrmMethod | undefined) ?? r.requirement?.verification?.method ?? 'Test';
        return {
          id: `entity:${vid}`,
          requirementId: r.id,
          method,
          level: (v?.metadata?.level as string | undefined) ?? r.requirement?.verification?.level,
          status: v?.status ?? 'planned',
          description: v?.name,
          verifierId: vid,
        };
      });
    const entries = [...explicit, ...synthetic];
    const byMethod = Object.fromEntries(VCRM_METHODS.map((m) => [m, entries.filter((e) => e.method === m)])) as Record<VcrmMethod, VerificationEntry[]>;
    const evRule = arch.evaluation.rules[r.id];
    const rule = evRule ? { expression: evRule.expression, result: evRule.result } : undefined;
    return {
      requirementId: r.id,
      code: arch.breakdownCodes[r.id] ?? r.id,
      name: r.short ?? r.name,
      text: r.requirement?.text,
      type: r.requirement?.type,
      priority: r.requirement?.priority,
      plannedMethod: r.requirement?.verification?.method,
      level: r.requirement?.verification?.level,
      rule,
      entries,
      byMethod,
      itemIds: [...new Set(entries.map((e) => e.itemId).filter((x): x is string => !!x))],
      verifierIds: [...new Set(entries.map((e) => e.verifierId).filter((x): x is string => !!x))],
      status: propagate(entries.map((e) => e.status)),
    };
  });
  const summary: Record<VcrmStatus, number> = { verified: 0, failed: 0, in_progress: 0, planned: 0, none: 0 };
  for (const row of rows) summary[row.status]++;
  return {
    rows,
    summary,
    coverage: {
      withPlan: rows.filter((r) => r.plannedMethod || r.entries.length > 0 || r.rule).length,
      withEvidence: rows.filter((r) => r.entries.some((e) => e.evidence)).length,
      closed: rows.filter((r) => r.status === 'verified').length,
      total: rows.length,
    },
  };
}

/* ── Risks ────────────────────────────────────────────────── */

export type RiskBand = 'low' | 'medium' | 'high';

export function riskBand(probability: number, impact: number): RiskBand {
  const s = probability * impact;
  return s >= 15 ? 'high' : s >= 8 ? 'medium' : 'low';
}

export interface RiskGrid {
  /** Keyed by `${probability}-${impact}`. */
  cells: Record<string, RiskEntry[]>;
  risks: (RiskEntry & { score: number; band: RiskBand })[];
  counts: Record<RiskBand, number>;
  open: number;
}

export function computeRiskGrid(arch: NormalizedArchitecture): RiskGrid {
  const cells: Record<string, RiskEntry[]> = {};
  const counts: Record<RiskBand, number> = { low: 0, medium: 0, high: 0 };
  const risks = (arch.risks ?? []).map((r) => {
    const band = riskBand(r.probability, r.impact);
    counts[band]++;
    (cells[`${r.probability}-${r.impact}`] ??= []).push(r);
    return { ...r, score: r.probability * r.impact, band };
  }).sort((a, b) => b.score - a.score);
  return { cells, risks, counts, open: risks.filter((r) => r.status === 'open').length };
}
