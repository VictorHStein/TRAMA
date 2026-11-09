import { useArchitectureStore } from '../../state/architectureStore';
import type { NormalizedArchitecture } from '../../domain/model/ArchitectureTypes';
import type { N2Matrix as N2 } from '../../domain/analysis/matrices';

export function N2Matrix({ matrix, architecture }: { matrix: N2; architecture: NormalizedArchitecture }) {
  const selectEntity = useArchitectureStore((s) => s.selectEntity);
  const selectRelation = useArchitectureStore((s) => s.selectRelation);
  const selectedEntityId = useArchitectureStore((s) => s.selectedEntityId);
  const selectedRelationId = useArchitectureStore((s) => s.selectedRelationId);
  const nodes = matrix.nodes;
  const code = (id: string) => architecture.breakdownCodes[id] ?? '';
  const short = (id: string) => architecture.entitiesById[id]?.short ?? architecture.entitiesById[id]?.name ?? id;

  if (nodes.length === 0) return <p className="sp-empty">Nenhum subsistema ou componente no modelo.</p>;

  return (
    <div className="n2-wrap">
      <table className="n2" aria-label="Matriz N² de interfaces">
        <thead>
          <tr>
            <th className="n2__corner"><span>de ↓ para →</span></th>
            {nodes.map((n) => (
              <th key={n.id} className={`n2__col${selectedEntityId === n.id ? ' is-selected' : ''}`} scope="col">
                <button type="button" className="n2__head" onClick={() => selectEntity(n.id)} title={architecture.entitiesById[n.id]?.name}>
                  <span className="n2__code mono">{code(n.id)}</span>
                  <span className="n2__short">{short(n.id)}</span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {nodes.map((row) => (
            <tr key={row.id} className={selectedEntityId === row.id ? 'is-selected' : ''}>
              <th scope="row" className="n2__row">
                <button type="button" className="n2__head n2__head--row" onClick={() => selectEntity(row.id)} title={architecture.entitiesById[row.id]?.name}>
                  <span className="n2__code mono">{code(row.id)}</span>
                  <span className="n2__short">{short(row.id)}</span>
                </button>
              </th>
              {nodes.map((col) => {
                if (col.id === row.id) return <td key={col.id} className="n2__diag" aria-label={short(row.id)}><span className="mono">{code(row.id)}</span></td>;
                const cell = matrix.cells[`${row.id}|${col.id}`];
                if (!cell) return <td key={col.id} className="n2__empty" />;
                return (
                  <td key={col.id} className="n2__cell">
                    {cell.relations.map((r) => {
                      const t = architecture.relationTypesById[r.type];
                      return (
                        <button
                          key={r.id}
                          type="button"
                          className={`n2__dot${selectedRelationId === r.id ? ' is-selected' : ''}`}
                          style={{ background: t?.color ?? 'var(--ink-3)' }}
                          title={`${t?.label ?? r.type}: ${short(r.source)} → ${short(r.target)}${r.label ? ` (${r.label})` : ''}`}
                          aria-label={`${t?.label ?? r.type} de ${short(r.source)} para ${short(r.target)}`}
                          onClick={() => selectRelation(r.id)}
                        >
                          {t?.index ?? ''}
                        </button>
                      );
                    })}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="n2-legend">
        {architecture.relationTypes.filter((t) => matrix.countByType[t.id]).map((t) => (
          <span key={t.id} className="n2-legend__item"><i className="n2__dot n2__dot--static" style={{ background: t.color }}>{t.index}</i>{t.label} <span className="support-label">{matrix.countByType[t.id]}</span></span>
        ))}
      </div>
    </div>
  );
}
