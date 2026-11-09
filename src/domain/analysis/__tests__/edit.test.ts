import { describe, expect, it } from 'vitest';
import { validateArchitecture } from '../../parser/validateArchitecture';
import { normalizeArchitecture } from '../../parser/normalizeArchitecture';
import { cloneInputDocument, toInputDocument } from '../../parser/inputDocument';
import { computeRipple } from '../ripple';
import { currentValue, defaultRange, linspace, runSweep, sweepVariables } from '../sweep';
import { useArchitectureStore } from '../../../state/architectureStore';
import demo from '../../../data/demoArchitecture.json';

const arch = (() => {
  const r = validateArchitecture(demo);
  if (!r.ok || !r.data) throw new Error(`demo invalid: ${JSON.stringify(r.issues)}`);
  return normalizeArchitecture(r.data);
})();

describe('input document round trip', () => {
  it('strips derived fields and validates again', () => {
    const doc = toInputDocument(arch) as unknown as Record<string, unknown>;
    expect(doc.evaluation).toBeUndefined();
    expect(doc.breakdownCodes).toBeUndefined();
    expect(validateArchitecture(doc).ok).toBe(true);
    const copy = cloneInputDocument(arch);
    copy.entities[0].name = 'x';
    expect(arch.entities[0].name).not.toBe('x');
  });
});

describe('ripple', () => {
  it('walks from the edited parameter through dependents to the rules', () => {
    const levels = computeRipple(arch, ['battery.capacity_wh']);
    expect(levels.battery).toBe(0);
    expect(levels.req_power).toBeGreaterThanOrEqual(1);
    expect(levels.camera).toBeUndefined();
    expect(levels.req_mass).toBeUndefined();
  });

  it('an orbit change starts at the mission and reaches the eclipse-dependent chain', () => {
    const levels = computeRipple(arch, ['engine.orbit_*']);
    expect(levels.mission).toBe(0);
    expect(levels.req_power).toBeGreaterThanOrEqual(1);
  });

  it('a mass edit reaches the mass requirement via the budget', () => {
    const levels = computeRipple(arch, ['camera.mass']);
    expect(levels.camera).toBe(0);
    expect(levels.payload).toBeGreaterThanOrEqual(1);
    expect(levels.req_mass).toBeGreaterThanOrEqual(1);
  });
});

describe('design sweep', () => {
  it('lists orbit elements and declared parameters', () => {
    const vars = sweepVariables(arch);
    expect(vars.find((v) => v.id === 'orbit.altitudeKm')).toBeDefined();
    const batt = vars.find((v) => v.id === 'battery.capacity_wh')!;
    expect(batt).toBeDefined();
    expect(currentValue(arch, batt)).toBe(84);
    expect(vars.find((v) => v.id === 'mission.dry_mass')).toBeUndefined();
    expect(linspace(0, 1, 5)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(defaultRange(vars[0], 550)).toEqual({ min: 330, max: 830, steps: 7 });
  });

  it('altitude sweep: higher orbits mean shorter eclipses, weaker links and longer lives', () => {
    const alt = sweepVariables(arch).find((v) => v.id === 'orbit.altitudeKm')!;
    const pts = runSweep(arch, alt, [400, 550, 700]);
    expect(pts.every((p) => p.ok)).toBe(true);
    expect(pts[0].eclipseMaxMin!).toBeGreaterThan(pts[2].eclipseMaxMin!);
    expect(pts[0].linkMarginDb!).toBeGreaterThan(pts[2].linkMarginDb!);
    expect(pts[0].lifetimeYears!).toBeLessThan(pts[2].lifetimeYears!);
    expect(pts[1].rulesTotal).toBe(5);
  });

  it('battery sweep flips the eclipse rule below the required capacity', () => {
    const batt = sweepVariables(arch).find((v) => v.id === 'battery.capacity_wh')!;
    const pts = runSweep(arch, batt, [20, 84]);
    expect(pts[0].rulesPass).toBeLessThan(pts[1].rulesPass);
    expect(pts[0].batteryRequiredWh!).toBeGreaterThan(20);
  });
});

describe('store editing with undo and redo', () => {
  it('applies an edit, ripples, undoes and redoes', () => {
    const s = useArchitectureStore.getState();
    s.resetToDemo();
    const before = useArchitectureStore.getState().architecture!.evaluation.params['battery.capacity_wh'].value;
    const r = s.applyEdit('test', (doc) => {
      const p = doc.entities.find((e) => e.id === 'battery')!.parameters!.find((x) => x.id === 'capacity_wh')!;
      p.value = 20;
    }, ['battery.capacity_wh']);
    expect(r.ok).toBe(true);
    let st = useArchitectureStore.getState();
    expect(st.architecture!.evaluation.params['battery.capacity_wh'].value).toBe(20);
    expect(st.architecture!.evaluation.rules.req_power.result).toBe('fail');
    expect(st.history).toHaveLength(1);
    expect(st.ripple?.levels.battery).toBe(0);
    st.undo();
    st = useArchitectureStore.getState();
    expect(st.architecture!.evaluation.params['battery.capacity_wh'].value).toBe(before);
    expect(st.future).toHaveLength(1);
    st.redo();
    st = useArchitectureStore.getState();
    expect(st.architecture!.evaluation.params['battery.capacity_wh'].value).toBe(20);
    expect(st.history).toHaveLength(1);
  });

  it('rejects an invalid edit and keeps the model', () => {
    const s = useArchitectureStore.getState();
    s.resetToDemo();
    const r = s.applyEdit('bad', (doc) => { doc.mission!.orbit!.altitudeKm = 5; }, ['engine.orbit_*']);
    expect(r.ok).toBe(false);
    expect(useArchitectureStore.getState().architecture!.mission!.orbit!.altitudeKm).toBe(600);
    expect(useArchitectureStore.getState().lastIssues.length).toBeGreaterThan(0);
  });
});
