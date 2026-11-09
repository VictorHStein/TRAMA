import { describe, expect, it } from 'vitest';
import { validateArchitecture } from '../../parser/validateArchitecture';
import { normalizeArchitecture } from '../../parser/normalizeArchitecture';
import { auditArchitecture } from '../audit';
import { computeImpact } from '../impact';
import demo from '../../../data/demoArchitecture.json';

const arch = (() => {
  const r = validateArchitecture(demo);
  if (!r.ok || !r.data) throw new Error(`demo invalid: ${JSON.stringify(r.issues)}`);
  return normalizeArchitecture(r.data);
})();
const ev = arch.evaluation;

describe('demo v2 through the parametric engine', () => {
  it('evaluates every parameter without errors', () => {
    const errors = ev.issues.filter((i) => i.severity === 'error');
    expect(errors).toEqual([]);
    expect(Object.keys(ev.params).length).toBeGreaterThan(35);
  });

  it('rolls the dry mass up from the leaves of the product tree', () => {
    expect(ev.params['mission.dry_mass'].value).toBeCloseTo(21.7, 3);
    expect(ev.params['eps.mass'].value).toBeCloseTo(3.2, 3);
    expect(ev.params['ttc.mass'].value).toBeCloseTo(1.4, 3);
  });

  it('computes the mass budget with item and system margins', () => {
    const mass = ev.budgets.find((b) => b.id === 'mass')!;
    expect(mass.nominal).toBeCloseTo(21.7, 3);
    expect(mass.total).toBeCloseTo(29.178, 2);
    // Margins are already in the total, so fitting 30 kg means compliance (~2.7 % left).
    expect(mass.status).toBe('ok');
    expect(mass.marginRemainingFraction).toBeCloseTo(0.027, 2);
    expect(ev.params['mission.dry_mass_margined'].value).toBeCloseTo(mass.total!, 6);
  });

  it('keeps the all-on power budget inside its allocation', () => {
    const power = ev.budgets.find((b) => b.id === 'power')!;
    expect(power.nominal).toBe(55);
    expect(power.status).toBe('ok');
  });

  it('computes mode loads and the orbit-average power', () => {
    const byId = Object.fromEntries(ev.modes.map((m) => [m.id, m.totalW]));
    expect(byId.nominal).toBe(28);
    expect(byId.imaging).toBe(46);
    expect(byId.downlink).toBe(37);
    expect(byId.eclipse).toBe(30);
    // Fractions follow the orbit (eclipse), the station (downlink) and the camera duty (imaging).
    const fE = ev.derived['engine.orbit_eclipse_max_fraction'];
    const fC = ev.derived['engine.station_contact_fraction'];
    const duty = ev.params['camera.duty_fraction'].value!;
    const fractions = Object.fromEntries(ev.modes.map((m) => [m.id, m.durationFraction]));
    expect(fractions.eclipse).toBeCloseTo(fE, 9);
    expect(fractions.downlink).toBeCloseTo(fC, 9);
    expect(fractions.imaging).toBeCloseTo(duty, 9);
    expect(fractions.nominal).toBeCloseTo(1 - fE - fC - duty, 9);
    expect(ev.orbitAveragePowerW).toBeCloseTo(28 * (1 - fE - fC - duty) + 46 * duty + 37 * fC + 30 * fE, 6);
    expect(ev.derived['engine.mode_eclipse_w']).toBe(30);
  });

  it('verifies all five requirement rules', () => {
    const results = Object.fromEntries(Object.values(ev.rules).map((r) => [r.entityId, r.result]));
    expect(results).toEqual({ req_image: 'pass', req_downlink: 'pass', req_power: 'pass', req_thermal: 'pass', req_mass: 'pass' });
  });
});

describe('audit and impact on the demo', () => {
  const report = auditArchitecture(arch);

  it('finds no blocking gap in the demo', () => {
    expect(report.counts.error).toBe(0);
    expect(report.items.filter((i) => i.kind === 'budget-over')).toHaveLength(0);
    expect(report.coverage.budgetsWithinAllocation).toEqual({ covered: 2, total: 2 });
    expect(report.coverage.requirementsAllocated).toEqual({ covered: 5, total: 5 });
    expect(report.coverage.requirementsVerified).toEqual({ covered: 5, total: 5 });
    expect(report.coverage.rulesPassing).toEqual({ covered: 5, total: 5 });
    expect(report.coverage.functionsAllocated).toEqual({ covered: 5, total: 5 });
  });

  it('detects a missing verification when one is removed', () => {
    const r = validateArchitecture(demo);
    const input = structuredClone(r.data!);
    input.relations = input.relations.filter((x) => x.id !== 'rel_verification_req_image' && !(x.type === 'verifies' && x.target === 'req_image'));
    input.verifications = (input.verifications ?? []).filter((v) => v.requirementId !== 'req_image');
    const req = input.entities.find((e) => e.id === 'req_image')!;
    req.requirement = { ...req.requirement, rule: undefined };
    const gapped = auditArchitecture(normalizeArchitecture(input));
    expect(gapped.items.some((i) => i.kind === 'requirement-without-verification' && i.entityIds.includes('req_image'))).toBe(true);
  });

  it('traces every requirement of a component through its parent and lists impact both ways', () => {
    expect(arch.traceAll.battery.requirements).toContain('req_power');
    expect(arch.traceAll.battery.subsystems).toEqual(['eps']);
    const impact = computeImpact(arch, 'battery');
    expect(impact.downstream).toContain('eps');      // parent roll-up
    expect(impact.downstream).toContain('mission');  // dry_mass formula depends on battery.mass
    expect(impact.viaParameters).toContain('mission');
    expect(impact.upstream).toContain('solar_array'); // solar_array → battery (charging)
  });
});
