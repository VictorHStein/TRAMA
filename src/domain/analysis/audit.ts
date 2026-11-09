/**
 * Architecture audit: coverage metrics and gaps a systems engineer would
 * flag in a PDR/CDR checklist. Everything is derived from the normalized
 * model plus the engine result, so it is always consistent with the graph.
 */
import type { NormalizedArchitecture } from '../model/ArchitectureTypes';
import { entityIdsOf, getMissionReport } from './mission';
import { riskBand, TRACE_TYPES } from './matrices';
import { computeSuspectLinks } from './suspect';

export type AuditSeverity = 'error' | 'warning' | 'info';

export type AuditKind =
  | 'requirement-without-origin'
  | 'objective-without-requirement'
  | 'requirement-without-function'
  | 'requirement-without-verification'
  | 'requirement-rule-failing'
  | 'requirement-rule-error'
  | 'function-without-allocation'
  | 'physical-without-interface'
  | 'component-without-parent'
  | 'orphan-entity'
  | 'suspect-link'
  | 'budget-over'
  | 'budget-critical'
  | 'parameter-error'
  | 'parameter-out-of-range'
  | 'risk-without-mitigation'
  | 'risk-critical-open'
  | 'mode-fractions'
  | 'verification-without-evidence'
  | 'link-margin'
  | 'power-negative'
  | 'battery-undersized'
  | 'array-undersized'
  | 'data-budget'
  | 'orbital-lifetime'
  | 'thermal-range';

export interface AuditItem {
  id: string;
  kind: AuditKind;
  severity: AuditSeverity;
  message: string;
  entityIds: string[];
  /** Suggested fix, in plain words. */
  fix?: string;
}

export interface CoverageMetric {
  covered: number;
  total: number;
}

export interface AuditReport {
  items: AuditItem[];
  coverage: {
    requirementsAllocated: CoverageMetric;
    requirementsVerified: CoverageMetric;
    requirementsWithRule: CoverageMetric;
    rulesPassing: CoverageMetric;
    functionsAllocated: CoverageMetric;
    physicalWithInterface: CoverageMetric;
    budgetsWithinAllocation: CoverageMetric;
  };
  counts: { error: number; warning: number; info: number };
}

export function auditArchitecture(arch: NormalizedArchitecture): AuditReport {
  const items: AuditItem[] = [];
  const add = (kind: AuditKind, severity: AuditSeverity, message: string, entityIds: string[], fix?: string) =>
    items.push({ id: `${kind}:${entityIds.join('+') || items.length}`, kind, severity, message, entityIds, fix });

  const byCat = (c: string) => arch.entities.filter((e) => e.category === c);
  const label = (id: string) => {
    const e = arch.entitiesById[id];
    const code = arch.breakdownCodes[id];
    return e ? (code ? `${code} ${e.short ?? e.name}` : (e.short ?? e.name)) : id;
  };
  const rels = (id: string) => arch.relationsByEntity[id] ?? { incoming: [], outgoing: [] };

  // ── Requirements ─────────────────────────────────────
  const requirements = byCat('requirement');
  let reqAllocated = 0;
  let reqVerified = 0;
  let reqWithRule = 0;
  let rulesPass = 0;
  for (const r of requirements) {
    const trace = arch.traceAll[r.id];
    // A system-level requirement (mass, for instance) may be satisfied by a whole segment.
    const allocated = trace.functions.length > 0 || trace.subsystems.length > 0 || trace.components.length > 0 || trace.segments.length > 0;
    if (allocated) reqAllocated++;
    else add('requirement-without-function', 'error', `${label(r.id)} não está alocado a nenhuma função, segmento, subsistema ou componente.`, [r.id],
      'Crie uma relação "Alocado para" do requisito para uma função, ou "Satisfaz requisito" de um subsistema para ele.');

    // A design rule predicts compliance; verification needs a planned activity.
    const hasVerification = trace.verifications.length > 0
      || (arch.verifications ?? []).some((v) => v.requirementId === r.id);
    if (hasVerification) reqVerified++;
    else add('requirement-without-verification', 'error', `${label(r.id)} não tem verificação prevista.`, [r.id],
      'Adicione uma entidade de verificação com a relação "Verifica", ou uma entrada em verifications com método, nível e estado.');

    const rule = arch.evaluation.rules[r.id];
    if (rule) {
      reqWithRule++;
      if (rule.result === 'pass') rulesPass++;
      else if (rule.result === 'fail') add('requirement-rule-failing', 'error', `${label(r.id)} viola a regra "${rule.expression}".`, [r.id, ...rule.dependencies.map((d) => d.split('.')[0])],
        'Reveja os parâmetros envolvidos ou renegocie o requisito.');
      else if (rule.result === 'error') add('requirement-rule-error', 'warning', `A regra de ${label(r.id)} não pôde ser avaliada: ${rule.error}`, [r.id]);
    }
  }

  // ── Objectives (only when the model declares them) ───
  // Every requirement should trace up to a mission objective (or to a
  // constraint it derives from), and every objective should be covered by
  // at least one requirement; otherwise the Mission → Requirement link is implicit.
  const objectives = byCat('objective');
  if (objectives.length > 0) {
    for (const r of requirements) {
      const hasOrigin = rels(r.id).outgoing.some((x) => x.type === 'derives_from') || (r.requirement?.derivesFrom?.length ?? 0) > 0;
      if (!hasOrigin) add('requirement-without-origin', 'warning', `${label(r.id)} não deriva de nenhum objetivo da missão.`, [r.id],
        'Crie uma relação "Deriva de" do requisito para o objetivo (ou para a restrição) que o justifica.');
    }
    for (const o of objectives) {
      if (arch.traceAll[o.id]?.requirements.length === 0) add('objective-without-requirement', 'warning', `O objetivo ${label(o.id)} não tem nenhum requisito derivado.`, [o.id],
        'Escreva pelo menos um requisito que o objetivo justifique e ligue-o com "Deriva de".');
    }
  }

  // ── Functions ────────────────────────────────────────
  const functions = byCat('function');
  let fnAllocated = 0;
  for (const f of functions) {
    const t = arch.traceAll[f.id];
    if (t.subsystems.length > 0 || t.components.length > 0) fnAllocated++;
    else add('function-without-allocation', 'error', `A função ${label(f.id)} não está alocada a nenhum subsistema ou componente.`, [f.id],
      'Crie uma relação "Alocado para" da função para o elemento físico que a executa.');
  }

  // ── Physical elements ────────────────────────────────
  const physical = [...byCat('subsystem'), ...byCat('component')];
  let withInterface = 0;
  for (const p of physical) {
    const r = rels(p.id);
    const hasInterface = [...r.incoming, ...r.outgoing].some((x) => !TRACE_TYPES.has(x.type));
    if (hasInterface) withInterface++;
    else add('physical-without-interface', 'warning', `${label(p.id)} não tem nenhuma interface (potência, dados, comando, mecânica ou térmica).`, [p.id],
      'Todo elemento físico troca algo com outro: declare pelo menos uma interface.');
    if (p.category === 'component' && !p.parentId) {
      add('component-without-parent', 'warning', `O componente ${label(p.id)} não pertence a nenhum subsistema.`, [p.id], 'Defina "parentId".');
    }
  }

  // ── Orphans ──────────────────────────────────────────
  for (const e of arch.entities) {
    const r = rels(e.id);
    const hasChild = arch.entities.some((x) => x.parentId === e.id);
    if (r.incoming.length === 0 && r.outgoing.length === 0 && !e.parentId && !hasChild && e.category !== 'mission') {
      add('orphan-entity', 'warning', `${label(e.id)} está isolado: nenhuma relação entra ou sai.`, [e.id]);
    }
  }

  // ── Suspect links ────────────────────────────────────
  for (const s of computeSuspectLinks(arch)) {
    const r = arch.relations.find((x) => x.id === s.relationId);
    if (!r) continue;
    const type = arch.relationTypesById[r.type]?.label ?? r.type;
    const changed = s.changed.map((end) => label(end === 'source' ? r.source : r.target)).join(' e ');
    add('suspect-link', 'warning', `A ligação ${label(r.source)} → ${label(r.target)} (${type}) está suspeita: ${changed} mudou depois da última revisão.`, [r.source, r.target],
      'Confira se a ligação continua válida e marque-a como revisada no inspetor da relação.');
  }

  // ── Budgets ──────────────────────────────────────────
  let budgetsOk = 0;
  let budgetsWithAlloc = 0;
  for (const b of arch.evaluation.budgets) {
    if (b.allocated === undefined) continue;
    budgetsWithAlloc++;
    if (b.status === 'over') add('budget-over', 'error', `${b.label}: total com margens ${fmt(b.total)} ${b.unit} excede a alocação de ${fmt(b.allocated)} ${b.unit}.`, b.rows.map((r) => r.entityId),
      'Reduza estimativas, reveja margens ou renegocie a alocação.');
    else if (b.status === 'critical') add('budget-critical', 'warning', `${b.label}: margem restante de apenas ${pct(b.marginRemainingFraction)}.`, b.rows.map((r) => r.entityId));
    if (b.status !== 'over') budgetsOk++;
  }

  // ── Parameters ───────────────────────────────────────
  for (const p of Object.values(arch.evaluation.params)) {
    if (p.error) add('parameter-error', 'error', `${p.key}: ${p.error}`, [p.entityId]);
    else if (p.outOfRange) add('parameter-out-of-range', 'warning', `${p.key} = ${fmt(p.value)} ${p.unit} está fora da faixa ${p.min ?? '−∞'}–${p.max ?? '∞'}.`, [p.entityId]);
  }

  // ── Risks ────────────────────────────────────────────
  for (const r of arch.risks ?? []) {
    const score = r.probability * r.impact;
    if (!r.mitigation.trim()) add('risk-without-mitigation', 'warning', `Risco "${r.title}" não tem mitigação definida.`, r.entityIds ?? []);
    if (riskBand(r.probability, r.impact) === 'high' && r.status === 'open') add('risk-critical-open', 'error', `Risco crítico aberto: "${r.title}" (P×I = ${score}).`, r.entityIds ?? []);
  }

  // ── Modes and verifications ──────────────────────────
  for (const issue of arch.evaluation.issues) {
    if (issue.message.startsWith('As frações de duração')) add('mode-fractions', 'warning', issue.message, []);
  }
  for (const v of arch.verifications ?? []) {
    if ((v.status === 'passed' || v.status === 'verified') && !v.evidence) {
      add('verification-without-evidence', 'info', `Verificação ${v.id} está "${v.status}" sem evidência registrada.`, v.itemId ? [v.itemId] : [], 'Registre o relatório/ensaio que comprova o resultado.');
    }
  }

  // ── Mission analysis ─────────────────────────────────
  const mission = getMissionReport(arch);
  if (mission) {
    const { link, power, data, decay, thermal } = mission;
    if (link && link.status === 'fail') {
      add('link-margin', 'error', `Enlace de dados sem margem: ${fmt(link.result.marginDb)} dB a ${fmt(Math.round(link.distanceKm))} km (mínimo 3 dB).`, entityIdsOf(link.inputs, arch),
        'Aumente a potência ou o ganho da antena, reduza a taxa de bits ou use codificação melhor.');
    } else if (link && link.status === 'warn') {
      add('link-margin', 'warning', `Enlace de dados com margem apertada: ${fmt(link.result.marginDb)} dB (recomendado ≥ 3 dB).`, entityIdsOf(link.inputs, arch));
    }
    if (power) {
      const ids = entityIdsOf(power.inputs, arch);
      if (power.status === 'fail') {
        add('power-negative', 'error', `Geração média por órbita (${fmt(power.generationAvgW)} W) menor que o consumo médio (${fmt(power.averageW)} W).`, ids,
          'Aumente a área de painéis ou reduza a fração dos modos de maior consumo.');
      }
      if (power.batteryStatus === 'fail' && power.battery) {
        add('battery-undersized', 'error', `Bateria de ${fmt(power.declaredCapacityWh)} Wh abaixo dos ${fmt(power.battery.capacityWh)} Wh necessários para ${fmt(power.designEclipseMin)} min de eclipse a ${fmt(power.eclipseW)} W.`, ids,
          'Aumente a capacidade, a profundidade de descarga admitida ou reduza o consumo no eclipse.');
      }
      if (power.arrayStatus === 'fail' && power.array) {
        add('array-undersized', 'warning', `Painel solar de ${fmt(power.declaredArrayAreaM2)} m² abaixo dos ${fmt(power.array.areaM2)} m² estimados para o fim de vida.`, ids);
      }
    }
    if (data && data.result.status === 'fail') {
      add('data-budget', 'error', `Dados gerados (${fmt(Math.round(data.result.generatedMBPerDay))} MB/dia) excedem a capacidade de downlink (${fmt(Math.round(data.result.downlinkCapacityMBPerDay))} MB/dia).`, data.entityIds,
        'Reduza o ciclo de trabalho da carga útil, comprima os dados ou aumente a taxa e os contatos.');
    } else if (data && data.status === 'warn') {
      add('data-budget', 'warning', data.result.status === 'marginal'
        ? `Downlink com margem apertada: ${pct(data.result.marginFraction)} sobre os dados gerados.`
        : `Memória de bordo de ${fmt(data.storageCapacityMB)} MB abaixo dos ${fmt(Math.round(data.result.storageRequiredMB))} MB necessários para o maior intervalo sem passe.`, data.entityIds);
    }
    if (decay) {
      const ids = entityIdsOf(decay.inputs, arch);
      if (decay.survives === false) {
        const shortest = decay.survival?.result ?? decay.result;
        add('orbital-lifetime', 'error', `Vida orbital estimada de ${fmt(shortest.lifetimeYears)} anos${decay.survival ? ' com a massa nominal' : ''}, menor que os ${fmt(decay.missionLifetimeYears)} anos de missão.`, ids,
          'Suba a órbita, reduza a área de arrasto ou preveja propulsão para manutenção de órbita.');
      } else if (!decay.result.meets25YearRule) {
        add('orbital-lifetime', 'warning', 'Reentrada natural em mais de 25 anos: prever meio de desorbitação (IADC; FCC exige 5 anos).', ids);
      }
    }
    if (thermal && thermal.status === 'fail') {
      add('thermal-range', 'warning', `Temperatura ${thermal.transient ? 'na órbita' : 'de equilíbrio'} fora dos limites: quente ${fmt(Math.round(thermal.result.hotCaseC))} °C, frio ${fmt(Math.round(thermal.result.coldCaseC))} °C (limites ${thermal.tMinC ?? '−∞'} a ${thermal.tMaxC ?? '∞'} °C).`, entityIdsOf(thermal.inputs, arch),
        'Ajuste o acabamento (α/ε), a área radiante ou preveja heaters.');
    }
  }

  const counts = { error: 0, warning: 0, info: 0 };
  for (const it of items) counts[it.severity]++;
  return {
    items,
    coverage: {
      requirementsAllocated: { covered: reqAllocated, total: requirements.length },
      requirementsVerified: { covered: reqVerified, total: requirements.length },
      requirementsWithRule: { covered: reqWithRule, total: requirements.length },
      rulesPassing: { covered: rulesPass, total: reqWithRule },
      functionsAllocated: { covered: fnAllocated, total: functions.length },
      physicalWithInterface: { covered: withInterface, total: physical.length },
      budgetsWithinAllocation: { covered: budgetsOk, total: budgetsWithAlloc },
    },
    counts,
  };
}

/** Number for audit messages, in pt-BR (decimal comma): two decimals below 10, one above. */
function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '?';
  if (Number.isInteger(n)) return String(n);
  const digits = Math.abs(n) < 10 ? 2 : 1;
  return n.toFixed(digits).replace(/\.?0+$/, '').replace('.', ',');
}
function pct(f: number | null): string {
  return f === null ? '?' : `${(f * 100).toFixed(0)} %`;
}
