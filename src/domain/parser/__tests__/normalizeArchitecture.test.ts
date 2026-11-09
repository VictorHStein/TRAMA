import { describe, expect, it } from 'vitest';
import { validateArchitecture } from '../validateArchitecture';
import { normalizeArchitecture } from '../normalizeArchitecture';
import demo from '../../../data/demoArchitecture.json';

const arch = (() => {
  const r = validateArchitecture(demo);
  if (!r.ok || !r.data) throw new Error('demo invalid');
  return normalizeArchitecture(r.data);
})();

describe('normalizeArchitecture (demo)', () => {
  it('computes PBS codes for the physical tree, with segments as level 1', () => {
    expect(arch.breakdownCodes.mission).toBe('0');
    expect(arch.breakdownCodes.seg_space).toBe('1');
    expect(arch.breakdownCodes.seg_ground).toBe('2');
    expect(arch.breakdownCodes.payload).toBe('1.1');
    expect(arch.breakdownCodes.eps).toBe('1.2');
    expect(arch.breakdownCodes.gs_ita).toBe('2.1');
    expect(arch.breakdownCodes.camera).toBe('1.1.1');
    expect(arch.breakdownCodes.solar_array).toBe('1.2.1');
  });

  it('keeps the legacy tree (mission 1, subsystems 1.n) when there are no segments', () => {
    const noSegments = normalizeArchitecture({
      ...arch,
      entities: arch.entities
        .filter((e) => e.category !== 'segment')
        .map((e) => (e.category === 'subsystem' ? { ...e, parentId: undefined } : e)),
    });
    expect(noSegments.breakdownCodes.mission).toBe('1');
    expect(noSegments.breakdownCodes.payload).toBe('1.1');
    expect(noSegments.breakdownCodes.camera).toBe('1.1.1');
  });

  it('traces objectives and segments', () => {
    expect(arch.traceAll.req_image.objectives).toEqual(['obj_imaging']);
    expect(arch.traceAll.obj_life.requirements).toEqual(expect.arrayContaining(['req_power', 'req_thermal']));
    expect(arch.traceAll.battery.segments).toEqual(['seg_space']);
    expect(arch.traceAll.gs_ita.segments).toEqual(['seg_ground']);
    expect(arch.traceAll.seg_space.subsystems).toContain('eps');
    expect(arch.traceAll.req_mass.segments).toContain('seg_space');
  });

  it('numbers logical artefacts with R/F/V prefixes unless an official code is given', () => {
    expect(arch.breakdownCodes.req_image).toBe('REQ-001');
    expect(arch.breakdownCodes.func_capture).toBe('F-001');
    expect(arch.breakdownCodes.ver_image_test).toBe('V-001');
  });

  it('derives maxStep and indexes relations by entity', () => {
    expect(arch.maxStep).toBe(10);
    expect(arch.relationsByEntity.eps.outgoing).toHaveLength(7);
    expect(arch.relationsByEntity.eps.incoming).toHaveLength(1);
  });

  it('builds the trace chain of a subsystem up to its requirement and down to verification', () => {
    const t = arch.traceById.eps;
    expect(t.mission).toBe('mission');
    expect(t.requirement).toBe('req_power');
    expect(t.function).toBe('func_pwr_mgmt');
    expect(t.subsystem).toBe('eps');
    expect(t.verifications).toContain('ver_power');
  });

  it('lets a component inherit its parent subsystem chain', () => {
    const t = arch.traceById.battery;
    expect(t.subsystem).toBe('eps');
    expect(t.requirement).toBe('req_power');
  });
});
