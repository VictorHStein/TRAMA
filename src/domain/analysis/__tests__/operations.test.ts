import { describe, expect, it } from 'vitest';
import { validateArchitecture } from '../../parser/validateArchitecture';
import { normalizeArchitecture } from '../../parser/normalizeArchitecture';
import { getMissionReport } from '../mission';
import { buildOperationsModel, operationsMode, simulateOperations, stepStateOfCharge } from '../operations';
import demo from '../../../data/demoArchitecture.json';

const arch = (() => {
  const r = validateArchitecture(demo);
  if (!r.ok || !r.data) throw new Error(`demo invalid: ${JSON.stringify(r.issues)}`);
  return normalizeArchitecture(r.data);
})();
const report = getMissionReport(arch)!;
const model = buildOperationsModel(arch, report)!;

describe('event-driven operations', () => {
  it('reads modes, loads, generation and battery from the model', () => {
    expect(model.eclipseModeId).toBe('eclipse');
    expect(model.downlinkModeId).toBe('downlink');
    expect(model.nominalModeId).toBe('nominal');
    expect(model.generationW).toBeCloseTo(arch.evaluation.params['eps.power_generation'].value!, 9);
    expect(model.capacityWh).toBe(84);
  });

  it('lets the events decide eclipse and downlink', () => {
    expect(operationsMode(model, { sunlit: false, contact: false, minutesSinceSunrise: 10 })).toBe('eclipse');
    expect(operationsMode(model, { sunlit: true, contact: true, minutesSinceSunrise: 10 })).toBe('downlink');
    // A pass in the shadow is still used for downlink.
    expect(operationsMode(model, { sunlit: false, contact: true, minutesSinceSunrise: 70 })).toBe('downlink');
    // A scheduled downlink slot without the station in view falls back to nominal.
    const slot = model.sunlitSchedule.indexOf('downlink');
    expect(slot).toBeGreaterThan(0);
    expect(operationsMode(model, { sunlit: true, contact: false, minutesSinceSunrise: slot })).toBe('nominal');
  });

  it('charges with the charge efficiency and discharges without it', () => {
    // 30 W eclipse load for one hour drains 30 Wh of 84 Wh.
    expect(stepStateOfCharge(model, 1, 'eclipse', false, 3600)).toBeCloseTo(1 - 30 / 84, 6);
    // Array generation minus the 28 W nominal load, × 0.9 charge efficiency, for one hour from 50 %.
    expect(stepStateOfCharge(model, 0.5, 'nominal', true, 3600)).toBeCloseTo(0.5 + ((model.generationW - 28) * 0.9) / 84, 6);
  });

  it('over one day, shadow and contact match the mission analysis', () => {
    const run = simulateOperations(model, report, { hours: 24, stepS: 10 });
    const shadowFraction = run.shadowSeconds / run.durationS;
    // Eclipse fraction at the epoch from the analytical model.
    expect(shadowFraction).toBeCloseTo(report.eclipse.atEpoch.eclipseMin / report.orbit.basics.periodMin, 1);
    // Daily contact within two minutes of the pass simulation of the report (20 s step there, 10 s here).
    expect(Math.abs(run.contactSeconds / 60 - report.station!.simulation.totalContactMinPerDay)).toBeLessThan(2);
    // Downlink happens only during passes, the same fraction the model declares (engine.station_contact_fraction).
    expect(run.modeSeconds['downlink']).toBe(run.contactSeconds);
    expect(run.minSoc).toBeGreaterThan(0.7);
    expect(run.minSoc).toBeLessThan(1);
  });
});
