import { useMemo } from 'react';
import { useArchitectureStore } from '../../state/architectureStore';
import { auditArchitecture, type AuditItem } from '../../domain/analysis/audit';
import type { NormalizedArchitecture } from '../../domain/model/ArchitectureTypes';
import type { EvaluatedBudget } from '../../domain/engine/evaluate';
import { fmtNum, fmtPct, fmtQty, fmtPctFine } from '../../lib/format';

/**
 * "Análise" tab of the inspector: what a systems engineer checks before a
 * review — coverage, gaps, budgets with margins, operational modes and the
 * status of every parametric requirement rule. Everything comes from the
 * engine result on the normalized architecture, so it is always consistent
 * with the graph.
 */
export function AnalysisPanel() {
  const architecture = useArchitectureStore((s) => s.architecture);
  const selectEntity = useArchitectureStore((s) => s.selectEntity);
  const selectedEntityId = useArchitectureStore((s) => s.selectedEntityId);
  const report = useMemo(() => (architecture ? auditArchitecture(architecture) : null), [architecture]);
  if (!architecture || !report) return null;
  const ev = architecture.evaluation;

  return (
    <div className="sp-stack">
      <CoverageGrid report={report} />
      <AuditList items={report.items} architecture={architecture} onSelect={selectEntity} />
      {ev.budgets.length > 0 && (
        <section className="sp-section">
          <h3 className="section-title">Budgets</h3>
          <div className="sp-stack sp-stack--tight">
            {ev.budgets.map((b) => (
              <BudgetCard key={b.id} budget={b} architecture={architecture} onSelect={selectEntity} selectedId={selectedEntityId} />
            ))}
          </div>
        </section>
      )}
      {ev.modes.length > 0 && <ModesTable architecture={architecture} />}
      {Object.keys(ev.rules).length > 0 && <RulesList architecture={architecture} onSelect={selectEntity} />}
    </div>
  );
}

/* ── Coverage ─────────────────────────────────────────────── */

function CoverageGrid({ report }: { report: ReturnType<typeof auditArchitecture> }) {
  const c = report.coverage;
  const cells: { label: string; m: { covered: number; total: number } }[] = [
    { label: 'Requisitos alocados', m: c.requirementsAllocated },
    { label: 'Requisitos com verificação', m: c.requirementsVerified },
    { label: 'Regras passando', m: c.rulesPassing },
    { label: 'Funções alocadas', m: c.functionsAllocated },
    { label: 'Físicos com interface', m: c.physicalWithInterface },
    { label: 'Budgets dentro da alocação', m: c.budgetsWithinAllocation },
  ];
  return (
    <section className="sp-section">
      <h3 className="section-title">Cobertura</h3>
      <div className="sp-metrics">
        {cells.map(({ label, m }) => {
          const tone = m.total === 0 ? 'neutral' : m.covered === m.total ? 'ok' : m.covered === 0 ? 'fail' : 'warn';
          return (
            <div key={label} className={`sp-metric sp-metric--${tone}`}>
              <span className="sp-metric__value mono">{m.covered}<span className="sp-metric__of"> / {m.total}</span></span>
              <span className="sp-metric__label">{label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── Audit ────────────────────────────────────────────────── */

const SEV_ORDER = { error: 0, warning: 1, info: 2 } as const;
const countLabel = (errors: number, warnings: number) =>
  `${errors} ${errors === 1 ? 'erro' : 'erros'}, ${warnings} ${warnings === 1 ? 'aviso' : 'avisos'}`;
const SEV_LABEL = { error: 'Erro', warning: 'Atenção', info: 'Nota' } as const;

function AuditList({ items, architecture, onSelect }: { items: AuditItem[]; architecture: NormalizedArchitecture; onSelect: (id: string) => void }) {
  const sorted = [...items].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
  return (
    <section className="sp-section">
      <div className="sp-section__head">
        <h3 className="section-title">Auditoria</h3>
        <span className="support-label">
          {items.length === 0 ? 'nenhuma lacuna' : countLabel(items.filter((i) => i.severity === 'error').length, items.filter((i) => i.severity === 'warning').length)}
        </span>
      </div>
      {sorted.length === 0 ? (
        <p className="sp-empty">Nenhuma lacuna encontrada. Requisitos alocados e verificados, budgets dentro da alocação.</p>
      ) : (
        <ul className="sp-list">
          {sorted.map((it) => {
            const target = it.entityIds.find((id) => architecture.entitiesById[id]);
            const tone = it.severity === 'error' ? 'fail' : it.severity === 'warning' ? 'warn' : 'info';
            return (
              <li key={it.id}>
                <button
                  type="button"
                  className="sp-row sp-row--audit"
                  onClick={() => target && onSelect(target)}
                  disabled={!target}
                >
                  <span className={`chip chip--${tone}`}><span className="chip__dot" />{SEV_LABEL[it.severity]}</span>
                  <span className="sp-row__body">
                    <span className="sp-row__text">{it.message}</span>
                    {it.fix && <span className="support-label">{it.fix}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ── Budgets ──────────────────────────────────────────────── */

const BUDGET_TONE: Record<EvaluatedBudget['status'], 'ok' | 'warn' | 'fail' | 'neutral'> = {
  ok: 'ok', warning: 'warn', critical: 'warn', over: 'fail', unknown: 'neutral',
};
const BUDGET_LABEL: Record<EvaluatedBudget['status'], string> = {
  ok: 'dentro da alocação', warning: 'margem apertada', critical: 'margem crítica', over: 'acima da alocação', unknown: 'sem alocação',
};

export function BudgetCard({
  budget, architecture, onSelect, selectedId,
}: { budget: EvaluatedBudget; architecture: NormalizedArchitecture; onSelect: (id: string) => void; selectedId: string | null }) {
  const b = budget;
  const scale = b.allocated ?? b.total ?? 1;
  const w = (v: number | null) => `${Math.max(0, Math.min(100, ((v ?? 0) / scale) * 100))}%`;
  const nominal = b.nominal ?? 0;
  const items = (b.withItemMargins ?? nominal) - nominal;
  const system = (b.total ?? b.withItemMargins ?? nominal) - (b.withItemMargins ?? nominal);
  const sorted = [...b.rows].sort((x, y) => (y.value ?? 0) - (x.value ?? 0));
  return (
    <div className="sp-budget">
      <div className="sp-budget__head">
        <span className="sp-budget__label">{b.label}</span>
        <span className={`chip chip--${BUDGET_TONE[b.status]}`}><span className="chip__dot" />{BUDGET_LABEL[b.status]}</span>
      </div>
      <div className="sp-budget__numbers mono">
        <span>{fmtQty(b.total, b.unit, 1)}</span>
        {b.allocated !== undefined && <span className="support-label"> de {fmtQty(b.allocated, b.unit, 1)} alocados, {fmtPct(b.marginRemainingFraction)} restante</span>}
      </div>
      <div className="sp-budget__bar" role="img" aria-label={`${b.label}: ${fmtQty(b.total, b.unit)} de ${fmtQty(b.allocated ?? b.total, b.unit)}`}>
        <span className="sp-budget__seg sp-budget__seg--nominal" style={{ width: w(nominal) }} title={`Nominal ${fmtQty(nominal, b.unit)}`} />
        <span className="sp-budget__seg sp-budget__seg--items" style={{ width: w(items) }} title={`Margens de maturidade ${fmtQty(items, b.unit)}`} />
        <span className="sp-budget__seg sp-budget__seg--system" style={{ width: w(system) }} title={`Margem de sistema ${fmtQty(system, b.unit)}`} />
      </div>
      <div className="sp-budget__legend support-label">
        <span><i className="sp-swatch sp-swatch--nominal" />nominal {fmtNum(nominal, 1)}</span>
        <span><i className="sp-swatch sp-swatch--items" />maturidade +{fmtNum(items, 1)}</span>
        {b.systemMarginFraction > 0 && <span><i className="sp-swatch sp-swatch--system" />sistema +{fmtNum(system, 1)}</span>}
      </div>
      <ul className="sp-list sp-list--compact">
        {sorted.map((r) => {
          const e = architecture.entitiesById[r.entityId];
          return (
            <li key={r.entityId}>
              <button type="button" className={`sp-row sp-row--budget${selectedId === r.entityId ? ' is-selected' : ''}`} onClick={() => onSelect(r.entityId)}>
                <span className="sp-row__text">{e?.short ? `${e.short}: ` : ''}{e?.name ?? r.entityId}</span>
                <span className="mono sp-row__num">{fmtNum(r.value, 1)}</span>
                <span className="mono sp-row__num support-label">{r.marginFraction > 0 ? `+${fmtPct(r.marginFraction)}` : ''}</span>
                <span className="mono sp-row__num">{fmtNum(r.valueWithMargin, 1)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── Modes ────────────────────────────────────────────────── */

function ModesTable({ architecture }: { architecture: NormalizedArchitecture }) {
  const ev = architecture.evaluation;
  const gen = ev.params[`${architecture.entities.find((e) => e.category === 'mission')?.id}.generation_avg`]?.value ?? null;
  const avg = ev.orbitAveragePowerW;
  const marginFrac = gen !== null && avg !== null && gen > 0 ? (gen - avg) / gen : null;
  const tone = marginFrac === null ? 'neutral' : marginFrac < 0 ? 'fail' : marginFrac < 0.1 ? 'warn' : 'ok';
  return (
    <section className="sp-section">
      <h3 className="section-title">Modos operacionais</h3>
      <table className="sp-table">
        <thead>
          <tr><th>Modo</th><th className="num">fração da órbita</th><th className="num">consumo</th></tr>
        </thead>
        <tbody>
          {ev.modes.map((m) => (
            <tr key={m.id}>
              <td>{m.name}</td>
              <td className="num mono">{m.durationFraction !== undefined ? fmtPctFine(m.durationFraction) : '—'}</td>
              <td className="num mono">{fmtQty(m.totalW, 'W')}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Média por órbita</td>
            <td />
            <td className="num mono">{fmtQty(avg, 'W', 1)}</td>
          </tr>
          {gen !== null && (
            <tr>
              <td title="Com o eclipse de pior caso geométrico (β = 0), o mesmo das frações dos modos; a aba Missão usa o eclipse máximo do ano">Geração média com β = 0</td>
              <td><span className={`chip chip--${tone}`}><span className="chip__dot" />{marginFrac === null ? '—' : `${fmtPct(marginFrac)} de margem`}</span></td>
              <td className="num mono">{fmtQty(gen, 'W', 1)}</td>
            </tr>
          )}
        </tfoot>
      </table>
    </section>
  );
}

/* ── Rules ────────────────────────────────────────────────── */

const RULE_TONE = { pass: 'ok', fail: 'fail', error: 'warn', unknown: 'neutral' } as const;
const RULE_LABEL = { pass: 'atende', fail: 'viola', error: 'erro', unknown: '—' } as const;

function RulesList({ architecture, onSelect }: { architecture: NormalizedArchitecture; onSelect: (id: string) => void }) {
  const rules = Object.values(architecture.evaluation.rules);
  return (
    <section className="sp-section">
      <h3 className="section-title">Requisitos verificados por regra</h3>
      <ul className="sp-list">
        {rules.map((r) => {
          const e = architecture.entitiesById[r.entityId];
          return (
            <li key={r.entityId}>
              <button type="button" className="sp-row sp-row--rule" onClick={() => onSelect(r.entityId)}>
                <span className={`chip chip--${RULE_TONE[r.result]}`}><span className="chip__dot" />{RULE_LABEL[r.result]}</span>
                <span className="sp-row__body">
                  <span className="sp-row__text"><span className="mono">{architecture.breakdownCodes[r.entityId]}</span> {e?.name}</span>
                  <span className="mono support-label">{r.expression}</span>
                  {r.error && <span className="support-label sp-error">{r.error}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
