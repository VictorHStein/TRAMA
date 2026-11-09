import { useArchitectureStore } from '../../state/architectureStore';
import type { NormalizedArchitecture } from '../../domain/model/ArchitectureTypes';
import { VCRM_METHODS, type Vcrm, type VcrmStatus } from '../../domain/analysis/matrices';
import { METHOD_SHORT, REQ_PRIORITY_LABEL, REQ_TYPE_LABEL, levelLabel, methodLabel } from '../../lib/labels';

const STATUS_LABEL: Record<VcrmStatus, string> = { verified: 'verificado', failed: 'falhou', in_progress: 'em andamento', planned: 'planejado', none: 'sem verificação' };
const STATUS_TONE: Record<VcrmStatus, string> = { verified: 'ok', failed: 'fail', in_progress: 'info', planned: 'neutral', none: 'warn' };
const ENTRY_LABEL: Record<string, string> = { planned: 'planejado', in_progress: 'em andamento', passed: 'aprovado', failed: 'falhou', verified: 'verificado', waived: 'dispensado' };
const ENTRY_TONE: Record<string, string> = { planned: 'neutral', in_progress: 'info', passed: 'ok', failed: 'fail', verified: 'ok', waived: 'neutral' };
const RULE_LABEL = { pass: 'atende', fail: 'viola', error: 'erro', unknown: '—' } as const;
const RULE_TONE = { pass: 'ok', fail: 'fail', error: 'warn', unknown: 'neutral' } as const;

export function VcrmTable({ vcrm, architecture }: { vcrm: Vcrm; architecture: NormalizedArchitecture }) {
  const selectEntity = useArchitectureStore((s) => s.selectEntity);
  const selectedEntityId = useArchitectureStore((s) => s.selectedEntityId);
  const name = (id: string) => architecture.entitiesById[id]?.short ?? architecture.entitiesById[id]?.name ?? id;
  if (vcrm.rows.length === 0) return <p className="sp-empty">Nenhum requisito no modelo.</p>;

  return (
    <div className="vcrm-wrap">
      <table className="vcrm" aria-label="Matriz de referência cruzada de verificação">
        <thead>
          <tr>
            <th>Requisito</th>
            <th>Regra</th>
            {VCRM_METHODS.map((m) => <th key={m} className="vcrm__m" title={methodLabel(m)}><abbr title={methodLabel(m)}>{METHOD_SHORT[m]}</abbr></th>)}
            <th>Itens verificados</th>
            <th>Verificações</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {vcrm.rows.map((r) => (
            <tr key={r.requirementId} className={selectedEntityId === r.requirementId ? 'is-selected' : ''}>
              <td className="vcrm__req">
                <button type="button" className="vcrm__link" onClick={() => selectEntity(r.requirementId)}>
                  <span className="mono support-label">{r.code}</span> <strong>{r.name}</strong>
                </button>
                {r.text && <div className="vcrm__text">{r.text}</div>}
                <div className="support-label">{[r.type && (REQ_TYPE_LABEL[r.type] ?? r.type), r.priority && (REQ_PRIORITY_LABEL[r.priority] ?? r.priority), r.level ? `nível ${levelLabel(r.level)}` : null].filter(Boolean).join(', ')}</div>
              </td>
              <td className="vcrm__rule">
                {r.rule ? (
                  <>
                    <span className={`chip chip--${RULE_TONE[r.rule.result]}`}><span className="chip__dot" />{RULE_LABEL[r.rule.result]}</span>
                    <div className="mono support-label vcrm__expr">{r.rule.expression}</div>
                  </>
                ) : <span className="support-label">—</span>}
              </td>
              {VCRM_METHODS.map((m) => {
                const entries = r.byMethod[m];
                const planned = r.plannedMethod === m && entries.length === 0;
                return (
                  <td key={m} className="vcrm__m">
                    {entries.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        className={`vcrm__mark vcrm__mark--${ENTRY_TONE[e.status] ?? 'neutral'}`}
                        title={`${e.id}: ${ENTRY_LABEL[e.status] ?? e.status}${e.description ? ` — ${e.description}` : ''}${e.evidence ? ` (evidência: ${e.evidence})` : ''}`}
                        aria-label={`${methodLabel(m)} ${ENTRY_LABEL[e.status] ?? e.status}`}
                        onClick={() => selectEntity(e.verifierId ?? e.itemId ?? r.requirementId)}
                      />
                    ))}
                    {planned && <span className="vcrm__mark vcrm__mark--planned" title="método previsto no requisito, sem entrada de verificação" aria-label={`${methodLabel(m)} previsto`} />}
                  </td>
                );
              })}
              <td>
                {r.itemIds.map((id) => <button key={id} type="button" className="vcrm__link" onClick={() => selectEntity(id)}>{name(id)}</button>)}
              </td>
              <td>
                {r.verifierIds.map((id) => <button key={id} type="button" className="vcrm__link" onClick={() => selectEntity(id)}>{name(id)}</button>)}
                {r.entries.filter((e) => !e.verifierId).map((e) => <span key={e.id} className="support-label">{e.description ?? e.id}</span>)}
              </td>
              <td><span className={`chip chip--${STATUS_TONE[r.status]}`}><span className="chip__dot" />{STATUS_LABEL[r.status]}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="support-label vcrm__legend">
        <span className="vcrm__mark vcrm__mark--ok" /> aprovado ou verificado
        <span className="vcrm__mark vcrm__mark--info" /> em andamento
        <span className="vcrm__mark vcrm__mark--neutral" /> planejado
        <span className="vcrm__mark vcrm__mark--fail" /> falhou
        <span className="vcrm__mark vcrm__mark--planned" /> método previsto sem entrada.
        Colunas: E ensaio, A análise, I inspeção, R revisão de projeto, D demonstração, Regra paramétrica.
      </p>
    </div>
  );
}
