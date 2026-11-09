import * as Astronomy from 'astronomy-engine';
import {
  DEG, RAD, J2, MU_EARTH_KM3_S2, R_EARTH_KM, SSO_NODAL_RATE_RAD_S, type Explained,
} from './constants';

export interface OrbitInput {
  altitudeKm: number;
  inclinationDeg: number;
  eccentricity?: number;
}

export interface OrbitBasics {
  semiMajorAxisKm: number;
  periodMin: number;
  periodS: number;
  velocityKmS: number;
  meanMotionRadS: number;
  orbitsPerDay: number;
  nodalRegressionDegPerDay: number;
  isSunSynchronous: boolean;
  /** Inclination that would make this altitude sun-synchronous (NaN when impossible). */
  sunSynchronousInclinationDeg: number;
}

/** Period, velocity, mean motion and J2 nodal regression of a (near-)circular orbit. */
export function orbitBasics(o: OrbitInput): Explained<OrbitBasics> {
  const e = o.eccentricity ?? 0;
  const a = R_EARTH_KM + o.altitudeKm;
  const n = Math.sqrt(MU_EARTH_KM3_S2 / (a * a * a));
  const periodS = (2 * Math.PI) / n;
  const p = a * (1 - e * e);
  const i = o.inclinationDeg * DEG;
  const raanDotRadS = -1.5 * J2 * (R_EARTH_KM / p) ** 2 * n * Math.cos(i);
  const nodalRegressionDegPerDay = raanDotRadS * 86400 * RAD;
  const cosISso = -(SSO_NODAL_RATE_RAD_S * Math.pow(a, 3.5) * (1 - e * e) ** 2) / (1.5 * J2 * R_EARTH_KM ** 2 * Math.sqrt(MU_EARTH_KM3_S2));
  const sunSynchronousInclinationDeg = Math.abs(cosISso) <= 1 ? Math.acos(cosISso) * RAD : NaN;
  return {
    semiMajorAxisKm: a,
    periodMin: periodS / 60,
    periodS,
    velocityKmS: Math.sqrt(MU_EARTH_KM3_S2 / a),
    meanMotionRadS: n,
    orbitsPerDay: 86400 / periodS,
    nodalRegressionDegPerDay,
    isSunSynchronous: Math.abs(nodalRegressionDegPerDay - 0.9856) < 0.05,
    sunSynchronousInclinationDeg,
    formula: 'a = R⊕ + h;  T = 2π√(a³/μ);  v = √(μ/a);  Ω̇ = −1,5·J₂·(R⊕/p)²·n·cos i',
    assumptions: [
      'Órbita kepleriana com perturbação secular de J₂ apenas (sem arrasto nem terceiro corpo).',
      `Excentricidade ${e} (velocidade dada para órbita circular).`,
    ],
    source: 'Wertz & Larson, SMAD, cap. 6; Vallado, Fundamentals of Astrodynamics, §9.4',
  };
}

/** Right ascension and declination of the Sun (geocentric, equator of date), in degrees. */
export function sunRaDecDeg(date: Date): { raDeg: number; decDeg: number } {
  const observer = new Astronomy.Observer(0, 0, 0);
  const eq = Astronomy.Equator(Astronomy.Body.Sun, date, observer, true, true);
  return { raDeg: eq.ra * 15, decDeg: eq.dec };
}

export interface BetaInput {
  date: Date;
  inclinationDeg: number;
  raanDeg: number;
}

/** Beta angle: angle between the Sun vector and the orbital plane (degrees). */
export function betaAngleDeg(b: BetaInput): Explained<{ betaDeg: number; sunRaDeg: number; sunDecDeg: number }> {
  const { raDeg, decDeg } = sunRaDecDeg(b.date);
  const i = b.inclinationDeg * DEG;
  const sinBeta = Math.cos(decDeg * DEG) * Math.sin(i) * Math.sin((b.raanDeg - raDeg) * DEG) + Math.sin(decDeg * DEG) * Math.cos(i);
  return {
    betaDeg: Math.asin(Math.max(-1, Math.min(1, sinBeta))) * RAD,
    sunRaDeg: raDeg,
    sunDecDeg: decDeg,
    formula: 'sin β = cos δ☉ · sin i · sin(Ω − α☉) + sin δ☉ · cos i',
    assumptions: ['Posição do Sol (α☉, δ☉) geocêntrica no equador da data, via astronomy-engine.'],
    source: 'Vallado, §11.2; SMAD, cap. 5',
  };
}

/** RAAN of a sun-synchronous orbit from its local time of ascending node (hours). */
export function raanFromLtan(input: { date: Date; ltanHours: number }): Explained<{ raanDeg: number }> {
  const { raDeg } = sunRaDecDeg(input.date);
  const raan = ((raDeg + (input.ltanHours - 12) * 15) % 360 + 360) % 360;
  return {
    raanDeg: raan,
    formula: 'Ω = α☉ + (LTAN − 12 h) · 15°/h',
    assumptions: ['Hora local do nó ascendente medida em tempo solar médio.'],
    source: 'SMAD, cap. 6 (órbitas héliossíncronas)',
  };
}

export interface EclipseInput {
  altitudeKm: number;
  betaDeg: number;
}

/** Fraction of a circular orbit spent in the Earth's cylindrical shadow. */
export function eclipseFraction(input: EclipseInput): Explained<{ fraction: number; betaStarDeg: number; eclipseMin: number }> {
  const h = input.altitudeKm;
  const r = R_EARTH_KM + h;
  const betaStar = Math.asin(R_EARTH_KM / r);
  const beta = Math.abs(input.betaDeg) * DEG;
  let fraction = 0;
  if (beta < betaStar) {
    const x = Math.sqrt(h * h + 2 * R_EARTH_KM * h) / (r * Math.cos(beta));
    fraction = Math.acos(Math.max(-1, Math.min(1, x))) / Math.PI;
  }
  const periodMin = orbitBasics({ altitudeKm: h, inclinationDeg: 0 }).periodMin;
  return {
    fraction,
    betaStarDeg: betaStar * RAD,
    eclipseMin: fraction * periodMin,
    formula: 'β* = asin(R⊕/(R⊕+h));  f_E = (1/π)·acos( √(h² + 2R⊕h) / ((R⊕+h)·cos β) )  para |β| < β*, senão 0',
    assumptions: ['Sombra cilíndrica (sem penumbra), órbita circular.'],
    source: 'SMAD, cap. 5, eq. 5-26; Sumanth, IJAAA 2019',
  };
}

export interface EclipseYearInput {
  altitudeKm: number;
  inclinationDeg: number;
  /** Fixed RAAN at Jan 1 (drifts with J₂) — or give ltanHours for a sun-synchronous orbit. */
  raanDeg?: number;
  ltanHours?: number;
  year: number;
}

export interface EclipseDay {
  dayOfYear: number;
  date: string;
  betaDeg: number;
  eclipseFraction: number;
  eclipseMin: number;
}

/** Beta angle and eclipse duration for every day of a year. */
export function eclipseOverYear(input: EclipseYearInput): Explained<{ days: EclipseDay[]; maxEclipseMin: number; minEclipseMin: number; maxBetaDeg: number; minBetaDeg: number }> {
  const basics = orbitBasics({ altitudeKm: input.altitudeKm, inclinationDeg: input.inclinationDeg });
  const days: EclipseDay[] = [];
  const start = Date.UTC(input.year, 0, 1);
  for (let d = 0; d < 365; d++) {
    const date = new Date(start + d * 86400000);
    const raanDeg = input.ltanHours !== undefined
      ? raanFromLtan({ date, ltanHours: input.ltanHours }).raanDeg
      : ((input.raanDeg ?? 0) + basics.nodalRegressionDegPerDay * d);
    const beta = betaAngleDeg({ date, inclinationDeg: input.inclinationDeg, raanDeg }).betaDeg;
    const ecl = eclipseFraction({ altitudeKm: input.altitudeKm, betaDeg: beta });
    days.push({ dayOfYear: d + 1, date: date.toISOString().slice(0, 10), betaDeg: beta, eclipseFraction: ecl.fraction, eclipseMin: ecl.eclipseMin });
  }
  const mins = days.map((x) => x.eclipseMin);
  const betas = days.map((x) => x.betaDeg);
  return {
    days,
    maxEclipseMin: Math.max(...mins),
    minEclipseMin: Math.min(...mins),
    maxBetaDeg: Math.max(...betas),
    minBetaDeg: Math.min(...betas),
    formula: 'Para cada dia: β(dia) com Ω(dia) = Ω₀ + Ω̇·dia (ou Ω do LTAN em SSO); f_E(β)',
    assumptions: ['Passo de 1 dia; Sol de astronomy-engine; sombra cilíndrica.'],
    source: 'SMAD, cap. 5',
  };
}
