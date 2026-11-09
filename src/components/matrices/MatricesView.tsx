import { useMemo, useState } from 'react';
import { useArchitectureStore } from '../../state/architectureStore';
import { computeN2, computeRiskGrid, computeVcrm, type N2Level } from '../../domain/analysis/matrices';
import { N2Matrix } from './N2Matrix';
import { VcrmTable } from './VcrmTable';
import { RiskMatrix } from './RiskMatrix';

type Kind = 'n2' | 'vcrm' | 'risks';

const KINDS: { key: Kind; label: string; hint: string }[] = [
  { key: 'n2', label: 'Matriz N²', hint: 'Interfaces físicas e lógicas entre elementos (linha fornece à coluna)' },
  { key: 'vcrm', label: 'VCRM', hint: 'Requisito × método de verificação × status' },
  { key: 'risks', label: 'Riscos 5×5', hint: 'Probabilidade × impacto' },
];

/**
 * "Matrizes" view: the three tables a systems engineer brings to a review,
 * computed from the same model as the graph.
 */
export function MatricesView() {
  const architecture = useArchitectureStore((s) => s.architecture);
  const kind = useArchitectureStore((s) => s.matrixKind);
  const setKind = useArchitectureStore((s) => s.setMatrixKind);
  const [level, setLevel] = useState<N2Level>('subsystem');
  const n2 = useMemo(() => (architecture ? computeN2(architecture, level) : null), [architecture, level]);
  const vcrm = useMemo(() => (architecture ? computeVcrm(architecture) : null), [architecture]);
  const risks = useMemo(() => (architecture ? computeRiskGrid(architecture) : null), [architecture]);
  if (!architecture || !n2 || !vcrm || !risks) return null;

  return (
    <div className="mx-view">
      <div className="mx-toolbar">
        <div className="segmented" role="tablist" aria-label="Matriz">
          {KINDS.map((k) => (
            <button key={k.key} type="button" role="tab" aria-selected={kind === k.key} className={`segmented__item${kind === k.key ? ' is-on' : ''}`} onClick={() => setKind(k.key)} title={k.hint}>
              {k.label}
            </button>
          ))}
        </div>
        {kind === 'n2' && (
          <div className="segmented" role="group" aria-label="Nível">
            <button type="button" className={`segmented__item${level === 'subsystem' ? ' is-on' : ''}`} aria-pressed={level === 'subsystem'} onClick={() => setLevel('subsystem')}>Subsistemas</button>
            <button type="button" className={`segmented__item${level === 'component' ? ' is-on' : ''}`} aria-pressed={level === 'component'} onClick={() => setLevel('component')}>Subsistemas e componentes</button>
          </div>
        )}
        <span className="support-label mx-toolbar__hint">
          {kind === 'n2' && `${n2.totalInterfaces} interfaces entre ${n2.nodes.length} elementos. A linha fornece à coluna; clique numa célula para selecionar a relação.`}
          {kind === 'vcrm' && `${vcrm.coverage.closed} de ${vcrm.coverage.total} requisitos verificados; ${vcrm.summary.failed} com falha; ${vcrm.summary.none} sem verificação prevista.`}
          {kind === 'risks' && `${risks.risks.length} riscos: ${risks.counts.high} altos, ${risks.counts.medium} médios, ${risks.counts.low} baixos; ${risks.open} abertos.`}
        </span>
      </div>
      <div className="mx-body">
        {kind === 'n2' && <N2Matrix matrix={n2} architecture={architecture} />}
        {kind === 'vcrm' && <VcrmTable vcrm={vcrm} architecture={architecture} />}
        {kind === 'risks' && <RiskMatrix grid={risks} architecture={architecture} />}
      </div>
    </div>
  );
}
