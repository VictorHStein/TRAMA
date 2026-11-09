import { useEffect, useRef, useState } from 'react';
import { useArchitectureStore } from '../../state/architectureStore';
import { TEMPLATES } from '../../data/templates';

/** "Modelos" menu in the top bar: the demo and the starter templates. */
export function TemplateMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const loadArchitectureFromJson = useArchitectureStore((s) => s.loadArchitectureFromJson);
  const resetToDemo = useArchitectureStore((s) => s.resetToDemo);
  const jsonSourceName = useArchitectureStore((s) => s.jsonSourceName);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className="export" ref={ref}>
      <button type="button" className="btn btn--ghost" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Modelos
      </button>
      {open && (
        <div className="export__menu" role="menu" aria-label="Modelos de partida">
          <button type="button" role="menuitem" className={`export__item${jsonSourceName === 'demoArchitecture.json' ? ' is-on' : ''}`} onClick={() => { resetToDemo(); setOpen(false); }}>
            <span className="export__label">DemoSat-TG</span>
            <span className="export__hint">observação da Terra, 30 kg, 600 km SSO (demo)</span>
          </button>
          {TEMPLATES.map((t) => (
            <button key={t.id} type="button" role="menuitem" className={`export__item${jsonSourceName === t.fileName ? ' is-on' : ''}`} onClick={() => { loadArchitectureFromJson(t.data, t.fileName); setOpen(false); }}>
              <span className="export__label">{t.name}</span>
              <span className="export__hint">{t.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
