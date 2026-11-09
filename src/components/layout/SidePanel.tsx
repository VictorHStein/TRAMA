import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useArchitectureStore,
  selectSelectedEntity,
  selectSelectedRelation,
} from '../../state/architectureStore';
import type {
  ArchitectureEntity,
  ArchitectureRelation,
  NormalizedArchitecture,
} from '../../domain/model/ArchitectureTypes';
import type { TraceSets } from '../../domain/analysis/trace';
import { missionObjectives } from '../../domain/analysis/objectives';
import { computeImpact } from '../../domain/analysis/impact';
import { linkReviewState, stampReview } from '../../domain/analysis/suspect';
import { AnalysisPanel } from '../panels/AnalysisPanel';
import { MissionPanel } from '../panels/MissionPanel';
import { fmtNum, fmtPct, fmtQty } from '../../lib/format';
import { REQ_PRIORITY_LABEL, REQ_TYPE_LABEL, criticalityLabel, levelLabel, methodLabel } from '../../lib/labels';
import { ParamEditor } from '../panels/ParamEditor';


/**
 * Right-hand inspector with three tabs.
 *
 *   Entidade — overview of the project (nothing selected), or the selected
 *              entity/relation with parameters, rule, traceability, impact.
 *   Análise  — coverage, audit, budgets, modes, rules (AnalysisPanel).
 *   Missão   — orbit, eclipse, passes, link, power, data, decay, thermal (MissionPanel).
 */
export function SidePanel() {
  const architecture = useArchitectureStore((s) => s.architecture);
  const selectedEntity = useArchitectureStore(selectSelectedEntity);
  const selectedRelation = useArchitectureStore(selectSelectedRelation);
  const selectedEntityId = useArchitectureStore((s) => s.selectedEntityId);
  const selectedRelationId = useArchitectureStore((s) => s.selectedRelationId);
  const selectEntity = useArchitectureStore((s) => s.selectEntity);
  const focusSubsystem = useArchitectureStore((s) => s.focusSubsystem);
  const focusedSubsystemId = useArchitectureStore((s) => s.focusedSubsystemId);

  const tab = useArchitectureStore((s) => s.inspectorTab);
  const setTab = useArchitectureStore((s) => s.setInspectorTab);
  // Selections made from inside the panel (audit list, budget rows…) keep the
  // current tab; selections coming from the canvas jump to "Entidade".
  const internalSelect = useRef(false);
  const select = (id: string | null) => { internalSelect.current = true; selectEntity(id); };
  useEffect(() => {
    if (!internalSelect.current && (selectedEntityId || selectedRelationId)) setTab('entity');
    internalSelect.current = false;
  }, [selectedEntityId, selectedRelationId, setTab]);

  if (!architecture) return <aside className="side-panel" />;

  return (
    <aside className="side-panel" aria-label="Inspetor">
      <div className="side-panel__tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'entity'} className={`side-panel__tab${tab === 'entity' ? ' is-on' : ''}`} onClick={() => setTab('entity')}>
          Entidade
        </button>
        <button type="button" role="tab" aria-selected={tab === 'analysis'} className={`side-panel__tab${tab === 'analysis' ? ' is-on' : ''}`} onClick={() => setTab('analysis')}>
          Análise
          {architecture.evaluation.issues.some((i) => i.severity === 'error') && <span className="side-panel__tab-dot" aria-label="há erros" />}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'mission'} className={`side-panel__tab${tab === 'mission' ? ' is-on' : ''}`} onClick={() => setTab('mission')}>
          Missão
        </button>
        {(selectedEntity || selectedRelation) && (
          <button type="button" className="btn btn--icon btn--sm btn--ghost side-panel__close" onClick={() => select(null)} aria-label="Limpar seleção" title="Limpar seleção (Esc)">
            ×
          </button>
        )}
      </div>

      <div className="side-panel__body" role="tabpanel">
        {tab === 'analysis' && <AnalysisPanel />}
        {tab === 'mission' && <MissionPanel />}
        {tab === 'entity' && selectedRelation && <RelationDetails relation={selectedRelation} architecture={architecture} onSelect={select} />}
        {tab === 'entity' && !selectedRelation && selectedEntity && (
          <EntityDetails entity={selectedEntity} architecture={architecture} onSelect={select} onFocus={focusSubsystem} focusedId={focusedSubsystemId} />
        )}
        {tab === 'entity' && !selectedRelation && !selectedEntity && <Overview architecture={architecture} onSelect={select} />}
      </div>
    </aside>
  );
}

/* ── Overview ───────────────────────────────────────────────── */

function Overview({ architecture, onSelect }: { architecture: NormalizedArchitecture; onSelect: (id: string) => void }) {
  const counts = architecture.categories.map((cat) => ({ cat, n: architecture.entities.filter((e) => e.category === cat.id).length }));
  const ev = architecture.evaluation;
  return (
    <div className="sp-stack">
      <header className="sp-title">
        <h2 className="sp-h2">{architecture.metadata.projectName}</h2>
        <span className="support-label">versão {architecture.metadata.version}, {architecture.entities.length} entidades, {architecture.relations.length} relações</span>
        {architecture.metadata.description && <p className="sp-paragraph">{architecture.metadata.description}</p>}
      </header>

      {architecture.mission && (
        <section className="sp-section">
          <h3 className="section-title">{architecture.mission.name}</h3>
          {missionObjectives(architecture).length > 0 && (
            <ul className="sp-bullets">{missionObjectives(architecture).map((o) => <li key={o.key}>{o.text}</li>)}</ul>
          )}
        </section>
      )}

      {ev.budgets.length > 0 && (
        <section className="sp-section">
          <h3 className="section-title">Budgets</h3>
          <ul className="sp-list sp-list--compact">
            {ev.budgets.map((b) => (
              <li key={b.id} className="sp-row sp-row--static">
                <span className="sp-row__text">{b.label}</span>
                <span className="mono sp-row__num">{fmtQty(b.total, b.unit, 1)}</span>
                {b.allocated !== undefined && <span className="mono sp-row__num support-label">/ {fmtNum(b.allocated, 1)}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="sp-section">
        <h3 className="section-title">Entidades por categoria</h3>
        <ul className="sp-list sp-list--compact">
          {counts.map(({ cat, n }) => (
            <li key={cat.id} className="sp-row sp-row--static">
              <span className="cat-dot" style={{ background: cat.color }} />
              <span className="sp-row__text">{cat.label}</span>
              <span className="mono sp-row__num">{n}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="sp-section">
        <h3 className="section-title">Tipos de relação</h3>
        <ul className="sp-list sp-list--compact">
          {architecture.relationTypes.map((rt) => (
            <li key={rt.id} className="sp-row sp-row--static">
              <span className="num-badge" style={{ background: rt.color }}>{rt.index}</span>
              <span className="sp-row__text">{rt.label}</span>
              <span className="mono sp-row__num">{architecture.relations.filter((r) => r.type === rt.id).length}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="sp-section">
        <h3 className="section-title">Subsistemas</h3>
        <div className="sp-pills">
          {architecture.entities.filter((e) => e.category === 'subsystem').map((e) => (
            <button key={e.id} type="button" className="sp-pill" onClick={() => onSelect(e.id)} title={e.name}>
              <span className="mono support-label">{architecture.breakdownCodes[e.id]}</span> {e.short ?? e.name}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ── Entity details ─────────────────────────────────────────── */

const RULE_TONE = { pass: 'ok', fail: 'fail', error: 'warn', unknown: 'neutral' } as const;
const RULE_LABEL = { pass: 'Atende', fail: 'Viola', error: 'Erro na regra', unknown: 'Sem resultado' } as const;
const STATUS_LABEL: Record<string, string> = { planned: 'Planejado', in_progress: 'Em andamento', passed: 'Aprovado', failed: 'Reprovado', verified: 'Verificado', waived: 'Dispensado' };
const STATUS_TONE: Record<string, string> = { planned: 'neutral', in_progress: 'info', passed: 'ok', failed: 'fail', verified: 'ok', waived: 'neutral' };

function EntityDetails({
  entity, architecture, onSelect, onFocus, focusedId,
}: {
  entity: ArchitectureEntity;
  architecture: NormalizedArchitecture;
  onSelect: (id: string) => void;
  onFocus: (id: string | null) => void;
  focusedId: string | null;
}) {
  const cat = architecture.categoriesById[entity.category];
  const rel = architecture.relationsByEntity[entity.id] ?? { incoming: [], outgoing: [] };
  const parent = entity.parentId ? architecture.entitiesById[entity.parentId] : undefined;
  const children = architecture.entities.filter((e) => e.parentId === entity.id);
  const code = architecture.breakdownCodes[entity.id] ?? entity.id;
  const ev = architecture.evaluation;
  const params = Object.values(ev.params).filter((p) => p.entityId === entity.id);
  const rule = ev.rules[entity.id];
  const trace = architecture.traceAll[entity.id];
  const verifications = (architecture.verifications ?? []).filter(
    (v) => v.requirementId === entity.id || v.itemId === entity.id || v.verifierId === entity.id,
  );
  const [showImpact, setShowImpact] = useState(false);
  const impact = useMemo(() => (showImpact ? computeImpact(architecture, entity.id) : null), [showImpact, architecture, entity.id]);
  const risks = (architecture.risks ?? []).filter((r) => r.entityIds?.includes(entity.id));

  return (
    <div className="sp-stack">
      <header className="sp-title">
        <div className="sp-title__row">
          <span className="chip chip--neutral" style={{ color: cat?.color }}><span className="chip__dot" />{cat?.label}</span>
          <span className="mono sp-code">{code}</span>
          {entity.status && <span className={`chip chip--${STATUS_TONE[entity.status] ?? 'neutral'}`}><span className="chip__dot" />{STATUS_LABEL[entity.status] ?? entity.status}</span>}
        </div>
        <h2 className="sp-h2">{entity.name}</h2>
        <span className="support-label">{entity.short ? `${entity.short}, ` : ''}<span className="mono">{entity.id}</span>, etapa {entity.step}{entity.trl ? `, TRL ${entity.trl}` : ''}</span>
        {entity.description && <p className="sp-paragraph">{entity.description}</p>}
        <div className="sp-actions">
          <button type="button" className={`btn btn--secondary btn--sm${focusedId === entity.id ? ' is-on' : ''}`} onClick={() => onFocus(focusedId === entity.id ? null : entity.id)}>
            {focusedId === entity.id ? 'Tirar foco' : 'Focar no grafo'}
          </button>
          <button type="button" className={`btn btn--ghost btn--sm${showImpact ? ' is-on' : ''}`} onClick={() => setShowImpact((v) => !v)}>
            Impacto
          </button>
        </div>
      </header>

      {entity.requirement && <RequirementBlock entity={entity} architecture={architecture} onSelect={onSelect} />}

      {rule && (
        <section className="sp-section">
          <div className="sp-section__head">
            <h3 className="section-title">Regra de verificação</h3>
            <span className={`chip chip--${RULE_TONE[rule.result]}`}><span className="chip__dot" />{RULE_LABEL[rule.result]}</span>
          </div>
          <code className="sp-code-block">{rule.expression}</code>
          {rule.error && <p className="support-label sp-error">{rule.error}</p>}
          <div className="sp-pills">
            {rule.dependencies.map((d) => <ParamPill key={d} paramKey={d} architecture={architecture} onSelect={onSelect} />)}
          </div>
        </section>
      )}

      {params.length > 0 && (
        <section className="sp-section">
          <h3 className="section-title">Parâmetros</h3>
          <ul className="sp-list">
            {params.map((p) => (
              <li key={p.key} className="sp-param">
                <div className="sp-param__row">
                  <span className="sp-param__name">{p.name}</span>
                  {p.formula || p.error ? (
                    <span className={`mono sp-param__value${p.error ? ' sp-error' : ''}`}>{p.error ? 'erro' : fmtQty(p.value, p.unit)}</span>
                  ) : (
                    <ParamEditor param={p} />
                  )}
                </div>
                <div className="sp-param__meta support-label">
                  {p.formula ? <span className="mono">= {p.formula}</span> : <span>{sourceLabel(p.source)}</span>}
                  {p.marginFraction > 0 && <span>, margem {fmtPct(p.marginFraction)} → <span className="mono">{fmtQty(p.valueWithMargin, p.unit)}</span></span>}
                  {p.outOfRange && <span className="sp-error">, fora da faixa ({p.outOfRange === 'min' ? `mín. ${p.min}` : `máx. ${p.max}`})</span>}
                  {p.dependents.length > 0 && <span>, usado por {p.dependents.length}</span>}
                </div>
                {p.error && <div className="support-label sp-error">{p.error}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {impact && (
        <section className="sp-section">
          <h3 className="section-title">Impacto de uma mudança</h3>
          <p className="support-label">{impact.downstream.length} elementos afetados a jusante ({impact.viaParameters.length} via fórmulas), {impact.upstream.length} a montante.</p>
          <PillGroup label="Afeta" ids={impact.downstream} architecture={architecture} onSelect={onSelect} />
          <PillGroup label="Depende de" ids={impact.upstream} architecture={architecture} onSelect={onSelect} />
        </section>
      )}

      {trace && <TraceSetsView trace={trace} architecture={architecture} onSelect={onSelect} currentId={entity.id} />}

      {parent && (
        <section className="sp-section">
          <h3 className="section-title">Pertence a</h3>
          <EntityRow id={parent.id} architecture={architecture} onSelect={onSelect} />
        </section>
      )}

      {children.length > 0 && (
        <section className="sp-section">
          <h3 className="section-title">Contém</h3>
          <ul className="sp-list sp-list--compact">{children.map((c) => <li key={c.id}><EntityRow id={c.id} architecture={architecture} onSelect={onSelect} /></li>)}</ul>
        </section>
      )}

      {entity.budgets && entity.budgets.length > 0 && (
        <section className="sp-section">
          <h3 className="section-title">Budgets locais</h3>
          {entity.budgets.map((b, i) => {
            const pct = b.allocated > 0 ? Math.min(100, (b.estimated / b.allocated) * 100) : 0;
            const tone = pct >= 95 ? 'fail' : pct >= 80 ? 'warn' : 'ok';
            return (
              <div key={i} className="sp-localbudget">
                <div className="sp-localbudget__top"><span>{b.kind}</span><span className="mono">{fmtNum(b.estimated)} / {fmtNum(b.allocated)} {b.unit}</span></div>
                <div className="sp-localbudget__track"><div className={`sp-localbudget__fill is-${tone}`} style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })}
        </section>
      )}

      <RelationsList title="Relações de saída" relations={rel.outgoing} endpoint="target" architecture={architecture} onSelect={onSelect} />
      <RelationsList title="Relações de entrada" relations={rel.incoming} endpoint="source" architecture={architecture} onSelect={onSelect} />

      {verifications.length > 0 && (
        <section className="sp-section">
          <h3 className="section-title">Verificações</h3>
          <ul className="sp-list">
            {verifications.map((v) => (
              <li key={v.id} className="sp-verif">
                <div className="sp-verif__head">
                  <span className={`chip chip--${STATUS_TONE[v.status] ?? 'neutral'}`}><span className="chip__dot" />{STATUS_LABEL[v.status] ?? v.status}</span>
                  <span className="support-label">{methodLabel(v.method)}{v.level ? `, nível ${levelLabel(v.level)}` : ''}</span>
                </div>
                {v.description && <p className="support-label">{v.description}</p>}
                {v.evidence && <p className="support-label">Evidência: {v.evidence}</p>}
                <div className="sp-pills">
                  {v.requirementId !== entity.id && <EntityPill id={v.requirementId} architecture={architecture} onSelect={onSelect} />}
                  {v.itemId && v.itemId !== entity.id && <EntityPill id={v.itemId} architecture={architecture} onSelect={onSelect} />}
                  {v.verifierId && v.verifierId !== entity.id && <EntityPill id={v.verifierId} architecture={architecture} onSelect={onSelect} />}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {risks.length > 0 && (
        <section className="sp-section">
          <h3 className="section-title">Riscos associados</h3>
          <ul className="sp-list">
            {risks.map((r) => {
              const score = r.probability * r.impact;
              const tone = score >= 16 ? 'fail' : score >= 10 ? 'warn' : score >= 5 ? 'info' : 'ok';
              return (
                <li key={r.id} className="sp-verif">
                  <div className="sp-verif__head">
                    <span className={`chip chip--${tone}`}><span className="chip__dot" />P{r.probability} × I{r.impact} = {score}</span>
                    <span className="support-label">{r.status}</span>
                  </div>
                  <p className="sp-row__text">{r.title}</p>
                  {r.mitigation && <p className="support-label">Mitigação: {r.mitigation}</p>}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function sourceLabel(s?: string): string {
  switch (s) {
    case 'estimated': return 'estimado';
    case 'computed': return 'calculado';
    case 'reference': return 'referência (datasheet ou projeto anterior)';
    case 'measured': return 'medido';
    default: return 'valor informado';
  }
}

function RequirementBlock({ entity, architecture, onSelect }: { entity: ArchitectureEntity; architecture: NormalizedArchitecture; onSelect: (id: string) => void }) {
  const r = entity.requirement!;
  return (
    <section className="sp-section">
      <h3 className="section-title">Requisito</h3>
      {r.text && <p className="sp-paragraph sp-paragraph--quote">{r.text}</p>}
      <div className="sp-pills">
        {r.type && <span className="chip chip--neutral">{REQ_TYPE_LABEL[r.type] ?? r.type}</span>}
        {r.priority && <span className="chip chip--neutral">{REQ_PRIORITY_LABEL[r.priority] ?? r.priority}</span>}
        {r.verification?.method && <span className="chip chip--neutral">verificação por {methodLabel(r.verification.method)}{r.verification.level ? `, nível ${levelLabel(r.verification.level)}` : ''}</span>}
      </div>
      {r.rationale && <div className="kv"><span className="kv__k">Justificativa</span><span className="kv__v">{r.rationale}</span></div>}
      {r.acceptance && <div className="kv"><span className="kv__k">Aceitação</span><span className="kv__v">{r.acceptance}</span></div>}
      {r.derivesFrom && r.derivesFrom.length > 0 && (
        <div className="kv"><span className="kv__k">Deriva de</span><span className="kv__v sp-pills">{r.derivesFrom.map((id) => <EntityPill key={id} id={id} architecture={architecture} onSelect={onSelect} />)}</span></div>
      )}
    </section>
  );
}

/* ── Small pieces ────────────────────────────────────────── */

function EntityRow({ id, architecture, onSelect }: { id: string; architecture: NormalizedArchitecture; onSelect: (id: string) => void }) {
  const e = architecture.entitiesById[id];
  const cat = e ? architecture.categoriesById[e.category] : undefined;
  return (
    <button type="button" className="sp-row" onClick={() => onSelect(id)}>
      <span className="cat-dot" style={{ background: cat?.color }} />
      <span className="sp-row__text">{e?.name ?? id}</span>
      <span className="mono support-label">{architecture.breakdownCodes[id] ?? id}</span>
    </button>
  );
}

function EntityPill({ id, architecture, onSelect, current }: { id: string; architecture: NormalizedArchitecture; onSelect: (id: string) => void; current?: boolean }) {
  const e = architecture.entitiesById[id];
  const cat = e ? architecture.categoriesById[e.category] : undefined;
  return (
    <button type="button" className={`sp-pill${current ? ' is-current' : ''}`} onClick={() => onSelect(id)} title={e?.name} style={{ borderColor: cat ? `color-mix(in srgb, ${cat.color} 45%, transparent)` : undefined }}>
      <span className="mono support-label">{architecture.breakdownCodes[id] ?? ''}</span> {e?.short ?? e?.name ?? id}
    </button>
  );
}

function ParamPill({ paramKey, architecture, onSelect }: { paramKey: string; architecture: NormalizedArchitecture; onSelect: (id: string) => void }) {
  const p = architecture.evaluation.params[paramKey];
  const derived = architecture.evaluation.derived[paramKey];
  if (!p) {
    return <span className="sp-pill sp-pill--static mono">{paramKey}{derived !== undefined ? ` = ${fmtNum(derived)}` : ''}</span>;
  }
  return (
    <button type="button" className="sp-pill mono" onClick={() => onSelect(p.entityId)} title={p.name}>
      {paramKey} = {fmtQty(p.value, p.unit)}
    </button>
  );
}

function PillGroup({ label, ids, architecture, onSelect }: { label: string; ids: string[]; architecture: NormalizedArchitecture; onSelect: (id: string) => void }) {
  if (ids.length === 0) return null;
  return (
    <div className="sp-pillgroup">
      <span className="support-label">{label}</span>
      <div className="sp-pills">{ids.map((id) => <EntityPill key={id} id={id} architecture={architecture} onSelect={onSelect} />)}</div>
    </div>
  );
}

function TraceSetsView({ trace, architecture, onSelect, currentId }: { trace: TraceSets; architecture: NormalizedArchitecture; onSelect: (id: string) => void; currentId: string }) {
  const groups: { label: string; ids: string[] }[] = [
    { label: 'Missão', ids: trace.mission ? [trace.mission] : [] },
    { label: 'Objetivos', ids: trace.objectives },
    { label: 'Requisitos', ids: trace.requirements },
    { label: 'Funções', ids: trace.functions },
    { label: 'Segmentos', ids: trace.segments },
    { label: 'Subsistemas', ids: trace.subsystems },
    { label: 'Componentes', ids: trace.components },
    { label: 'Verificações', ids: trace.verifications },
  ].filter((g) => g.ids.length > 0 && !(g.ids.length === 1 && g.ids[0] === currentId));
  if (groups.length === 0) return null;
  return (
    <section className="sp-section">
      <h3 className="section-title">Rastreabilidade</h3>
      <div className="sp-trace">
        {groups.map((g) => (
          <div key={g.label} className="sp-trace__row">
            <span className="support-label sp-trace__label">{g.label}</span>
            <div className="sp-pills">
              {g.ids.map((id) => <EntityPill key={id} id={id} architecture={architecture} onSelect={onSelect} current={id === currentId} />)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RelationsList({ title, relations, endpoint, architecture, onSelect }: {
  title: string; relations: ArchitectureRelation[]; endpoint: 'source' | 'target'; architecture: NormalizedArchitecture; onSelect: (id: string) => void;
}) {
  const selectRelation = useArchitectureStore((s) => s.selectRelation);
  if (relations.length === 0) return null;
  return (
    <section className="sp-section">
      <div className="sp-section__head"><h3 className="section-title">{title}</h3><span className="support-label mono">{relations.length}</span></div>
      <ul className="sp-list sp-list--compact">
        {relations.map((r) => {
          const rt = architecture.relationTypesById[r.type];
          const otherId = endpoint === 'target' ? r.target : r.source;
          const other = architecture.entitiesById[otherId];
          return (
            <li key={r.id} className="sp-relrow">
              <button type="button" className="sp-relrow__badge" onClick={() => selectRelation(r.id)} title={`Ver relação: ${rt.label}`} aria-label={`Ver relação ${rt.label}`}>
                <span className="num-badge" style={{ background: rt.color }}>{rt.index}</span>
              </button>
              <button type="button" className="sp-row" onClick={() => onSelect(otherId)}>
                <span className="sp-row__body">
                  <span className="sp-row__text">{endpoint === 'target' ? '→' : '←'} {other?.short ?? other?.name ?? otherId}</span>
                  <span className="support-label">{rt.label}{r.label ? `: ${r.label}` : ''}{r.criticality ? `, criticidade ${criticalityLabel(r.criticality)}` : ''}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ── Relation details ───────────────────────────────────────── */

function RelationDetails({ relation, architecture, onSelect }: { relation: ArchitectureRelation; architecture: NormalizedArchitecture; onSelect: (id: string) => void }) {
  const rt = architecture.relationTypesById[relation.type];
  const source = architecture.entitiesById[relation.source];
  const target = architecture.entitiesById[relation.target];
  const meta = Object.entries(relation.metadata ?? {});
  const applyEdit = useArchitectureStore((s) => s.applyEdit);
  const review = linkReviewState(architecture, relation);
  const changedNames = review.changed.map((end) => {
    const e = end === 'source' ? source : target;
    return e ? `${architecture.breakdownCodes[e.id] ?? ''} ${e.short ?? e.name}`.trim() : end;
  });
  return (
    <div className="sp-stack">
      <header className="sp-title">
        <div className="sp-title__row">
          <span className="num-badge" style={{ background: rt.color }}>{rt.index}</span>
          <span className="section-title">{rt.label}</span>
          {relation.criticality && <span className={`chip chip--${relation.criticality === 'critical' || relation.criticality === 'high' ? 'warn' : 'neutral'}`}><span className="chip__dot" />criticidade {criticalityLabel(relation.criticality)}</span>}
        </div>
        <p className="sp-paragraph">{rt.description}</p>
      </header>

      <section className="sp-section">
        <div className="sp-flow">
          <EntityPill id={relation.source} architecture={architecture} onSelect={onSelect} />
          <svg width="36" height="12" viewBox="0 0 36 12" aria-hidden="true">
            <line x1="0" y1="6" x2="30" y2="6" stroke={rt.color} strokeWidth={2} strokeDasharray={rt.lineStyle === 'dashed' ? '8 4' : rt.lineStyle === 'dotted' ? '2 4' : ''} />
            {rt.directed && <polygon points="26,2 36,6 26,10" fill={rt.color} />}
          </svg>
          <EntityPill id={relation.target} architecture={architecture} onSelect={onSelect} />
        </div>
        {relation.label && <div className="kv"><span className="kv__k">Rótulo</span><span className="kv__v">{relation.label}</span></div>}
        {relation.description && <div className="kv"><span className="kv__k">Descrição</span><span className="kv__v">{relation.description}</span></div>}
        <div className="kv"><span className="kv__k">Etapa</span><span className="kv__v mono">{relation.step}</span></div>
        {meta.map(([k, v]) => <div key={k} className="kv"><span className="kv__k">{k}</span><span className="kv__v mono">{String(v)}</span></div>)}
        {source && target && source.category !== target.category && (
          <p className="support-label">Cruza categorias ({architecture.categoriesById[source.category]?.label} → {architecture.categoriesById[target.category]?.label}): interface de sistema.</p>
        )}
      </section>

      <section className="sp-section">
        <h3 className="section-title">Revisão da ligação</h3>
        {review.state === 'suspect' && (
          <p className="sp-paragraph">
            <span className="chip chip--warn"><span className="chip__dot" />suspeita</span>{' '}
            {changedNames.join(' e ')} mudou depois da última revisão{relation.reviewed?.at ? ` (${relation.reviewed.at})` : ''}. Confira se a ligação continua valendo.
          </p>
        )}
        {review.state === 'reviewed' && (
          <p className="sp-paragraph"><span className="chip chip--ok"><span className="chip__dot" />revisada</span>{relation.reviewed?.at ? ` em ${relation.reviewed.at}` : ''}; as duas pontas não mudaram desde então.</p>
        )}
        {review.state === 'untracked' && (
          <p className="sp-paragraph">Esta ligação ainda não foi revisada; ao marcá-la, qualquer mudança futura nas pontas a deixa suspeita.</p>
        )}
        {review.state !== 'reviewed' && (
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => applyEdit('Marcar ligação como revisada', (doc) => { stampReview(doc, [relation.id]); })}>
            Marcar como revisada
          </button>
        )}
      </section>
    </div>
  );
}
