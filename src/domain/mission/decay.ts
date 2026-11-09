import { MU_EARTH_KM3_S2, R_EARTH_KM, type Explained } from './constants';

export type SolarActivity = 'low' | 'mean' | 'high';

/** Exponential atmosphere (US Standard 1976 fit): base altitude, nominal density, scale height. */
const ATMOSPHERE: { h0: number; rho0: number; H: number }[] = [
  { h0: 0, rho0: 1.225, H: 7.249 }, { h0: 25, rho0: 3.899e-2, H: 6.349 }, { h0: 30, rho0: 1.774e-2, H: 6.682 },
  { h0: 40, rho0: 3.972e-3, H: 7.554 }, { h0: 50, rho0: 1.057e-3, H: 8.382 }, { h0: 60, rho0: 3.206e-4, H: 7.714 },
  { h0: 70, rho0: 8.770e-5, H: 6.549 }, { h0: 80, rho0: 1.905e-5, H: 5.799 }, { h0: 90, rho0: 3.396e-6, H: 5.382 },
  { h0: 100, rho0: 5.297e-7, H: 5.877 }, { h0: 110, rho0: 9.661e-8, H: 7.263 }, { h0: 120, rho0: 2.438e-8, H: 9.473 },
  { h0: 130, rho0: 8.484e-9, H: 12.636 }, { h0: 140, rho0: 3.845e-9, H: 16.149 }, { h0: 150, rho0: 2.070e-9, H: 22.523 },
  { h0: 180, rho0: 5.464e-10, H: 29.740 }, { h0: 200, rho0: 2.789e-10, H: 37.105 }, { h0: 250, rho0: 7.248e-11, H: 45.546 },
  { h0: 300, rho0: 2.418e-11, H: 53.628 }, { h0: 350, rho0: 9.518e-12, H: 53.298 }, { h0: 400, rho0: 3.725e-12, H: 58.515 },
  { h0: 450, rho0: 1.585e-12, H: 60.828 }, { h0: 500, rho0: 6.967e-13, H: 63.822 }, { h0: 600, rho0: 1.454e-13, H: 71.835 },
  { h0: 700, rho0: 3.614e-14, H: 88.667 }, { h0: 800, rho0: 1.170e-14, H: 124.64 }, { h0: 900, rho0: 5.245e-15, H: 181.05 },
  { h0: 1000, rho0: 3.019e-15, H: 268.00 },
];
const ACTIVITY_FACTOR: Record<SolarActivity, number> = { low: 0.5, mean: 1, high: 2.5 };

export function atmosphericDensity(input: { altitudeKm: number; solarActivity?: SolarActivity }): Explained<{ densityKgM3: number }> {
  const h = Math.max(0, input.altitudeKm);
  let band = ATMOSPHERE[0];
  for (const b of ATMOSPHERE) if (h >= b.h0) band = b;
  const rho = band.rho0 * Math.exp(-(h - band.h0) / band.H) * ACTIVITY_FACTOR[input.solarActivity ?? 'mean'];
  return {
    densityKgM3: rho,
    formula: 'ρ(h) = ρ₀·exp(−(h − h₀)/H) · fator de atividade solar',
    assumptions: [`Atmosfera exponencial por faixas (US Standard 1976); atividade solar ${input.solarActivity ?? 'mean'} (fator ${ACTIVITY_FACTOR[input.solarActivity ?? 'mean']}).`],
    source: 'Vallado, tabela 8-4',
  };
}

export interface LifetimeInput {
  altitudeKm: number;
  /** Ballistic coefficient C_D·A/m in m²/kg. */
  ballisticCoefficient: number;
  solarActivity?: SolarActivity;
  maxYears?: number;
  /** Mission duration in years; the disposal rules count from its end. */
  missionYears?: number;
}

export function orbitalLifetime(input: LifetimeInput): Explained<{ lifetimeYears: number; postMissionYears: number; reachedFloor: boolean; history: { dayIndex: number; altitudeKm: number }[]; meets25YearRule: boolean; meets5YearRule: boolean }> {
  const maxDays = Math.round((input.maxYears ?? 30) * 365.25);
  const muM = MU_EARTH_KM3_S2 * 1e9;
  let aM = (R_EARTH_KM + input.altitudeKm) * 1000;
  const history: { dayIndex: number; altitudeKm: number }[] = [];
  let day = 0;
  let reachedFloor = false;
  const sampleEvery = Math.max(1, Math.round(maxDays / 400));
  for (day = 0; day < maxDays; day++) {
    const hKm = aM / 1000 - R_EARTH_KM;
    if (hKm <= 120) { history.push({ dayIndex: day, altitudeKm: 120 }); reachedFloor = true; break; }
    if (day % sampleEvery === 0) history.push({ dayIndex: day, altitudeKm: hKm });
    const rho = atmosphericDensity({ altitudeKm: hKm, solarActivity: input.solarActivity }).densityKgM3;
    const dadt = -input.ballisticCoefficient * rho * Math.sqrt(muM * aM); // m/s
    aM += dadt * 86400;
  }
  const years = day / 365.25;
  // IADC (25 years) and FCC 22-74 (5 years) count from the end of the mission.
  const postMission = Math.max(0, years - (input.missionYears ?? 0));
  return {
    lifetimeYears: years,
    postMissionYears: postMission,
    reachedFloor,
    history,
    meets25YearRule: reachedFloor && postMission <= 25,
    meets5YearRule: reachedFloor && postMission <= 5,
    formula: 'da/dt = −(C_D·A/m)·ρ(h)·√(μ·a), integrado com passo de 1 dia até h = 120 km',
    assumptions: [
      'Órbita circular; decaimento lento (variação de a por órbita pequena).',
      reachedFloor ? 'Reentrada assumida em 120 km.' : `Não reentrou em ${input.maxYears ?? 30} anos (limite da simulação).`,
      input.missionYears ? `Regras de descarte contadas a partir do fim da missão (${input.missionYears} anos após o lançamento).` : 'Regras de descarte contadas a partir do lançamento (duração da missão não informada).',
    ],
    source: 'Vallado, §8.6; SMAD, cap. 8; regra dos 25 anos (IADC) e 5 anos (FCC 2022)',
  };
}
