import { DEG, G0_M_S2, MU_EARTH_KM3_S2, type Explained } from './constants';

export function hohmannDeltaV(input: { r1Km: number; r2Km: number }): Explained<{ deltaV1KmS: number; deltaV2KmS: number; totalKmS: number; transferTimeMin: number }> {
  const { r1Km: r1, r2Km: r2 } = input;
  const mu = MU_EARTH_KM3_S2;
  const dv1 = Math.sqrt(mu / r1) * (Math.sqrt((2 * r2) / (r1 + r2)) - 1);
  const dv2 = Math.sqrt(mu / r2) * (1 - Math.sqrt((2 * r1) / (r1 + r2)));
  const at = (r1 + r2) / 2;
  const tof = Math.PI * Math.sqrt((at * at * at) / mu);
  return {
    deltaV1KmS: Math.abs(dv1),
    deltaV2KmS: Math.abs(dv2),
    totalKmS: Math.abs(dv1) + Math.abs(dv2),
    transferTimeMin: tof / 60,
    formula: 'Δv₁ = √(μ/r₁)·(√(2r₂/(r₁+r₂)) − 1);  Δv₂ = √(μ/r₂)·(1 − √(2r₁/(r₁+r₂)));  t = π·√(a_t³/μ)',
    assumptions: ['Órbitas circulares coplanares; impulsos instantâneos.'],
    source: 'SMAD, cap. 6, eq. 6-31',
  };
}

export function planeChangeDeltaV(input: { velocityKmS: number; deltaInclinationDeg: number }): Explained<{ deltaVKmS: number }> {
  const dv = 2 * input.velocityKmS * Math.sin((input.deltaInclinationDeg * DEG) / 2);
  return {
    deltaVKmS: dv,
    formula: 'Δv = 2·v·sin(Δi/2)',
    assumptions: ['Mudança de plano pura, sem alteração de energia.'],
    source: 'SMAD, cap. 6, eq. 6-34',
  };
}

export function dragMakeupDeltaVPerOrbit(input: { ballisticCoefficient: number; densityKgM3: number; semiMajorAxisKm: number; velocityKmS: number }): Explained<{ deltaVPerOrbitMs: number; deltaVPerYearMs: number }> {
  const aM = input.semiMajorAxisKm * 1000;
  const vM = input.velocityKmS * 1000;
  const dvOrbit = Math.PI * input.ballisticCoefficient * input.densityKgM3 * aM * vM;
  const periodS = 2 * Math.PI * Math.sqrt((input.semiMajorAxisKm ** 3) / MU_EARTH_KM3_S2);
  const orbitsPerYear = (365.25 * 86400) / periodS;
  return {
    deltaVPerOrbitMs: dvOrbit,
    deltaVPerYearMs: dvOrbit * orbitsPerYear,
    formula: 'Δv_órbita ≈ π·(C_D·A/m)·ρ·a·v',
    assumptions: ['Densidade constante ao longo da órbita.'],
    source: 'SMAD, cap. 6, eq. 6-26',
  };
}

export function propellantMass(input: { dryMassKg: number; deltaVMs: number; ispS: number }): Explained<{ propellantKg: number; wetMassKg: number; massRatio: number }> {
  const ratio = Math.exp(input.deltaVMs / (G0_M_S2 * input.ispS));
  const prop = input.dryMassKg * (ratio - 1);
  return {
    propellantKg: prop,
    wetMassKg: input.dryMassKg + prop,
    massRatio: ratio,
    formula: 'm_p = m_seca·(e^{Δv/(g₀·Isp)} − 1)',
    assumptions: ['Equação de Tsiolkovsky; Isp constante.'],
    source: 'SMAD, cap. 17',
  };
}
