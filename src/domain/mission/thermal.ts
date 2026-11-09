import { EARTH_ALBEDO, EARTH_IR_W_M2, R_EARTH_KM, SOLAR_CONSTANT_W_M2, STEFAN_BOLTZMANN_W_M2_K4, type Explained } from './constants';

export interface ThermalInput {
  altitudeKm: number;
  absorptivity: number;
  emissivity: number;
  /** Area projected towards the Sun. */
  sunlitAreaM2: number;
  /** Total radiating area. */
  radiatorAreaM2: number;
  /** Area facing the Earth (albedo and IR); defaults to sunlitAreaM2. */
  earthFacingAreaM2?: number;
  internalPowerW?: number;
  albedo?: number;
  earthIrWm2?: number;
}

export interface ThermalResult {
  hotCaseK: number;
  hotCaseC: number;
  coldCaseK: number;
  coldCaseC: number;
  viewFactor: number;
  absorbedHotW: number;
  absorbedColdW: number;
}

/** Radiative equilibrium temperature for the hot (sunlit) and cold (eclipse) cases. */
export function equilibriumTemperature(input: ThermalInput): Explained<ThermalResult> {
  const F = (R_EARTH_KM / (R_EARTH_KM + input.altitudeKm)) ** 2;
  const albedo = input.albedo ?? EARTH_ALBEDO;
  const qIr = input.earthIrWm2 ?? EARTH_IR_W_M2;
  const aEarth = input.earthFacingAreaM2 ?? input.sunlitAreaM2;
  const pInt = input.internalPowerW ?? 0;
  const solar = input.absorptivity * SOLAR_CONSTANT_W_M2 * input.sunlitAreaM2;
  const alb = input.absorptivity * albedo * SOLAR_CONSTANT_W_M2 * F * aEarth;
  const ir = input.emissivity * qIr * F * aEarth;
  const denom = input.emissivity * STEFAN_BOLTZMANN_W_M2_K4 * input.radiatorAreaM2;
  const hot = Math.pow((solar + alb + ir + pInt) / denom, 0.25);
  const cold = Math.pow((ir + pInt) / denom, 0.25);
  return {
    hotCaseK: hot,
    hotCaseC: hot - 273.15,
    coldCaseK: cold,
    coldCaseC: cold - 273.15,
    viewFactor: F,
    absorbedHotW: solar + alb + ir + pInt,
    absorbedColdW: ir + pInt,
    formula: 'T = [ (α·S·A_sol + α·a·S·F·A_terra + ε·q_IR·F·A_terra + P_int) / (ε·σ·A_rad) ]^{1/4};  F ≈ (R⊕/(R⊕+h))²',
    assumptions: [`Albedo ${albedo}, IR terrestre ${qIr} W/m², nó único isotérmico, sem condução para outros nós.`],
    source: 'SMAD, cap. 11 (controle térmico), eqs. 11-15 a 11-19',
  };
}

export interface OrbitThermalInput extends ThermalInput {
  periodMin: number;
  /** Eclipse duration in the cold case (longest eclipse). */
  eclipseMinCold: number;
  /** Eclipse duration in the hot case (shortest eclipse); defaults to the cold one. */
  eclipseMinHot?: number;
  /** Heat capacity m·c of the single node, J/K. */
  heatCapacityJPerK: number;
  /** Internal dissipation in the hot case (highest-power mode); defaults to internalPowerW. */
  internalPowerHotW?: number;
  /** Internal dissipation in the cold case (lowest-power mode); defaults to internalPowerW. */
  internalPowerColdW?: number;
}

export interface OrbitThermalResult extends ThermalResult {
  /** Instantaneous-equilibrium extremes (no thermal inertia), kept for reference. */
  equilibriumHotC: number;
  equilibriumColdC: number;
  /** Orbit-mean temperatures of each case. */
  meanHotC: number;
  meanColdC: number;
  /** Thermal time constant C / (4·ε·σ·A·T³) at the orbit-mean hot temperature, hours. */
  timeConstantH: number;
}

/** Solar flux at perihelion and aphelion (Earth orbit eccentricity 0.0167, 1/r²). */
const SOLAR_HOT = SOLAR_CONSTANT_W_M2 * 1.0337;
const SOLAR_COLD = SOLAR_CONSTANT_W_M2 * 0.9673;

/**
 * Single-node transient temperature over the orbit. The node absorbs solar
 * and albedo flux while sunlit, Earth IR and internal power all the time,
 * and radiates from the radiator; its heat capacity damps the swing between
 * Sun and shadow. Each case runs until the orbit repeats itself; the hot case
 * takes the perihelion flux, the shortest eclipse and the highest
 * dissipation, the cold case the aphelion flux, the longest eclipse and the
 * lowest dissipation.
 */
export function orbitTemperatureRange(input: OrbitThermalInput): Explained<OrbitThermalResult> {
  const F = (R_EARTH_KM / (R_EARTH_KM + input.altitudeKm)) ** 2;
  const albedo = input.albedo ?? EARTH_ALBEDO;
  const qIr = input.earthIrWm2 ?? EARTH_IR_W_M2;
  const aEarth = input.earthFacingAreaM2 ?? input.sunlitAreaM2;
  const k = input.emissivity * STEFAN_BOLTZMANN_W_M2_K4 * input.radiatorAreaM2;
  const ir = input.emissivity * qIr * F * aEarth;
  const sunTerms = (s: number) => input.absorptivity * s * input.sunlitAreaM2 + input.absorptivity * albedo * s * F * aEarth;
  const periodS = input.periodMin * 60;
  const C = Math.max(input.heatCapacityJPerK, 1);

  const runCase = (solar: number, pInt: number, eclipseMin: number) => {
    const sunlitS = Math.max(0, periodS - eclipseMin * 60);
    const qSun = sunTerms(solar) + ir + pInt;
    const qShadow = ir + pInt;
    const qMean = (qSun * sunlitS + qShadow * (periodS - sunlitS)) / periodS;
    let T = Math.pow(qMean / k, 0.25);
    const dt = 10;
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let n = 0;
    const orbits = 12;
    for (let o = 0; o < orbits; o++) {
      for (let t = 0; t < periodS; t += dt) {
        const q = t < sunlitS ? qSun : qShadow;
        T += ((q - k * T ** 4) * dt) / C;
        if (o === orbits - 1) { min = Math.min(min, T); max = Math.max(max, T); sum += T; n++; }
      }
    }
    return { min, max, mean: sum / n, qSun, qShadow };
  };

  const pMean = input.internalPowerW ?? 0;
  const hot = runCase(SOLAR_HOT, input.internalPowerHotW ?? pMean, input.eclipseMinHot ?? input.eclipseMinCold);
  const cold = runCase(SOLAR_COLD, input.internalPowerColdW ?? pMean, input.eclipseMinCold);
  const eq = equilibriumTemperature(input);
  const tau = C / (4 * k * hot.mean ** 3) / 3600;
  return {
    hotCaseK: hot.max,
    hotCaseC: hot.max - 273.15,
    coldCaseK: cold.min,
    coldCaseC: cold.min - 273.15,
    viewFactor: F,
    absorbedHotW: hot.qSun,
    absorbedColdW: cold.qShadow,
    equilibriumHotC: eq.hotCaseC,
    equilibriumColdC: eq.coldCaseC,
    meanHotC: hot.mean - 273.15,
    meanColdC: cold.mean - 273.15,
    timeConstantH: tau,
    formula: 'C·dT/dt = α·S·A_sol + α·a·S·F·A_terra (ao Sol) + ε·q_IR·F·A_terra + P_int − ε·σ·A_rad·T⁴;  F ≈ (R⊕/(R⊕+h))²',
    assumptions: [
      `Nó único com capacidade térmica de ${Math.round(C / 1000)} kJ/K (constante de tempo de ${tau.toFixed(1)} h); integrado até a órbita se repetir.`,
      `Caso quente: fluxo solar no periélio (${Math.round(SOLAR_HOT)} W/m²), menor eclipse e maior dissipação; caso frio: afélio (${Math.round(SOLAR_COLD)} W/m²), maior eclipse e menor dissipação.`,
      `Albedo ${albedo}, IR terrestre ${qIr} W/m²; o equilíbrio instantâneo (sem inércia) daria ${Math.round(eq.coldCaseC)} °C a ${Math.round(eq.hotCaseC)} °C.`,
    ],
    source: 'SMAD, cap. 11 (controle térmico); balanço de um nó com capacidade térmica',
  };
}
