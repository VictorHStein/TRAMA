/**
 * Parametric engine: evaluates every parameter formula, requirement rule,
 * v2 budget and operational mode of an architecture.
 *
 * Deterministic and pure: same input → same result. Runs on load (a few
 * hundred parameters evaluate in well under a millisecond) so views can
 * treat the result as static data.
 */
import type { ArchitectureInput, Maturity } from '../model/ArchitectureTypes';
import {
  ECSS_MATURITY_MARGIN,
  ExprError,
  collectDependencies,
  evaluate,
  leafOwners,
  parse,
  type AstNode,
  type ModelShape,
} from './expr';
import { orbitDerivedValues, stationDerivedValues } from '../mission/derived';
import { orbitTemperatureRange } from '../mission/thermal';

export interface EvaluatedParameter {
  key: string;
  entityId: string;
  paramId: string;
  name: string;
  unit: string;
  /** Final numeric value, or null when it could not be computed. */
  value: number | null;
  computed: boolean;
  formula?: string;
  source?: string;
  error?: string;
  dependencies: string[];
  dependents: string[];
  marginFraction: number;
  valueWithMargin: number | null;
  outOfRange?: 'min' | 'max';
  min?: number;
  max?: number;
}

export type RuleResult = 'pass' | 'fail' | 'error' | 'unknown';

export interface EvaluatedRule {
  entityId: string;
  expression: string;
  result: RuleResult;
  error?: string;
  dependencies: string[];
}

export interface BudgetRow {
  entityId: string;
  paramKey: string;
  value: number | null;
  marginFraction: number;
  valueWithMargin: number | null;
}

export type BudgetStatus = 'ok' | 'warning' | 'critical' | 'over' | 'unknown';

export interface EvaluatedBudget {
  id: string;
  label: string;
  unit: string;
  kind?: string;
  rows: BudgetRow[];
  /** Sum of the raw values. */
  nominal: number | null;
  /** Sum of the values with item margins. */
  withItemMargins: number | null;
  systemMarginFraction: number;
  /** withItemMargins × (1 + systemMargin). */
  total: number | null;
  allocated?: number;
  /** (allocated − total) / allocated. */
  marginRemainingFraction: number | null;
  status: BudgetStatus;
}

export interface EvaluatedModeLoad {
  entityId: string;
  powerW: number | null;
  parameterRef?: string;
}

export interface EvaluatedMode {
  id: string;
  name: string;
  durationFraction?: number;
  /** The expression the fraction came from, when it is not a plain number. */
  fractionExpression?: string;
  loads: EvaluatedModeLoad[];
  totalW: number | null;
}

export interface EngineIssue {
  severity: 'error' | 'warning';
  message: string;
  entityId?: string;
  paramKey?: string;
}

export interface EngineResult {
  params: Record<string, EvaluatedParameter>;
  /** Evaluation order (topological); useful for debugging and for the UI "connections" view. */
  order: string[];
  cycles: string[][];
  rules: Record<string, EvaluatedRule>;
  budgets: EvaluatedBudget[];
  modes: EvaluatedMode[];
  /** Time-weighted average power over the modes that declare a duration fraction. */
  orbitAveragePowerW: number | null;
  /** Engine-derived scalars exposed to rules as engine.<name>. */
  derived: Record<string, number>;
  issues: EngineIssue[];
}

/* ── Model shape helpers ──────────────────────────────────── */

export function buildShape(input: ArchitectureInput): ModelShape {
  const childrenOf = new Map<string, string[]>();
  const paramSet = new Set<string>();
  for (const e of input.entities) {
    for (const p of e.parameters ?? []) paramSet.add(`${e.id}.${p.id}`);
    if (e.parentId) {
      const arr = childrenOf.get(e.parentId) ?? [];
      arr.push(e.id);
      childrenOf.set(e.parentId, arr);
    }
  }
  const descendantsCache = new Map<string, string[]>();
  const descendants = (id: string): string[] => {
    const cached = descendantsCache.get(id);
    if (cached) return cached;
    const out: string[] = [];
    const stack = [...(childrenOf.get(id) ?? [])];
    const seen = new Set<string>();
    while (stack.length) {
      const c = stack.pop()!;
      if (seen.has(c)) continue;
      seen.add(c);
      out.push(c);
      stack.push(...(childrenOf.get(c) ?? []));
    }
    descendantsCache.set(id, out);
    return out;
  };
  const all = input.entities.map((e) => e.id);
  return {
    children: (id) => childrenOf.get(id) ?? [],
    descendants,
    allEntities: () => all,
    hasParam: (entityId, paramId) => paramSet.has(`${entityId}.${paramId}`),
  };
}

function marginOf(margin: number | undefined, maturity: Maturity | undefined): number {
  if (margin !== undefined) return margin;
  if (maturity) return ECSS_MATURITY_MARGIN[maturity] ?? 0;
  return 0;
}

/* ── Main entry point ─────────────────────────────────────── */

export function evaluateModel(input: ArchitectureInput): EngineResult {
  const shape = buildShape(input);
  const issues: EngineIssue[] = [];
  const params: Record<string, EvaluatedParameter> = {};
  const asts = new Map<string, AstNode>();
  // 0. Orbit- and station-derived values (engine.orbit_*, engine.station_*), usable by parameter formulas and rules
  const orbitDerived: Record<string, number> = {
    ...orbitDerivedValues(input.mission?.orbit),
    ...stationDerivedValues(input.mission?.orbit, input.mission?.groundStations?.[0]),
  };
  if (input.mission?.lifetimeYears !== undefined) orbitDerived['engine.mission_lifetime_years'] = input.mission.lifetimeYears;

  // 1. Collect parameters and parse formulas
  for (const e of input.entities) {
    for (const p of e.parameters ?? []) {
      const key = `${e.id}.${p.id}`;
      const ep: EvaluatedParameter = {
        key,
        entityId: e.id,
        paramId: p.id,
        name: p.name ?? p.id,
        unit: p.unit,
        value: p.formula ? null : (p.value ?? null),
        computed: !!p.formula,
        formula: p.formula,
        source: p.source ?? (p.formula ? 'computed' : undefined),
        dependencies: [],
        dependents: [],
        marginFraction: marginOf(p.margin, p.maturity),
        valueWithMargin: null,
        min: p.min,
        max: p.max,
      };
      if (p.formula) {
        try {
          const ast = parse(p.formula);
          asts.set(key, ast);
          ep.dependencies = collectDependencies(ast, { shape, selfEntityId: e.id });
        } catch (err) {
          ep.error = err instanceof Error ? err.message : String(err);
          issues.push({ severity: 'error', message: `Fórmula de ${key}: ${ep.error}`, entityId: e.id, paramKey: key });
        }
      }
      params[key] = ep;
    }
  }

  // Unknown references become errors on the parameter that uses them
  for (const ep of Object.values(params)) {
    for (const dep of ep.dependencies) {
      if (params[dep]) {
        params[dep].dependents.push(ep.key);
      } else if (orbitDerived[dep] === undefined) {
        ep.error = ep.error ?? `Parâmetro "${dep}" não existe`;
        issues.push({ severity: 'error', message: `${ep.key} referencia "${dep}", que não existe`, entityId: ep.entityId, paramKey: ep.key });
      }
    }
  }

  // 2. Topological order (Kahn) — cycles are reported, not evaluated
  const { order, cycles } = topoSort(params);
  for (const cycle of cycles) {
    for (const key of cycle) {
      const ep = params[key];
      if (ep && !ep.error) ep.error = `Dependência circular: ${cycle.join(' → ')}`;
    }
    issues.push({ severity: 'error', message: `Dependência circular entre parâmetros: ${cycle.join(' → ')}` });
  }

  // 3. Evaluate
  const lookup = (key: string) => {
    const v = params[key]?.value ?? orbitDerived[key];
    return v === null || v === undefined ? undefined : v;
  };
  const lookupMargined = (key: string) => {
    const p = params[key];
    return p && p.value !== null ? p.value * (1 + p.marginFraction) : undefined;
  };
  for (const key of order) {
    const ep = params[key];
    if (ep.error) continue;
    if (!ep.computed) continue;
    const ast = asts.get(key);
    if (!ast) continue;
    try {
      const v = evaluate(ast, { shape, selfEntityId: ep.entityId, lookup, lookupMargined });
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw new ExprError(
          Array.isArray(v) ? 'O resultado é uma lista; use sum(), max(), min() ou avg()' : 'O resultado não é um número',
        );
      }
      ep.value = v;
    } catch (err) {
      ep.error = err instanceof Error ? err.message : String(err);
      issues.push({ severity: 'error', message: `${key}: ${ep.error}`, entityId: ep.entityId, paramKey: key });
    }
  }

  // 4. Margins and ranges
  for (const ep of Object.values(params)) {
    if (ep.value !== null) {
      ep.valueWithMargin = ep.value * (1 + ep.marginFraction);
      if (ep.min !== undefined && ep.value < ep.min) {
        ep.outOfRange = 'min';
        issues.push({ severity: 'warning', message: `${ep.key} = ${fmt(ep.value)} ${ep.unit} está abaixo do mínimo ${fmt(ep.min)}`, entityId: ep.entityId, paramKey: ep.key });
      } else if (ep.max !== undefined && ep.value > ep.max) {
        ep.outOfRange = 'max';
        issues.push({ severity: 'warning', message: `${ep.key} = ${fmt(ep.value)} ${ep.unit} está acima do máximo ${fmt(ep.max)}`, entityId: ep.entityId, paramKey: ep.key });
      }
    }
  }

  // 5. Budgets
  const budgets: EvaluatedBudget[] = [];
  for (const b of input.budgets ?? []) {
    if (b.parameter) {
      const candidates = b.rootEntityId
        ? [b.rootEntityId, ...shape.descendants(b.rootEntityId)]
        : shape.allEntities();
      const owners = leafOwners(shape, candidates, b.parameter);
      const rows: BudgetRow[] = owners.map((id) => {
        const ep = params[`${id}.${b.parameter}`];
        return {
          entityId: id,
          paramKey: ep.key,
          value: ep.value,
          marginFraction: ep.marginFraction,
          valueWithMargin: ep.valueWithMargin,
        };
      });
      budgets.push(summarizeBudget(b.id, b.label, b.unit, b.kind, rows, b.systemMargin ?? 0, b.allocated));
    } else if (b.items) {
      const rows: BudgetRow[] = b.items.map((it) => ({
        entityId: it.entityId,
        paramKey: '',
        value: it.value,
        marginFraction: 0,
        valueWithMargin: it.value,
      }));
      budgets.push(summarizeBudget(b.id, b.label, b.unit, b.kind, rows, b.systemMargin ?? 0, b.allocated));
    }
  }

  // 7. Modes
  const modes: EvaluatedMode[] = [];
  let weighted = 0;
  let weightSum = 0;
  let averageKnown = true;
  for (const m of input.modes ?? []) {
    const loads: EvaluatedModeLoad[] = m.loads.map((l) => {
      if (l.parameterRef) {
        const v = params[l.parameterRef]?.value ?? null;
        if (v === null) issues.push({ severity: 'warning', message: `Modo "${m.id}": carga de ${l.entityId} depende de ${l.parameterRef}, que não tem valor`, entityId: l.entityId });
        return { entityId: l.entityId, powerW: v, parameterRef: l.parameterRef };
      }
      return { entityId: l.entityId, powerW: l.powerW ?? null };
    });
    const totalW = loads.every((l) => l.powerW !== null)
      ? loads.reduce((a, l) => a + (l.powerW ?? 0), 0)
      : null;
    // A fraction may be a number or an expression, so it can follow the orbit
    // (engine.orbit_eclipse_max_fraction), the station (engine.station_contact_fraction)
    // or a parameter (camera.duty_fraction) instead of a guess.
    let fraction: number | undefined;
    if (typeof m.durationFraction === 'number') fraction = m.durationFraction;
    else if (typeof m.durationFraction === 'string') {
      try {
        const v = evaluate(parse(m.durationFraction), { shape, selfEntityId: m.id, lookup, lookupMargined });
        if (typeof v !== 'number' || !Number.isFinite(v)) throw new ExprError('O resultado não é um número');
        fraction = Math.min(1, Math.max(0, v));
      } catch (err) {
        issues.push({ severity: 'error', message: `Fração do modo "${m.id}": ${err instanceof Error ? err.message : String(err)}` });
      }
    }
    modes.push({
      id: m.id, name: m.name, durationFraction: fraction, loads, totalW,
      fractionExpression: typeof m.durationFraction === 'string' ? m.durationFraction : undefined,
    });
    if (fraction !== undefined) {
      weightSum += fraction;
      if (totalW === null) averageKnown = false;
      else weighted += totalW * fraction;
    }
  }
  if (weightSum > 0 && Math.abs(weightSum - 1) > 0.02) {
    issues.push({ severity: 'warning', message: `As frações de duração dos modos somam ${fmt(weightSum)} em vez de 1` });
  }
  const orbitAveragePowerW = weightSum > 0 && averageKnown ? weighted / weightSum : null;

  // 7. Engine-derived values, readable from rules as engine.<name>
  const derived: Record<string, number> = { ...orbitDerived };
  if (orbitAveragePowerW !== null) derived['engine.orbit_average_power_w'] = orbitAveragePowerW;
  for (const b of budgets) {
    if (b.nominal !== null) derived[`engine.budget_${b.id}_nominal`] = b.nominal;
    if (b.total !== null) derived[`engine.budget_${b.id}_total`] = b.total;
    if (b.marginRemainingFraction !== null) derived[`engine.budget_${b.id}_margin`] = b.marginRemainingFraction;
  }
  for (const m of modes) {
    if (m.totalW !== null) derived[`engine.mode_${m.id}_w`] = m.totalW;
  }
  const ruleLookup = (key: string) => lookup(key) ?? derived[key];

  // 7b. Orbit temperature (engine.thermal_hot_c / engine.thermal_cold_c), so a
  // thermal requirement checks the analysis result instead of typed values.
  const th = input.mission?.analysis?.thermal;
  const period = orbitDerived['engine.orbit_period_min'];
  const eclipseMax = orbitDerived['engine.orbit_eclipse_max_min'];
  if (th && input.mission?.orbit && period !== undefined && eclipseMax !== undefined) {
    const num = (v: number | string | undefined): number | undefined => (typeof v === 'number' ? v : v === undefined ? undefined : ruleLookup(v));
    const absorptivity = num(th.absorptivity);
    const emissivity = num(th.emissivity);
    const sunlitAreaM2 = num(th.sunlitAreaM2);
    const radiatorAreaM2 = num(th.radiatorAreaM2);
    const heatCapacityJPerK = num(th.heatCapacityJPerK);
    if (absorptivity !== undefined && emissivity !== undefined && sunlitAreaM2 !== undefined && radiatorAreaM2 !== undefined && heatCapacityJPerK !== undefined) {
      const r = orbitTemperatureRange({
        altitudeKm: input.mission.orbit.altitudeKm,
        absorptivity, emissivity, sunlitAreaM2, radiatorAreaM2,
        earthFacingAreaM2: num(th.earthFacingAreaM2),
        internalPowerW: num(th.internalPowerW),
        internalPowerHotW: num(th.internalPowerHotW),
        internalPowerColdW: num(th.internalPowerColdW),
        heatCapacityJPerK,
        periodMin: period,
        eclipseMinCold: eclipseMax,
        eclipseMinHot: orbitDerived['engine.orbit_eclipse_min'],
      });
      derived['engine.thermal_hot_c'] = r.hotCaseC;
      derived['engine.thermal_cold_c'] = r.coldCaseC;
    }
  }

  // 8. Requirement rules (after budgets and modes so they can use engine.* values)
  const rules: Record<string, EvaluatedRule> = {};
  for (const e of input.entities) {
    const rule = e.requirement?.rule;
    if (!rule) continue;
    const er: EvaluatedRule = { entityId: e.id, expression: rule, result: 'unknown', dependencies: [] };
    try {
      const ast = parse(rule);
      er.dependencies = collectDependencies(ast, { shape, selfEntityId: e.id });
      const missing = er.dependencies.filter((d) => !params[d] && derived[d] === undefined);
      if (missing.length) {
        throw new ExprError(
          missing[0].startsWith('engine.')
            ? `Valor derivado "${missing[0]}" não está disponível (verifique budgets/modos)`
            : `Parâmetro "${missing[0]}" não existe`,
        );
      }
      const v = evaluate(ast, { shape, selfEntityId: e.id, lookup: ruleLookup, lookupMargined });
      if (typeof v !== 'boolean') throw new ExprError('A regra precisa resultar em verdadeiro/falso (use <, <=, >, >=, ==)');
      er.result = v ? 'pass' : 'fail';
    } catch (err) {
      er.error = err instanceof Error ? err.message : String(err);
      er.result = 'error';
      issues.push({ severity: 'error', message: `Regra de ${e.id}: ${er.error}`, entityId: e.id });
    }
    rules[e.id] = er;
  }

  return { params, order, cycles, rules, budgets, modes, orbitAveragePowerW, derived, issues };
}

/* ── Helpers ──────────────────────────────────────────────── */

function summarizeBudget(
  id: string,
  label: string,
  unit: string,
  kind: string | undefined,
  rows: BudgetRow[],
  systemMarginFraction: number,
  allocated: number | undefined,
): EvaluatedBudget {
  const complete = rows.every((r) => r.value !== null);
  const nominal = complete ? rows.reduce((a, r) => a + (r.value ?? 0), 0) : null;
  const withItemMargins = complete ? rows.reduce((a, r) => a + (r.valueWithMargin ?? 0), 0) : null;
  const total = withItemMargins === null ? null : withItemMargins * (1 + systemMarginFraction);
  let marginRemainingFraction: number | null = null;
  let status: BudgetStatus = 'unknown';
  if (total !== null && allocated !== undefined && allocated > 0) {
    marginRemainingFraction = (allocated - total) / allocated;
    // Item and system margins are already in `total`, so the budget complies
    // whenever it fits the allocation; extra thresholds would count the margin twice.
    status = marginRemainingFraction < 0 ? 'over' : 'ok';
  } else if (total !== null) {
    status = 'ok';
  }
  return { id, label, unit, kind, rows, nominal, withItemMargins, systemMarginFraction, total, allocated, marginRemainingFraction, status };
}

function topoSort(params: Record<string, EvaluatedParameter>): { order: string[]; cycles: string[][] } {
  const indeg = new Map<string, number>();
  const keys = Object.keys(params);
  for (const k of keys) indeg.set(k, 0);
  for (const k of keys) {
    for (const d of params[k].dependencies) {
      if (params[d]) indeg.set(k, (indeg.get(k) ?? 0) + 1);
    }
  }
  const queue = keys.filter((k) => (indeg.get(k) ?? 0) === 0);
  const order: string[] = [];
  while (queue.length) {
    const k = queue.shift()!;
    order.push(k);
    for (const dep of params[k].dependents) {
      const n = (indeg.get(dep) ?? 0) - 1;
      indeg.set(dep, n);
      if (n === 0) queue.push(dep);
    }
  }
  const stuck = keys.filter((k) => !order.includes(k));
  const cycles: string[][] = [];
  if (stuck.length) {
    // Group the stuck nodes into cycles by following dependencies
    const visited = new Set<string>();
    for (const start of stuck) {
      if (visited.has(start)) continue;
      const path: string[] = [];
      let cur: string | undefined = start;
      while (cur && !visited.has(cur) && stuck.includes(cur)) {
        visited.add(cur);
        path.push(cur);
        cur = params[cur].dependencies.find((d) => stuck.includes(d));
      }
      if (path.length) cycles.push(path);
    }
  }
  return { order, cycles };
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/\.?0+$/, '');
}
