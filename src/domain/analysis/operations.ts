/**
 * Event-driven operations for the physical scene: which mode the satellite is
 * in at a given instant, and how the battery state of charge evolves.
 *
 * The power profile of the mission report (power.ts) plays the declared mode
 * fractions in sequence from sunrise, which is right for sizing but not for a
 * time simulation: there, the eclipse mode must start when the satellite
 * enters the shadow and the downlink mode only while the station is in view.
 * This module takes the declared modes and loads and lets the simulated
 * events decide.
 */
import type { NormalizedArchitecture } from '../model/ArchitectureTypes';
import {
  DEG, ecfToLookAngles, eciToEcf, gmstRad, inEclipse, propagateKeplerJ2, sunUnitVectorEci,
  type KeplerOrbit, type Vec3,
} from '../mission';
import type { MissionReport } from './mission';

export interface OperationsModel {
  /** Mode used in the shadow (declared eclipse mode, or a synthetic one). */
  eclipseModeId: string;
  /** Mode used while the station is in view; null when the model has none. */
  downlinkModeId: string | null;
  /** Fallback sunlit mode. */
  nominalModeId: string | null;
  modeW: Record<string, number>;
  /** Array output while sunlit, as declared in mission.analysis.power. */
  generationW: number;
  capacityWh: number;
  chargeEfficiency: number;
  /** Sunlit schedule from the report profile: mode per minute after sunrise. */
  sunlitSchedule: (string | null)[];
}

export interface OperationsInstant {
  sunlit: boolean;
  contact: boolean;
  /** Minutes since the last shadow exit, or null if not known yet. */
  minutesSinceSunrise: number | null;
}

const DOWNLINK_NAME = /downlink|descida|transmiss/i;

export function buildOperationsModel(arch: NormalizedArchitecture, report: MissionReport): OperationsModel | null {
  const power = report.power;
  if (!power || power.sunPowerW === null || power.declaredCapacityWh === null || power.declaredCapacityWh <= 0) return null;
  const modes = arch.evaluation.modes.filter((m) => m.totalW !== null);
  if (modes.length === 0) return null;

  const modeW: Record<string, number> = Object.fromEntries(modes.map((m) => [m.id, m.totalW ?? 0]));
  const eclipseModeId = power.eclipseModeId && modeW[power.eclipseModeId] !== undefined ? power.eclipseModeId : '__eclipse';
  if (modeW[eclipseModeId] === undefined) modeW[eclipseModeId] = power.eclipseW ?? 0;

  const downlink = modes.find((m) => m.id === 'downlink') ?? modes.find((m) => DOWNLINK_NAME.test(m.name) || DOWNLINK_NAME.test(m.id));
  const sunlitModes = modes.filter((m) => m.id !== eclipseModeId && (m.durationFraction ?? 0) > 0);
  const nominal = modes.find((m) => m.id === 'nominal')
    ?? [...sunlitModes].filter((m) => m.id !== downlink?.id).sort((a, b) => (b.durationFraction ?? 0) - (a.durationFraction ?? 0))[0]
    ?? null;

  const sunlitSchedule = (power.profile?.points ?? []).filter((p) => !p.inEclipse).map((p) => p.modeId);

  return {
    eclipseModeId,
    downlinkModeId: downlink?.id ?? null,
    nominalModeId: nominal?.id ?? null,
    modeW,
    generationW: power.sunPowerW,
    capacityWh: power.declaredCapacityWh,
    chargeEfficiency: 0.9,
    sunlitSchedule,
  };
}

/**
 * Mode at one instant: downlink mode while the station is in view (a pass in
 * the shadow is still used, on battery), eclipse mode in the shadow,
 * otherwise the declared sunlit schedule (imaging and nominal), with
 * scheduled downlink or eclipse slots that the events do not confirm falling
 * back to the nominal mode.
 */
export function operationsMode(model: OperationsModel, at: OperationsInstant): string | null {
  if (at.contact && model.downlinkModeId) return model.downlinkModeId;
  if (!at.sunlit) return model.eclipseModeId;
  const n = model.sunlitSchedule.length;
  const scheduled = at.minutesSinceSunrise !== null && n > 0
    ? model.sunlitSchedule[Math.min(n - 1, Math.max(0, Math.floor(at.minutesSinceSunrise)))]
    : null;
  if (scheduled && scheduled !== model.downlinkModeId && scheduled !== model.eclipseModeId) return scheduled;
  return model.nominalModeId;
}

/** Load of a mode in watts (0 when unknown). */
export function operationsLoadW(model: OperationsModel, modeId: string | null): number {
  return modeId ? (model.modeW[modeId] ?? 0) : 0;
}

/** Advances the state of charge by dtS seconds with constant load and generation. */
export function stepStateOfCharge(model: OperationsModel, soc: number, modeId: string | null, sunlit: boolean, dtS: number): number {
  const netW = (sunlit ? model.generationW : 0) - operationsLoadW(model, modeId);
  const dWh = (netW * dtS) / 3600;
  const next = dWh >= 0 ? soc + (dWh * model.chargeEfficiency) / model.capacityWh : soc + dWh / model.capacityWh;
  return Math.min(1, Math.max(0, next));
}

/** Orbit of the report in the form the propagator takes. */
export function reportOrbit(report: MissionReport): KeplerOrbit {
  return {
    altitudeKm: report.orbit.altitudeKm,
    inclinationDeg: report.orbit.inclinationDeg,
    raanDeg: report.orbit.raanDeg ?? 0,
    eccentricity: report.orbit.eccentricity,
  };
}

/** Time of the last shadow exit before tSec (30 s resolution), or null if none within one orbit. */
export function lastSunriseBefore(orbit: KeplerOrbit, tSec: number, sunDir: Vec3, periodS: number): number | null {
  let prev = inEclipse(propagateKeplerJ2(orbit, tSec), sunDir);
  for (let back = 30; back <= periodS + 30; back += 30) {
    const cur = inEclipse(propagateKeplerJ2(orbit, tSec - back), sunDir);
    if (cur && !prev) return tSec - back + 30;
    prev = cur;
  }
  return null;
}

export interface OperationsRun {
  durationS: number;
  /** Seconds spent in each mode. */
  modeSeconds: Record<string, number>;
  shadowSeconds: number;
  contactSeconds: number;
  minSoc: number;
  finalSoc: number;
}

/**
 * Runs the event-driven operations over a time span with the same orbit,
 * Sun, shadow and station geometry as the physical scene.
 */
export function simulateOperations(model: OperationsModel, report: MissionReport, opts: { hours?: number; stepS?: number; initialSoc?: number } = {}): OperationsRun {
  const hours = opts.hours ?? 24;
  const stepS = opts.stepS ?? 10;
  const orbit = reportOrbit(report);
  const epochMs = report.orbit.epoch.getTime();
  const periodS = report.orbit.basics.periodMin * 60;
  const st = report.station?.station ?? null;
  const observer = st ? { latRad: st.latDeg * DEG, lonRad: st.lonDeg * DEG, heightKm: st.altKm } : null;
  const minEl = st ? st.minElevationDeg * DEG : 0;

  let sun = sunUnitVectorEci(report.orbit.epoch);
  let sunT = 0;
  let lastSunrise = lastSunriseBefore(orbit, 0, sun, periodS);
  let wasSunlit: boolean | null = null;
  let soc = opts.initialSoc ?? 1;
  let minSoc = soc;
  const modeSeconds: Record<string, number> = {};
  let shadowSeconds = 0;
  let contactSeconds = 0;
  const end = hours * 3600;

  for (let t = 0; t < end; t += stepS) {
    const date = new Date(epochMs + t * 1000);
    if (t - sunT >= 600) { sun = sunUnitVectorEci(date); sunT = t; }
    const pos = propagateKeplerJ2(orbit, t);
    const sunlit = !inEclipse(pos, sun);
    if (wasSunlit === false && sunlit) lastSunrise = t;
    wasSunlit = sunlit;
    const contact = observer ? ecfToLookAngles(observer, eciToEcf(pos, gmstRad(date))).elevationRad >= minEl : false;
    const minutes = lastSunrise === null ? null : (t - lastSunrise) / 60;
    const modeId = operationsMode(model, { sunlit, contact, minutesSinceSunrise: minutes });
    if (modeId) modeSeconds[modeId] = (modeSeconds[modeId] ?? 0) + stepS;
    if (!sunlit) shadowSeconds += stepS;
    if (contact) contactSeconds += stepS;
    soc = stepStateOfCharge(model, soc, modeId, sunlit, stepS);
    minSoc = Math.min(minSoc, soc);
  }
  return { durationS: end, modeSeconds, shadowSeconds, contactSeconds, minSoc, finalSoc: soc };
}
