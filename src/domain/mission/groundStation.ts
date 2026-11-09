import * as Astronomy from 'astronomy-engine';
import { ecfToGeodetic, ecfToLookAngles, eciToEcf, gmstRad, type GeodeticLocation } from './frames';
import { DEG, RAD, J2, MU_EARTH_KM3_S2, R_EARTH_KM, type Explained } from './constants';
import { orbitBasics } from './orbit';

export interface CoverageGeometry {
  earthAngularRadiusDeg: number;
  nadirAngleDeg: number;
  earthCentralAngleDeg: number;
  slantRangeKm: number;
  maxPassDurationMin: number;
  swathWidthKm: number;
}

/** Geometry of the visibility circle of a ground station for a satellite at altitude h. */
export function coverageGeometry(input: { altitudeKm: number; minElevationDeg: number }): Explained<CoverageGeometry> {
  const h = input.altitudeKm;
  const r = R_EARTH_KM + h;
  const eps = input.minElevationDeg * DEG;
  const rho = Math.asin(R_EARTH_KM / r);
  const eta = Math.asin(Math.cos(eps) * Math.sin(rho));
  const lambda = Math.PI / 2 - eps - eta;
  const slant = R_EARTH_KM * (Math.sqrt((r / R_EARTH_KM) ** 2 - Math.cos(eps) ** 2) - Math.sin(eps));
  const periodMin = orbitBasics({ altitudeKm: h, inclinationDeg: 0 }).periodMin;
  return {
    earthAngularRadiusDeg: rho * RAD,
    nadirAngleDeg: eta * RAD,
    earthCentralAngleDeg: lambda * RAD,
    slantRangeKm: slant,
    maxPassDurationMin: periodMin * (2 * lambda) / (2 * Math.PI),
    swathWidthKm: 2 * lambda * R_EARTH_KM,
    formula: 'sin ρ = R⊕/(R⊕+h);  sin η = cos ε·sin ρ;  λ = 90° − ε − η;  d = R⊕[√(((R⊕+h)/R⊕)² − cos²ε) − sin ε];  T_max = T·2λ/360°',
    assumptions: ['Terra esférica, órbita circular, passe zenital para a duração máxima.'],
    source: 'SMAD, cap. 5, eqs. 5-24 a 5-28',
  };
}

export interface PassesEstimateInput {
  altitudeKm: number;
  inclinationDeg: number;
  stationLatDeg: number;
  minElevationDeg: number;
}

/** Rough analytic number of passes per day over a station (no propagation). */
export function passesPerDayEstimate(input: PassesEstimateInput): Explained<{ passesPerDay: number; orbitsPerDay: number }> {
  const basics = orbitBasics({ altitudeKm: input.altitudeKm, inclinationDeg: input.inclinationDeg });
  const geo = coverageGeometry({ altitudeKm: input.altitudeKm, minElevationDeg: input.minElevationDeg });
  const phi = Math.abs(input.stationLatDeg) * DEG;
  const i = input.inclinationDeg * DEG;
  const iEff = i > Math.PI / 2 ? Math.PI - i : i;
  const assumptions = ['Estimativa geométrica: fração da faixa de longitudes em que o traço cruza o círculo de visibilidade.', 'Não considera repetição de traço nem a rotação da Terra durante o passe.'];
  if (phi >= iEff + geo.earthCentralAngleDeg * DEG) {
    return { passesPerDay: 0, orbitsPerDay: basics.orbitsPerDay, formula: 'φ ≥ i + λ → sem cobertura', assumptions, source: 'SMAD, cap. 5' };
  }
  const cosPsi = Math.min(1, Math.cos(iEff) / Math.cos(phi));
  const psi = Math.acos(cosPsi);
  const sinPsi = Math.max(Math.sin(psi), 0.2);
  const p = (2 * geo.earthCentralAngleDeg) / (360 * Math.cos(phi) * sinPsi);
  const passes = Math.min(2 * basics.orbitsPerDay * p, basics.orbitsPerDay);
  return {
    passesPerDay: passes,
    orbitsPerDay: basics.orbitsPerDay,
    formula: 'cos ψ = cos i / cos φ;  p = 2λ / (360°·cos φ·sin ψ);  passes/dia ≈ 2·N·p',
    assumptions,
    source: 'SMAD, cap. 5 (aproximação); validar com simulatePasses()',
  };
}

/* ── Propagation ─────────────────────────────────────────── */

export interface KeplerOrbit {
  altitudeKm: number;
  inclinationDeg: number;
  raanDeg: number;
  argPerigeeDeg?: number;
  trueAnomalyDeg?: number;
  eccentricity?: number;
}

export interface Station {
  latDeg: number;
  lonDeg: number;
  altKm?: number;
  minElevationDeg: number;
}

export interface EciState { x: number; y: number; z: number }

function solveKepler(M: number, e: number): number {
  let E = e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 30; k++) {
    const f = E - e * Math.sin(E) - M;
    const fp = 1 - e * Math.cos(E);
    const dE = f / fp;
    E -= dE;
    if (Math.abs(dE) < 1e-10) break;
  }
  return E;
}

/**
 * Kepler + secular J₂ propagator: position in ECI (km) at `tSeconds` after epoch.
 * Good enough for passes, eclipses and ground tracks in phase 0/A.
 */
export function propagateKeplerJ2(orbit: KeplerOrbit, tSeconds: number): EciState {
  const e = orbit.eccentricity ?? 0;
  const a = R_EARTH_KM + orbit.altitudeKm;
  const n = Math.sqrt(MU_EARTH_KM3_S2 / (a * a * a));
  const i = orbit.inclinationDeg * DEG;
  const p = a * (1 - e * e);
  const k = 1.5 * J2 * (R_EARTH_KM / p) ** 2 * n;
  const raanDot = -k * Math.cos(i);
  const argpDot = 0.5 * k * (5 * Math.cos(i) ** 2 - 1);
  const raan = orbit.raanDeg * DEG + raanDot * tSeconds;
  const argp = (orbit.argPerigeeDeg ?? 0) * DEG + argpDot * tSeconds;
  // Mean anomaly from the initial true anomaly
  const nu0 = (orbit.trueAnomalyDeg ?? 0) * DEG;
  const E0 = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu0 / 2), Math.sqrt(1 + e) * Math.cos(nu0 / 2));
  const M0 = E0 - e * Math.sin(E0);
  const M = M0 + n * tSeconds;
  const E = solveKepler(((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r = a * (1 - e * Math.cos(E));
  const xp = r * Math.cos(nu);
  const yp = r * Math.sin(nu);
  const cO = Math.cos(raan), sO = Math.sin(raan);
  const ci = Math.cos(i), si = Math.sin(i);
  const cw = Math.cos(argp), sw = Math.sin(argp);
  // R = Rz(Ω) Rx(i) Rz(ω)
  const x = (cO * cw - sO * sw * ci) * xp + (-cO * sw - sO * cw * ci) * yp;
  const y = (sO * cw + cO * sw * ci) * xp + (-sO * sw + cO * cw * ci) * yp;
  const z = (sw * si) * xp + (cw * si) * yp;
  return { x, y, z };
}

/** Unit vector towards the Sun in the ECI (J2000 equatorial) frame. */
export function sunUnitVectorEci(date: Date): EciState {
  const v = Astronomy.GeoVector(Astronomy.Body.Sun, date, true);
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/** True when the satellite is inside the Earth's cylindrical shadow. */
export function inEclipse(pos: EciState, sun: EciState): boolean {
  const dot = pos.x * sun.x + pos.y * sun.y + pos.z * sun.z;
  if (dot >= 0) return false; // sunlit side
  const px = pos.x - dot * sun.x, py = pos.y - dot * sun.y, pz = pos.z - dot * sun.z;
  return Math.hypot(px, py, pz) < R_EARTH_KM;
}

export interface Pass {
  aosUtc: string;
  losUtc: string;
  durationMin: number;
  maxElevationDeg: number;
}

export interface GroundTrackPoint { t: number; latDeg: number; lonDeg: number; altKm: number; sunlit: boolean }

export interface SimulationInput {
  orbit: KeplerOrbit;
  epoch: Date;
  station: Station;
  durationHours?: number;
  stepS?: number;
}

export interface SimulationResult {
  passes: Pass[];
  totalContactMinPerDay: number;
  longestGapMin: number;
  eclipseFraction: number;
  eclipseIntervals: { startUtc: string; endUtc: string; durationMin: number }[];
  groundTrack: GroundTrackPoint[];
}

/** Propagates the orbit and detects station passes and eclipses over a window. */
export function simulatePasses(input: SimulationInput): Explained<SimulationResult> {
  const durationS = (input.durationHours ?? 24) * 3600;
  const stepS = input.stepS ?? 10;
  const minEl = input.station.minElevationDeg * DEG;
  const observer: GeodeticLocation = {
    lonRad: input.station.lonDeg * DEG,
    latRad: input.station.latDeg * DEG,
    heightKm: input.station.altKm ?? 0,
  };
  const passes: Pass[] = [];
  const eclipseIntervals: SimulationResult['eclipseIntervals'] = [];
  const groundTrack: GroundTrackPoint[] = [];
  let inPass = false;
  let passStart = 0;
  let passMaxEl = -90;
  let inShadow = false;
  let shadowStart = 0;
  let shadowSeconds = 0;
  // Sun direction moves ~1°/day; refresh it every 10 minutes
  let sun = sunUnitVectorEci(input.epoch);
  let lastSunT = 0;

  for (let t = 0; t <= durationS; t += stepS) {
    const date = new Date(input.epoch.getTime() + t * 1000);
    const pos = propagateKeplerJ2(input.orbit, t);
    const gmst = gmstRad(date);
    const ecf = eciToEcf(pos, gmst);
    const look = ecfToLookAngles(observer, ecf);
    const el = look.elevationRad;

    if (el >= minEl && !inPass) { inPass = true; passStart = t; passMaxEl = el; }
    else if (el >= minEl && inPass) { passMaxEl = Math.max(passMaxEl, el); }
    else if (el < minEl && inPass) {
      inPass = false;
      passes.push({
        aosUtc: new Date(input.epoch.getTime() + passStart * 1000).toISOString(),
        losUtc: date.toISOString(),
        durationMin: (t - passStart) / 60,
        maxElevationDeg: passMaxEl * RAD,
      });
    }

    if (t - lastSunT >= 600) { sun = sunUnitVectorEci(date); lastSunT = t; }
    const shadow = inEclipse(pos, sun);
    if (shadow) shadowSeconds += stepS;
    if (shadow && !inShadow) { inShadow = true; shadowStart = t; }
    else if (!shadow && inShadow) {
      inShadow = false;
      eclipseIntervals.push({
        startUtc: new Date(input.epoch.getTime() + shadowStart * 1000).toISOString(),
        endUtc: date.toISOString(),
        durationMin: (t - shadowStart) / 60,
      });
    }

    if (t % 60 === 0) {
      const gd = ecfToGeodetic(ecf);
      groundTrack.push({ t, latDeg: gd.latRad * RAD, lonDeg: gd.lonRad * RAD, altKm: gd.heightKm, sunlit: !shadow });
    }
  }
  if (inPass) {
    passes.push({
      aosUtc: new Date(input.epoch.getTime() + passStart * 1000).toISOString(),
      losUtc: new Date(input.epoch.getTime() + durationS * 1000).toISOString(),
      durationMin: (durationS - passStart) / 60,
      maxElevationDeg: passMaxEl * RAD,
    });
  }

  const totalContactMin = passes.reduce((a, p) => a + p.durationMin, 0);
  let longestGapMin = durationS / 60;
  if (passes.length > 1) {
    longestGapMin = 0;
    for (let k = 1; k < passes.length; k++) {
      const gap = (Date.parse(passes[k].aosUtc) - Date.parse(passes[k - 1].losUtc)) / 60000;
      longestGapMin = Math.max(longestGapMin, gap);
    }
  }
  return {
    passes,
    totalContactMinPerDay: (totalContactMin * 86400) / durationS,
    longestGapMin,
    eclipseFraction: shadowSeconds / durationS,
    eclipseIntervals,
    groundTrack,
    formula: 'Propagação Kepler + J₂ secular a cada Δt; elevação via ECI→ECEF (GMST)→ângulos de visada; passe = elevação ≥ ε_min; eclipse = sombra cilíndrica',
    assumptions: [
      `Passo de ${stepS} s; janela de ${(durationS / 3600).toFixed(0)} h a partir de ${input.epoch.toISOString()}.`,
      'Sem arrasto, sem refração atmosférica, Terra WGS84 para as coordenadas geodésicas.',
    ],
    source: 'Vallado, Fundamentals of Astrodynamics (GMST IAU-82, ECI→ECEF, WGS84); conversões validadas contra satellite.js nos testes',
  };
}
