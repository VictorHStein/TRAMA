import { describe, expect, it } from 'vitest';
import { validateArchitecture } from '../../parser/validateArchitecture';
import { normalizeArchitecture } from '../../parser/normalizeArchitecture';
import { compareCodes, computeN2, computeRiskGrid, computeVcrm, riskBand } from '../matrices';
import { budgetsCsv, interfacesCsv, parametersCsv, requirementsCsv, toCsv } from '../../export/csv';
import { buildHtmlReport } from '../../export/report';
import { parseCommand, type AnyDoc } from '../../parser/commandParser';
import demo from '../../../data/demoArchitecture.json';

const arch = (() => {
  const r = validateArchitecture(demo);
  if (!r.ok || !r.data) throw new Error(`demo invalid: ${JSON.stringify(r.issues)}`);
  return normalizeArchitecture(r.data);
})();

describe('N² matrix', () => {
  it('orders codes naturally', () => {
    expect(['1.10', '1.2', 'R-002', '1.1.3', 'R-001', '1.1'].sort(compareCodes)).toEqual(['1.1', '1.1.3', '1.2', '1.10', 'R-001', 'R-002']);
  });

  it('rolls component interfaces up to subsystems and never puts interfaces on the diagonal', () => {
    const n2 = computeN2(arch, 'subsystem');
    expect(n2.nodes.every((n) => n.category === 'subsystem')).toBe(true);
    for (const c of Object.values(n2.cells)) expect(c.from).not.toBe(c.to);
    expect(n2.totalInterfaces).toBeGreaterThan(5);
    // every counted relation is a physical/logical interface, not a trace link
    for (const c of Object.values(n2.cells)) for (const r of c.relations) expect(['satisfies', 'allocated_to', 'verifies']).not.toContain(r.type);
    const comp = computeN2(arch, 'component');
    expect(comp.nodes.length).toBeGreaterThan(n2.nodes.length);
    expect(comp.totalInterfaces).toBeGreaterThanOrEqual(n2.totalInterfaces);
  });
});

describe('VCRM', () => {
  it('builds one row per requirement with propagated status', () => {
    const v = computeVcrm(arch);
    expect(v.rows).toHaveLength(5);
    const thermal = v.rows.find((r) => r.requirementId === 'req_thermal')!;
    expect(thermal.byMethod.Analysis.length).toBeGreaterThanOrEqual(1);
    expect(thermal.rule?.result).toBe('pass');
    expect(thermal.status).toBe('verified');
    const downlink = v.rows.find((r) => r.requirementId === 'req_downlink')!;
    expect(downlink.status).toBe('in_progress');
    const mass = v.rows.find((r) => r.requirementId === 'req_mass')!;
    expect(mass.rule?.result).toBe('pass');
    expect(['verified', 'in_progress', 'planned']).toContain(mass.status);
    expect(v.coverage.total).toBe(5);
  });
});

describe('risk grid', () => {
  it('bands and cells', () => {
    expect(riskBand(5, 5)).toBe('high');
    expect(riskBand(3, 3)).toBe('medium');
    expect(riskBand(1, 5)).toBe('low');
    const g = computeRiskGrid(arch);
    expect(g.risks.length).toBe(3);
    expect(g.risks[0].score).toBeGreaterThanOrEqual(g.risks[1].score);
    expect(g.cells['3-4']?.map((r) => r.id)).toContain('risk_payload_thermal');
  });
});

describe('exports', () => {
  it('CSV escapes separators and uses decimal comma with BOM', () => {
    const csv = toCsv(['a', 'b'], [['x;y', 1.5], ['q"r', null]]);
    expect(csv.startsWith('﻿a;b\r\n')).toBe(true);
    expect(csv).toContain('"x;y";1,5');
    expect(csv).toContain('"q""r";');
  });

  it('tables from the demo have headers and rows', () => {
    for (const fn of [requirementsCsv, parametersCsv, budgetsCsv, interfacesCsv]) {
      const lines = fn(arch).trim().split('\r\n');
      expect(lines.length).toBeGreaterThan(2);
    }
  });

  it('HTML report is self-contained and covers every section', () => {
    const html = buildHtmlReport(arch, new Date('2026-09-23T12:00:00Z'));
    expect(html).toContain('<!doctype html>');
    expect(html).not.toMatch(/<script|https?:\/\//);
    for (const h of ['1. Missão', '2. Requisitos e VCRM', '3. Árvore de produto', '4. Budgets', '5. Modos', '6. Análise de missão', '7. Interfaces', '8. Riscos', '9. Auditoria']) expect(html).toContain(h);
    expect(html).toContain('Enlace de dados');
    expect(html).toContain('&lt;=');
  });
});

describe('orbit command', () => {
  it('sets altitude, inclination and LTAN on the mission orbit', () => {
    const doc = JSON.parse(JSON.stringify(demo)) as AnyDoc;
    const r = parseCommand('órbita 600 km inclinação 97,8 ltan 10:30', doc);
    expect(r.ok).toBe(true);
    r.mutation!(doc);
    const orbit = (doc.mission as { orbit: Record<string, number> }).orbit;
    expect(orbit.altitudeKm).toBe(600);
    expect(orbit.inclinationDeg).toBe(97.8);
    expect(orbit.ltanHours).toBeCloseTo(10.5, 6);
    const v = validateArchitecture(doc);
    expect(v.ok).toBe(true);
    expect(normalizeArchitecture(v.data!).evaluation.derived['engine.orbit_altitude_km']).toBe(600);
  });

  it('accepts "mudar altitude para 450" and rejects nonsense', () => {
    const doc = JSON.parse(JSON.stringify(demo)) as AnyDoc;
    const r = parseCommand('mudar altitude para 450', doc);
    expect(r.ok).toBe(true);
    r.mutation!(doc);
    expect((doc.mission as { orbit: { altitudeKm: number } }).orbit.altitudeKm).toBe(450);
    expect(parseCommand('órbita', doc).ok).toBe(false);
    expect(parseCommand('órbita 50 km', doc).ok).toBe(false);
  });
});
