/**
 * Altitude scan of the demo model for the results chapter: survival lifetime
 * (nominal mass), disposal lifetime after the mission (margined mass) and GSD.
 * Run: npx vite-node scripts/janela_altitude.ts > dados_janela.dat
 */
import demo from '../src/data/demoArchitecture.json';
import { normalizeArchitecture } from '../src/domain/parser/normalizeArchitecture';
import type { ArchitectureInput } from '../src/domain/model/ArchitectureTypes';
import { analyzeMission } from '../src/domain/analysis/mission';
import { cloneInputDocument } from '../src/domain/parser/inputDocument';

const arch = normalizeArchitecture(demo as unknown as ArchitectureInput);
console.log('h survival postmission gsd');
for (let h = 540; h <= 660; h += 5) {
  const d = cloneInputDocument(arch);
  d.mission!.orbit!.altitudeKm = h;
  const a = normalizeArchitecture(d);
  const m = analyzeMission(a, { fast: true })!;
  const dec = m.decay!;
  const surv = (dec.survival?.result ?? dec.result).lifetimeYears;
  console.log(h, surv.toFixed(3), dec.result.postMissionYears.toFixed(3), a.evaluation.params['camera.gsd_m'].value!.toFixed(3));
}
