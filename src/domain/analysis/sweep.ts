/**
 * Design-space sweep: vary one input (an orbit element or any declared
 * parameter value), re-evaluate the whole model for each value and collect
 * the numbers an engineer trades on. Everything runs in memory on copies of
 * the input document; nothing is applied until the user asks.
 */
import type { ArchitectureInput, NormalizedArchitecture } from '../model/ArchitectureTypes';
import { validateArchitecture } from '../parser/validateArchitecture';
import { normalizeArchitecture } from '../parser/normalizeArchitecture';
import { cloneInputDocument } from '../parser/inputDocument';
import { analyzeMission } from './mission';

export type OrbitField = 'altitudeKm' | 'inclinationDeg' | 'ltanHours';

export interface SweepVariable {
  id: string;
  kind: 'orbit' | 'param';
  label: string;
  unit: string;
  field?: OrbitField;
  key?: string;
  /** Ripple seeds for the graph when the value is applied. */
  seeds: string[];
}

export interface SweepPoint {
  value: number;
  ok: boolean;
  issue?: string;
  rulesPass: number;
  rulesTotal: number;
  eclipseMaxMin: number | null;
  passesPerDay: number | null;
  contactMinPerDay: number | null;
  linkMarginDb: number | null;
  powerMarginFraction: number | null;
  batteryRequiredWh: number | null;
  batteryDeclaredWh: number | null;
  /** Infinity when the satellite does not re-enter inside the simulated window. */
  lifetimeYears: number | null;
  missionLifetimeYears: number | null;
  massTotal: number | null;
  massAllocated: number | null;
  dataMarginFraction: number | null;
  hotC: number | null;
  coldC: number | null;
}

export function sweepVariables(arch: NormalizedArchitecture): SweepVariable[] {
  const out: SweepVariable[] = [];
  if (arch.mission?.orbit) {
    out.push({ id: 'orbit.altitudeKm', kind: 'orbit', field: 'altitudeKm', label: 'Altitude da órbita', unit: 'km', seeds: ['engine.orbit_*'] });
    out.push({ id: 'orbit.inclinationDeg', kind: 'orbit', field: 'inclinationDeg', label: 'Inclinação da órbita', unit: '°', seeds: ['engine.orbit_*'] });
    out.push({ id: 'orbit.ltanHours', kind: 'orbit', field: 'ltanHours', label: 'LTAN', unit: 'h', seeds: ['engine.orbit_*'] });
  }
  for (const p of Object.values(arch.evaluation.params)) {
    if (p.formula || p.value === null) continue;
    const e = arch.entitiesById[p.entityId];
    out.push({ id: p.key, kind: 'param', key: p.key, label: `${e?.short ?? e?.name ?? p.entityId}: ${p.name}`, unit: p.unit, seeds: [p.key] });
  }
  return out;
}

export function currentValue(arch: NormalizedArchitecture, v: SweepVariable): number | null {
  if (v.kind === 'orbit') return arch.mission?.orbit?.[v.field!] ?? null;
  return arch.evaluation.params[v.key!]?.value ?? null;
}

/** Writes the value into an input document (mutates it). */
export function applyVariable(doc: ArchitectureInput, v: SweepVariable, value: number): void {
  if (v.kind === 'orbit') {
    if (!doc.mission) return;
    doc.mission.orbit = { ...(doc.mission.orbit ?? { altitudeKm: 500, inclinationDeg: 97.4, eccentricity: 0 }), [v.field!]: value };
    return;
  }
  const [entityId, paramId] = (v.key ?? '').split('.');
  const e = doc.entities.find((x) => x.id === entityId);
  const p = e?.parameters?.find((x) => x.id === paramId);
  if (!p) return;
  p.value = value;
  delete p.formula;
}

export function defaultRange(v: SweepVariable, current: number | null): { min: number; max: number; steps: number } {
  if (v.field === 'ltanHours') return { min: 6, max: 18, steps: 7 };
  if (v.field === 'inclinationDeg') {
    const c = current ?? 97;
    return { min: Math.max(0, c - 10), max: Math.min(180, c + 10), steps: 5 };
  }
  if (v.field === 'altitudeKm') {
    const c = current ?? 500;
    return { min: Math.max(200, Math.round(c * 0.6 / 10) * 10), max: Math.round(c * 1.5 / 10) * 10, steps: 7 };
  }
  const c = current ?? 1;
  if (c === 0) return { min: 0, max: 1, steps: 5 };
  return { min: round3(c * 0.5), max: round3(c * 1.5), steps: 7 };
}

function round3(x: number): number {
  const m = Math.pow(10, Math.max(0, 3 - Math.floor(Math.log10(Math.abs(x) || 1)) - 1));
  return Math.round(x * m) / m;
}

export function linspace(min: number, max: number, n: number): number[] {
  const k = Math.max(2, Math.min(25, Math.round(n)));
  return Array.from({ length: k }, (_, i) => round3(min + ((max - min) * i) / (k - 1)));
}

export function runSweep(arch: NormalizedArchitecture, v: SweepVariable, values: number[]): SweepPoint[] {
  return values.map((value) => {
    const doc = cloneInputDocument(arch);
    applyVariable(doc, v, value);
    const r = validateArchitecture(doc);
    const empty: SweepPoint = {
      value, ok: false, rulesPass: 0, rulesTotal: 0, eclipseMaxMin: null, passesPerDay: null, contactMinPerDay: null, linkMarginDb: null,
      powerMarginFraction: null, batteryRequiredWh: null, batteryDeclaredWh: null, lifetimeYears: null, missionLifetimeYears: null,
      massTotal: null, massAllocated: null, dataMarginFraction: null, hotC: null, coldC: null,
    };
    if (!r.ok || !r.data) return { ...empty, issue: r.issues[0]?.message };
    const a = normalizeArchitecture(r.data);
    const m = analyzeMission(a, { fast: true });
    const rules = Object.values(a.evaluation.rules);
    const mass = a.evaluation.budgets.find((b) => b.kind === 'mass') ?? null;
    return {
      value,
      ok: true,
      rulesPass: rules.filter((x) => x.result === 'pass').length,
      rulesTotal: rules.length,
      eclipseMaxMin: m?.eclipse.worst.eclipseMin ?? null,
      passesPerDay: m?.station?.estimate.passesPerDay ?? null,
      contactMinPerDay: m?.station?.simulation.totalContactMinPerDay ?? null,
      linkMarginDb: m?.link?.result.marginDb ?? null,
      powerMarginFraction: m?.power?.marginFraction ?? null,
      batteryRequiredWh: m?.power?.battery?.capacityWh ?? null,
      batteryDeclaredWh: m?.power?.declaredCapacityWh ?? null,
      // Survival is judged with the lightest satellite when the model gives its mass.
      lifetimeYears: m?.decay ? ((m.decay.survival?.result ?? m.decay.result).reachedFloor ? (m.decay.survival?.result ?? m.decay.result).lifetimeYears : Infinity) : null,
      missionLifetimeYears: m?.decay?.missionLifetimeYears ?? null,
      massTotal: mass?.total ?? null,
      massAllocated: mass?.allocated ?? null,
      dataMarginFraction: m?.data?.result.marginFraction ?? null,
      hotC: m?.thermal?.result.hotCaseC ?? null,
      coldC: m?.thermal?.result.coldCaseC ?? null,
    };
  });
}
