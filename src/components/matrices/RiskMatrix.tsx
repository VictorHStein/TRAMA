import { useArchitectureStore } from '../../state/architectureStore';
import type { NormalizedArchitecture } from '../../domain/model/ArchitectureTypes';
import { riskBand, type RiskGrid } from '../../domain/analysis/matrices';
import { RISK_CATEGORY_LABEL } from '../../lib/labels';

const STATUS_LABEL: Record<string, string> = { open: 'aberto', mitigated: 'mitigado', accepted: 'aceito', closed: 'fechado' };
const STATUS_TONE: Record<string, string> = { open: 'fail', mitigated: 'ok', accepted: 'warn', closed: 'neutral' };
const BAND_LABEL = { low: 'baixo', medium: 'médio', high: 'alto' } as const;
const LEVELS = [5, 4, 3, 2, 1];

export function RiskMatrix({ grid, architecture }: { grid: RiskGrid; architecture: NormalizedArchitecture }) {
  const selectEntity = useArchitectureStore((s) => s.selectEntity);
  const name = (id: string) => architecture.entitiesById[id]?.short ?? architecture.entitiesById[id]?.name ?? id;
  const index = new Map(grid.risks.map((r, i) => [r.id, i + 1]));

  return (
    <div className="rk">
      <div className="rk-grid-wrap">
        <div className="rk-axis rk-axis--y"><span>Probabilidade</span></div>
        <table className="rk-grid" aria-label="Matriz de riscos probabilidade por impacto">
          <tbody>
            {LEVELS.map((p) => (
              <tr key={p}>
                <th scope="row" className="mono">{p}</th>
                {[1, 2, 3, 4, 5].map((i) => {
                  const band = riskBand(p, i);
                  const cellRisks = grid.cells[`${p}-${i}`] ?? [];
                  return (
                    <td key={i} className={`rk-cell rk-cell--${band}`} title={`P ${p} × I ${i} = ${p * i} (${BAND_LABEL[band]})`}>
                      {cellRisks.map((r) => (
                        <button key={r.id} type="button" className="rk-chip" title={r.title} onClick={() => r.entityIds?.[0] && selectEntity(r.entityIds[0])}>
                          {index.get(r.id)}
                        </button>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <th />
              {[1, 2, 3, 4, 5].map((i) => <th key={i} className="mono">{i}</th>)}
            </tr>
          </tbody>
        </table>
        <div className="rk-axis rk-axis--x"><span>Impacto</span></div>
      </div>
      {grid.risks.length === 0 ? (
        <p className="sp-empty">Nenhum risco declarado. Adicione entradas em "risks" com probabilidade e impacto de 1 a 5.</p>
      ) : (
        <table className="sp-table rk-list" aria-label="Lista de riscos">
          <thead>
            <tr><th>#</th><th>Risco</th><th className="num">P × I</th><th>Faixa</th><th>Status</th><th>Elementos</th><th>Mitigação</th><th>Responsável</th></tr>
          </thead>
          <tbody>
            {grid.risks.map((r) => (
              <tr key={r.id}>
                <td className="mono">{index.get(r.id)}</td>
                <td><strong>{r.title}</strong>{r.category && <div className="support-label">{RISK_CATEGORY_LABEL[r.category] ?? r.category}</div>}</td>
                <td className="num mono">{r.probability} × {r.impact} = {r.score}</td>
                <td><span className={`chip chip--${r.band === 'high' ? 'fail' : r.band === 'medium' ? 'warn' : 'ok'}`}><span className="chip__dot" />{BAND_LABEL[r.band]}</span></td>
                <td><span className={`chip chip--${STATUS_TONE[r.status] ?? 'neutral'}`}><span className="chip__dot" />{STATUS_LABEL[r.status] ?? r.status}</span></td>
                <td>{(r.entityIds ?? []).map((id) => <button key={id} type="button" className="vcrm__link" onClick={() => selectEntity(id)}>{name(id)}</button>)}</td>
                <td className="rk-list__text">{r.mitigation || <span className="support-label">sem mitigação</span>}</td>
                <td>{r.owner ?? <span className="support-label">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
