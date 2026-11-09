import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useArchitectureStore } from '../../state/architectureStore';
import { validateArchitecture, type ValidationIssue } from '../../domain/parser/validateArchitecture';
import { parseCommand, pickColor, deleteEntityMutation, type AnyDoc } from '../../domain/parser/commandParser';
import { VoiceInput } from './VoiceInput';
import demoJson from '../../data/demoArchitecture.json';

/**
 * Construtor — no-code editor for the architecture JSON.
 *
 *   • A natural-language command bar at the top (with mic). Type or
 *     dictate things like "adicione um subsistema chamado Bateria sob
 *     EPS" or "conectar EPS a OBC tipo potência" and the JSON mutates.
 *   • Three lists below: Categorias, Entidades, Relações. Each item has
 *     inline delete; clicking the row selects it for editing.
 *   • A collapsible JSON editor on the side for power-users.
 *   • Apply buttons at the bottom to send the architecture to the
 *     2D / 3D viewers.
 */

const EMPTY_SKELETON: AnyDoc = {
  metadata: { projectName: 'Minha Arquitetura', version: '0.1.0', description: '' },
  mission: { id: 'mission_x', name: 'Minha Missão', objectives: [] },
  // The full vocabulary of the chain, so every command works on an empty project.
  categories: demoJson.categories,
  relationTypes: demoJson.relationTypes,
  entities: [
    { id: 'mission_x', name: 'Minha Missão', category: 'mission', step: 1, description: '' },
  ],
  relations: [],
  views: { defaultStep: 1, maxStep: 6 },
};

const SAMPLE_COMMANDS = [
  'adicione um subsistema chamado Bateria sob EPS',
  'criar componente chamado Painel solar sob EPS',
  'conectar EPS a OBC tipo potência',
  'órbita 600 km inclinação 97,8',
  'criar categoria Verificação cor #ef4444',
  'renomear EPS para Subsistema Elétrico',
  'remover bateria',
];

interface FeedbackMessage {
  text: string;
  ok: boolean;
  ts: number;
}

export function TutorialView() {
  const architecture = useArchitectureStore((s) => s.architecture);
  const loadArchitectureFromJson = useArchitectureStore((s) => s.loadArchitectureFromJson);
  const setViewMode = useArchitectureStore((s) => s.setViewMode);
  const resetToDemo = useArchitectureStore((s) => s.resetToDemo);
  const builderDraft = useArchitectureStore((s) => s.builderDraft);
  const setBuilderDraft = useArchitectureStore((s) => s.setBuilderDraft);

  // The editor text lives locally; an unsaved draft is mirrored into the
  // store so switching tabs and coming back does not lose the user's work.
  const [text, setTextRaw] = useState(() => builderDraft ?? buildEditorText(architecture));
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [dirty, setDirtyState] = useState(builderDraft != null);
  const dirtyRef = useRef(builderDraft != null);
  const setDirty = useCallback((v: boolean) => { dirtyRef.current = v; setDirtyState(v); }, []);
  const setText = useCallback((t: string) => { setTextRaw(t); setDirty(true); }, [setDirty]);

  useEffect(() => {
    setBuilderDraft(dirty ? text : null);
  }, [dirty, text, setBuilderDraft]);

  // Follow the store when the architecture changes elsewhere (TopBar "Carregar
  // JSON", "Resetar para demo") and there is no unsaved draft to protect.
  useEffect(() => {
    if (!dirtyRef.current) setTextRaw(buildEditorText(architecture));
  }, [architecture]);
  const [commandText, setCommandText] = useState('');
  const [liveVoice, setLiveVoice] = useState('');
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const [jsonOpen, setJsonOpen] = useState(false);
  const cmdInputRef = useRef<HTMLInputElement>(null);

  /* ── Validation (debounced) ──────────────────────────── */
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const parsed = JSON.parse(text);
        const result = validateArchitecture(parsed);
        if (result.ok) {
          setIssues([]); setStatus('ok');
        } else {
          setIssues(result.issues); setStatus('error');
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'JSON inválido';
        setIssues([{ path: '(raiz)', message: `JSON sintaticamente inválido: ${msg}` }]);
        setStatus('error');
      }
    }, 300);
    return () => clearTimeout(t);
  }, [text]);

  const parsedDoc = useMemo<AnyDoc | null>(() => {
    try { return JSON.parse(text); } catch { return null; }
  }, [text]);

  /* ── Mutations ──────────────────────────────────────── */

  const runMutation = useCallback((mutator: (d: AnyDoc) => void, description: string) => {
    try {
      const doc = JSON.parse(text) as AnyDoc;
      mutator(doc);
      setText(JSON.stringify(doc, null, 2));
      setFeedback({ text: `✓ ${description}`, ok: true, ts: Date.now() });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '?';
      setFeedback({ text: `Erro ao aplicar: ${msg}`, ok: false, ts: Date.now() });
    }
  }, [text, setText]);

  const dispatchCommand = useCallback((raw: string) => {
    if (!raw.trim() || !parsedDoc) return;
    const result = parseCommand(raw, parsedDoc);
    if (!result.ok || !result.mutation) {
      setFeedback({ text: result.description || 'Não entendi.', ok: false, ts: Date.now() });
      return;
    }
    runMutation(result.mutation, result.description);
    setCommandText('');
    setLiveVoice('');
  }, [parsedDoc, runMutation]);

  /* ── Quick-add buttons ───────────────────────────────── */

  const addCategory = () => runMutation((d) => {
    const n = (d.categories?.length ?? 0) + 1;
    (d.categories ||= []).push({
      id: `cat_${n}`, label: `Categoria ${n}`, color: pickColor(n),
      shape2D: 'box', shape3D: 'box',
    });
  }, `Nova categoria cat_${(parsedDoc?.categories?.length ?? 0) + 1}`);

  const addRelationType = () => {
    const existing = (parsedDoc?.relationTypes ?? []) as Array<{ index?: number }>;
    const nextIndex = Math.max(0, ...existing.map((r) => Number(r.index ?? 0))) + 1;
    runMutation((d) => {
      (d.relationTypes ||= []).push({
        id: `rel_type_${nextIndex}`, index: nextIndex,
        label: `Relação ${nextIndex}`, color: pickColor(nextIndex + 6),
        lineStyle: 'solid', directed: true,
        description: 'Descreva o significado desta relação.',
      });
    }, `Tipo de relação #${nextIndex}`);
  };

  const addEntity = () => {
    const n = (parsedDoc?.entities?.length ?? 0) + 1;
    runMutation((d) => {
      const firstCat = ((d.categories ?? [])[0] as { id?: string })?.id ?? 'subsystem';
      (d.entities ||= []).push({
        id: `ent_${n}`, name: `Entidade ${n}`,
        category: firstCat, step: 1, description: '',
      });
    }, `Nova entidade ent_${n}`);
  };

  const addRelation = () => {
    const ents = (parsedDoc?.entities ?? []) as Array<{ id?: string }>;
    const types = (parsedDoc?.relationTypes ?? []) as Array<{ id?: string }>;
    if (ents.length < 2 || types.length === 0) {
      setFeedback({ text: 'Crie ao menos 2 entidades e 1 tipo de relação antes', ok: false, ts: Date.now() });
      return;
    }
    const n = (parsedDoc?.relations?.length ?? 0) + 1;
    runMutation((d) => {
      (d.relations ||= []).push({
        id: `rel_${n}`, type: types[0].id, source: ents[0].id, target: ents[1].id,
        step: 1, label: '',
      });
    }, `Nova relação ${ents[0].id} → ${ents[1].id}`);
  };

  /* ── Delete from inline buttons ──────────────────────── */

  const deleteEntity = (id: string) => runMutation(deleteEntityMutation(id), `Removida entidade ${id}`);

  const deleteCategory = (id: string) => runMutation((d) => {
    d.categories = (d.categories ?? []).filter((c) => (c as { id?: string }).id !== id);
  }, `Removida categoria ${id}`);

  const deleteRelation = (id: string) => runMutation((d) => {
    d.relations = (d.relations ?? []).filter((r) => (r as { id?: string }).id !== id);
  }, `Removida relação ${id}`);

  const deleteRelationType = (id: string) => runMutation((d) => {
    d.relationTypes = (d.relationTypes ?? []).filter((t) => (t as { id?: string }).id !== id);
  }, `Removido tipo de relação ${id}`);

  /* ── Apply ────────────────────────────────────────────── */

  /** Applies the editor JSON to the store. Returns true when it was accepted. */
  const onApply = (): boolean => {
    try {
      const raw = JSON.parse(text);
      const result = loadArchitectureFromJson(raw, 'Construtor');
      if (!result.ok) {
        setIssues(result.issues);
        setStatus('error');
        setFeedback({ text: `JSON com ${result.issues.length} problema(s) — corrija antes de aplicar`, ok: false, ts: Date.now() });
        return false;
      }
      setDirty(false);
      setFeedback({ text: 'Arquitetura aplicada — abra 2D ou 3D para ver', ok: true, ts: Date.now() });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'JSON inválido';
      setIssues([{ path: '(raiz)', message: msg }]);
      setStatus('error');
      return false;
    }
  };

  const onStartEmpty = () => { setText(JSON.stringify(EMPTY_SKELETON, null, 2)); };
  const onLoadDemo = () => {
    setDirty(false);
    resetToDemo();
    // Zustand updates synchronously, so the fresh demo is already in the store.
    setTextRaw(buildEditorText(useArchitectureStore.getState().architecture));
  };

  /* ── Auto-focus the command bar on '/' (Slack/Discord-style) ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        cmdInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={`builder${jsonOpen ? ' builder--json-open' : ''}`}>
      {/* ─── Top: NL command bar ─────────────────────────── */}
      <div className="builder-cmdbar">
        <div className="builder-cmdbar__row">
          <span className="builder-cmdbar__prompt">›</span>
          <input
            ref={cmdInputRef}
            className="builder-cmdbar__input"
            placeholder="Diga o que fazer… (ex: adicione um subsistema chamado Bateria sob EPS)"
            value={commandText}
            onChange={(e) => setCommandText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') dispatchCommand(commandText);
              else if (e.key === 'Escape') { setCommandText(''); e.currentTarget.blur(); }
            }}
            spellCheck={false}
          />
          <VoiceInput
            onResult={(t) => { setCommandText(t); dispatchCommand(t); }}
            onLiveTranscript={setLiveVoice}
          />
          <button
            className="builder-cmdbar__send"
            onClick={() => dispatchCommand(commandText)}
            disabled={!commandText.trim()}
          >
            Aplicar
          </button>
        </div>
        {liveVoice && (
          <div className="builder-cmdbar__live">🎙 {liveVoice}</div>
        )}
        {feedback && (
          <div className={`builder-cmdbar__feedback${feedback.ok ? ' is-ok' : ' is-error'}`}>
            {feedback.text}
          </div>
        )}
        <div className="builder-cmdbar__samples">
          <span className="builder-cmdbar__samples-head">Exemplos</span>
          {SAMPLE_COMMANDS.map((s) => (
            <button
              key={s}
              className="builder-cmdbar__sample"
              onClick={() => { setCommandText(s); cmdInputRef.current?.focus(); }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Main: 3 lists + side JSON ───────────────────── */}
      <div className="builder-grid">
        <Pane title="Categorias" actionLabel="+ Adicionar" onAction={addCategory}>
          {((parsedDoc?.categories ?? []) as Array<{ id?: string; label?: string; color?: string }>).map((c) => (
            <Card
              key={String(c.id)}
              accent={c.color}
              title={String(c.label ?? c.id)}
              subtitle={String(c.id)}
              onDelete={() => deleteCategory(String(c.id))}
            />
          ))}
        </Pane>

        <Pane title="Tipos de relação" actionLabel="+ Adicionar" onAction={addRelationType}>
          {((parsedDoc?.relationTypes ?? []) as Array<{ id?: string; index?: number; label?: string; color?: string }>).map((r) => (
            <Card
              key={String(r.id)}
              accent={r.color}
              badge={String(r.index ?? '')}
              title={String(r.label ?? r.id)}
              subtitle={String(r.id)}
              onDelete={() => deleteRelationType(String(r.id))}
            />
          ))}
        </Pane>

        <Pane title="Entidades" actionLabel="+ Adicionar" onAction={addEntity}>
          {((parsedDoc?.entities ?? []) as Array<{ id?: string; name?: string; short?: string; category?: string; parentId?: string }>).map((e, _i, all) => {
            const cat = ((parsedDoc?.categories ?? []) as Array<{ id?: string; label?: string; color?: string }>).find((c) => c.id === e.category);
            const parent = e.parentId ? all.find((x) => x.id === e.parentId) : undefined;
            return (
              <Card
                key={String(e.id)}
                accent={cat?.color}
                title={String(e.name ?? e.id)}
                subtitle={`${cat?.label ?? e.category}${e.parentId ? `, dentro de ${parent?.short ?? parent?.name ?? e.parentId}` : ''}`}
                onDelete={() => deleteEntity(String(e.id))}
              />
            );
          })}
        </Pane>

        <Pane title="Relações" actionLabel="+ Adicionar" onAction={addRelation}>
          {((parsedDoc?.relations ?? []) as Array<{ id?: string; type?: string; source?: string; target?: string; label?: string }>).map((r) => {
            const rt = ((parsedDoc?.relationTypes ?? []) as Array<{ id?: string; index?: number; color?: string }>).find((t) => t.id === r.type);
            return (
              <Card
                key={String(r.id)}
                accent={rt?.color}
                badge={String(rt?.index ?? '')}
                title={`${r.source} → ${r.target}`}
                subtitle={String(r.label ?? r.type)}
                onDelete={() => deleteRelation(String(r.id))}
              />
            );
          })}
        </Pane>
      </div>

      {/* ─── Bottom: status + actions + collapsible JSON ── */}
      <div className="builder-footer">
        <div className="builder-footer__left">
          <button className="builder-btn" onClick={onStartEmpty}>Esqueleto mínimo</button>
          <button className="builder-btn builder-btn--ghost" onClick={onLoadDemo}>Carregar demo</button>
          <button className="builder-btn builder-btn--ghost" onClick={() => setJsonOpen((s) => !s)}>
            {jsonOpen ? 'Esconder JSON' : 'Ver JSON'}
          </button>
        </div>
        <div className={`builder-footer__status builder-footer__status--${status}`}>
          {status === 'ok' && <span>JSON válido: {count(text, 'entities')} entidades, {count(text, 'relations')} relações</span>}
          {status === 'error' && <span>{issues.length} {issues.length === 1 ? 'problema no JSON' : 'problemas no JSON'}</span>}
          {status === 'idle' && <span>Aguardando…</span>}
        </div>
        <div className="builder-footer__right">
          {dirty && <span className="builder-dirty">não aplicado</span>}
          <button
            className={`builder-btn builder-btn--primary${status === 'error' ? ' is-disabled' : ''}`}
            disabled={status === 'error'}
            onClick={onApply}
          >
            Aplicar
          </button>
          <button
            className="builder-btn"
            disabled={status === 'error'}
            onClick={() => { if (onApply()) setViewMode('2d'); }}
          >
            Aplicar e ir 2D
          </button>
          <button
            className="builder-btn builder-btn--ghost"
            disabled={status === 'error'}
            onClick={() => { if (onApply()) setViewMode('3d'); }}
          >
            Aplicar e ir 3D
          </button>
        </div>
      </div>

      {/* ─── JSON drawer ─────────────────────────────────── */}
      {jsonOpen && (
        <div className="builder-json-drawer">
          <textarea
            className="builder-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
          />
          {status === 'error' && (
            <div className="builder-issues-list">
              {issues.slice(0, 8).map((i, k) => (
                <div key={k} className="builder-issue">
                  <code>{i.path}</code> {i.message}
                </div>
              ))}
              {issues.length > 8 && <div className="builder-issue">… e mais {issues.length - 8}.</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────── */

function buildEditorText(arch: ReturnType<typeof useArchitectureStore.getState>['architecture']): string {
  if (!arch) return JSON.stringify(EMPTY_SKELETON, null, 2);
  const {
    entitiesById: _e, relationTypesById: _r, categoriesById: _c,
    maxStep: _m, relationsByEntity: _rbe, breakdownCodes: _bc, traceById: _t,
    ...input
  } = arch;
  void _e; void _r; void _c; void _m; void _rbe; void _bc; void _t;
  return JSON.stringify(input, null, 2);
}

function count(text: string, key: string): number {
  try {
    const doc = JSON.parse(text);
    const arr = doc?.[key];
    return Array.isArray(arr) ? arr.length : 0;
  } catch { return 0; }
}

/* ── UI primitives ─────────────────────────────────────── */

function Pane({
  title, actionLabel, onAction, children,
}: {
  title: string; actionLabel: string; onAction: () => void; children: React.ReactNode;
}) {
  return (
    <section className="builder-pane">
      <header className="builder-pane__head">
        <span>{title}</span>
        <button className="builder-pane__add" onClick={onAction}>{actionLabel}</button>
      </header>
      <div className="builder-pane__body">
        {children}
        {!children || (Array.isArray(children) && children.length === 0) ? (
          <div className="builder-pane__empty">Nada aqui ainda.</div>
        ) : null}
      </div>
    </section>
  );
}

function Card({
  title, subtitle, accent, badge, onDelete,
}: {
  title: string;
  subtitle?: string;
  accent?: string;
  badge?: string;
  onDelete?: () => void;
}) {
  return (
    <div className="builder-card" style={accent ? { borderLeftColor: accent } : undefined}>
      {badge && (
        <span className="builder-card__badge" style={accent ? { background: accent } : undefined}>{badge}</span>
      )}
      <div className="builder-card__body">
        <div className="builder-card__title">{title}</div>
        {subtitle && <div className="builder-card__sub">{subtitle}</div>}
      </div>
      {onDelete && (
        <button type="button" className="builder-card__del" onClick={onDelete} title="Remover" aria-label={`Remover ${title}`}>×</button>
      )}
    </div>
  );
}
