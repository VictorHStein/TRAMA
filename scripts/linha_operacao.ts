/**
 * Event-driven operations of the demo over the first three hours after the
 * epoch, minute by minute, for the operations timeline figure of the thesis.
 * Same loop as simulateOperations (domain/analysis/operations.ts).
 * Run: npx vite-node scripts/linha_operacao.ts > dados_operacao.dat
 */
import demo from '../src/data/demoArchitecture.json';
import { normalizeArchitecture } from '../src/domain/parser/normalizeArchitecture';
import type { ArchitectureInput } from '../src/domain/model/ArchitectureTypes';
import { analyzeMission } from '../src/domain/analysis/mission';
import {
  buildOperationsModel, operationsMode, operationsLoadW, stepStateOfCharge, reportOrbit, lastSunriseBefore,
} from '../src/domain/analysis/operations';
import {
  DEG, ecfToLookAngles, eciToEcf, gmstRad, inEclipse, propagateKeplerJ2, sunUnitVectorEci,
} from '../src/domain/mission';

const arch = normalizeArchitecture(demo as unknown as ArchitectureInput);
const report = analyzeMission(arch)!;
const model = buildOperationsModel(arch, report)!;
const orbit = reportOrbit(report);
const epochMs = report.orbit.epoch.getTime();
const periodS = report.orbit.basics.periodMin * 60;
const st = report.station!.station;
const observer = { latRad: st.latDeg * DEG, lonRad: st.lonDeg * DEG, heightKm: st.altKm };
const minEl = st.minElevationDeg * DEG;
const MODE_INDEX: Record<string, number> = { nominal: 1, imaging: 2, downlink: 3, eclipse: 4, safe: 5 };

let sun = sunUnitVectorEci(report.orbit.epoch);
let sunT = 0;
let lastSunrise = lastSunriseBefore(orbit, 0, sun, periodS);
let wasSunlit: boolean | null = null;
let soc = 1;
const stepS = 10;
console.log('t sunlit contact mode soc load gen elev');
for (let t = 0; t <= 3 * 3600; t += stepS) {
  const date = new Date(epochMs + t * 1000);
  if (t - sunT >= 600) { sun = sunUnitVectorEci(date); sunT = t; }
  const pos = propagateKeplerJ2(orbit, t);
  const sunlit = !inEclipse(pos, sun);
  if (wasSunlit === false && sunlit) lastSunrise = t;
  wasSunlit = sunlit;
  const el = ecfToLookAngles(observer, eciToEcf(pos, gmstRad(date))).elevationRad;
  const contact = el >= minEl;
  const minutes = lastSunrise === null ? null : (t - lastSunrise) / 60;
  const modeId = operationsMode(model, { sunlit, contact, minutesSinceSunrise: minutes });
  if (t % 60 === 0) {
    console.log((t / 60).toFixed(0), sunlit ? 1 : 0, contact ? 1 : 0, MODE_INDEX[modeId ?? ''] ?? 0, (soc * 100).toFixed(2),
      operationsLoadW(model, modeId).toFixed(1), (sunlit ? model.generationW : 0).toFixed(1), (el / DEG).toFixed(1));
  }
  soc = stepStateOfCharge(model, soc, modeId, sunlit, stepS);
}
