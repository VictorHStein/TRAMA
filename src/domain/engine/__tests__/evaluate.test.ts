import { describe, expect, it } from 'vitest';
import { evaluateModel } from '../evaluate';
import type { ArchitectureInput } from '../../model/ArchitectureTypes';

function model(): ArchitectureInput {
  return {
    metadata: { projectName: 'T', version: '2', schemaVersion: 2 },
    categories: [
      { id: 'mission', label: 'Missão', color: '#c4a6ff' },
      { id: 'requirement', label: 'Requisito', color: '#82b1ff' },
      { id: 'subsystem', label: 'Subsistema', color: '#5bcf7a' },
      { id: 'component', label: 'Componente', color: '#f2c14e' },
    ],
    relationTypes: [{ id: 'satisfies', index: 1, label: 'Satisfaz', color: '#82b1ff', lineStyle: 'solid', directed: true, description: 'x' }],
    entities: [
      {
        id: 'sat', name: 'Satélite', category: 'mission', step: 1, description: '',
        parameters: [
          { id: 'dry_mass', unit: 'kg', formula: 'sum(total("mass"))' },
          { id: 'dry_mass_margin', unit: 'kg', formula: 'withMargin(dry_mass, 0.2)' },
          { id: 'power_avg', unit: 'W', formula: 'sum(total("power"))' },
        ],
      },
      {
        id: 'eps', name: 'EPS', category: 'subsystem', step: 6, description: '',
        parameters: [
          { id: 'mass', unit: 'kg', formula: 'sum(children("eps", "mass"))' },
          { id: 'power', unit: 'W', value: 5, maturity: 'cots' },
        ],
      },
      { id: 'battery', name: 'Bateria', category: 'component', step: 7, description: '', parentId: 'eps',
        parameters: [{ id: 'mass', unit: 'kg', value: 1.5, maturity: 'cots' }, { id: 'capacity', unit: 'Wh', value: 84, min: 50 }] },
      { id: 'solar', name: 'Painel', category: 'component', step: 7, description: '', parentId: 'eps',
        parameters: [{ id: 'mass', unit: 'kg', value: 1.2, maturity: 'new' }] },
      { id: 'obc', name: 'OBC', category: 'subsystem', step: 6, description: '',
        parameters: [{ id: 'mass', unit: 'kg', value: 1.1, margin: 0.1 }, { id: 'power', unit: 'W', value: 7, max: 6 }] },
      {
        id: 'req_mass', name: 'Massa', category: 'requirement', step: 3, description: '',
        requirement: { rule: 'sat.dry_mass_margin <= 12' },
      },
      {
        id: 'req_power', name: 'Potência', category: 'requirement', step: 3, description: '',
        requirement: { rule: 'sat.power_avg <= 10' },
      },
      {
        id: 'req_bad', name: 'Regra quebrada', category: 'requirement', step: 3, description: '',
        requirement: { rule: 'ghost.value <= 1' },
      },
    ],
    relations: [],
    budgets: [
      { id: 'b_mass', label: 'Massa', unit: 'kg', parameter: 'mass', kind: 'mass', allocated: 6, systemMargin: 0.2 },
      { id: 'b_old', label: 'Antigo', unit: 'W', items: [{ entityId: 'eps', value: 5 }, { entityId: 'obc', value: 7 }] },
    ],
    modes: [
      { id: 'safe', name: 'Safe', durationFraction: 0.5, loads: [{ entityId: 'obc', powerW: 3 }] },
      { id: 'nominal', name: 'Nominal', durationFraction: 0.5, loads: [{ entityId: 'obc', parameterRef: 'obc.power' }, { entityId: 'eps', powerW: 5 }] },
    ],
  };
}

describe('evaluateModel', () => {
  const r = evaluateModel(model());

  it('evaluates formulas in dependency order, including hierarchical aggregation', () => {
    expect(r.params['eps.mass'].value).toBeCloseTo(2.7);
    // total("mass") takes leaf owners only: battery, solar, obc (eps has children with mass)
    expect(r.params['sat.dry_mass'].value).toBeCloseTo(1.5 + 1.2 + 1.1);
    expect(r.params['sat.dry_mass_margin'].value).toBeCloseTo(3.8 * 1.2);
    expect(r.order.indexOf('eps.mass')).toBeGreaterThan(r.order.indexOf('battery.mass'));
    expect(r.cycles).toHaveLength(0);
  });

  it('records dependencies both ways', () => {
    expect(r.params['sat.dry_mass'].dependencies.sort()).toEqual(['battery.mass', 'obc.mass', 'solar.mass']);
    expect(r.params['battery.mass'].dependents).toContain('eps.mass');
    expect(r.params['battery.mass'].dependents).toContain('sat.dry_mass');
  });

  it('applies ECSS maturity margins and explicit margins', () => {
    expect(r.params['battery.mass'].marginFraction).toBe(0.05);
    expect(r.params['solar.mass'].marginFraction).toBe(0.2);
    expect(r.params['obc.mass'].marginFraction).toBe(0.1);
    expect(r.params['solar.mass'].valueWithMargin).toBeCloseTo(1.44);
  });

  it('flags values outside their range', () => {
    expect(r.params['obc.power'].outOfRange).toBe('max');
    expect(r.params['battery.capacity'].outOfRange).toBeUndefined();
  });

  it('evaluates requirement rules to pass / fail / error', () => {
    expect(r.rules.req_mass.result).toBe('pass');
    expect(r.rules.req_power.result).toBe('fail'); // 12 W > 10 W
    expect(r.rules.req_bad.result).toBe('error');
    expect(r.rules.req_bad.error).toMatch(/ghost/);
  });

  it('rolls up v2 budgets with item and system margins against the allocation', () => {
    const b = r.budgets.find((x) => x.id === 'b_mass')!;
    expect(b.rows.map((x) => x.entityId).sort()).toEqual(['battery', 'obc', 'solar']);
    expect(b.nominal).toBeCloseTo(3.8);
    expect(b.withItemMargins).toBeCloseTo(1.5 * 1.05 + 1.2 * 1.2 + 1.1 * 1.1);
    expect(b.total).toBeCloseTo((1.5 * 1.05 + 1.2 * 1.2 + 1.1 * 1.1) * 1.2);
    expect(b.status).toBe('ok'); // fits the allocation with ≈ 12 % to spare
    const old = r.budgets.find((x) => x.id === 'b_old')!;
    expect(old.total).toBe(12);
  });

  it('computes mode loads, parameter references and the orbit average', () => {
    const nominal = r.modes.find((m) => m.id === 'nominal')!;
    expect(nominal.totalW).toBe(12);
    expect(r.orbitAveragePowerW).toBeCloseTo(0.5 * 3 + 0.5 * 12);
  });

  it('reports a circular dependency instead of hanging', () => {
    const m = model();
    m.entities[1].parameters!.push({ id: 'a', unit: '-', formula: 'b + 1' }, { id: 'b', unit: '-', formula: 'a + 1' });
    const rr = evaluateModel(m);
    expect(rr.cycles.length).toBeGreaterThan(0);
    expect(rr.params['eps.a'].error).toMatch(/circular/i);
    expect(rr.params['eps.mass'].value).toBeCloseTo(2.7); // the rest still evaluates
  });
});
