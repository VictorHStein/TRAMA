import { describe, expect, it } from 'vitest';
import * as satellite from 'satellite.js';
import { ecfToGeodetic, ecfToLookAngles, eciToEcf, geodeticToEcf, gmstRad } from '../frames';

const dates = [
  new Date('2027-03-21T00:00:00Z'),
  new Date('2024-01-01T12:34:56Z'),
  new Date('2031-11-15T23:59:59Z'),
];
const points = [
  { x: 6878.137, y: 0, z: 0 },
  { x: -2410.5, y: 5512.3, z: 3300.1 },
  { x: 1000, y: -6500, z: -2200 },
  { x: 0, y: 0, z: 6900 },
];
const stations = [
  { latRad: -23.21 * Math.PI / 180, lonRad: -45.86 * Math.PI / 180, heightKm: 0.6 },
  { latRad: 67.9 * Math.PI / 180, lonRad: 21.0 * Math.PI / 180, heightKm: 0.4 },
  { latRad: 0, lonRad: 0, heightKm: 0 },
];

describe('frame conversions agree with satellite.js', () => {
  it('GMST', () => {
    for (const d of dates) expect(gmstRad(d)).toBeCloseTo(satellite.gstime(d), 9);
  });

  it('ECI → ECEF', () => {
    for (const d of dates) for (const p of points) {
      const g = satellite.gstime(d);
      const a = eciToEcf(p, g);
      const b = satellite.eciToEcf(p, g);
      expect(a.x).toBeCloseTo(b.x, 6);
      expect(a.y).toBeCloseTo(b.y, 6);
      expect(a.z).toBeCloseTo(b.z, 6);
    }
  });

  it('geodetic → ECEF and back', () => {
    for (const s of stations) {
      const ecf = geodeticToEcf(s);
      const ref = satellite.geodeticToEcf({ latitude: s.latRad, longitude: s.lonRad, height: s.heightKm });
      expect(ecf.x).toBeCloseTo(ref.x, 6);
      expect(ecf.y).toBeCloseTo(ref.y, 6);
      expect(ecf.z).toBeCloseTo(ref.z, 6);
      const back = ecfToGeodetic(ecf);
      expect(back.latRad).toBeCloseTo(s.latRad, 9);
      expect(back.lonRad).toBeCloseTo(s.lonRad, 9);
      expect(back.heightKm).toBeCloseTo(s.heightKm, 6);
    }
    for (const p of points) {
      const a = ecfToGeodetic(p);
      const b = satellite.eciToGeodetic(p, 0);
      expect(a.latRad).toBeCloseTo(b.latitude, 9);
      expect(a.lonRad).toBeCloseTo(b.longitude, 9);
      expect(a.heightKm).toBeCloseTo(b.height, 6);
    }
  });

  it('look angles', () => {
    for (const s of stations) for (const p of points) {
      const a = ecfToLookAngles(s, p);
      const b = satellite.ecfToLookAngles({ latitude: s.latRad, longitude: s.lonRad, height: s.heightKm }, p);
      expect(a.elevationRad).toBeCloseTo(b.elevation, 9);
      const dAz = Math.abs(a.azimuthRad - b.azimuth) % (2 * Math.PI);
      expect(Math.min(dAz, 2 * Math.PI - dAz)).toBeLessThan(1e-9);
      expect(a.rangeKm).toBeCloseTo(b.rangeSat, 6);
    }
  });
});
