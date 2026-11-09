/**
 * Self-contained, printable HTML report generated from the model: mission,
 * requirements with rule status and VCRM, product tree with parameters,
 * budgets, modes, mission analysis (with the maths), interfaces, risks and
 * the audit. Light theme for paper; no external resources.
 */
import type { NormalizedArchitecture } from '../model/ArchitectureTypes';
import { auditArchitecture } from '../analysis/audit';
import { missionObjectives } from '../analysis/objectives';
import { computeN2, computeRiskGrid, computeVcrm, compareCodes, VCRM_METHODS, VCRM_METHOD_SHORT } from '../analysis/matrices';
import { REQ_PRIORITY_LABEL, REQ_TYPE_LABEL, criticalityLabel } from '../../lib/labels';
import { getMissionReport, type MissionReport, type ResolvedInput, type Working } from '../analysis/mission';

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const num = (n: number | null | undefined, d = 2): string => (n === null || n === undefined || !Number.isFinite(n) ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: d }));
const pct = (f: number | null | undefined): string => (f === null || f === undefined || !Number.isFinite(f) ? '—' : `${(f * 100).toFixed(0)} %`);
const qty = (n: number | null | undefined, unit: string, d = 2): string => (unit && unit !== '-' ? `${num(n, d)} ${unit}` : num(n, d));

const STATUS_PT: Record<string, string> = {
  ok: 'ok', warning: 'atenção', critical: 'crítico', over: 'acima', unknown: 'sem alocação',
  pass: 'atende', fail: 'viola', error: 'erro', verified: 'verificado', failed: 'falhou', in_progress: 'em andamento', planned: 'planejado', none: 'sem verificação',
  open: 'aberto', mitigated: 'mitigado', accepted: 'aceito', closed: 'fechado', marginal: 'marginal',
};
const st = (s: string | undefined): string => (s ? STATUS_PT[s] ?? s : '—');

function table(headers: string[], rows: string[][], cls = ''): string {
  return `<table class="${cls}"><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function working(w: Working, inputs?: ResolvedInput[]): string {
  const ins = inputs && inputs.length ? `<dl class="inputs">${inputs.map((i) => `<dt>${esc(i.label)}</dt><dd>${esc(qty(i.value, i.unit ?? ''))}${i.ref ? ` <span class="ref">← ${esc(i.ref)}</span>` : ''}</dd>`).join('')}</dl>` : '';
  return `<div class="working">${ins}<code>${esc(w.formula)}</code><ul>${w.assumptions.map((a) => `<li>${esc(a)}</li>`).join('')}</ul><p class="src">Fonte: ${esc(w.source)}</p></div>`;
}

function missionSection(m: MissionReport | null): string {
  if (!m) return '<p>Sem órbita de referência declarada (<code>mission.orbit</code>).</p>';
  const parts: string[] = [];
  const b = m.orbit.basics;
  parts.push(`<h3>Órbita</h3>${table(['Altitude', 'Inclinação', 'Período', 'Velocidade', 'Órbitas/dia', 'Regressão nodal', 'Héliossíncrona'],
    [[qty(m.orbit.altitudeKm, 'km'), qty(m.orbit.inclinationDeg, '°'), qty(b.periodMin, 'min', 1), qty(b.velocityKmS, 'km/s'), num(b.orbitsPerDay, 1), qty(b.nodalRegressionDegPerDay, '°/dia', 3), b.isSunSynchronous ? 'sim' : 'não']])}${working(b)}`);
  const e = m.eclipse;
  parts.push(`<h3>Eclipse</h3>${table(['β na época', 'Eclipse na época', 'Pior caso (β = 0°)', 'β*', 'Eclipse de projeto'],
    [[e.betaDeg === null ? '—' : qty(e.betaDeg, '°', 1), `${qty(e.atEpoch.eclipseMin, 'min', 1)} (${pct(e.atEpoch.fraction)})`, `${qty(e.worst.eclipseMin, 'min', 1)} (${pct(e.worst.fraction)})`, qty(e.worst.betaStarDeg, '°', 1), qty(e.designEclipseMin, 'min', 1)]])}${e.year ? `<p>Ao longo de ${e.year.year}: eclipse de ${num(e.year.minEclipseMin, 1)} a ${num(e.year.maxEclipseMin, 1)} min; β de ${num(e.year.minBetaDeg, 0)}° a ${num(e.year.maxBetaDeg, 0)}°.</p>` : ''}${working(e.atEpoch)}`);
  if (m.station) {
    const s = m.station;
    parts.push(`<h3>Cobertura e passes: ${esc(s.station.name)}</h3>${table(['Passes em 24 h', 'Contato por dia', 'Maior intervalo', 'Passe máximo', 'Alcance na elevação mínima', 'Estimativa analítica'],
      [[String(s.simulation.passes.length), qty(s.simulation.totalContactMinPerDay, 'min', 1), qty(s.simulation.longestGapMin / 60, 'h', 1), qty(s.coverage.maxPassDurationMin, 'min', 1), qty(s.coverage.slantRangeKm, 'km', 0), `${num(s.estimate.passesPerDay, 1)} passes/dia`]])}${table(['AOS (UTC)', 'LOS (UTC)', 'Duração', 'Elevação máx.'], s.simulation.passes.map((p) => [esc(p.aosUtc.slice(11, 16)), esc(p.losUtc.slice(11, 16)), qty(p.durationMin, 'min', 1), qty(p.maxElevationDeg, '°', 0)]))}${working(s.coverage)}${working(s.simulation)}`);
  }
  if (m.power) {
    const p = m.power;
    parts.push(`<h3>Energia</h3>${table(['Consumo médio por órbita', 'Geração média por órbita', 'Margem', 'Consumo no eclipse', 'Painel necessário', 'Painel declarado', 'Bateria necessária', 'Bateria declarada'],
      [[qty(p.averageW, 'W', 1), qty(p.generationAvgW, 'W', 1), pct(p.marginFraction), qty(p.eclipseW, 'W', 1), p.array ? `${qty(p.array.areaM2, 'm²')} (${qty(p.array.requiredArrayPowerW, 'W', 0)})` : '—', qty(p.declaredArrayAreaM2, 'm²'), p.battery ? qty(p.battery.capacityWh, 'Wh', 0) : '—', qty(p.declaredCapacityWh, 'Wh', 0)]])}${p.array ? working(p.array, p.inputs) : ''}${p.battery ? working(p.battery) : ''}`);
  }
  if (m.link) {
    const l = m.link;
    parts.push(`<h3>Enlace de dados</h3>${table(['Linha', 'Valor (dB)'], l.result.lines.map((ln) => [esc(ln.label), num(ln.valueDb, 1)]))}<p>Margem: <strong>${num(l.result.marginDb, 1)} dB</strong> (${st(l.result.status)}) a ${num(l.distanceKm, 0)} km.</p>${working(l.result, l.inputs)}`);
  }
  if (m.data) {
    const d = m.data.result;
    parts.push(`<h3>Dados</h3>${table(['Gerado por dia', 'Capacidade de downlink', 'Margem', 'Memória necessária', 'Memória declarada', 'Contato por dia'],
      [[qty(d.generatedMBPerDay, 'MB', 0), qty(d.downlinkCapacityMBPerDay, 'MB', 0), pct(d.marginFraction), qty(d.storageRequiredMB, 'MB', 0), qty(m.data.storageCapacityMB, 'MB', 0), qty(m.data.contactMinPerDay, 'min', 1)]])}${working(d, m.data.inputs)}`);
  }
  if (m.decay) {
    const d = m.decay;
    const yrs = (r: typeof d.result) => (r.reachedFloor ? `${num(r.lifetimeYears, 1)} anos` : '> 30 anos');
    parts.push(`<h3>Decaimento orbital</h3>${table(['Vida orbital (sobrevivência, massa nominal)', 'Vida orbital (descarte, massa com margens)', 'Coeficiente balístico (descarte)', 'Regra dos 25 anos', 'Regra dos 5 anos', 'Vida da missão'],
      [[d.survival ? yrs(d.survival.result) : '—', yrs(d.result), qty(d.ballisticCoefficient, 'm²/kg', 3), d.result.meets25YearRule ? 'cumpre' : 'não cumpre', d.result.meets5YearRule ? 'cumpre' : 'não cumpre', d.missionLifetimeYears !== null ? `${d.missionLifetimeYears} anos` : '—']])}${working(d.result, d.inputs)}`);
  }
  if (m.thermal) {
    const t = m.thermal;
    parts.push(`<h3>Térmico${t.transient ? ' (nó único com capacidade térmica, ao longo da órbita)' : ' (equilíbrio instantâneo)'}</h3>${table(['Caso quente', 'Caso frio', 'Limites', 'Fator de vista'],
      [[qty(t.result.hotCaseC, '°C', 0), qty(t.result.coldCaseC, '°C', 0), `${t.tMinC ?? '−∞'} a ${t.tMaxC ?? '∞'} °C`, num(t.result.viewFactor, 2)]])}${working(t.result, t.inputs)}`);
  }
  if (m.missing.length) parts.push(`<h3>Análises não configuradas</h3><ul>${m.missing.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`);
  return parts.join('');
}

export function buildHtmlReport(arch: NormalizedArchitecture, generatedAt = new Date()): string {
  const audit = auditArchitecture(arch);
  const vcrm = computeVcrm(arch);
  const n2 = computeN2(arch, 'component');
  const risks = computeRiskGrid(arch);
  const mission = getMissionReport(arch);
  const ev = arch.evaluation;
  const m = arch.mission;
  const label = (id: string) => `${arch.breakdownCodes[id] ? `<span class="code">${esc(arch.breakdownCodes[id])}</span> ` : ''}${esc(arch.entitiesById[id]?.name ?? id)}`;

  const physical = arch.entities
    .filter((e) => e.category === 'subsystem' || e.category === 'component')
    .sort((a, b) => compareCodes(arch.breakdownCodes[a.id] ?? a.id, arch.breakdownCodes[b.id] ?? b.id));
  const paramRows = physical.flatMap((e) => (e.parameters ?? []).map((p) => {
    const ep = ev.params[`${e.id}.${p.id}`];
    return [label(e.id), esc(p.id), esc(ep?.name ?? p.id), esc(qty(ep?.value, ep?.unit ?? p.unit)), esc(ep?.formula ?? ''), esc(ep?.source ?? ''), esc(ep?.marginFraction ? pct(ep.marginFraction) : '')];
  }));

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(arch.metadata.projectName)} — relatório de arquitetura</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; padding: 32px; font: 13px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1c2430; background: #fff; max-width: 1100px; margin-inline: auto; }
  h1 { font-size: 24px; margin: 0 0 4px; } h2 { font-size: 17px; margin: 32px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #1c2430; } h3 { font-size: 14px; margin: 18px 0 6px; }
  p { margin: 6px 0; } .muted { color: #5b6674; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 10px; font-size: 12px; } th, td { text-align: left; vertical-align: top; padding: 4px 6px; border-bottom: 1px solid #d9dee5; } th { background: #f1f4f8; font-weight: 600; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 11px; color: #5b6674; }
  code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 11px; white-space: pre-wrap; display: block; padding: 6px 8px; background: #f1f4f8; }
  .working { margin: 4px 0 12px; padding-left: 10px; border-left: 3px solid #d9dee5; } .working ul { margin: 4px 0; padding-left: 18px; } .src { color: #5b6674; font-size: 11px; }
  .inputs { display: grid; grid-template-columns: max-content 1fr; gap: 2px 12px; margin: 0 0 6px; font-size: 12px; } .inputs dt { color: #5b6674; } .inputs dd { margin: 0; } .ref { color: #8a94a3; font-size: 11px; }
  .chip { display: inline-block; padding: 0 6px; border-radius: 3px; font-size: 11px; font-weight: 600; background: #e8ecf1; } .chip.ok { background: #d9f3e4; color: #135c34; } .chip.warn { background: #fbecd0; color: #7a4d00; } .chip.fail { background: #fbdcdf; color: #8a1c25; }
  .cover { display: flex; justify-content: space-between; gap: 24px; align-items: flex-end; border-bottom: 1px solid #d9dee5; padding-bottom: 12px; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin: 12px 0; } .kpi { border: 1px solid #d9dee5; padding: 8px 10px; } .kpi b { display: block; font-size: 18px; }
  @media print { body { padding: 0; } h2 { break-after: avoid; } table { break-inside: auto; } tr { break-inside: avoid; } .working { break-inside: avoid; } }
</style></head><body>
<div class="cover"><div><h1>${esc(arch.metadata.projectName)}</h1><p class="muted">${esc(m?.name ?? '')}${m?.name ? ' · ' : ''}versão ${esc(arch.metadata.version)} · relatório gerado em ${esc(generatedAt.toISOString().slice(0, 16).replace('T', ' '))} UTC</p></div><div class="muted">Sistema imersivo de modelagem de sistemas espaciais (TG2)</div></div>
${arch.metadata.description ? `<p>${esc(arch.metadata.description)}</p>` : ''}
<div class="kpis">
  <div class="kpi"><b>${arch.entities.length}</b>entidades</div><div class="kpi"><b>${arch.relations.length}</b>relações</div>
  <div class="kpi"><b>${audit.coverage.requirementsAllocated.covered}/${audit.coverage.requirementsAllocated.total}</b>requisitos alocados</div>
  <div class="kpi"><b>${audit.coverage.rulesPassing.covered}/${audit.coverage.rulesPassing.total}</b>regras atendidas</div>
  <div class="kpi"><b>${vcrm.coverage.closed}/${vcrm.coverage.total}</b>requisitos verificados</div>
  <div class="kpi"><b>${audit.counts.error}</b>erros de auditoria</div><div class="kpi"><b>${audit.counts.warning}</b>avisos</div>
</div>

<h2>1. Missão</h2>
${missionObjectives(arch).length ? `<ul>${missionObjectives(arch).map((o) => `<li>${o.code ? `${esc(o.code)} ` : ''}${esc(o.text)}</li>`).join('')}</ul>` : ''}
${m?.orbit ? `<p>Órbita de referência: ${qty(m.orbit.altitudeKm, 'km')}, ${qty(m.orbit.inclinationDeg, '°')}${m.orbit.ltanHours !== undefined ? `, LTAN ${num(m.orbit.ltanHours, 2)} h` : ''}${m.orbit.epoch ? `, época ${esc(m.orbit.epoch.slice(0, 10))}` : ''}. ${m.lifetimeYears ? `Vida útil: ${m.lifetimeYears} anos.` : ''}</p>` : ''}
${m?.groundStations?.length ? table(['Estação solo', 'Latitude', 'Longitude', 'Altitude', 'Elevação mínima'], m.groundStations.map((g) => [esc(g.name), qty(g.latDeg, '°'), qty(g.lonDeg, '°'), qty(g.altKm, 'km'), qty(g.minElevationDeg, '°')])) : ''}

<h2>2. Requisitos e VCRM</h2>
${table(['Código', 'Requisito', 'Tipo', 'Prior.', 'Regra', ...VCRM_METHODS.map((x) => VCRM_METHOD_SHORT[x]), 'Itens verificados', 'Status'],
    vcrm.rows.map((r) => [`<span class="code">${esc(r.code)}</span>`, `<strong>${esc(r.name)}</strong>${r.text ? `<br>${esc(r.text)}` : ''}`, esc(r.type ? REQ_TYPE_LABEL[r.type] ?? r.type : ''), esc(r.priority ? REQ_PRIORITY_LABEL[r.priority] ?? r.priority : ''),
      r.rule ? `<code style="display:inline;padding:1px 4px">${esc(r.rule.expression)}</code> <span class="chip ${r.rule.result === 'pass' ? 'ok' : r.rule.result === 'fail' ? 'fail' : 'warn'}">${esc(st(r.rule.result))}</span>` : '—',
      ...VCRM_METHODS.map((x) => r.byMethod[x].map((e) => `<span class="chip ${['passed', 'verified'].includes(e.status) ? 'ok' : e.status === 'failed' ? 'fail' : ''}">${esc(st(e.status))}</span>`).join(' ') || (r.plannedMethod === x ? '<span class="muted">previsto</span>' : '')),
      r.itemIds.map((id) => label(id)).join(', '), `<span class="chip ${r.status === 'verified' ? 'ok' : r.status === 'failed' ? 'fail' : r.status === 'none' ? 'warn' : ''}">${esc(st(r.status))}</span>`]))}

<h2>3. Árvore de produto e parâmetros</h2>
${table(['Elemento', 'Parâmetro', 'Nome', 'Valor', 'Fórmula', 'Origem', 'Margem'], paramRows)}

<h2>4. Budgets</h2>
${ev.budgets.map((b) => `<h3>${esc(b.label)} <span class="chip ${b.status === 'ok' ? 'ok' : b.status === 'over' ? 'fail' : 'warn'}">${esc(st(b.status))}</span></h3>
<p>Nominal ${qty(b.nominal, b.unit, 2)} · com margens de maturidade ${qty(b.withItemMargins, b.unit, 2)} · margem de sistema ${pct(b.systemMarginFraction)} · <strong>total ${qty(b.total, b.unit, 2)}</strong>${b.allocated !== undefined ? ` de ${qty(b.allocated, b.unit, 2)} alocados (${pct(b.marginRemainingFraction)} restante)` : ''}.</p>
${table(['Item', 'Valor', 'Margem', 'Com margem'], [...b.rows].sort((x, y) => (y.value ?? 0) - (x.value ?? 0)).map((r) => [label(r.entityId), esc(qty(r.value, b.unit)), esc(pct(r.marginFraction)), esc(qty(r.valueWithMargin, b.unit))]))}`).join('')}

<h2>5. Modos operacionais</h2>
${ev.modes.length ? table(['Modo', 'Fração da órbita', 'Consumo', 'Cargas'], ev.modes.map((md) => [esc(md.name), esc(md.durationFraction !== undefined ? pct(md.durationFraction) : '—'), esc(qty(md.totalW, 'W', 1)), md.loads.map((l) => `${esc(arch.entitiesById[l.entityId]?.short ?? arch.entitiesById[l.entityId]?.name ?? l.entityId)} ${esc(qty(l.powerW, 'W', 1))}`).join(', ')])) + `<p>Média por órbita: <strong>${qty(ev.orbitAveragePowerW, 'W', 1)}</strong>.</p>` : '<p>Sem modos declarados.</p>'}

<h2>6. Análise de missão</h2>
${missionSection(mission)}

<h2>7. Interfaces (N²)</h2>
<p>${n2.totalInterfaces} interfaces físicas/lógicas entre ${n2.nodes.length} elementos.</p>
${table(['De', 'Para', 'Tipo', 'Rótulo', 'Criticidade'], Object.values(n2.cells).flatMap((c) => c.relations.map((r) => [label(r.source), label(r.target), esc(arch.relationTypesById[r.type]?.label ?? r.type), esc(r.label ?? ''), esc(r.criticality ? criticalityLabel(r.criticality) : '')])))}

<h2>8. Riscos</h2>
${risks.risks.length ? table(['Risco', 'P', 'I', 'P×I', 'Faixa', 'Status', 'Elementos', 'Mitigação', 'Responsável'], risks.risks.map((r) => [esc(r.title), String(r.probability), String(r.impact), String(r.score), `<span class="chip ${r.band === 'high' ? 'fail' : r.band === 'medium' ? 'warn' : 'ok'}">${r.band === 'high' ? 'alta' : r.band === 'medium' ? 'média' : 'baixa'}</span>`, esc(st(r.status)), (r.entityIds ?? []).map((id) => label(id)).join(', '), esc(r.mitigation), esc(r.owner ?? '')])) : '<p>Sem riscos declarados.</p>'}

<h2>9. Auditoria</h2>
${audit.items.length ? table(['Severidade', 'Achado', 'Elementos', 'Sugestão'], audit.items.map((it) => [`<span class="chip ${it.severity === 'error' ? 'fail' : it.severity === 'warning' ? 'warn' : ''}">${it.severity === 'error' ? 'erro' : it.severity === 'warning' ? 'atenção' : 'nota'}</span>`, esc(it.message), it.entityIds.filter((id) => arch.entitiesById[id]).map((id) => label(id)).join(', '), esc(it.fix ?? '')])) : '<p>Nenhuma lacuna encontrada.</p>'}
<p class="muted">Relatório gerado automaticamente a partir do modelo JSON; os números vêm do motor paramétrico e da biblioteca de análise de missão (fórmulas e fontes indicadas em cada seção).</p>
</body></html>`;
  return html;
}
