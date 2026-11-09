/**
 * Bridges the architecture model to the mission-analysis library.
 *
 * Reads the reference orbit, the ground stations, the operational modes and
 * the optional `mission.analysis` bindings (plain numbers or references to
 * declared parameters / engine values) and produces one report where every
 * number carries its inputs and the maths behind it ("mostrar a conta").
 */
import type { GroundStationDef, NormalizedArchitecture, NumOrRef } from '../model/ArchitectureTypes';
import {
  betaAngleDeg, coverageGeometry, dataBudget, eclipseFraction, eclipseOverYear, equilibriumTemperature, orbitTemperatureRange,
  linkBudget, orbitBasics, orbitalLifetime, passesPerDayEstimate, powerProfileOverOrbit, simulatePasses,
  solarArraySizing, batterySizing, orbitEpoch, orbitRaanDeg,
  type EclipseDay, type Explained, type OrbitBasics,
} from '../mission';

export type MissionStatus = 'ok' | 'warn' | 'fail' | 'neutral';

export interface ResolvedInput {
  label: string;
  value: number | null;
  unit?: string;
  /** Parameter or engine key the value came from, when bound by reference. */
  ref?: string;
}

export interface Working { formula: string; assumptions: string[]; source: string }

export interface OrbitSection {
  altitudeKm: number;
  inclinationDeg: number;
  eccentricity: number;
  ltanHours?: number;
  raanDeg: number | null;
  epoch: Date;
  epochKnown: boolean;
  basics: Explained<OrbitBasics>;
}

export interface EclipseSection {
  betaDeg: number | null;
  atEpoch: ReturnType<typeof eclipseFraction>;
  worst: ReturnType<typeof eclipseFraction>;
  year: { year: number; days: EclipseDay[]; maxEclipseMin: number; minEclipseMin: number; maxBetaDeg: number; minBetaDeg: number; working: Working } | null;
  /** Eclipse duration used for sizing: yearly maximum when known, else the geometric worst case. */
  designEclipseMin: number;
  designEclipseFraction: number;
}

export interface StationSection {
  station: GroundStationDef;
  coverage: ReturnType<typeof coverageGeometry>;
  estimate: ReturnType<typeof passesPerDayEstimate>;
  simulation: ReturnType<typeof simulatePasses>;
}

export interface LinkSection {
  result: ReturnType<typeof linkBudget>;
  distanceKm: number;
  inputs: ResolvedInput[];
  status: MissionStatus;
}

export interface PowerSection {
  averageW: number | null;
  /** Declared generation while sunlit. */
  sunPowerW: number | null;
  /** sunPowerW × (1 − design eclipse fraction). */
  generationAvgW: number | null;
  marginFraction: number | null;
  status: MissionStatus;
  eclipseModeId: string | null;
  eclipseW: number | null;
  dayW: number | null;
  designEclipseMin: number;
  array: ReturnType<typeof solarArraySizing> | null;
  declaredArrayAreaM2: number | null;
  arrayStatus: MissionStatus;
  battery: ReturnType<typeof batterySizing> | null;
  declaredCapacityWh: number | null;
  batteryStatus: MissionStatus;
  profile: ReturnType<typeof powerProfileOverOrbit> | null;
  inputs: ResolvedInput[];
}

export interface DataSection {
  result: ReturnType<typeof dataBudget>;
  contactMinPerDay: number;
  storageCapacityMB: number | null;
  status: MissionStatus;
  inputs: ResolvedInput[];
  entityIds: string[];
}

export interface DecaySection {
  /** Disposal case: heaviest mass (with margins), the one that stays longest in orbit. */
  result: ReturnType<typeof orbitalLifetime>;
  ballisticCoefficient: number;
  /** Survival case: lightest (nominal) mass, the one that decays fastest; absent without massMinKg. */
  survival: { result: ReturnType<typeof orbitalLifetime>; ballisticCoefficient: number; massKg: number } | null;
  missionLifetimeYears: number | null;
  /** null when the satellite does not re-enter inside the simulated window. */
  survives: boolean | null;
  status: MissionStatus;
  inputs: ResolvedInput[];
}

export interface ThermalSection {
  /** Orbit transient when the heat capacity is known (equilibrium fields filled too), else instantaneous equilibrium. */
  result: ReturnType<typeof equilibriumTemperature> & Partial<Pick<ReturnType<typeof orbitTemperatureRange>, 'equilibriumHotC' | 'equilibriumColdC' | 'meanHotC' | 'meanColdC' | 'timeConstantH'>>;
  transient: boolean;
  tMinC: number | null;
  tMaxC: number | null;
  status: MissionStatus;
  inputs: ResolvedInput[];
}

export interface MissionReport {
  orbit: OrbitSection;
  eclipse: EclipseSection;
  station: StationSection | null;
  link: LinkSection | null;
  power: PowerSection | null;
  data: DataSection | null;
  decay: DecaySection | null;
  thermal: ThermalSection | null;
  /** Analyses that could not run, with the reason in plain words. */
  missing: string[];
}

const DEFAULT_EPOCH = '2027-01-01T00:00:00Z';

type Resolver = (v: NumOrRef | undefined, label: string, unit?: string) => ResolvedInput;

function makeResolver(arch: NormalizedArchitecture): Resolver {
  const ev = arch.evaluation;
  return (v, label, unit) => {
    if (v === undefined) return { label, value: null, unit };
    if (typeof v === 'number') return { label, value: v, unit };
    const p = ev.params[v];
    const value = p ? p.value : (ev.derived[v] ?? null);
    return { label, value: value ?? null, unit: p?.unit ?? unit, ref: v };
  };
}

/** Entity ids behind a set of resolved inputs (for audit navigation). */
export function entityIdsOf(inputs: ResolvedInput[], arch: NormalizedArchitecture): string[] {
  const ids = new Set<string>();
  for (const i of inputs) {
    if (!i.ref || i.ref.startsWith('engine.')) continue;
    const id = i.ref.split('.')[0];
    if (arch.entitiesById[id]) ids.add(id);
  }
  return [...ids];
}

export function analyzeMission(arch: NormalizedArchitecture, options: { fast?: boolean } = {}): MissionReport | null {
  const fast = options.fast === true;
  const m = arch.mission;
  const orbit = m?.orbit;
  if (!m || !orbit) return null;
  const cfg = m.analysis;
  const resolve = makeResolver(arch);
  const missing: string[] = [];
  const ev = arch.evaluation;

  // ── Orbit ────────────────────────────────────────────
  const epochParsed = orbitEpoch(orbit);
  const epoch = epochParsed ?? new Date(DEFAULT_EPOCH);
  const raanDeg = orbitRaanDeg(orbit, epoch);
  const basics = orbitBasics({ altitudeKm: orbit.altitudeKm, inclinationDeg: orbit.inclinationDeg, eccentricity: orbit.eccentricity });
  const orbitSection: OrbitSection = {
    altitudeKm: orbit.altitudeKm,
    inclinationDeg: orbit.inclinationDeg,
    eccentricity: orbit.eccentricity ?? 0,
    ltanHours: orbit.ltanHours,
    raanDeg,
    epoch,
    epochKnown: epochParsed !== null,
    basics,
  };

  // ── Eclipse ──────────────────────────────────────────
  const worst = eclipseFraction({ altitudeKm: orbit.altitudeKm, betaDeg: 0 });
  let betaDeg: number | null = null;
  let atEpoch = worst;
  let year: EclipseSection['year'] = null;
  if (raanDeg !== null) {
    betaDeg = betaAngleDeg({ date: epoch, inclinationDeg: orbit.inclinationDeg, raanDeg }).betaDeg;
    atEpoch = eclipseFraction({ altitudeKm: orbit.altitudeKm, betaDeg });
    if (!fast) {
      const y = epoch.getUTCFullYear();
      const over = eclipseOverYear({
        altitudeKm: orbit.altitudeKm,
        inclinationDeg: orbit.inclinationDeg,
        ltanHours: orbit.ltanHours,
        raanDeg: orbit.ltanHours === undefined ? raanDeg : undefined,
        year: y,
      });
      year = { year: y, days: over.days, maxEclipseMin: over.maxEclipseMin, minEclipseMin: over.minEclipseMin, maxBetaDeg: over.maxBetaDeg, minBetaDeg: over.minBetaDeg, working: { formula: over.formula, assumptions: over.assumptions, source: over.source } };
    }
  } else {
    missing.push('Eclipse ao longo do ano: informe "ltanHours" (órbita héliossíncrona) ou "raanDeg" e "epoch" em mission.orbit.');
  }
  const designEclipseMin = year ? Math.max(year.maxEclipseMin, 0) : worst.eclipseMin;
  const designEclipseFraction = basics.periodMin > 0 ? designEclipseMin / basics.periodMin : worst.fraction;
  const eclipseSection: EclipseSection = { betaDeg, atEpoch, worst, year, designEclipseMin, designEclipseFraction };

  // ── Ground station ───────────────────────────────────
  let station: StationSection | null = null;
  const gs = m.groundStations?.[0];
  if (gs) {
    const coverage = coverageGeometry({ altitudeKm: orbit.altitudeKm, minElevationDeg: gs.minElevationDeg });
    const estimate = passesPerDayEstimate({ altitudeKm: orbit.altitudeKm, inclinationDeg: orbit.inclinationDeg, stationLatDeg: gs.latDeg, minElevationDeg: gs.minElevationDeg });
    const simulation = simulatePasses({
      orbit: { altitudeKm: orbit.altitudeKm, inclinationDeg: orbit.inclinationDeg, raanDeg: raanDeg ?? 0, eccentricity: orbit.eccentricity },
      epoch,
      station: { latDeg: gs.latDeg, lonDeg: gs.lonDeg, altKm: gs.altKm, minElevationDeg: gs.minElevationDeg },
      durationHours: 24,
      stepS: fast ? 60 : 20,
    });
    station = { station: gs, coverage, estimate, simulation };
  } else {
    missing.push('Passes e cobertura: adicione uma estação em mission.groundStations.');
  }

  // ── Link ─────────────────────────────────────────────
  let link: LinkSection | null = null;
  if (cfg?.link) {
    const c = cfg.link;
    const inputs: ResolvedInput[] = [];
    const take = (v: NumOrRef | undefined, label: string, unit?: string) => { const r = resolve(v, label, unit); inputs.push(r); return r.value; };
    const txPowerW = take(c.txPowerW, 'Potência de transmissão', 'W');
    const txGainDbi = take(c.txGainDbi, 'Ganho da antena TX', 'dBi');
    const frequencyGHz = take(c.frequencyGHz, 'Frequência', 'GHz');
    const dataRateMbps = take(c.dataRateMbps, 'Taxa de bits', 'Mbps');
    const rxGainDbi = take(c.rxGainDbi, 'Ganho da antena RX', 'dBi');
    const systemNoiseTempK = take(c.systemNoiseTempK, 'Temperatura de sistema RX', 'K');
    const rxGT = take(c.rxGT_dBK, 'G/T do receptor', 'dB/K');
    const requiredEbN0Db = take(c.requiredEbN0Db, 'Eb/N₀ requerido', 'dB') ?? 4.4;
    const distanceKm = take(c.distanceKm, 'Distância', 'km') ?? station?.coverage.slantRangeKm ?? coverageGeometry({ altitudeKm: orbit.altitudeKm, minElevationDeg: 10 }).slantRangeKm;
    const txLineLossDb = take(c.txLineLossDb, 'Perdas de linha TX', 'dB') ?? undefined;
    const atmosphericLossDb = take(c.atmosphericLossDb, 'Perda atmosférica', 'dB') ?? undefined;
    const polarizationLossDb = take(c.polarizationLossDb, 'Perda de polarização', 'dB') ?? undefined;
    const pointingLossDb = take(c.pointingLossDb, 'Perda de apontamento', 'dB') ?? undefined;
    const implementationLossDb = take(c.implementationLossDb, 'Perda de implementação', 'dB') ?? undefined;
    const required = { txPowerW, txGainDbi, frequencyGHz, dataRateMbps };
    const gap = Object.entries(required).find(([, v]) => v === null);
    if (gap) {
      missing.push(`Enlace: o valor de "${inputs.find((i) => i.label && required[gap[0] as keyof typeof required] === null)?.ref ?? gap[0]}" não está disponível.`);
    } else if (rxGT === null && rxGainDbi === null) {
      missing.push('Enlace: informe "rxGainDbi" e "systemNoiseTempK" (ou "rxGT_dBK") em mission.analysis.link.');
    } else {
      const result = linkBudget({
        txPowerW: txPowerW!, txGainDbi: txGainDbi!, frequencyGHz: frequencyGHz!, dataRateBps: dataRateMbps! * 1e6,
        distanceKm, rxGainDbi: rxGainDbi ?? undefined, systemNoiseTempK: systemNoiseTempK ?? undefined, rxGT_dBK: rxGT ?? undefined,
        requiredEbN0Db, txLineLossDb, atmosphericLossDb, polarizationLossDb, pointingLossDb, implementationLossDb,
      });
      const cleanInputs = inputs.filter((i) => i.value !== null);
      if (c.distanceKm === undefined) cleanInputs.push({ label: 'Distância (alcance máximo na elevação mínima)', value: distanceKm, unit: 'km' });
      link = { result, distanceKm, inputs: cleanInputs, status: result.status === 'ok' ? 'ok' : result.status === 'marginal' ? 'warn' : 'fail' };
    }
  } else {
    missing.push('Enlace: adicione mission.analysis.link ao JSON (potência, ganhos, frequência, taxa).');
  }

  // ── Power ────────────────────────────────────────────
  let power: PowerSection | null = null;
  const modes = ev.modes;
  if (modes.length > 0) {
    const c = cfg?.power;
    const inputs: ResolvedInput[] = [];
    const take = (v: NumOrRef | undefined, label: string, unit?: string) => { const r = resolve(v, label, unit); if (r.value !== null || r.ref) inputs.push(r); return r.value; };
    const averageW = ev.orbitAveragePowerW;
    const eclipseModeId = c?.eclipseModeId ?? (modes.some((x) => x.id === 'eclipse') ? 'eclipse' : null);
    const eclipseMode = eclipseModeId ? modes.find((x) => x.id === eclipseModeId) ?? null : null;
    const eclipseW = eclipseMode?.totalW ?? averageW;
    const fE = eclipseMode?.durationFraction ?? designEclipseFraction;
    const dayW = averageW !== null && eclipseW !== null && fE < 1 ? Math.max((averageW - eclipseW * fE) / (1 - fE), 0) : averageW;
    const sunPowerW = take(c?.generationW, 'Geração ao Sol', 'W');
    const generationAvgW = sunPowerW !== null ? sunPowerW * (1 - designEclipseFraction) : null;
    const marginFraction = generationAvgW !== null && averageW !== null && generationAvgW > 0 ? (generationAvgW - averageW) / generationAvgW : null;
    const status: MissionStatus = marginFraction === null ? 'neutral' : marginFraction < 0 ? 'fail' : marginFraction < 0.1 ? 'warn' : 'ok';
    const lifetimeYears = m.lifetimeYears ?? 5;
    const dod = take(c?.depthOfDischarge, 'Profundidade de descarga', '-');
    const batteryEfficiency = take(c?.batteryEfficiency, 'Eficiência de descarga da bateria', '-');
    const declaredCapacityWh = take(c?.batteryCapacityWh, 'Capacidade da bateria declarada', 'Wh');
    const declaredArrayAreaM2 = take(c?.solarArrayAreaM2, 'Área de painel declarada', 'm²');
    const cellEfficiency = take(c?.cellEfficiency, 'Eficiência das células', '-');
    const degradationPerYear = take(c?.degradationPerYear, 'Degradação por ano', '-');
    const sunIncidenceDeg = take(c?.sunIncidenceDeg, 'Incidência solar', '°');
    let array: PowerSection['array'] = null;
    let battery: PowerSection['battery'] = null;
    let profile: PowerSection['profile'] = null;
    if (dayW !== null && eclipseW !== null) {
      array = solarArraySizing({
        dayPowerW: dayW, eclipsePowerW: eclipseW, periodMin: basics.periodMin, eclipseMin: designEclipseMin, lifetimeYears,
        cellEfficiency: cellEfficiency ?? undefined, degradationPerYear: degradationPerYear ?? undefined, sunIncidenceDeg: sunIncidenceDeg ?? undefined,
      });
      battery = batterySizing({ eclipsePowerW: eclipseW, eclipseMin: designEclipseMin, depthOfDischarge: dod ?? undefined, batteryEfficiency: batteryEfficiency ?? undefined, orbitsPerDay: basics.orbitsPerDay, lifetimeYears });
      if (sunPowerW !== null && declaredCapacityWh !== null && declaredCapacityWh > 0) {
        const periodMin = Math.max(2, Math.round(basics.periodMin));
        const eclipseMin = Math.min(periodMin - 1, Math.round(designEclipseMin));
        const sunlitMin = periodMin - eclipseMin;
        const sunlitModes = modes.filter((x) => x.id !== eclipseModeId && (x.durationFraction ?? 0) > 0 && x.totalW !== null);
        const fSum = sunlitModes.reduce((a, x) => a + (x.durationFraction ?? 0), 0);
        const schedule: { modeId: string; startMin: number; endMin: number }[] = [];
        let cursor = 0;
        for (const x of sunlitModes) {
          const len = fSum > 0 ? ((x.durationFraction ?? 0) / fSum) * sunlitMin : sunlitMin / sunlitModes.length;
          schedule.push({ modeId: x.id, startMin: cursor, endMin: cursor + len });
          cursor += len;
        }
        const eclipseId = eclipseModeId ?? '__eclipse';
        schedule.push({ modeId: eclipseId, startMin: sunlitMin, endMin: periodMin });
        const modeList = modes.filter((x) => x.totalW !== null).map((x) => ({ id: x.id, totalW: x.totalW ?? 0 }));
        if (!modeList.some((x) => x.id === eclipseId)) modeList.push({ id: eclipseId, totalW: eclipseW });
        profile = powerProfileOverOrbit({ periodMin, eclipseMin, modeSchedule: schedule, modes: modeList, generationW: sunPowerW, capacityWh: declaredCapacityWh, initialSoc: 1 });
      }
    }
    const batteryStatus: MissionStatus = battery && declaredCapacityWh !== null ? (declaredCapacityWh >= battery.capacityWh ? 'ok' : 'fail') : 'neutral';
    const arrayStatus: MissionStatus = array && declaredArrayAreaM2 !== null ? (declaredArrayAreaM2 >= array.areaM2 ? 'ok' : declaredArrayAreaM2 >= array.areaM2 * 0.9 ? 'warn' : 'fail') : 'neutral';
    power = {
      averageW, sunPowerW, generationAvgW, marginFraction, status, eclipseModeId, eclipseW, dayW, designEclipseMin,
      array, declaredArrayAreaM2, arrayStatus, battery, declaredCapacityWh, batteryStatus, profile, inputs,
    };
    if (!cfg?.power) missing.push('Energia: adicione mission.analysis.power para comparar geração, bateria e painéis declarados com o necessário.');
  } else {
    missing.push('Energia: declare modos operacionais ("modes") com frações de duração.');
  }

  // ── Data ─────────────────────────────────────────────
  let data: DataSection | null = null;
  if (cfg?.data) {
    const c = cfg.data;
    const inputs: ResolvedInput[] = [];
    const take = (v: NumOrRef | undefined, label: string, unit?: string) => { const r = resolve(v, label, unit); inputs.push(r); return r.value; };
    const sources = c.sources.map((s) => ({
      entityId: s.entityId,
      rateMbps: take(s.rateMbps, `Taxa de ${arch.entitiesById[s.entityId]?.short ?? arch.entitiesById[s.entityId]?.name ?? s.entityId}`, 'Mbps'),
      duty: take(s.dutyFraction, `Ciclo de trabalho de ${arch.entitiesById[s.entityId]?.short ?? s.entityId}`, '-'),
    }));
    const downlinkRateMbps = take(c.downlinkRateMbps, 'Taxa de downlink', 'Mbps');
    const overheadFraction = take(c.overheadFraction, 'Overhead de protocolo', '-');
    const compressionRatio = take(c.compressionRatio, 'Compressão', ':1');
    const storageCapacityMB = take(c.storageCapacityMB, 'Memória de bordo declarada', 'MB');
    const contactMinPerDay = station ? station.simulation.totalContactMinPerDay : 0;
    const longestGapMin = station ? station.simulation.longestGapMin : 1440;
    if (downlinkRateMbps === null || sources.some((s) => s.rateMbps === null || s.duty === null)) {
      missing.push('Dados: algum valor de mission.analysis.data não está disponível.');
    } else {
      const result = dataBudget({
        sources: sources.map((s) => ({ entityId: s.entityId, rateBps: (s.rateMbps ?? 0) * 1e6, dutyFraction: s.duty ?? 0 })),
        downlinkRateBps: downlinkRateMbps * 1e6,
        contactMinPerDay,
        overheadFraction: overheadFraction ?? undefined,
        compressionRatio: compressionRatio ?? undefined,
        longestGapMin,
      });
      const cleanInputs = inputs.filter((i) => i.value !== null);
      cleanInputs.push({ label: 'Contato por dia (simulado)', value: contactMinPerDay, unit: 'min' });
      cleanInputs.push({ label: 'Maior intervalo sem passe', value: longestGapMin, unit: 'min' });
      let status: MissionStatus = result.status === 'ok' ? 'ok' : result.status === 'marginal' ? 'warn' : 'fail';
      if (status === 'ok' && storageCapacityMB !== null && storageCapacityMB < result.storageRequiredMB) status = 'warn';
      data = { result, contactMinPerDay, storageCapacityMB, status, inputs: cleanInputs, entityIds: sources.map((s) => s.entityId) };
      if (!station) missing.push('Dados: sem estação solo o contato por dia é zero; adicione mission.groundStations.');
    }
  } else {
    missing.push('Dados: adicione mission.analysis.data (fontes, taxa de downlink).');
  }

  // ── Decay ────────────────────────────────────────────
  let decay: DecaySection | null = null;
  if (cfg?.decay) {
    const c = cfg.decay;
    const inputs: ResolvedInput[] = [];
    const take = (v: NumOrRef | undefined, label: string, unit?: string) => { const r = resolve(v, label, unit); inputs.push(r); return r.value; };
    const area = take(c.dragAreaM2, 'Área de arrasto', 'm²');
    const cd = take(c.dragCoefficient, 'Coeficiente de arrasto', '-') ?? 2.2;
    const mass = take(c.massKg, 'Massa no caso de descarte (com margens)', 'kg');
    const massMin = take(c.massMinKg, 'Massa no caso de sobrevivência (nominal)', 'kg');
    if (area === null || mass === null || mass <= 0) {
      missing.push('Decaimento: área de arrasto ou massa não disponíveis em mission.analysis.decay.');
    } else {
      const missionLifetimeYears = m.lifetimeYears ?? null;
      const activity = c.solarActivity ?? 'mean';
      const maxYears = Math.max(30, (missionLifetimeYears ?? 0) + 26);
      const run = (massKg: number) => orbitalLifetime({ altitudeKm: orbit.altitudeKm, ballisticCoefficient: (cd * area) / massKg, solarActivity: activity, maxYears, missionYears: missionLifetimeYears ?? undefined });
      // Disposal is judged with the heaviest satellite (it stays longest);
      // survival with the lightest one (it decays fastest).
      const B = (cd * area) / mass;
      const result = run(mass);
      const survival = massMin !== null && massMin > 0 && massMin < mass
        ? { result: run(massMin), ballisticCoefficient: (cd * area) / massMin, massKg: massMin }
        : null;
      const shortest = survival?.result ?? result;
      const survives = shortest.reachedFloor ? (missionLifetimeYears !== null ? shortest.lifetimeYears >= missionLifetimeYears : null) : true;
      const status: MissionStatus = survives === false ? 'fail' : !result.meets25YearRule ? 'warn' : 'ok';
      const cleanInputs = inputs.filter((i) => i.value !== null);
      cleanInputs.push({ label: 'Coeficiente balístico C_D·A/m (descarte)', value: B, unit: 'm²/kg' });
      if (survival) cleanInputs.push({ label: 'Coeficiente balístico C_D·A/m (sobrevivência)', value: survival.ballisticCoefficient, unit: 'm²/kg' });
      decay = { result, ballisticCoefficient: B, survival, missionLifetimeYears, survives, status, inputs: cleanInputs };
    }
  } else {
    missing.push('Decaimento: adicione mission.analysis.decay (área de arrasto, massa).');
  }

  // ── Thermal ──────────────────────────────────────────
  let thermal: ThermalSection | null = null;
  if (cfg?.thermal) {
    const c = cfg.thermal;
    const inputs: ResolvedInput[] = [];
    const take = (v: NumOrRef | undefined, label: string, unit?: string) => { const r = resolve(v, label, unit); inputs.push(r); return r.value; };
    const absorptivity = take(c.absorptivity, 'Absortividade α', '-');
    const emissivity = take(c.emissivity, 'Emissividade ε', '-');
    const sunlitAreaM2 = take(c.sunlitAreaM2, 'Área ao Sol', 'm²');
    const radiatorAreaM2 = take(c.radiatorAreaM2, 'Área radiante', 'm²');
    const earthFacingAreaM2 = take(c.earthFacingAreaM2, 'Área voltada à Terra', 'm²');
    const internalPowerW = take(c.internalPowerW, 'Dissipação interna média', 'W');
    const internalPowerHotW = take(c.internalPowerHotW, 'Dissipação no caso quente', 'W');
    const internalPowerColdW = take(c.internalPowerColdW, 'Dissipação no caso frio', 'W');
    const heatCapacityJPerK = take(c.heatCapacityJPerK, 'Capacidade térmica', 'J/K');
    const tMinC = take(c.tMinC, 'Limite inferior', '°C');
    const tMaxC = take(c.tMaxC, 'Limite superior', '°C');
    if (absorptivity === null || emissivity === null || sunlitAreaM2 === null || radiatorAreaM2 === null) {
      missing.push('Térmico: α, ε ou áreas não disponíveis em mission.analysis.thermal.');
    } else {
      const base = {
        altitudeKm: orbit.altitudeKm, absorptivity, emissivity, sunlitAreaM2, radiatorAreaM2,
        earthFacingAreaM2: earthFacingAreaM2 ?? undefined, internalPowerW: internalPowerW ?? undefined,
      };
      // With a heat capacity, the same transient single node the engine uses
      // for engine.thermal_*; without it, the instantaneous equilibrium.
      const transient = heatCapacityJPerK !== null && heatCapacityJPerK > 0;
      const result = transient
        ? orbitTemperatureRange({
          ...base,
          internalPowerHotW: internalPowerHotW ?? undefined,
          internalPowerColdW: internalPowerColdW ?? undefined,
          heatCapacityJPerK: heatCapacityJPerK!,
          periodMin: basics.periodMin,
          eclipseMinCold: worst.eclipseMin,
          eclipseMinHot: atEpoch.eclipseMin,
        })
        : equilibriumTemperature(base);
      let status: MissionStatus = 'neutral';
      if (tMinC !== null || tMaxC !== null) {
        const tooHot = tMaxC !== null && result.hotCaseC > tMaxC;
        const tooCold = tMinC !== null && result.coldCaseC < tMinC;
        status = tooHot || tooCold ? 'fail' : 'ok';
      }
      thermal = { result, transient, tMinC, tMaxC, status, inputs: inputs.filter((i) => i.value !== null) };
    }
  } else {
    missing.push('Térmico: adicione mission.analysis.thermal (α, ε, áreas, limites).');
  }

  return { orbit: orbitSection, eclipse: eclipseSection, station, link, power, data, decay, thermal, missing };
}

const cache = new WeakMap<NormalizedArchitecture, MissionReport | null>();

/** Memoized per architecture instance: the audit and the panel share one computation. */
export function getMissionReport(arch: NormalizedArchitecture): MissionReport | null {
  if (cache.has(arch)) return cache.get(arch) ?? null;
  const report = analyzeMission(arch);
  cache.set(arch, report);
  return report;
}
