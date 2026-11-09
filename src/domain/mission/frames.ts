/**
 * Reference-frame conversions needed for passes and ground tracks.
 * Pure functions (Vallado, Fundamentals of Astrodynamics), cross-checked
 * against satellite.js in the tests so the app bundle carries no SGP4/WASM.
 */
import { DEG } from './constants';

export interface Vec3 { x: number; y: number; z: number }
export interface GeodeticLocation { latRad: number; lonRad: number; heightKm: number }
export interface LookAngles { azimuthRad: number; elevationRad: number; rangeKm: number }

const WGS84_A_KM = 6378.137;
const WGS84_F = 1 / 298.257223563;
const WGS84_E2 = WGS84_F * (2 - WGS84_F);

/** Julian date (UTC) of a JS Date. */
export function julianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

/** Greenwich mean sidereal time in radians (IAU-82; Vallado, algorithm 15). */
export function gmstRad(date: Date): number {
  const tut1 = (julianDate(date) - 2451545.0) / 36525;
  let s = 67310.54841 + (876600 * 3600 + 8640184.812866) * tut1 + 0.093104 * tut1 * tut1 - 6.2e-6 * tut1 * tut1 * tut1;
  s = ((s % 86400) + 86400) % 86400;
  return (s / 240) * DEG; // 240 s of time per degree
}

/** Rotates an ECI (TEME/J2000-ish) position into Earth-fixed coordinates. */
export function eciToEcf(p: Vec3, gmst: number): Vec3 {
  const c = Math.cos(gmst);
  const s = Math.sin(gmst);
  return { x: c * p.x + s * p.y, y: -s * p.x + c * p.y, z: p.z };
}

/** WGS84 geodetic coordinates to Earth-fixed cartesian (km). */
export function geodeticToEcf(g: GeodeticLocation): Vec3 {
  const sinLat = Math.sin(g.latRad);
  const cosLat = Math.cos(g.latRad);
  const n = WGS84_A_KM / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  return {
    x: (n + g.heightKm) * cosLat * Math.cos(g.lonRad),
    y: (n + g.heightKm) * cosLat * Math.sin(g.lonRad),
    z: (n * (1 - WGS84_E2) + g.heightKm) * sinLat,
  };
}

/** Azimuth, elevation and range of an Earth-fixed satellite position seen from a station. */
export function ecfToLookAngles(observer: GeodeticLocation, satEcf: Vec3): LookAngles {
  const o = geodeticToEcf(observer);
  const rx = satEcf.x - o.x;
  const ry = satEcf.y - o.y;
  const rz = satEcf.z - o.z;
  const sinLat = Math.sin(observer.latRad);
  const cosLat = Math.cos(observer.latRad);
  const sinLon = Math.sin(observer.lonRad);
  const cosLon = Math.cos(observer.lonRad);
  const topS = sinLat * cosLon * rx + sinLat * sinLon * ry - cosLat * rz;
  const topE = -sinLon * rx + cosLon * ry;
  const topZ = cosLat * cosLon * rx + cosLat * sinLon * ry + sinLat * rz;
  const range = Math.sqrt(topS * topS + topE * topE + topZ * topZ);
  const az = Math.atan2(-topE, topS) + Math.PI;
  return {
    azimuthRad: az >= 2 * Math.PI ? az - 2 * Math.PI : az,
    elevationRad: Math.asin(topZ / range),
    rangeKm: range,
  };
}

/** Earth-fixed cartesian (km) to WGS84 geodetic latitude, longitude and height. */
export function ecfToGeodetic(p: Vec3): GeodeticLocation {
  const lon = Math.atan2(p.y, p.x);
  const r = Math.sqrt(p.x * p.x + p.y * p.y);
  let lat = Math.atan2(p.z, r);
  let c = 1;
  for (let k = 0; k < 20; k++) {
    const sinLat = Math.sin(lat);
    c = 1 / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
    const next = Math.atan2(p.z + WGS84_A_KM * c * WGS84_E2 * sinLat, r);
    if (Math.abs(next - lat) < 1e-12) { lat = next; break; }
    lat = next;
  }
  return { latRad: lat, lonRad: lon, heightKm: r / Math.cos(lat) - WGS84_A_KM * c };
}
