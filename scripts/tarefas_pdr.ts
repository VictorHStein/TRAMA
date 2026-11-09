/**
 * Answers the eight PDR questions of the thesis task study with the real
 * engine, on the demo model. Run: npx vite-node scripts/tarefas_pdr.ts
 * The output feeds the comparative and results chapters of the monograph.
 */
import demo from '../src/data/demoArchitecture.json';
import { normalizeArchitecture } from '../src/domain/parser/normalizeArchitecture';
import type { ArchitectureInput } from '../src/domain/model/ArchitectureTypes';
import { analyzeMission } from '../src/domain/analysis/mission';
import { auditArchitecture } from '../src/domain/analysis/audit';
import { computeVcrm } from '../src/domain/analysis/matrices';
import { computeSuspectLinks } from '../src/domain/analysis/suspect';
import { cloneInputDocument } from '../src/domain/parser/inputDocument';

const base = demo as unknown as ArchitectureInput;
const arch = normalizeArchitecture(base);
const ev = arch.evaluation;
const mission = analyzeMission(arch)!;
const fmt = (n: number | null | undefined, d = 1) => (n === null || n === undefined ? '—' : n.toFixed(d));

const mass = ev.budgets.find((b) => b.id === 'mass')!;
console.log('Q1 massa:', fmt(mass.nominal), 'nominal;', fmt(mass.withItemMargins), 'com maturidade;', fmt(mass.total, 2), 'com sistema; alocado', mass.allocated, '; resta', fmt((mass.marginRemainingFraction ?? 0) * 100), '%; estado', mass.status);

const p = mission.power!;
console.log('Q2 energia: eclipse de projeto', fmt(mission.eclipse.designEclipseMin), 'min; geração EOL', fmt(p.sunPowerW), 'W; média', fmt(p.averageW), 'W; bateria necessária', fmt(p.battery?.capacityWh, 1), 'Wh; declarada', p.declaredCapacityWh, 'Wh; margem média', fmt((p.marginFraction ?? 0) * 100, 0), '%; SoC mínimo', fmt((p.profile?.minSoc ?? 0) * 100, 0), '%; REQ-003', ev.rules['req_power']?.result);

console.log('Q3 enlace: margem', fmt(mission.link?.result.marginDb), 'dB; estado', mission.link?.status);

const doc = cloneInputDocument(arch);
const battery = doc.entities.find((e) => e.id === 'battery')!;
battery.parameters!.find((x) => x.id === 'capacity_wh')!.value = 20;
const weak = normalizeArchitecture(doc);
const flipped = Object.entries(weak.evaluation.rules).filter(([id, r]) => r.result === 'fail' && ev.rules[id]?.result !== 'fail').map(([id]) => weak.breakdownCodes[id] ?? id);
const newAudit = auditArchitecture(weak).items.filter((i) => i.severity !== 'info').map((i) => i.kind);
const suspects = computeSuspectLinks(weak).map((s) => { const r = weak.relations.find((x) => x.id === s.relationId)!; return `${weak.breakdownCodes[r.source] ?? r.source}→${weak.breakdownCodes[r.target] ?? r.target}`; });
console.log('Q4 bateria 20 Wh: requisitos que passam a violar', flipped, '; auditoria', [...new Set(newAudit)], '; ligações suspeitas', suspects);

for (const alt of [550, 600, 650]) {
  const d2 = cloneInputDocument(arch);
  d2.mission!.orbit!.altitudeKm = alt;
  const a2 = normalizeArchitecture(d2);
  const m2 = analyzeMission(a2)!;
  const dec = m2.decay!;
  const surv = dec.survival?.result ?? dec.result;
  const failing = Object.entries(a2.evaluation.rules).filter(([, r]) => r.result === 'fail').map(([id]) => a2.breakdownCodes[id] ?? id);
  console.log(`Q5 ${alt} km: eclipse ${fmt(m2.eclipse.designEclipseMin)} min; passes/dia ${fmt(m2.station?.estimate.passesPerDay)}; contato ${fmt(m2.station?.simulation.totalContactMinPerDay, 0)} min; enlace ${fmt(m2.link?.result.marginDb)} dB; GSD ${fmt(a2.evaluation.params['camera.gsd_m'].value)} m; dados ${fmt(m2.data?.result.downlinkCapacityMBPerDay, 0)} MB/dia; vida ${fmt(surv.lifetimeYears)} a ${dec.result.reachedFloor ? fmt(dec.result.lifetimeYears) : '>30'} anos; pós-missão ${fmt(dec.result.postMissionYears)}; sobrevive ${dec.survives}; 25 anos ${dec.result.meets25YearRule}; térmico ${fmt(m2.thermal?.result.coldCaseC, 0)}..${fmt(m2.thermal?.result.hotCaseC, 0)} °C; requisitos violados ${JSON.stringify(failing)}`);
}

const vcrm = computeVcrm(arch);
const row = vcrm.rows.find((r) => r.requirementId === 'req_power')!;
console.log('Q6 VCRM REQ-003:', row.code, 'métodos', row.entries.map((e) => `${e.method}/${e.status}`), '; estado', row.status, '; regra', row.rule?.result);

const outs = arch.relations.filter((r) => r.source === 'eps' && r.type === 'provides_power_to').map((r) => `${arch.breakdownCodes[r.target] ?? r.target}:${r.criticality ?? '-'}`);
console.log('Q7 interfaces de potência do EPS:', outs);

const dec = mission.decay!;
console.log('Q8 vida orbital: sobrevivência', fmt(dec.survival?.result.lifetimeYears), 'anos; descarte', fmt(dec.result.lifetimeYears), 'anos; pós-missão', fmt(dec.result.postMissionYears), '; 25 anos', dec.result.meets25YearRule, '; 5 anos', dec.result.meets5YearRule);

const t = mission.thermal!;
console.log('Térmico:', fmt(t.result.coldCaseC), 'a', fmt(t.result.hotCaseC), '°C; equilíbrio', fmt(t.result.equilibriumColdC), 'a', fmt(t.result.equilibriumHotC), '; tau', fmt(t.result.timeConstantH), 'h; REQ-004', ev.rules['req_thermal']?.result);
console.log('Geometria:', ['drag_area_m2', 'sun_area_m2', 'nadir_area_m2', 'heat_capacity_j_k'].map((k) => `${k}=${fmt(ev.params[`seg_space.${k}`].value, 3)}`).join(' '), '; GSD', fmt(ev.params['camera.gsd_m'].value, 2));
console.log('Modos:', ev.modes.map((m2) => `${m2.id} ${fmt((m2.durationFraction ?? 0) * 100, 1)}% ${m2.totalW} W`).join('; '));
console.log('Contagem:', arch.entities.length, 'entidades,', arch.relations.length, 'relações; auditoria', auditArchitecture(arch).counts);
