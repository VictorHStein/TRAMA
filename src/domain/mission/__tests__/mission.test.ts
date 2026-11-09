import { describe, expect, it } from 'vitest';
import * as satellite from 'satellite.js';
import {
  orbitBasics, betaAngleDeg, eclipseFraction, eclipseOverYear, raanFromLtan,
  coverageGeometry, passesPerDayEstimate, simulatePasses, propagateKeplerJ2,
  freeSpacePathLossDb, parabolicGainDbi, linkBudget,
  powerByMode, solarArraySizing, batterySizing, powerProfileOverOrbit,
  dataBudget, hohmannDeltaV, propellantMass, planeChangeDeltaV,
  atmosphericDensity, orbitalLifetime, equilibriumTemperature, orbitTemperatureRange, massBudget,
  R_EARTH_KM,
} from '../index';

describe('orbit', () => {
  it('period, velocity and sun-synchronous inclination at 500 km', () => {
    const o = orbitBasics({ altitudeKm: 500, inclinationDeg: 97.4 });
    expect(o.periodMin).toBeCloseTo(94.6, 0);
    expect(o.velocityKmS).toBeCloseTo(7.61, 1);
    expect(o.sunSynchronousInclinationDeg).toBeCloseTo(97.4, 0);
    expect(o.isSunSynchronous).toBe(true);
    expect(orbitBasics({ altitudeKm: 800, inclinationDeg: 98.6 }).sunSynchronousInclinationDeg).toBeCloseTo(98.6, 0);
    expect(o.formula).toContain('T = 2π');
  });

  it('eclipse fraction at 500 km', () => {
    const e0 = eclipseFraction({ altitudeKm: 500, betaDeg: 0 });
    expect(e0.fraction).toBeCloseTo(0.378, 2);
    expect(e0.eclipseMin).toBeCloseTo(35.7, 0);
    expect(e0.betaStarDeg).toBeCloseTo(68.0, 0);
    expect(eclipseFraction({ altitudeKm: 500, betaDeg: 70 }).fraction).toBe(0);
  });

  it('beta angle follows the Sun; LTAN 10:30 SSO keeps a moderate beta all year', () => {
    const march = new Date('2027-03-21T00:00:00Z');
    const raan = raanFromLtan({ date: march, ltanHours: 12 }).raanDeg;
    // Noon LTAN at the equinox: orbit plane contains the Sun direction → beta ≈ 0 for a polar orbit
    expect(Math.abs(betaAngleDeg({ date: march, inclinationDeg: 90, raanDeg: raan }).betaDeg)).toBeLessThan(2);
    const year = eclipseOverYear({ altitudeKm: 550, inclinationDeg: 97.6, ltanHours: 10.5, year: 2027 });
    expect(year.days).toHaveLength(365);
    expect(year.maxEclipseMin).toBeGreaterThan(20);
    expect(year.maxEclipseMin).toBeLessThan(40);
    expect(year.maxBetaDeg - year.minBetaDeg).toBeLessThan(40);
  });
});

describe('ground station geometry and passes', () => {
  it('coverage geometry at 500 km and 10° elevation', () => {
    const g = coverageGeometry({ altitudeKm: 500, minElevationDeg: 10 });
    expect(g.earthAngularRadiusDeg).toBeCloseTo(68.0, 0);
    expect(g.nadirAngleDeg).toBeCloseTo(65.9, 0);
    expect(g.earthCentralAngleDeg).toBeCloseTo(14.1, 0);
    expect(g.slantRangeKm).toBeCloseTo(1695, -1);
    expect(g.maxPassDurationMin).toBeCloseTo(7.4, 0);
  });

  it('propagator keeps altitude and latitude bounds', () => {
    const orbit = { altitudeKm: 420, inclinationDeg: 51.6, raanDeg: 30 };
    for (let t = 0; t < 6000; t += 300) {
      const p = propagateKeplerJ2(orbit, t);
      const r = Math.hypot(p.x, p.y, p.z);
      expect(r - R_EARTH_KM).toBeCloseTo(420, 0);
      const lat = Math.asin(p.z / r) * 180 / Math.PI;
      expect(Math.abs(lat)).toBeLessThanOrEqual(51.7);
    }
  });

  it('ISS-like orbit over São José dos Campos: a handful of passes a day, none longer than 12 min', () => {
    const sim = simulatePasses({
      orbit: { altitudeKm: 420, inclinationDeg: 51.6, raanDeg: 120 },
      epoch: new Date('2027-03-21T00:00:00Z'),
      station: { latDeg: -23.21, lonDeg: -45.86, altKm: 0.6, minElevationDeg: 10 },
      durationHours: 24,
      stepS: 10,
    });
    expect(sim.passes.length).toBeGreaterThanOrEqual(2);
    expect(sim.passes.length).toBeLessThanOrEqual(8);
    for (const p of sim.passes) expect(p.durationMin).toBeLessThan(12);
    expect(sim.groundTrack.length).toBeGreaterThan(1000);
    const est = passesPerDayEstimate({ altitudeKm: 420, inclinationDeg: 51.6, stationLatDeg: -23.21, minElevationDeg: 10 });
    expect(est.passesPerDay).toBeGreaterThan(1.5);
    expect(est.passesPerDay).toBeLessThan(10);
  });

  it('simulated eclipse fraction agrees with the analytic value', () => {
    const epoch = new Date('2027-03-21T00:00:00Z');
    const raan = raanFromLtan({ date: epoch, ltanHours: 10.5 }).raanDeg;
    const beta = betaAngleDeg({ date: epoch, inclinationDeg: 97.6, raanDeg: raan }).betaDeg;
    const analytic = eclipseFraction({ altitudeKm: 550, betaDeg: beta }).fraction;
    const sim = simulatePasses({
      orbit: { altitudeKm: 550, inclinationDeg: 97.6, raanDeg: raan },
      epoch,
      station: { latDeg: -23.21, lonDeg: -45.86, minElevationDeg: 10 },
      durationHours: 24,
      stepS: 30,
    });
    expect(Math.abs(sim.eclipseFraction - analytic)).toBeLessThan(0.05);
  });

  it('cross-check with satellite.js SGP4 on a real ISS TLE: altitude and latitude envelope', () => {
    const tle1 = '1 25544U 98067A   24001.50000000  .00016717  00000-0  30390-3 0  9992';
    const tle2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.49309239428934';
    const rec = satellite.twoline2satrec(tle1, tle2);
    for (let k = 0; k < 12; k++) {
      const date = new Date(Date.UTC(2024, 0, 1, 12, k * 10, 0));
      const pv = satellite.propagate(rec, date);
      const pos = pv?.position as { x: number; y: number; z: number };
      const gmst = satellite.gstime(date);
      const gd = satellite.eciToGeodetic(pos, gmst);
      expect(gd.height).toBeGreaterThan(380);
      expect(gd.height).toBeLessThan(460);
      expect(Math.abs(gd.latitude * 180 / Math.PI)).toBeLessThan(52);
    }
  });
});

describe('link budget', () => {
  it('free-space path loss and parabolic gain', () => {
    expect(freeSpacePathLossDb({ distanceKm: 1000, frequencyGHz: 2.2 }).fsplDb).toBeCloseTo(159.3, 1);
    expect(freeSpacePathLossDb({ distanceKm: 1000, frequencyGHz: 0.437 }).fsplDb).toBeCloseTo(145.3, 0);
    expect(parabolicGainDbi({ diameterM: 3, frequencyGHz: 2.2 }).gainDbi).toBeCloseTo(34.2, 0);
  });

  it('reproduces a hand-computed S-band downlink line by line', () => {
    const r = linkBudget({
      txPowerW: 2, txLineLossDb: 1, txGainDbi: 6, frequencyGHz: 2.2, distanceKm: 1695,
      atmosphericLossDb: 0.5, polarizationLossDb: 0.5, pointingLossDb: 0.5,
      rxGainDbi: 34.2, systemNoiseTempK: 250, dataRateBps: 2.4e6, requiredEbN0Db: 4.4, implementationLossDb: 1,
    });
    const eirp = 10 * Math.log10(2) - 1 + 6; // 8.01 dBW
    expect(r.eirpDbW).toBeCloseTo(eirp, 2);
    const fspl = 92.45 + 20 * Math.log10(1695) + 20 * Math.log10(2.2);
    expect(r.fsplDb).toBeCloseTo(fspl, 2);
    const gt = 34.2 - 10 * Math.log10(250);
    expect(r.gtDbK).toBeCloseTo(gt, 2);
    const cn0 = eirp - fspl - 1.5 + gt + 228.6;
    expect(r.cN0DbHz).toBeCloseTo(cn0, 2);
    expect(r.ebN0Db).toBeCloseTo(cn0 - 10 * Math.log10(2.4e6), 2);
    expect(r.marginDb).toBeCloseTo(r.ebN0Db - 4.4 - 1, 6);
    expect(r.lines[r.lines.length - 1].valueDb).toBeCloseTo(r.marginDb, 6);
  });
});

describe('power, data', () => {
  it('mode average and solar array sizing', () => {
    const modes = powerByMode({ modes: [
      { id: 'a', name: 'A', durationFraction: 0.6, loads: [{ entityId: 'x', powerW: 20 }] },
      { id: 'b', name: 'B', durationFraction: 0.4, loads: [{ entityId: 'x', powerW: 40 }] },
    ] });
    expect(modes.orbitAverageW).toBeCloseTo(28);
    const sa = solarArraySizing({ dayPowerW: 30, eclipsePowerW: 30, periodMin: 95, eclipseMin: 35, lifetimeYears: 5 });
    // P_sa = (30·35/0.65 + 30·60/0.85)/60 = (1615.4 + 2117.6)/60 = 62.2 W
    expect(sa.requiredArrayPowerW).toBeCloseTo(62.2, 0);
    expect(sa.areaM2).toBeGreaterThan(0.2);
    expect(sa.areaM2).toBeLessThan(0.4);
  });

  it('battery sizing and orbit profile never dip below zero for a healthy design', () => {
    const b = batterySizing({ eclipsePowerW: 30, eclipseMin: 35, depthOfDischarge: 0.3, orbitsPerDay: 15.2, lifetimeYears: 5 });
    expect(b.capacityWh).toBeCloseTo((30 * 35 / 60) / (0.3 * 0.9), 1);
    expect(b.cyclesTotal).toBeCloseTo(15.2 * 365 * 5, 0);
    const prof = powerProfileOverOrbit({
      periodMin: 95, eclipseMin: 35, generationW: 64, capacityWh: 84,
      modes: [{ id: 'n', totalW: 28 }, { id: 'img', totalW: 46 }],
      modeSchedule: [{ modeId: 'img', startMin: 10, endMin: 25 }, { modeId: 'n', startMin: 0, endMin: 10 }, { modeId: 'n', startMin: 25, endMin: 95 }],
    });
    expect(prof.points).toHaveLength(95);
    expect(prof.minSoc).toBeGreaterThan(0.7);
    expect(prof.energyDeficitWh).toBe(0);
  });

  it('data budget flags an undersized downlink', () => {
    const ok = dataBudget({ sources: [{ entityId: 'cam', rateBps: 8e6, dutyFraction: 0.05 }], downlinkRateBps: 2.4e6, contactMinPerDay: 40, longestGapMin: 600 });
    expect(ok.generatedMBPerDay).toBeCloseTo(8e6 * 0.05 * 86400 / 8 / 1e6, 1);
    expect(ok.status).toBe('fail');
    const fine = dataBudget({ sources: [{ entityId: 'cam', rateBps: 8e6, dutyFraction: 0.005 }], downlinkRateBps: 2.4e6, contactMinPerDay: 40 });
    expect(fine.status).toBe('ok');
  });
});

describe('propulsion, decay, thermal, mass', () => {
  it('Hohmann 500→800 km and Tsiolkovsky', () => {
    const h = hohmannDeltaV({ r1Km: R_EARTH_KM + 500, r2Km: R_EARTH_KM + 800 });
    expect(h.totalKmS).toBeCloseTo(0.161, 2);
    expect(propellantMass({ dryMassKg: 100, deltaVMs: 100, ispS: 220 }).propellantKg).toBeCloseTo(4.74, 1);
    expect(planeChangeDeltaV({ velocityKmS: 7.6, deltaInclinationDeg: 10 }).deltaVKmS).toBeCloseTo(1.325, 2);
  });

  it('atmospheric density and orbital lifetime orders of magnitude', () => {
    expect(atmosphericDensity({ altitudeKm: 400 }).densityKgM3).toBeCloseTo(3.725e-12, 14);
    const low = orbitalLifetime({ altitudeKm: 400, ballisticCoefficient: 0.02, solarActivity: 'mean' });
    expect(low.reachedFloor).toBe(true);
    expect(low.lifetimeYears).toBeGreaterThan(0.2);
    expect(low.lifetimeYears).toBeLessThan(5);
    const high = orbitalLifetime({ altitudeKm: 800, ballisticCoefficient: 0.02, solarActivity: 'mean', maxYears: 30 });
    expect(high.reachedFloor).toBe(false);
    expect(high.meets25YearRule).toBe(false);
    for (let k = 1; k < low.history.length; k++) expect(low.history[k].altitudeKm).toBeLessThanOrEqual(low.history[k - 1].altitudeKm);
  });

  it('counts the IADC and FCC disposal rules from the end of the mission', () => {
    // A satellite that stays more than 5 years in orbit fails the FCC rule counted
    // from launch, but passes it when the mission itself takes all but 2 of those years.
    const fromLaunch = orbitalLifetime({ altitudeKm: 550, ballisticCoefficient: 0.0113, solarActivity: 'mean' });
    expect(fromLaunch.reachedFloor).toBe(true);
    expect(fromLaunch.lifetimeYears).toBeGreaterThan(5);
    expect(fromLaunch.meets5YearRule).toBe(false);
    const missionYears = fromLaunch.lifetimeYears - 2;
    const afterMission = orbitalLifetime({ altitudeKm: 550, ballisticCoefficient: 0.0113, solarActivity: 'mean', missionYears });
    expect(afterMission.postMissionYears).toBeCloseTo(2, 6);
    expect(afterMission.meets5YearRule).toBe(true);
    expect(afterMission.meets25YearRule).toBe(true);
  });

  it('equilibrium temperature hot and cold cases', () => {
    const t = equilibriumTemperature({ altitudeKm: 500, absorptivity: 0.9, emissivity: 0.9, sunlitAreaM2: 0.17, radiatorAreaM2: 1.0, earthFacingAreaM2: 0.17 });
    expect(t.hotCaseK).toBeGreaterThan(240);
    expect(t.hotCaseK).toBeLessThan(320);
    expect(t.coldCaseK).toBeGreaterThan(150);
    expect(t.coldCaseK).toBeLessThan(260);
    expect(t.coldCaseK).toBeLessThan(t.hotCaseK);
  });

  it('ECSS mass budget', () => {
    const m = massBudget({ items: [{ id: 'a', massKg: 10, maturity: 'cots' }, { id: 'b', massKg: 5, maturity: 'modified' }, { id: 'c', massKg: 2, maturity: 'new' }], systemMarginFraction: 0.2, allocatedDryMassKg: 25 });
    expect(m.dryMassWithItemMarginsKg).toBeCloseTo(18.4, 6);
    expect(m.dryMassWithSystemMarginKg).toBeCloseTo(22.08, 6);
    expect(m.status).toBe('warning');
  });
});

describe('transient single-node thermal model', () => {
  const base = {
    altitudeKm: 600, absorptivity: 0.06, emissivity: 0.85, sunlitAreaM2: 0.216, radiatorAreaM2: 0.18,
    earthFacingAreaM2: 0.16, internalPowerW: 29, periodMin: 96.7, eclipseMinCold: 35.5,
  };

  it('with a huge heat capacity, sits at the orbit-mean equilibrium of each case', () => {
    const r = orbitTemperatureRange({ ...base, heatCapacityJPerK: 1e12 });
    // Orbit-mean absorbed power over εσA gives T⁴; the swing vanishes.
    expect(r.hotCaseC - r.meanHotC).toBeLessThan(0.05);
    expect(r.meanColdC - r.coldCaseC).toBeLessThan(0.05);
    expect(r.hotCaseC).toBeLessThan(r.equilibriumHotC + 5);
  });

  it('with the 20 kJ/K of a 22 kg aluminium satellite, swings a few kelvin around the mean', () => {
    const r = orbitTemperatureRange({ ...base, heatCapacityJPerK: 19_530 });
    expect(r.hotCaseC - r.meanHotC).toBeLessThan(3);
    expect(r.timeConstantH).toBeGreaterThan(3);
    // Far inside the instantaneous-equilibrium extremes (no thermal inertia).
    expect(r.coldCaseC).toBeGreaterThan(r.equilibriumColdC);
  });

  it('with almost no heat capacity, reaches the instantaneous equilibrium of the cold case', () => {
    const r = orbitTemperatureRange({ ...base, heatCapacityJPerK: 50 });
    // Cold case: aphelion and the same dissipation, so its shadow equilibrium equals the plain one.
    expect(r.coldCaseC).toBeCloseTo(r.equilibriumColdC, 0);
  });
});
