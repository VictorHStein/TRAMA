import { useEffect, useMemo, useRef, useState } from 'react';
import { useArchitectureStore, type GraphLens, type MatrixKind, type ViewMode } from '../../state/architectureStore';
import type { ArchitectureEntity, ArchitectureInput } from '../../domain/model/ArchitectureTypes';
import { parseCommand, type AnyDoc } from '../../domain/parser/commandParser';
import { buildHtmlReport } from '../../domain/export/report';
import { computeSuspectLinks, stampReview } from '../../domain/analysis/suspect';
import { TEMPLATES } from '../../data/templates';
import { downloadText, fileSlug, toInputDocument } from '../../lib/download';

/**
 * Command palette in the top bar (Ctrl+K / ⌘K). One field does three jobs:
 *   • actions: switch view, lens or matrix, theme, undo/redo, export, load a model;
 *   • Construtor commands ("órbita 600 km", "adicione um subsistema…"),
 *     applied through applyEdit so they can be undone;
 *   • entity search by name, id or PBS code.
 * Arrow keys move through the combined list; Enter runs the highlighted row.
 */

interface PaletteAction {
  id: string;
  label: string;
  hint?: string;
  keywords: string;
  run: () => void;
}

type Row =
  | { kind: 'action'; action: PaletteAction }
  | { kind: 'command'; label: string; run: () => void }
  | { kind: 'entity'; entity: ArchitectureEntity; code: string };

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function EntitySearch() {
  const architecture = useArchitectureStore((s) => s.architecture);
  const selectEntity = useArchitectureStore((s) => s.selectEntity);
  const theme = useArchitectureStore((s) => s.theme);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  const actions = useMemo<PaletteAction[]>(() => {
    const st = useArchitectureStore.getState;
    const view = (v: ViewMode) => () => st().setViewMode(v);
    const lens = (l: GraphLens) => () => { st().setLens(l); st().setViewMode('2d'); };
    const matrix = (m: MatrixKind) => () => { st().setMatrixKind(m); st().setViewMode('matrices'); };
    const list: PaletteAction[] = [
      { id: 'v-home', label: 'Ir para o projeto', hint: 'o projeto fecha?', keywords: 'projeto inicio home painel estado fecha', run: view('home') },
      { id: 'v-2d', label: 'Ir para o grafo 2D', keywords: 'grafo 2d diagrama', run: view('2d') },
      { id: 'v-3d', label: 'Ir para a cena 3D', keywords: 'cena 3d satelite orbita', run: view('3d') },
      { id: 'v-split', label: 'Ver 2D e 3D lado a lado', keywords: 'lado a lado split', run: view('split') },
      { id: 'v-builder', label: 'Abrir o construtor', keywords: 'construtor editar json comandos', run: view('tutorial') },
      { id: 'l-trace', label: 'Lente de rastreabilidade', hint: 'grafo 2D', keywords: 'lente rastreabilidade requisitos funcoes verificacao', run: lens('trace') },
      { id: 'l-if', label: 'Lente de interfaces', hint: 'grafo 2D', keywords: 'lente interfaces potencia dados comando termica mecanica', run: lens('interfaces') },
      { id: 'l-all', label: 'Mostrar tudo no grafo', hint: 'grafo 2D', keywords: 'lente tudo todas', run: lens('all') },
      { id: 'm-n2', label: 'Abrir a matriz N²', keywords: 'matriz n2 n² interfaces dsm', run: matrix('n2') },
      { id: 'm-vcrm', label: 'Abrir a VCRM', hint: 'verificação dos requisitos', keywords: 'vcrm verificacao matriz requisitos', run: matrix('vcrm') },
      { id: 'm-risk', label: 'Abrir a matriz de riscos', keywords: 'riscos 5x5 matriz', run: matrix('risks') },
      { id: 't-theme', label: theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro', hint: theme === 'dark' ? 'projetor e impressão' : undefined, keywords: 'tema claro escuro cor projetor', run: () => st().setTheme(theme === 'dark' ? 'light' : 'dark') },
      { id: 'g-tour', label: 'Fazer o tour guiado', hint: '1 minuto', keywords: 'tour ajuda guia tutorial comecar inicio', run: () => st().setTourOpen(true) },
      { id: 'h-undo', label: 'Desfazer a última edição', hint: 'Ctrl+Z', keywords: 'desfazer undo', run: () => st().undo() },
      { id: 'h-redo', label: 'Refazer', hint: 'Ctrl+Shift+Z', keywords: 'refazer redo', run: () => st().redo() },
    ];
    if (architecture) {
      const base = fileSlug(architecture.metadata.projectName);
      list.push(
        { id: 'x-html', label: 'Exportar o relatório HTML', keywords: 'exportar relatorio html imprimir', run: () => downloadText(`${base}-relatorio.html`, buildHtmlReport(architecture), 'text/html') },
        { id: 'x-json', label: 'Exportar o JSON do modelo', keywords: 'exportar json salvar modelo', run: () => downloadText(`${base}.json`, JSON.stringify(toInputDocument(architecture), null, 2), 'application/json') },
      );
      const suspects = computeSuspectLinks(architecture);
      if (suspects.length > 0) {
        const first = suspects[0].relationId;
        list.push(
          { id: 'r-next-suspect', label: 'Ir à próxima ligação suspeita', hint: `${suspects.length} suspeita${suspects.length > 1 ? 's' : ''}`, keywords: 'ligacao link suspeita suspect revisar rastreabilidade', run: () => { st().setViewMode('2d'); st().selectRelation(first); } },
          { id: 'r-review-suspects', label: `Marcar as ${suspects.length} ligações suspeitas como revisadas`, keywords: 'ligacao link suspeita revisar revisada', run: () => { st().applyEdit('Marcar ligações suspeitas como revisadas', (doc) => { stampReview(doc, suspects.map((s) => s.relationId)); }); } },
        );
      }
      list.push({ id: 'r-review-all', label: 'Registrar a revisão das ligações de rastreabilidade', hint: 'mudanças futuras deixam as ligações suspeitas', keywords: 'revisao baseline linha de base ligacoes links suspeitas rastreabilidade', run: () => { st().applyEdit('Registrar revisão das ligações', (doc) => { stampReview(doc); }); } });
      const failing = architecture.entities.find((e) => architecture.evaluation.rules[e.id]?.result === 'fail');
      if (failing) {
        list.push({ id: 'n-fail', label: 'Ir ao próximo requisito violado', hint: architecture.breakdownCodes[failing.id] ?? failing.id, keywords: 'requisito violado falha regra', run: () => { st().setViewMode('2d'); st().selectEntity(failing.id); } });
      }
    }
    list.push({ id: 'd-demo', label: 'Carregar o modelo DemoSat-TG', keywords: 'modelo demo demosat carregar', run: () => st().resetToDemo() });
    for (const t of TEMPLATES) {
      list.push({ id: `d-${t.id}`, label: `Carregar o modelo ${t.name}`, hint: t.description, keywords: `modelo carregar template ${t.name}`, run: () => st().loadArchitectureFromJson(t.data, t.fileName) });
    }
    return list;
  }, [architecture, theme]);

  const rows = useMemo<Row[]>(() => {
    const query = fold(q.trim());
    const out: Row[] = [];
    if (!query) {
      return actions.filter((a) => ['v-home', 'l-trace', 'l-if', 'm-vcrm', 't-theme', 'x-html'].includes(a.id)).map((action) => ({ kind: 'action', action }));
    }
    // A Construtor command first, when the text parses as one that changes the model.
    if (architecture && query.split(/\s+/).length >= 2) {
      const doc = toInputDocument(architecture) as unknown as AnyDoc;
      const parsed = parseCommand(q, doc);
      if (parsed.ok && parsed.mutation) {
        const mutation = parsed.mutation;
        out.push({
          kind: 'command',
          label: parsed.description,
          run: () => useArchitectureStore.getState().applyEdit(parsed.description, (d: ArchitectureInput) => mutation(d as unknown as AnyDoc)),
        });
      }
    }
    const words = query.split(/\s+/);
    for (const a of actions) {
      const hay = fold(`${a.label} ${a.keywords}`);
      if (words.every((w) => hay.includes(w))) out.push({ kind: 'action', action: a });
    }
    if (architecture) {
      const ents: Array<{ entity: ArchitectureEntity; score: number; code: string }> = [];
      for (const e of architecture.entities) {
        const name = fold(e.name);
        const code = fold(architecture.breakdownCodes[e.id] ?? '');
        let score = 0;
        if (name.startsWith(query)) score = 3;
        else if (name.includes(query)) score = 2;
        if (code.startsWith(query)) score = Math.max(score, 2);
        if (fold(e.id).includes(query)) score = Math.max(score, 1);
        if (score > 0) ents.push({ entity: e, score, code: architecture.breakdownCodes[e.id] ?? '' });
      }
      ents.sort((a, b) => b.score - a.score || a.entity.name.localeCompare(b.entity.name));
      for (const m of ents.slice(0, 8)) out.push({ kind: 'entity', entity: m.entity, code: m.code });
    }
    return out;
  }, [actions, architecture, q]);

  useEffect(() => { setActiveIdx(0); }, [rows.length, q]);

  const close = () => {
    setQ('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const run = (row: Row) => {
    if (row.kind === 'entity') selectEntity(row.entity.id);
    else if (row.kind === 'action') row.action.run();
    else row.run();
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && rows[activeIdx]) {
      e.preventDefault();
      run(rows[activeIdx]);
    } else if (e.key === 'Escape') {
      close();
    }
  };

  const groupOf = (r: Row) => (r.kind === 'entity' ? 'Entidades' : r.kind === 'command' ? 'Comando do construtor' : 'Ações');

  return (
    <div className="entity-search" ref={wrapRef}>
      <input
        ref={inputRef}
        type="text"
        placeholder="Buscar (Ctrl+K)"
        aria-label="Buscar entidades ou executar ações"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="entity-search__input"
        spellCheck={false}
      />
      {open && rows.length > 0 && (
        <ul className="entity-search__menu" role="listbox" aria-label="Resultados">
          {rows.map((r, i) => {
            const showGroup = i === 0 || groupOf(rows[i - 1]) !== groupOf(r);
            const key = r.kind === 'entity' ? `e-${r.entity.id}` : r.kind === 'action' ? `a-${r.action.id}` : 'cmd';
            return (
              <li key={key} role="option" aria-selected={i === activeIdx}>
                {showGroup && <div className="entity-search__group">{groupOf(r)}</div>}
                <button
                  type="button"
                  className={`entity-search__item${r.kind !== 'entity' ? ' entity-search__item--action' : ''}${i === activeIdx ? ' is-active' : ''}`}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => run(r)}
                  tabIndex={-1}
                >
                  {r.kind === 'entity' && (() => {
                    const cat = architecture?.categoriesById[r.entity.category];
                    return (
                      <>
                        <span className="entity-search__code">{r.code || r.entity.id}</span>
                        <span className="entity-search__name">{r.entity.name}</span>
                        <span className="entity-search__cat"><span className="cat-dot" style={{ background: cat?.color }} />{cat?.label}</span>
                      </>
                    );
                  })()}
                  {r.kind === 'action' && (
                    <>
                      <span className="entity-search__name">{r.action.label}</span>
                      {r.action.hint && <span className="entity-search__cat">{r.action.hint}</span>}
                    </>
                  )}
                  {r.kind === 'command' && (
                    <>
                      <span className="entity-search__name">Aplicar: {r.label}</span>
                      <span className="entity-search__cat">pode desfazer</span>
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
