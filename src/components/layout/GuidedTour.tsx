import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useArchitectureStore, type SceneMode, type ViewMode } from '../../state/architectureStore';
import { markTourDone } from '../../lib/tour';

interface TourStep {
  view: ViewMode;
  /** CSS selector of the element to highlight; the card centres itself when it is missing. */
  target: string;
  title: string;
  text: string;
  sceneMode?: SceneMode;
  /** Entity to select before showing the step (the inspector step). */
  select?: string;
}

const STEPS: TourStep[] = [
  {
    view: 'home', target: '.checklist', title: 'O projeto fecha?',
    text: 'A tela inicial responde à pergunta de uma revisão de projeto: massa, energia, enlace, dados, vida orbital e temperatura, cada linha com o número e o estado. Clique numa linha para ver a conta.',
  },
  {
    view: 'home', target: '.trama', title: 'A cadeia de rastreabilidade',
    text: 'Da missão à verificação, cada elo mostra quantos elementos existem e se está em dia. Tudo nesta tela sai de um único arquivo JSON.',
  },
  {
    view: '2d', target: '.flow2d-canvas', title: 'O grafo da arquitetura',
    text: 'As mesmas entidades em camadas, uma por categoria. A cor e o número de cada ligação são os da legenda; as lentes no alto separam rastreabilidade e interfaces.',
  },
  {
    view: '2d', target: '.timeline', title: 'Montagem por etapas',
    text: 'Em "Por etapas", a arquitetura aparece camada por camada, da missão às verificações, como numa apresentação de revisão.',
  },
  {
    view: '2d', target: '.side-panel', select: 'req_power', title: 'O inspetor',
    text: 'Cada elemento diz de onde vem, a que se liga, que requisito atende e como será verificado. Mude um parâmetro e a onda de impacto mostra o que foi afetado; Ctrl+Z desfaz.',
  },
  {
    view: '3d', sceneMode: 'physical', target: '.scene3d-shell', title: 'O satélite em órbita',
    text: 'Órbita, Sol, eclipse e estação vêm da mesma análise de missão. Os modos e a bateria seguem os eventos da simulação, e o grafo apaga o que está desligado no modo atual.',
  },
  {
    view: '3d', target: '.entity-search', title: 'Paleta de comandos',
    text: 'Ctrl+K busca qualquer elemento, troca de vista ou executa um comando do Construtor, como "órbita 650 km". O tour pode ser refeito por ela.',
  },
];

interface Box { left: number; top: number; width: number; height: number }

const CARD_W = 340;
const GAP = 12;

/**
 * One-minute first-run tour. A spotlight frames one part of the interface at
 * a time and a small card explains it; the steps switch the view when needed.
 * No animation: the card simply moves, as the motion rules ask for keyboard
 * navigation.
 */
export function GuidedTour() {
  const open = useArchitectureStore((s) => s.tourOpen);
  const setTourOpen = useArchitectureStore((s) => s.setTourOpen);
  const architecture = useArchitectureStore((s) => s.architecture);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const nextRef = useRef<HTMLButtonElement | null>(null);
  const step = STEPS[index];

  const close = useCallback(() => {
    markTourDone();
    setTourOpen(false);
    setIndex(0);
  }, [setTourOpen]);

  // Put the interface in the state the step talks about.
  useEffect(() => {
    if (!open || !step) return;
    const st = useArchitectureStore.getState();
    if (st.viewMode !== step.view) st.setViewMode(step.view);
    if (step.sceneMode && st.sceneMode !== step.sceneMode) st.setSceneMode(step.sceneMode);
    if (step.select && architecture?.entitiesById[step.select]) st.selectEntity(step.select);
  }, [open, step, architecture]);

  // Measure the target after the view has rendered, and again on resize.
  useLayoutEffect(() => {
    if (!open || !step) return;
    let raf = 0;
    const measure = () => {
      const el = document.querySelector(step.target);
      if (!el) { setBox(null); return; }
      el.scrollIntoView({ block: 'nearest' });
      const r = el.getBoundingClientRect();
      setBox({ left: r.left, top: r.top, width: r.width, height: r.height });
    };
    const settle = window.setTimeout(() => { raf = requestAnimationFrame(measure); }, 120);
    window.addEventListener('resize', measure);
    return () => { window.clearTimeout(settle); cancelAnimationFrame(raf); window.removeEventListener('resize', measure); };
  }, [open, step]);

  useEffect(() => { if (open) nextRef.current?.focus(); }, [open, index]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setIndex((i) => Math.min(STEPS.length - 1, i + 1)); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open || !step || !architecture) return null;

  const last = index === STEPS.length - 1;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Card below the target when it fits, else above, else centred; always inside the viewport.
  let cardLeft = (vw - CARD_W) / 2;
  let cardTop = vh / 2 - 100;
  if (box) {
    cardLeft = Math.min(Math.max(16, box.left + box.width / 2 - CARD_W / 2), vw - CARD_W - 16);
    const below = box.top + box.height + GAP;
    const roomBelow = vh - below;
    if (roomBelow > 220) cardTop = below;
    else if (box.top > 240) cardTop = box.top - GAP - 200;
    else cardTop = Math.min(Math.max(16, box.top + 24), vh - 236);
  }

  return (
    <div className="tour" role="presentation">
      {box
        ? <div className="tour__spot" style={{ left: box.left - 4, top: box.top - 4, width: box.width + 8, height: box.height + 8 }} aria-hidden="true" />
        : <div className="tour__dim" aria-hidden="true" />}
      <div className="tour__card" role="dialog" aria-modal="false" aria-labelledby="tour-title" aria-describedby="tour-text" style={{ left: cardLeft, top: cardTop, width: CARD_W }}>
        <p className="tour__count support-label">Passo {index + 1} de {STEPS.length}</p>
        <h2 id="tour-title" className="tour__title">{step.title}</h2>
        <p id="tour-text" className="tour__text">{step.text}</p>
        <div className="tour__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={close}>Pular o tour</button>
          <span className="tour__spacer" />
          {index > 0 && <button type="button" className="btn btn--secondary btn--sm" onClick={() => setIndex(index - 1)}>Anterior</button>}
          <button ref={nextRef} type="button" className="btn btn--primary btn--sm" onClick={() => (last ? close() : setIndex(index + 1))}>
            {last ? 'Concluir' : 'Próximo'}
          </button>
        </div>
      </div>
    </div>
  );
}
