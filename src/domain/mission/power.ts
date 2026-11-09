import { SOLAR_CONSTANT_W_M2, DEG, type Explained } from './constants';

export interface ModeLoadInput { entityId: string; powerW: number }
export interface ModeInput { id: string; name: string; durationFraction: number; loads: ModeLoadInput[] }

export function powerByMode(input: { modes: ModeInput[] }): Explained<{ perMode: { id: string; name: string; totalW: number; durationFraction: number }[]; orbitAverageW: number; fractionSum: number }> {
  const perMode = input.modes.map((m) => ({
    id: m.id,
    name: m.name,
    durationFraction: m.durationFraction,
    totalW: m.loads.reduce((a, l) => a + l.powerW, 0),
  }));
  const fractionSum = perMode.reduce((a, m) => a + m.durationFraction, 0);
  const orbitAverageW = fractionSum > 0 ? perMode.reduce((a, m) => a + m.totalW * m.durationFraction, 0) / fractionSum : 0;
  return {
    perMode,
    orbitAverageW,
    fractionSum,
    formula: 'P_m = Σ P_i;  P̄ = Σ_m P_m · f_m',
    assumptions: [fractionSum > 0 && Math.abs(fractionSum - 1) > 0.02 ? `As frações somam ${fractionSum.toFixed(2)}; a média foi normalizada.` : 'Frações de duração somam 1.'],
    source: 'SMAD, cap. 11',
  };
}

export interface SolarArrayInput {
  dayPowerW: number;
  eclipsePowerW: number;
  periodMin: number;
  eclipseMin: number;
  pathEfficiencyDay?: number;
  pathEfficiencyEclipse?: number;
  cellEfficiency?: number;
  inherentDegradation?: number;
  sunIncidenceDeg?: number;
  degradationPerYear?: number;
  lifetimeYears: number;
  bodyMountedTumbling?: boolean;
}

export function solarArraySizing(input: SolarArrayInput): Explained<{ requiredArrayPowerW: number; bolPowerPerM2: number; eolPowerPerM2: number; lifeDegradation: number; areaM2: number }> {
  const Xd = input.pathEfficiencyDay ?? 0.85;
  const Xe = input.pathEfficiencyEclipse ?? 0.65;
  const eta = input.cellEfficiency ?? 0.28;
  const Id = input.inherentDegradation ?? 0.77;
  const theta = (input.sunIncidenceDeg ?? 0) * DEG;
  const D = input.degradationPerYear ?? 0.0275;
  const Td = input.periodMin - input.eclipseMin;
  const Te = input.eclipseMin;
  const Psa = (input.eclipsePowerW * Te / Xe + input.dayPowerW * Td / Xd) / Math.max(Td, 1e-6);
  const P0 = SOLAR_CONSTANT_W_M2 * eta;
  const geometry = input.bodyMountedTumbling ? 1 / Math.PI : Math.cos(theta);
  const Pbol = P0 * Id * geometry;
  const Ld = Math.pow(1 - D, input.lifetimeYears);
  const Peol = Pbol * Ld;
  return {
    requiredArrayPowerW: Psa,
    bolPowerPerM2: Pbol,
    eolPowerPerM2: Peol,
    lifeDegradation: Ld,
    areaM2: Psa / Peol,
    formula: 'P_sa = (P_e·T_e/X_e + P_d·T_d/X_d)/T_d;  P₀ = S·η;  P_BOL = P₀·I_d·cos θ;  L_d = (1−D)^anos;  A = P_sa/(P_BOL·L_d)',
    assumptions: [
      `X_d = ${Xd}, X_e = ${Xe} (regulação direta), η = ${eta}, I_d = ${Id}, D = ${D}/ano.`,
      input.bodyMountedTumbling ? 'Painéis fixos ao corpo em rotação: fator geométrico médio 1/π.' : `Incidência solar θ = ${input.sunIncidenceDeg ?? 0}°.`,
    ],
    source: 'SMAD, cap. 11, tabelas 11-33 a 11-35',
  };
}

export interface BatterySizingInput {
  eclipsePowerW: number;
  eclipseMin: number;
  depthOfDischarge?: number;
  batteryEfficiency?: number;
  specificEnergyWhPerKg?: number;
  orbitsPerDay: number;
  lifetimeYears: number;
}

export function batterySizing(input: BatterySizingInput): Explained<{ capacityWh: number; massKg: number; cyclesTotal: number; recommendedDoD: number; usedDoD: number }> {
  const cycles = input.orbitsPerDay * 365 * input.lifetimeYears;
  const recommendedDoD = cycles <= 5000 ? 0.3 : cycles <= 15000 ? 0.2 : 0.15;
  const dod = input.depthOfDischarge ?? recommendedDoD;
  const eff = input.batteryEfficiency ?? 0.9;
  const cap = (input.eclipsePowerW * (input.eclipseMin / 60)) / (dod * eff);
  const se = input.specificEnergyWhPerKg ?? 120;
  return {
    capacityWh: cap,
    massKg: cap / se,
    cyclesTotal: cycles,
    recommendedDoD,
    usedDoD: dod,
    formula: 'C = P_e·T_e / (DoD·η_bat);  ciclos = N·365·anos;  m = C / E_esp',
    assumptions: [`DoD ${dod} (recomendado ${recommendedDoD} para ${Math.round(cycles)} ciclos, Li-ion), η_bat = ${eff}, E_esp = ${se} Wh/kg.`],
    source: 'SMAD, cap. 11, fig. 11-11 e tabela 11-40',
  };
}

export interface ProfileInput {
  periodMin: number;
  eclipseMin: number;
  /** Mode schedule inside one orbit, minutes from orbit start. */
  modeSchedule: { modeId: string; startMin: number; endMin: number }[];
  modes: { id: string; totalW: number }[];
  /** Solar array power while sunlit. */
  generationW: number;
  capacityWh: number;
  initialSoc?: number;
  chargeEfficiency?: number;
}

export interface ProfilePoint { tMin: number; inEclipse: boolean; modeId: string | null; loadW: number; genW: number; netW: number; soc: number }

/** Minute-by-minute power balance over one orbit; eclipse is placed at the end of the orbit. */
export function powerProfileOverOrbit(input: ProfileInput): Explained<{ points: ProfilePoint[]; minSoc: number; finalSoc: number; energyDeficitWh: number }> {
  const points: ProfilePoint[] = [];
  const eff = input.chargeEfficiency ?? 0.9;
  let soc = input.initialSoc ?? 1;
  let minSoc = soc;
  let deficit = 0;
  const modeW = new Map(input.modes.map((m) => [m.id, m.totalW]));
  const eclipseStart = input.periodMin - input.eclipseMin;
  for (let t = 0; t < input.periodMin; t++) {
    const inEclipse = t >= eclipseStart;
    const sched = input.modeSchedule.find((s) => t >= s.startMin && t < s.endMin);
    const modeId = sched?.modeId ?? null;
    const loadW = modeId ? (modeW.get(modeId) ?? 0) : 0;
    const genW = inEclipse ? 0 : input.generationW;
    const netW = genW - loadW;
    const dWh = netW / 60;
    if (dWh >= 0) soc = Math.min(1, soc + (dWh * eff) / input.capacityWh);
    else {
      soc = soc + dWh / input.capacityWh;
      if (soc < 0) { deficit += -soc * input.capacityWh; soc = 0; }
    }
    minSoc = Math.min(minSoc, soc);
    points.push({ tMin: t, inEclipse, modeId, loadW, genW, netW, soc });
  }
  return {
    points,
    minSoc,
    finalSoc: soc,
    energyDeficitWh: deficit,
    formula: 'SoC(t+1) = SoC(t) + (P_ger − P_carga)·Δt/C  (com η_carga na carga; eclipse no fim da órbita)',
    assumptions: ['Passo de 1 min; geração constante ao Sol; bateria ideal fora do rendimento de carga.'],
    source: 'Balanço de energia clássico (SMAD, cap. 11)',
  };
}
