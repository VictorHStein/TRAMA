import { useMemo } from 'react';
import { useArchitectureStore, usedSteps } from '../../state/architectureStore';

const DEFAULT_STEP_LABELS: Record<number, string> = {
  1: 'Missão',
  2: 'Objetivos',
  3: 'Requisitos',
  4: 'Funções',
  5: 'Segmentos',
  6: 'Subsistemas',
  7: 'Componentes',
  8: 'Interfaces',
  9: 'Rastreabilidade',
  10: 'Verificações',
};

/**
 * Bottom timeline. Always shows the 10 canonical steps in order; steps that
 * introduce nothing in this architecture stay visible but disabled, so the
 * sequence never looks like it has holes. ‹ › jump over them (store).
 */
export function BottomTimeline() {
  const architecture = useArchitectureStore((s) => s.architecture);
  const currentStep = useArchitectureStore((s) => s.currentStep);
  const explorationMode = useArchitectureStore((s) => s.explorationMode);
  const setStep = useArchitectureStore((s) => s.setStep);
  const next = useArchitectureStore((s) => s.nextStep);
  const prev = useArchitectureStore((s) => s.previousStep);
  const setExplorationMode = useArchitectureStore((s) => s.setExplorationMode);

  const used = useMemo(() => new Set(architecture ? usedSteps(architecture) : []), [architecture]);
  if (!architecture || used.size === 0) return null;

  const maxStep = Math.max(10, architecture.maxStep);
  const steps = Array.from({ length: maxStep }, (_, i) => i + 1);
  const usedList = [...used].sort((a, b) => a - b);
  const stepMode = explorationMode === 'step';

  return (
    <div className="timeline">
      <div className="segmented" role="tablist" aria-label="Modo de exploração">
        <button type="button" role="tab" aria-selected={!stepMode} className={`segmented__item${!stepMode ? ' is-on' : ''}`} onClick={() => setExplorationMode('all')}>
          Mostrar tudo
        </button>
        <button type="button" role="tab" aria-selected={stepMode} className={`segmented__item${stepMode ? ' is-on' : ''}`} onClick={() => setExplorationMode('step')}>
          Por etapas
        </button>
      </div>

      <div className={`timeline__track${stepMode ? '' : ' is-idle'}`}>
        <button type="button" className="btn btn--icon btn--sm btn--ghost" onClick={prev} disabled={!stepMode || currentStep <= usedList[0]} aria-label="Etapa anterior" title="Etapa anterior">
          ‹
        </button>
        <ol className="timeline__steps">
          {steps.map((s) => {
            const has = used.has(s);
            const reached = stepMode && s <= currentStep;
            const current = stepMode && s === currentStep;
            const label = DEFAULT_STEP_LABELS[s] ?? `Etapa ${s}`;
            return (
              <li key={s} className="timeline__item">
                <button
                  type="button"
                  className={`timeline__step${current ? ' is-current' : ''}${reached ? ' is-reached' : ''}${has ? '' : ' is-empty'}`}
                  onClick={() => { setExplorationMode('step'); setStep(s); }}
                  disabled={!has}
                  aria-current={current ? 'step' : undefined}
                  title={has ? `${s}. ${label}` : `${s}. ${label} — nenhum elemento nesta etapa`}
                >
                  <span className="timeline__n">{s}</span>
                  <span className="timeline__label">{label}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <button type="button" className="btn btn--icon btn--sm btn--ghost" onClick={next} disabled={!stepMode || currentStep >= usedList[usedList.length - 1]} aria-label="Próxima etapa" title="Próxima etapa">
          ›
        </button>
      </div>

      <span className="timeline__hint support-label">
        {stepMode ? `Etapa ${currentStep} de ${usedList[usedList.length - 1]}` : 'Missão → requisitos → funções → subsistemas → componentes → interfaces → verificação'}
      </span>
    </div>
  );
}
