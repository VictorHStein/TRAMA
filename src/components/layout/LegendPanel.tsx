import { useArchitectureStore } from '../../state/architectureStore';

/** Same dash patterns the 2D edges use (relationStyle.ts), so the legend is a true key. */
export const DASH_BY_STYLE: Record<string, string> = { solid: '', dashed: '8 4', dotted: '2 4' };

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d={dir === 'left' ? 'M9 2 4 7l5 5' : 'M5 2l5 5-5 5'} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Left legend: a key for relation numbers/colours and category dots that also
 * filters both views. Collapses into a 56 px rail that keeps the numbered
 * badges and the dots clickable.
 */
export function LegendPanel() {
  const architecture = useArchitectureStore((s) => s.architecture);
  const visibleRelationTypes = useArchitectureStore((s) => s.visibleRelationTypes);
  const visibleCategories = useArchitectureStore((s) => s.visibleCategories);
  const toggleRelationType = useArchitectureStore((s) => s.toggleRelationType);
  const setVisibleRelationTypes = useArchitectureStore((s) => s.setVisibleRelationTypes);
  const toggleCategory = useArchitectureStore((s) => s.toggleCategory);
  const showOnlyCrossCategory = useArchitectureStore((s) => s.showOnlyCrossCategory);
  const toggleCrossCategoryOnly = useArchitectureStore((s) => s.toggleCrossCategoryOnly);
  const collapsed = useArchitectureStore((s) => s.legendCollapsed);
  const toggleCollapsed = useArchitectureStore((s) => s.toggleLegendCollapsed);

  if (!architecture) return null;
  const allOn = architecture.relationTypes.every((rt) => visibleRelationTypes.has(rt.id));

  if (collapsed) {
    return (
      <aside className="legend legend--rail" aria-label="Legenda (recolhida)">
        <button type="button" className="btn btn--icon btn--ghost" onClick={toggleCollapsed} aria-label="Expandir legenda" title="Expandir legenda">
          <Chevron dir="right" />
        </button>
        <div className="legend-rail__group" role="group" aria-label="Tipos de relação">
          {architecture.relationTypes.map((rt) => {
            const on = visibleRelationTypes.has(rt.id);
            return (
              <button
                key={rt.id}
                type="button"
                className={`legend-rail__badge${on ? '' : ' is-off'}`}
                style={{ background: on ? rt.color : 'transparent', borderColor: rt.color, color: on ? 'var(--on-accent)' : rt.color }}
                onClick={() => toggleRelationType(rt.id)}
                aria-pressed={on}
                title={`${rt.index} ${rt.label}`}
              >
                {rt.index}
              </button>
            );
          })}
        </div>
        <div className="legend-rail__group" role="group" aria-label="Categorias">
          {architecture.categories.map((cat) => {
            const on = visibleCategories.has(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                className={`legend-rail__dot${on ? '' : ' is-off'}`}
                style={{ background: on ? cat.color : 'transparent', borderColor: cat.color }}
                onClick={() => toggleCategory(cat.id)}
                aria-pressed={on}
                title={cat.label}
              />
            );
          })}
        </div>
      </aside>
    );
  }

  return (
    <aside className="legend" aria-label="Legenda e filtros">
      <div className="legend__head">
        <h2 className="section-title">Legenda</h2>
        <button type="button" className="btn btn--icon btn--sm btn--ghost" onClick={toggleCollapsed} aria-label="Recolher legenda" title="Recolher legenda">
          <Chevron dir="left" />
        </button>
      </div>
      <p className="support-label">Clique num tipo ou numa categoria para mostrar ou esconder. Cores e números são os mesmos em 2D e 3D.</p>

      <section className="legend__section">
        <div className="legend__section-head">
          <h3 className="section-title">Tipos de relação</h3>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setVisibleRelationTypes(allOn ? [] : architecture.relationTypes.map((r) => r.id))}>
            {allOn ? 'Esconder todos' : 'Mostrar todos'}
          </button>
        </div>
        <ul className="legend__list">
          {architecture.relationTypes.map((rt) => {
            const on = visibleRelationTypes.has(rt.id);
            return (
              <li key={rt.id}>
                <button type="button" className={`legend-row${on ? '' : ' is-off'}`} onClick={() => toggleRelationType(rt.id)} aria-pressed={on} title={rt.description}>
                  <span className="num-badge" style={{ background: on ? rt.color : 'transparent', borderColor: rt.color, color: on ? 'var(--on-accent)' : rt.color }}>{rt.index}</span>
                  <svg className="legend-row__line" width="36" height="10" viewBox="0 0 36 10" aria-hidden="true">
                    <line x1="0" y1="5" x2="30" y2="5" stroke={rt.color} strokeWidth={2} strokeDasharray={DASH_BY_STYLE[rt.lineStyle] ?? ''} />
                    {rt.directed && <polygon points="28,1 36,5 28,9" fill={rt.color} />}
                  </svg>
                  <span className="legend-row__text">
                    <span className="legend-row__label">{rt.label}</span>
                    <span className="legend-row__id mono">{rt.id}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="legend__section">
        <h3 className="section-title">Categorias</h3>
        <div className="legend__cats">
          {architecture.categories.map((cat) => {
            const on = visibleCategories.has(cat.id);
            return (
              <button key={cat.id} type="button" className={`legend-cat${on ? '' : ' is-off'}`} onClick={() => toggleCategory(cat.id)} aria-pressed={on} title={cat.description}>
                <span className="cat-dot" style={{ background: on ? cat.color : 'transparent', boxShadow: `inset 0 0 0 1.5px ${cat.color}` }} />
                {cat.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="legend__section">
        <h3 className="section-title">Filtro</h3>
        <label className="legend-toggle">
          <input type="checkbox" checked={showOnlyCrossCategory} onChange={toggleCrossCategoryOnly} />
          <span>Só relações entre categorias diferentes</span>
        </label>
      </section>
    </aside>
  );
}
