import { betaAngleDeg, eclipseFraction, orbitBasics, raanFromLtan } from './orbit';
import { simulatePasses } from './groundStation';

export interface OrbitLike {
  altitudeKm: number;
  inclinationDeg: number;
  eccentricity?: number;
  raanDeg?: number;
  ltanHours?: number;
  epoch?: string;
}

/** Parses the orbit epoch; null when absent or invalid. */
export function orbitEpoch(orbit: OrbitLike | undefined): Date | null {
  if (!orbit?.epoch) return null;
  const d = new Date(orbit.epoch);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** RAAN of the orbit at the epoch (from LTAN for sun-synchronous orbits), or null when unknown. */
export function orbitRaanDeg(orbit: OrbitLike, epoch: Date | null): number | null {
  if (orbit.ltanHours !== undefined && epoch) return raanFromLtan({ date: epoch, ltanHours: orbit.ltanHours }).raanDeg;
  if (orbit.raanDeg !== undefined) return orbit.raanDeg;
  return null;
}

/**
 * Orbit-derived scalars exposed to formulas and rules as `engine.orbit_*`.
 * Cheap enough to run on every evaluation (one Sun position at most).
 */
export function orbitDerivedValues(orbit: OrbitLike | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (!orbit) return out;
  const b = orbitBasics({ altitudeKm: orbit.altitudeKm, inclinationDeg: orbit.inclinationDeg, eccentricity: orbit.eccentricity });
  out['engine.orbit_altitude_km'] = orbit.altitudeKm;
  out['engine.orbit_period_min'] = b.periodMin;
  out['engine.orbit_velocity_km_s'] = b.velocityKmS;
  out['engine.orbit_orbits_per_day'] = b.orbitsPerDay;
  const worst = eclipseFraction({ altitudeKm: orbit.altitudeKm, betaDeg: 0 });
  out['engine.orbit_eclipse_max_fraction'] = worst.fraction;
  out['engine.orbit_eclipse_max_min'] = worst.eclipseMin;
  const epoch = orbitEpoch(orbit);
  const raan = orbitRaanDeg(orbit, epoch);
  if (epoch && raan !== null) {
    const beta = betaAngleDeg({ date: epoch, inclinationDeg: orbit.inclinationDeg, raanDeg: raan }).betaDeg;
    const e = eclipseFraction({ altitudeKm: orbit.altitudeKm, betaDeg: beta });
    out['engine.orbit_beta_deg'] = beta;
    out['engine.orbit_eclipse_fraction'] = e.fraction;
    out['engine.orbit_eclipse_min'] = e.eclipseMin;
  }
  return out;
}

export interface StationLike {
  latDeg: number;
  lonDeg: number;
  altKm?: number;
  minElevationDeg: number;
}

/**
 * Contact with the first ground station over 24 h (`engine.station_*`), so
 * that a downlink mode can take the fraction of the day the station is in
 * view instead of a guessed one. 60 s step: within a minute per day of the
 * finer simulation in the mission analysis.
 */
export function stationDerivedValues(orbit: OrbitLike | undefined, station: StationLike | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (!orbit || !station) return out;
  const epoch = orbitEpoch(orbit);
  if (!epoch) return out;
  const raan = orbitRaanDeg(orbit, epoch) ?? 0;
  const sim = simulatePasses({
    orbit: { altitudeKm: orbit.altitudeKm, inclinationDeg: orbit.inclinationDeg, raanDeg: raan, eccentricity: orbit.eccentricity ?? 0 },
    epoch,
    station: { latDeg: station.latDeg, lonDeg: station.lonDeg, altKm: station.altKm ?? 0, minElevationDeg: station.minElevationDeg },
    durationHours: 24,
    stepS: 60,
  });
  out['engine.station_contact_min_per_day'] = sim.totalContactMinPerDay;
  out['engine.station_contact_fraction'] = sim.totalContactMinPerDay / 1440;
  out['engine.station_passes_per_day'] = sim.passes.length;
  return out;
}
