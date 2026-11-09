import { useEffect, useRef, useState } from 'react';
import { useArchitectureStore } from '../../state/architectureStore';
import { budgetsCsv, interfacesCsv, parametersCsv, requirementsCsv } from '../../domain/export/csv';
import { buildHtmlReport } from '../../domain/export/report';
import { downloadText, fileSlug, toInputDocument } from '../../lib/download';

/** "Exportar" menu in the top bar: JSON, printable HTML report and CSV tables. */
export function ExportMenu() {
  const architecture = useArchitectureStore((s) => s.architecture);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);

  if (!architecture) return null;
  const base = fileSlug(architecture.metadata.projectName);
  const items: { label: string; hint: string; run: () => void }[] = [
    { label: 'JSON da arquitetura', hint: 'o modelo atual, recarregável', run: () => downloadText(`${base}.json`, JSON.stringify(toInputDocument(architecture), null, 2), 'application/json') },
    { label: 'Relatório HTML', hint: 'imprimível, com a análise de missão e a conta', run: () => downloadText(`${base}-relatorio.html`, buildHtmlReport(architecture), 'text/html') },
    { label: 'Requisitos e VCRM (CSV)', hint: 'uma linha por requisito', run: () => downloadText(`${base}-requisitos.csv`, requirementsCsv(architecture), 'text/csv') },
    { label: 'Parâmetros (CSV)', hint: 'valores, fórmulas, margens', run: () => downloadText(`${base}-parametros.csv`, parametersCsv(architecture), 'text/csv') },
    { label: 'Budgets (CSV)', hint: 'itens com margens de maturidade', run: () => downloadText(`${base}-budgets.csv`, budgetsCsv(architecture), 'text/csv') },
    { label: 'Interfaces N² (CSV)', hint: 'uma linha por interface', run: () => downloadText(`${base}-interfaces.csv`, interfacesCsv(architecture), 'text/csv') },
  ];

  return (
    <div className="export" ref={ref}>
      <button type="button" className="btn btn--ghost" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Exportar
      </button>
      {open && (
        <div className="export__menu" role="menu" aria-label="Exportar">
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem" className="export__item" onClick={() => { it.run(); setOpen(false); }}>
              <span className="export__label">{it.label}</span>
              <span className="export__hint">{it.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
