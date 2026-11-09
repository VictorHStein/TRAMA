import { describe, expect, it } from 'vitest';
import { validateArchitecture } from '../../parser/validateArchitecture';
import { normalizeArchitecture } from '../../parser/normalizeArchitecture';
import { analyzeMission, getMissionReport } from '../mission';
import { auditArchitecture } from '../audit';
import demo from '../../../data/demoArchitecture.json';

const arch = (() => {
  const r = validateArchitecture(demo);
  if (!r.ok || !r.data) throw new Error(`demo invalid: ${JSON.stringify(r.issues)}`);
  return normalizeArchitecture(r.data);
})();
const ev = arch.evaluation;
const report = getMissionReport(arch)!;

describe('engine.orbit_* values', () => {
  it('exposes period and eclipse from mission.orbit to formulas and rules', () => {
    // 600 km circular: T = 2π√(a³/μ) = 96.7 min; at β = 0 the shadow half-angle is
    // acos(√(h² + 2R⊕h)/a) = 66.1°, so the eclipse is 66.1/180 = 0.367 of the orbit.
    expect(ev.derived['engine.orbit_period_min']).toBeCloseTo(96.7, 0);
    expect(ev.derived['engine.orbit_eclipse_max_fraction']).toBeCloseTo(0.367, 2);
    expect(ev.derived['engine.orbit_eclipse_max_min']).toBeCloseTo(35.5, 0);
    expect(ev.derived['engine.orbit_beta_deg']).toBeDefined();
    // mission.eclipse_fraction is now a formula on the engine value
    expect(ev.params['mission.eclipse_fraction'].value).toBeCloseTo(ev.derived['engine.orbit_eclipse_max_fraction'], 6);
    expect(ev.params['mission.eclipse_fraction'].error).toBeUndefined();
    expect(ev.rules['req_power'].result).toBe('pass');
  });

  it('still reports a truly unknown reference as an error', () => {
    const r = validateArchitecture({
      ...demo,
      entities: demo.entities.map((e) => (e.id === 'mission'
        ? { ...e, parameters: [...(e.parameters ?? []), { id: 'bogus', unit: '-', formula: 'engine.orbit_nonexistent * 2' }] }
        : e)),
    });
    expect(r.ok).toBe(true);
    const a = normalizeArchitecture(r.data!);
    expect(a.evaluation.params['mission.bogus'].error).toContain('não existe');
  });
});

describe('mission report on the demo', () => {
  it('is memoized per architecture instance', () => {
    expect(getMissionReport(arch)).toBe(report);
    expect(analyzeMission(arch)).not.toBe(report);
  });

  it('orbit and eclipse', () => {
    expect(report.orbit.basics.isSunSynchronous).toBe(true);
    expect(report.orbit.raanDeg).not.toBeNull();
    expect(report.eclipse.betaDeg).not.toBeNull();
    expect(report.eclipse.year?.days).toHaveLength(365);
    expect(report.eclipse.designEclipseMin).toBeGreaterThan(20);
    expect(report.eclipse.designEclipseMin).toBeLessThanOrEqual(report.eclipse.worst.eclipseMin + 0.01);
  });

  it('ground station passes over São José dos Campos', () => {
    const s = report.station!;
    expect(s.station.id).toBe('gs_sjc');
    expect(s.simulation.passes.length).toBeGreaterThanOrEqual(2);
    expect(s.simulation.passes.length).toBeLessThanOrEqual(8);
    expect(s.simulation.totalContactMinPerDay).toBeGreaterThan(10);
    for (const p of s.simulation.passes) expect(p.durationMin).toBeLessThanOrEqual(s.coverage.maxPassDurationMin + 1);
  });

  it('link budget binds to transceiver and antenna parameters', () => {
    const l = report.link!;
    expect(l.inputs.some((i) => i.ref === 'transceiver.tx_power_w' && i.value === 2)).toBe(true);
    expect(l.inputs.some((i) => i.ref === 'antenna.gain_dbi' && i.value === 6)).toBe(true);
    expect(l.result.marginDb).toBeGreaterThan(3);
    expect(l.status).toBe('ok');
    expect(l.distanceKm).toBeCloseTo(report.station!.coverage.slantRangeKm, 6);
  });

  it('power: modes, array and battery sizing against declared values', () => {
    const p = report.power!;
    expect(p.averageW).toBeCloseTo(ev.orbitAveragePowerW!, 6);
    // Generation at end of life from the array: A·S·η·I_d·cos β·(1 − D)^years (SMAD).
    const beta = ev.derived['engine.orbit_beta_deg'] * Math.PI / 180;
    expect(p.sunPowerW).toBeCloseTo(0.3 * 1361 * 0.28 * 0.77 * Math.cos(beta) * Math.pow(1 - 0.0275, 5), 6);
    expect(p.arrayStatus).toBe('ok');
    expect(p.eclipseModeId).toBe('eclipse');
    expect(p.battery!.capacityWh).toBeGreaterThan(0);
    expect(p.declaredCapacityWh).toBe(84);
    expect(p.batteryStatus).toBe('ok');
    expect(p.profile!.points.length).toBe(Math.round(report.orbit.basics.periodMin));
    expect(p.profile!.minSoc).toBeGreaterThan(0.5);
    expect(p.status).not.toBe('fail');
  });

  it('data, decay and thermal', () => {
    expect(report.data!.result.generatedMBPerDay).toBeCloseTo(8e6 * 0.003 * 86400 / 8 / 1e6, 1);
    expect(report.data!.contactMinPerDay).toBe(report.station!.simulation.totalContactMinPerDay);
    // Drag area from the declared geometry: the 0.40 × 0.45 m front face plus the
    // wings, which turn to the Sun and average 2/π of their area in the ram direction.
    const dragArea = 0.40 * 0.45 + 0.3 * 0.6366;
    expect(report.decay!.ballisticCoefficient).toBeCloseTo((2.2 * dragArea) / ev.derived['engine.budget_mass_total'], 6);
    // Survival with the light (nominal) satellite, disposal with the heavy one.
    expect(report.decay!.survival!.massKg).toBeCloseTo(ev.derived['engine.budget_mass_nominal'], 6);
    expect(report.decay!.survival!.result.lifetimeYears).toBeLessThan(report.decay!.result.lifetimeYears);
    expect(report.decay!.survival!.result.lifetimeYears).toBeGreaterThanOrEqual(5);
    expect(report.decay!.survives).toBe(true);
    expect(report.decay!.result.meets25YearRule).toBe(true);
    // Transient single node: the heat capacity keeps the swing far inside the
    // instantaneous-equilibrium extremes, and the engine exposes the same numbers.
    const t = report.thermal!;
    expect(t.transient).toBe(true);
    expect(t.result.hotCaseC).toBeGreaterThan(t.result.coldCaseC);
    expect(t.result.hotCaseC).toBeLessThan(t.result.equilibriumHotC!);
    expect(t.result.coldCaseC).toBeGreaterThan(t.result.equilibriumColdC!);
    expect(ev.derived['engine.thermal_hot_c']).toBeCloseTo(t.result.hotCaseC, 6);
    expect(ev.derived['engine.thermal_cold_c']).toBeCloseTo(t.result.coldCaseC, 6);
    expect(t.status).toBe('ok');
  });

  it('feeds the audit without duplicating the computation', () => {
    const audit = auditArchitecture(arch);
    const missionKinds = new Set(['link-margin', 'power-negative', 'battery-undersized', 'array-undersized', 'data-budget', 'orbital-lifetime', 'thermal-range']);
    const errors = audit.items.filter((i) => missionKinds.has(i.kind) && i.severity === 'error');
    expect(errors).toEqual([]);
  });
});

describe('validation of mission.analysis bindings', () => {
  it('rejects a reference to an undeclared parameter', () => {
    const bad = JSON.parse(JSON.stringify(demo));
    bad.mission.analysis.link.txPowerW = 'transceiver.nope';
    const r = validateArchitecture(bad);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.path === 'mission/analysis/link/txPowerW')).toBe(true);
  });

  it('accepts engine.* references and plain numbers', () => {
    const good = JSON.parse(JSON.stringify(demo));
    good.mission.analysis.decay.massKg = 'engine.budget_mass_nominal';
    good.mission.analysis.link.txPowerW = 3;
    expect(validateArchitecture(good).ok).toBe(true);
  });

  it('report is null without an orbit', () => {
    const noOrbit = JSON.parse(JSON.stringify(demo));
    delete noOrbit.mission.orbit;
    delete noOrbit.mission.analysis;
    // rules that use engine.orbit_* now fail to evaluate, but the model still normalizes
    const r = validateArchitecture(noOrbit);
    expect(r.ok).toBe(true);
    const a = normalizeArchitecture(r.data!);
    expect(analyzeMission(a)).toBeNull();
    expect(a.evaluation.params['mission.eclipse_fraction'].error).toContain('não existe');
  });
});
