/**
 * Recomputes the mission-analysis quantities that the unit tests check
 * against published values (SMAD 3rd ed., Vallado 4th ed.) and prints them
 * with the difference, for the results chapter of the monograph.
 * Run: npx vite-node scripts/verificacao_referencias.ts
 */
import {
  orbitBasics, eclipseFraction, coverageGeometry, freeSpacePathLossDb, parabolicGainDbi,
  hohmannDeltaV, propellantMass, planeChangeDeltaV, atmosphericDensity, solarArraySizing,
  batterySizing, massBudget, R_EARTH_KM,
} from '../src/domain/mission';

interface Row { quantity: string; reference: number; computed: number; unit: string; source: string }

const o = orbitBasics({ altitudeKm: 500, inclinationDeg: 97.4 });
const e = eclipseFraction({ altitudeKm: 500, betaDeg: 0 });
const g = coverageGeometry({ altitudeKm: 500, minElevationDeg: 10 });
const sa = solarArraySizing({ dayPowerW: 30, eclipsePowerW: 30, periodMin: 95, eclipseMin: 35, lifetimeYears: 5 });
const b = batterySizing({ eclipsePowerW: 30, eclipseMin: 35, depthOfDischarge: 0.3, orbitsPerDay: 15.2, lifetimeYears: 5 });
const m = massBudget({ items: [{ id: 'a', massKg: 10, maturity: 'cots' }, { id: 'b', massKg: 5, maturity: 'modified' }, { id: 'c', massKg: 2, maturity: 'new' }], systemMarginFraction: 0.2, allocatedDryMassKg: 25 });

const rows: Row[] = [
  { quantity: 'Período orbital a 500 km', reference: 94.6, computed: o.periodMin, unit: 'min', source: 'SMAD' },
  { quantity: 'Inclinação heliossíncrona a 500 km', reference: 97.4, computed: o.sunSynchronousInclinationDeg, unit: '°', source: 'SMAD' },
  { quantity: 'Raio angular da Terra a 500 km', reference: 68.0, computed: g.earthAngularRadiusDeg, unit: '°', source: 'SMAD' },
  { quantity: 'Eclipse máximo a 500 km (β = 0)', reference: 35.7, computed: e.eclipseMin, unit: 'min', source: 'SMAD' },
  { quantity: 'Ângulo central da cobertura (ε = 10°)', reference: 14.1, computed: g.earthCentralAngleDeg, unit: '°', source: 'SMAD' },
  { quantity: 'Alcance máximo (ε = 10°)', reference: 1695, computed: g.slantRangeKm, unit: 'km', source: 'SMAD' },
  { quantity: 'Perda no espaço livre (1 000 km, 2,2 GHz)', reference: 159.3, computed: freeSpacePathLossDb({ distanceKm: 1000, frequencyGHz: 2.2 }).fsplDb, unit: 'dB', source: 'SMAD' },
  { quantity: 'Ganho de antena parabólica de 3 m (2,2 GHz)', reference: 34.2, computed: parabolicGainDbi({ diameterM: 3, frequencyGHz: 2.2 }).gainDbi, unit: 'dBi', source: 'SMAD' },
  { quantity: 'Potência do painel (30 W, 35 min de eclipse)', reference: 62.2, computed: sa.requiredArrayPowerW, unit: 'W', source: 'SMAD' },
  { quantity: 'Capacidade da bateria (30 W, 35 min, DoD 0,3)', reference: (30 * 35 / 60) / (0.3 * 0.9), computed: b.capacityWh, unit: 'Wh', source: 'SMAD' },
  { quantity: 'Transferência de Hohmann 500 → 800 km', reference: 0.161, computed: hohmannDeltaV({ r1Km: R_EARTH_KM + 500, r2Km: R_EARTH_KM + 800 }).totalKmS, unit: 'km/s', source: 'Vallado' },
  { quantity: 'Mudança de plano de 10° a 7,6 km/s', reference: 1.325, computed: planeChangeDeltaV({ velocityKmS: 7.6, deltaInclinationDeg: 10 }).deltaVKmS, unit: 'km/s', source: 'Vallado' },
  { quantity: 'Propelente (100 kg, 100 m/s, Isp 220 s)', reference: 4.74, computed: propellantMass({ dryMassKg: 100, deltaVMs: 100, ispS: 220 }).propellantKg, unit: 'kg', source: 'SMAD' },
  { quantity: 'Densidade atmosférica a 400 km', reference: 3.725e-12, computed: atmosphericDensity({ altitudeKm: 400 }).densityKgM3, unit: 'kg/m³', source: 'Vallado' },
  { quantity: 'Massa com margens de maturidade (10 + 5 + 2 kg)', reference: 18.4, computed: m.dryMassWithItemMarginsKg, unit: 'kg', source: 'ESA' },
];

for (const r of rows) {
  const rel = Math.abs(r.computed - r.reference) / Math.abs(r.reference) * 100;
  console.log(`${r.quantity} | ${r.reference} | ${r.computed.toPrecision(5)} | ${r.unit} | ${rel.toFixed(2)} % | ${r.source}`);
}
