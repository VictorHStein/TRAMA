import { useArchitectureStore, type ViewMode } from '../../state/architectureStore';

const MODES: { key: ViewMode; label: string; hint: string }[] = [
  { key: 'home', label: 'Projeto', hint: 'O projeto fecha? Estado da rastreabilidade, budgets e missão' },
  { key: '2d', label: 'Grafo 2D', hint: 'Diagrama por camadas com relações numeradas e códigos PBS' },
  { key: '3d', label: 'Cena 3D', hint: 'Arquitetura em anéis, com tubos por tipo de relação' },
  { key: 'split', label: 'Lado a lado', hint: '2D e 3D ao mesmo tempo' },
  { key: 'matrices', label: 'Matrizes', hint: 'Matriz N² de interfaces, VCRM e riscos 5×5' },
  { key: 'tutorial', label: 'Construtor', hint: 'Monte o JSON com comandos, voz ou listas' },
];

export function ViewModeTabs() {
  const viewMode = useArchitectureStore((s) => s.viewMode);
  const setViewMode = useArchitectureStore((s) => s.setViewMode);
  return (
    <div className="segmented" role="tablist" aria-label="Vista">
      {MODES.map((m) => (
        <button
          key={m.key}
          type="button"
          role="tab"
          aria-selected={viewMode === m.key}
          className={`segmented__item${viewMode === m.key ? ' is-on' : ''}`}
          onClick={() => setViewMode(m.key)}
          title={m.hint}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
