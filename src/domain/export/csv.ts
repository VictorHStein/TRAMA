/**
 * CSV exports (semicolon-separated, UTF-8 with BOM, decimal comma) so the
 * files open correctly in Excel/LibreOffice configured for pt-BR.
 */
import type { NormalizedArchitecture } from '../model/ArchitectureTypes';
import { computeN2, computeVcrm, VCRM_METHODS } from '../analysis/matrices';

export type CsvValue = string | number | boolean | null | undefined;

function cell(v: CsvValue): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v).replace('.', ',') : '';
  if (typeof v === 'boolean') return v ? 'sim' : 'não';
  const s = String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const BOM = String.fromCharCode(0xfeff);

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers.map(cell).join(';'), ...rows.map((r) => r.map(cell).join(';'))];
  return `${BOM}${lines.join('\r\n')}\r\n`;
}

export function requirementsCsv(arch: NormalizedArchitecture): string {
  const vcrm = computeVcrm(arch);
  const headers = ['Código', 'Requisito', 'Texto', 'Tipo', 'Prioridade', 'Regra', 'Resultado da regra', 'Método previsto', 'Nível',
    ...VCRM_METHODS.map((m) => `Entradas ${m}`), 'Itens verificados', 'Status VCRM', 'Evidências'];
  const rows = vcrm.rows.map((r) => [
    r.code, r.name, r.text, r.type, r.priority, r.rule?.expression, r.rule?.result, r.plannedMethod, r.level,
    ...VCRM_METHODS.map((m) => r.byMethod[m].map((e) => `${e.id} (${e.status})`).join(' | ')),
    r.itemIds.map((id) => arch.entitiesById[id]?.name ?? id).join(' | '),
    r.status,
    r.entries.map((e) => e.evidence).filter(Boolean).join(' | '),
  ]);
  return toCsv(headers, rows);
}

export function parametersCsv(arch: NormalizedArchitecture): string {
  const headers = ['Entidade', 'Código', 'Parâmetro', 'Nome', 'Valor', 'Unidade', 'Fórmula', 'Origem', 'Margem', 'Valor com margem', 'Mín', 'Máx', 'Erro'];
  const rows = Object.values(arch.evaluation.params).map((p) => [
    arch.entitiesById[p.entityId]?.name ?? p.entityId, arch.breakdownCodes[p.entityId], p.paramId, p.name, p.value, p.unit,
    p.formula, p.source, p.marginFraction, p.valueWithMargin, p.min, p.max, p.error,
  ]);
  return toCsv(headers, rows);
}

export function budgetsCsv(arch: NormalizedArchitecture): string {
  const headers = ['Budget', 'Unidade', 'Entidade', 'Código', 'Valor', 'Margem do item', 'Valor com margem', 'Nominal do budget', 'Com margens de item', 'Margem de sistema', 'Total', 'Alocado', 'Margem restante', 'Status'];
  const rows: CsvValue[][] = [];
  for (const b of arch.evaluation.budgets) {
    for (const r of b.rows) {
      rows.push([b.label, b.unit, arch.entitiesById[r.entityId]?.name ?? r.entityId, arch.breakdownCodes[r.entityId], r.value, r.marginFraction, r.valueWithMargin,
        b.nominal, b.withItemMargins, b.systemMarginFraction, b.total, b.allocated, b.marginRemainingFraction, b.status]);
    }
  }
  return toCsv(headers, rows);
}

export function interfacesCsv(arch: NormalizedArchitecture): string {
  const n2 = computeN2(arch, 'component');
  const headers = ['De (código)', 'De', 'Para (código)', 'Para', 'Tipo', 'Nº', 'Rótulo', 'Criticidade', 'Descrição'];
  const rows: CsvValue[][] = [];
  for (const c of Object.values(n2.cells)) {
    for (const r of c.relations) {
      const t = arch.relationTypesById[r.type];
      rows.push([arch.breakdownCodes[r.source], arch.entitiesById[r.source]?.name, arch.breakdownCodes[r.target], arch.entitiesById[r.target]?.name,
        t?.label ?? r.type, t?.index, r.label, r.criticality, r.description]);
    }
  }
  return toCsv(headers, rows);
}
