import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  useStore,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { GraphVoiceBar } from './GraphVoiceBar';
import { ArchitectureNode, type ArchitectureNodeData } from './ArchitectureNode';
import { ArchitectureEdge, type ArchitectureEdgeData } from './ArchitectureEdge';
import { RowBackground, FamilyBackground } from './RowBackground';
import { useKeyboardPan } from './useKeyboardPan';
import { NavHint } from '../layout/NavHint';
import { useFlowLayout, NODE_WIDTH, NODE_HEIGHT } from './useFlowLayout';
import { badgeScaleForZoom, corridorShift, edgeShape, handlePoint, placeBadges, type BadgeRequest, type EdgeShape, type HandleId } from './edgeGeometry';
import { getRelationVisualStyle } from '../../domain/parser/relationStyle';
import { computeFocusedNeighbors, computePairGroups } from '../../domain/analysis/focus';
import {
  useArchitectureStore,
  computeVisibleEntities,
  computeVisibleRelations,
  type GraphLens,
} from '../../state/architectureStore';
import type { ArchitectureEntity, ArchitectureRelation, NormalizedArchitecture } from '../../domain/model/ArchitectureTypes';

const NODE_TYPES = { entity: ArchitectureNode, rowbg: RowBackground, familybg: FamilyBackground } as const;
const EDGE_TYPES = { architecture: ArchitectureEdge } as const;

/**
 * Categories of the interfaces lens. Segments stay out: their few external
 * interfaces (the launcher) show in the full view, and a segment row above
 * the subsystems would sit in the way of the arc diagram.
 */
const PHYSICAL = new Set(['subsystem', 'component']);

const LENSES: { id: GraphLens; label: string; title: string }[] = [
  { id: 'all', label: 'Tudo', title: 'Todas as entidades e relações' },
  { id: 'trace', label: 'Rastreabilidade', title: 'Missão, objetivos, requisitos, funções, elementos e verificações, com as relações de origem, satisfação, alocação e verificação' },
  { id: 'interfaces', label: 'Interfaces', title: 'Subsistemas e componentes, com as interfaces de potência, dados, comando, mecânicas e térmicas' },
];

/**
 * Apply the viewpoint on top of the legend filters. The lens is decided by
 * the endpoints, not by relation-type ids, so it works for any model:
 * a relation between two physical elements is an interface, anything that
 * touches mission, requirement, function or verification is traceability.
 */
function applyLens(
  architecture: NormalizedArchitecture | null,
  entities: ArchitectureEntity[],
  relations: ArchitectureRelation[],
  lens: GraphLens,
): { entities: ArchitectureEntity[]; relations: ArchitectureRelation[] } {
  if (!architecture || lens === 'all') return { entities, relations };
  const cat = (id: string) => architecture.entitiesById[id]?.category ?? '';
  const isInterface = (r: ArchitectureRelation) => PHYSICAL.has(cat(r.source)) && PHYSICAL.has(cat(r.target));
  const kept = relations.filter((r) => (lens === 'interfaces' ? isInterface(r) : !isInterface(r)));
  const endpoints = new Set(kept.flatMap((r) => [r.source, r.target]));
  const keptEntities = entities.filter((e) => (lens === 'interfaces'
    ? PHYSICAL.has(e.category)
    : e.category !== 'component' || endpoints.has(e.id)));
  const ids = new Set(keptEntities.map((e) => e.id));
  return { entities: keptEntities, relations: kept.filter((r) => ids.has(r.source) && ids.has(r.target)) };
}

/**
 * Pick the pair of (sourceHandle, targetHandle) that yields the most
 * natural connection given where the two cards sit relative to each other.
 *
 *  • Same row (|Δy| < 12 px) → both on `sameRowSide`: above the row, or below
 *    it for components, whose lower neighbour (verification) has few edges.
 *  • One row apart vertically  → bottom–top (or top–bottom going up).
 *  • Far horizontal, same height → right–left (or left–right).
 *
 * The actual curve is drawn by ArchitectureEdge as a cubic bezier whose
 * control points extend in the normal direction of each chosen side, so
 * the line always leaves and enters perpendicular to the card edge.
 */
function pickHandles(
  src: { x: number; y: number } | undefined,
  tgt: { x: number; y: number } | undefined,
  sameRowSide: HandleId,
): { source: HandleId; target: HandleId } {
  if (!src || !tgt) return { source: 'bottom', target: 'top' };
  const dx = tgt.x - src.x;
  const dy = tgt.y - src.y;

  // Intra-row: a shallow arc on the side with less traffic (see sameRowSide).
  if (Math.abs(dy) < 12) {
    return { source: sameRowSide, target: sameRowSide };
  }

  // Different rows → vertical handles (most natural for hierarchy)
  if (Math.abs(dy) > 80) {
    return dy > 0
      ? { source: 'bottom', target: 'top' }
      : { source: 'top', target: 'bottom' };
  }

  // Slight vertical offset but mostly horizontal → side handles
  return dx > 0
    ? { source: 'right', target: 'left' }
    : { source: 'left', target: 'right' };
}

function FitOnChange({ depend, entityIds }: { depend: unknown[]; entityIds: string[] }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const t = setTimeout(
      () => fitView({
        padding: 0.06,
        duration: 450,
        maxZoom: 1.4,
        // Only entity nodes — ignore the wide swimlane backgrounds when fitting.
        nodes: entityIds.map((id) => ({ id })),
      }),
      80,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, depend);
  return null;
}

/**
 * When a single entity becomes selected, smoothly re-frame the viewport
 * onto that entity AND its direct neighbours so the user can read every
 * incident relation without panning.
 *
 *   - selectedEntityId changes → fit-to (entity + neighbours)
 *   - selectedEntityId cleared  → fit-to (everything)
 *
 * The set of nodes to focus on is supplied by the parent (already computed
 * for the dim/highlight logic).
 */
function FitOnSelection({
  selectedId,
  focusIds,
  allEntityIds,
}: {
  selectedId: string | null;
  focusIds: string[];
  allEntityIds: string[];
}) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const t = setTimeout(() => {
      const nodes = selectedId
        ? focusIds.map((id) => ({ id }))
        : allEntityIds.map((id) => ({ id }));
      fitView({
        padding: selectedId ? 0.25 : 0.06,
        duration: 600,
        maxZoom: selectedId ? 1.0 : 1.4,
        nodes,
      });
    }, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);
  return null;
}

const NO_IDS: ReadonlySet<string> = new Set();
const MAX_ANIMATED_NEW = 6;

function FlowCanvas({ active = true }: { active?: boolean }) {
  useKeyboardPan(active);
  const architecture = useArchitectureStore((s) => s.architecture);
  const selectedEntityId = useArchitectureStore((s) => s.selectedEntityId);
  const selectedRelationId = useArchitectureStore((s) => s.selectedRelationId);
  const explorationMode = useArchitectureStore((s) => s.explorationMode);
  const currentStep = useArchitectureStore((s) => s.currentStep);
  const focusedSubsystemId = useArchitectureStore((s) => s.focusedSubsystemId);
  const visibleRelationTypes = useArchitectureStore((s) => s.visibleRelationTypes);
  const visibleCategories = useArchitectureStore((s) => s.visibleCategories);
  const showOnlyCrossCategory = useArchitectureStore((s) => s.showOnlyCrossCategory);
  const ripple = useArchitectureStore((s) => s.ripple);
  const clearRipple = useArchitectureStore((s) => s.clearRipple);
  const liveModeId = useArchitectureStore((s) => s.liveModeId);
  // Entities switched off in the mode the simulation is currently in.
  const offSet = useMemo(() => {
    if (!architecture || !liveModeId) return null;
    const mode = architecture.modes?.find((md) => md.id === liveModeId);
    if (!mode?.active) return null;
    const active = new Set(mode.active);
    const hasActiveChild = (id: string) => architecture.entities.some((c) => c.parentId === id && active.has(c.id));
    // A mode describes one segment (the spacecraft): elements of a segment with
    // nothing active in the mode, like the ground station, are not switched off.
    const segmentOf = (id: string): string | undefined => {
      let cur: ArchitectureEntity | undefined = architecture.entitiesById[id];
      for (let guard = 0; cur && guard < 20; guard++) {
        if (cur.category === 'segment') return cur.id;
        cur = cur.parentId ? architecture.entitiesById[cur.parentId] : undefined;
      }
      return undefined;
    };
    const modeSegments = new Set([...active].map(segmentOf).filter(Boolean));
    // Only what some mode switches on can be off: a passive element (the
    // structure) is never listed in a mode and stays lit.
    const everActive = new Set((architecture.modes ?? []).flatMap((md) => md.active ?? []));
    const switchable = (e: ArchitectureEntity) => everActive.has(e.id) || (!!e.parentId && everActive.has(e.parentId))
      || architecture.entities.some((c) => c.parentId === e.id && everActive.has(c.id));
    return new Set(
      architecture.entities
        .filter((e) => (e.category === 'subsystem' || e.category === 'component') && switchable(e) && !active.has(e.id) && !(e.parentId && active.has(e.parentId)) && !hasActiveChild(e.id))
        .filter((e) => { const seg = segmentOf(e.id); return seg === undefined || modeSegments.has(seg); })
        .map((e) => e.id),
    );
  }, [architecture, liveModeId]);
  const liveModeName = liveModeId ? (architecture?.modes?.find((md) => md.id === liveModeId)?.name ?? (liveModeId === '__eclipse' ? 'Eclipse' : liveModeId)) : null;
  // The pulse is CSS; drop the flag once the farthest node has played.
  useEffect(() => {
    if (!ripple) return;
    const deepest = Math.max(0, ...Object.values(ripple.levels));
    const t = window.setTimeout(clearRipple, deepest * 90 + 700);
    return () => window.clearTimeout(t);
  }, [ripple, clearRipple]);

  const lens = useArchitectureStore((s) => s.lens);
  const theme = useArchitectureStore((s) => s.theme);
  // Badges keep a readable size when the whole graph is fitted on screen.
  const badgeScale = useStore((s) => badgeScaleForZoom(s.transform[2]));
  const setLens = useArchitectureStore((s) => s.setLens);
  const baseEntities = useMemo(
    () => computeVisibleEntities(architecture, visibleCategories, explorationMode, currentStep),
    [architecture, visibleCategories, explorationMode, currentStep],
  );
  const baseRelations = useMemo(
    () => computeVisibleRelations(architecture, baseEntities, visibleRelationTypes, explorationMode, currentStep, showOnlyCrossCategory),
    [architecture, baseEntities, visibleRelationTypes, explorationMode, currentStep, showOnlyCrossCategory],
  );
  const { entities: visibleEntities, relations: visibleRelations } = useMemo(
    () => applyLens(architecture, baseEntities, baseRelations, lens),
    [architecture, baseEntities, baseRelations, lens],
  );

  const selectEntity = useArchitectureStore((s) => s.selectEntity);
  const selectRelation = useArchitectureStore((s) => s.selectRelation);
  const minimapOpen = useArchitectureStore((s) => s.minimapOpen);
  const toggleMinimap = useArchitectureStore((s) => s.toggleMinimap);

  const layout = useFlowLayout(architecture, visibleEntities, visibleRelations);

  // Focus neighbours (shared with the 3D scene so both views dim the same things).
  const focusedNeighbors = useMemo(
    () => computeFocusedNeighbors(architecture, selectedEntityId, focusedSubsystemId),
    [architecture, selectedEntityId, focusedSubsystemId],
  );

  // What a command just created enters with an effect. A whole model loading at once does not.
  const seenIds = useRef<Set<string> | null>(null);
  const newIds = useMemo(() => {
    const seen = seenIds.current;
    if (!seen) return NO_IDS;
    const fresh = [...visibleEntities.map((e) => e.id), ...visibleRelations.map((r) => r.id)].filter((id) => !seen.has(id));
    return fresh.length > 0 && fresh.length <= MAX_ANIMATED_NEW ? new Set(fresh) : NO_IDS;
  }, [visibleEntities, visibleRelations]);
  useEffect(() => {
    const seen = seenIds.current ?? new Set<string>();
    visibleEntities.forEach((e) => seen.add(e.id));
    visibleRelations.forEach((r) => seen.add(r.id));
    seenIds.current = seen;
  }, [visibleEntities, visibleRelations]);

  /* ── Build React Flow nodes ──────────────────────────────────── */
  const flowNodes: Node[] = useMemo(() => {
    if (!architecture) return [];
    // Lanes reach only a little past the outer cards, so their labels stay
    // inside the fitted viewport.
    const rowWidth =
      Math.max(layout.bounds.maxX - layout.bounds.minX, NODE_WIDTH) + 72;
    const rowX = layout.bounds.minX - 36;

    const rowNodes: Node[] = layout.rows.map((row) => ({
      id: `row-${row.id}`,
      type: 'rowbg',
      width: rowWidth,
      height: row.height,
      position: { x: rowX, y: row.y },
      data: {
        label: row.label,
        color: row.color,
        width: rowWidth,
        height: row.height,
      },
      selectable: false,
      draggable: false,
      focusable: false,
      style: { zIndex: -1 },
      zIndex: -1,
    }));

    const familyNodes: Node[] = layout.families.map((f) => ({
      // One parent can have children on several rows (the mission has objectives
      // and segments): the row keeps node ids unique, which fitView depends on.
      id: `familybg-${f.parentId}-${Math.round(f.y)}`,
      type: 'familybg',
      position: { x: f.x, y: f.y },
      width: f.width,
      height: f.height,
      data: {
        parentName: architecture.entitiesById[f.parentId]?.name ?? f.parentId,
        color: f.color,
        width: f.width,
        height: f.height,
      },
      draggable: false,
      selectable: false,
      connectable: false,
      focusable: false,
      style: { zIndex: -1 },
      zIndex: -1,
    }));

    const entityNodes: Node[] = visibleEntities.map((entity) => {
      const pos = layout.positions.get(entity.id) ?? { x: 0, y: 0 };
      const cat = architecture.categoriesById[entity.category];
      const isSelected = entity.id === selectedEntityId;
      const isHighlighted = focusedNeighbors?.entityIds.has(entity.id) ?? false;
      const isDimmed =
        (selectedEntityId !== null || focusedSubsystemId !== null) && !isHighlighted;

      const data: ArchitectureNodeData = {
        entityId: entity.id,
        name: entity.name,
        category: cat,
        status: entity.status,
        isSelected,
        isDimmed,
        isHighlighted: isHighlighted && !isSelected,
        step: entity.step,
        parentId: entity.parentId,
        breakdownCode: architecture.breakdownCodes[entity.id] ?? entity.id,
        short: entity.short,
        ruleResult: architecture.evaluation.rules[entity.id]?.result,
        rippleLevel: ripple?.levels[entity.id],
        isNew: newIds.has(entity.id),
        rippleTick: ripple?.tick,
        isOff: offSet?.has(entity.id) ?? false,
      };
      return {
        id: entity.id,
        type: 'entity',
        position: { x: pos.x, y: pos.y },
        // Explicit size: with controlled nodes React Flow never writes `measured`
        // back into our objects, and the MiniMap only draws nodes with a size.
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        data: data as unknown as Record<string, unknown>,
        draggable: false,
        connectable: false,
        zIndex: isSelected ? 20 : 10,
      };
    });

    return [...rowNodes, ...familyNodes, ...entityNodes];
  }, [
    architecture, visibleEntities, layout, selectedEntityId, focusedSubsystemId, focusedNeighbors, ripple, offSet, newIds,
  ]);

  /* ── Build React Flow edges ──────────────────────────────────── */
  const flowEdges: Edge[] = useMemo(() => {
    if (!architecture) return [];

    // Offset parallel edges so two relations between the same pair never overlap.
    const pairGroups = computePairGroups(visibleRelations);

    // With only the physical rows on screen there is room for an arc diagram.
    const arcScale = lens === 'interfaces' ? 3.2 : 1;

    // Pass 1: style and geometry of every edge.
    const drafts = visibleRelations.map((relation) => {
      const rt = architecture.relationTypesById[relation.type];
      const source = architecture.entitiesById[relation.source];
      const target = architecture.entitiesById[relation.target];
      const isSelected = relation.id === selectedRelationId;
      const inFocus = focusedNeighbors?.relationIds.has(relation.id) ?? false;
      const isDimmed =
        (selectedEntityId !== null || focusedSubsystemId !== null) && !inFocus && !isSelected;
      const isEmphasized = isSelected || inFocus;

      const vs = getRelationVisualStyle(relation, rt, source, target, {
        selected: isSelected,
        emphasizedByFilter: isEmphasized,
        dimmed: isDimmed,
      });

      const { offset: pairOffset, total: pairTotal } = pairGroups.get(relation.id) ?? { offset: 0, total: 1 };

      const srcPos = layout.positions.get(relation.source);
      const tgtPos = layout.positions.get(relation.target);
      const sameRow = !!srcPos && !!tgtPos && srcPos.row === tgtPos.row;
      // Same-row arcs go above the row, except components, whose lower
      // neighbour (verification) carries few edges.
      const handles = pickHandles(srcPos, tgtPos, source?.category === 'component' ? 'bottom' : 'top');
      // Long cross-row edges bow through a corridor that is free in every row they cross.
      const obstacleShift = corridorShift(srcPos, tgtPos, layout.positions.values());
      // In the interfaces view every relation is an interface, so every one carries its number.
      const wantsBadge = !isDimmed && (isSelected || inFocus || vs.isCrossCategory || lens === 'interfaces');
      return { relation, rt, vs, isSelected, inFocus, isDimmed, isEmphasized, pairOffset, pairTotal, handles, obstacleShift, sameRow, srcPos, tgtPos, wantsBadge,
        sOff: { x: 0, y: 0 }, tOff: { x: 0, y: 0 }, shape: null as EdgeShape | null };
    });

    // Ports: edges sharing one side of a card attach at distinct points along
    // it, ordered by where the other end lies, so they leave as a fan instead
    // of a single bundle and do not cross each other at the card.
    const ports = new Map<string, Array<{ d: (typeof drafts)[number]; end: 's' | 't'; key: number }>>();
    for (const d of drafts) {
      if (!d.srcPos || !d.tgtPos) continue;
      const centre = (p: { x: number; y: number }) => ({ x: p.x + NODE_WIDTH / 2, y: p.y + NODE_HEIGHT / 2 });
      const sc = centre(d.srcPos);
      const tc = centre(d.tgtPos);
      const horizontalSide = (h: HandleId) => h === 'top' || h === 'bottom';
      const add = (node: string, side: HandleId, end: 's' | 't', other: { x: number; y: number }) => {
        const k = `${node}|${side}`;
        const list = ports.get(k) ?? [];
        list.push({ d, end, key: horizontalSide(side) ? other.x : other.y });
        ports.set(k, list);
      };
      add(d.relation.source, d.handles.source, 's', tc);
      add(d.relation.target, d.handles.target, 't', sc);
    }
    for (const [k, list] of ports) {
      if (list.length < 2) continue;
      const side = k.slice(k.lastIndexOf('|') + 1) as HandleId;
      const span = (side === 'top' || side === 'bottom' ? NODE_WIDTH : NODE_HEIGHT) * 0.72;
      const step = Math.min(18, span / (list.length - 1));
      list.sort((a, b) => a.key - b.key || a.d.relation.id.localeCompare(b.d.relation.id));
      list.forEach((p, i) => {
        const off = (i - (list.length - 1) / 2) * step;
        const v = side === 'top' || side === 'bottom' ? { x: off, y: 0 } : { x: 0, y: off };
        if (p.end === 's') p.d.sOff = v; else p.d.tOff = v;
      });
    }
    for (const d of drafts) {
      if (!d.srcPos || !d.tgtPos) continue;
      const s = handlePoint(d.srcPos, d.handles.source);
      const t = handlePoint(d.tgtPos, d.handles.target);
      d.shape = edgeShape({ x: s.x + d.sOff.x, y: s.y + d.sOff.y }, { x: t.x + d.tOff.x, y: t.y + d.tOff.y },
        d.handles.source, d.handles.target, d.pairOffset, d.obstacleShift, d.sameRow, arcScale);
    }

    // Pass 2: place all badges at once so no two numbers stack.
    const requests: BadgeRequest[] = drafts
      .filter((d) => d.wantsBadge && d.shape)
      .map((d) => ({
        id: d.relation.id,
        shape: d.shape!,
        index: d.rt.index,
        priority: d.isSelected ? 3 : d.inFocus ? 2 : 1,
      }));
    const cards = visibleEntities
      .map((e) => layout.positions.get(e.id))
      .filter((p): p is NonNullable<typeof p> => !!p);
    const placements = placeBadges(requests, cards, badgeScale);

    return drafts.map((d) => {
      const placement = placements.get(d.relation.id);
      const data: ArchitectureEdgeData = {
        relationId: d.relation.id,
        isNew: newIds.has(d.relation.id),
        style: d.vs,
        relationTypeLabel: d.rt.label,
        relationIndex: d.rt.index,
        description: d.rt.description,
        isSelected: d.isSelected,
        isDimmed: d.isDimmed,
        isEmphasized: d.isEmphasized,
        onClick: selectRelation,
        pairOffset: d.pairOffset,
        pairTotal: d.pairTotal,
        animated: d.isSelected,
        showBadge: d.wantsBadge && (placement?.visible ?? true),
        badgeT: placement?.t ?? 0.5,
        obstacleShift: d.obstacleShift,
        sameRow: d.sameRow,
        sourceShift: d.sOff,
        targetShift: d.tOff,
        arcScale,
      };

      return {
        id: d.relation.id,
        source: d.relation.source,
        target: d.relation.target,
        sourceHandle: d.handles.source,
        targetHandle: d.handles.target,
        type: 'architecture',
        data: data as unknown as Record<string, unknown>,
        zIndex: d.isSelected ? 30 : d.isDimmed ? 1 : 5,
      };
    });
  }, [
    architecture, visibleEntities, visibleRelations, layout, selectedRelationId, selectedEntityId, focusedSubsystemId, focusedNeighbors, selectRelation, lens, badgeScale, newIds,
  ]);

  /* ── Handlers ────────────────────────────────────────────────── */
  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
      if (node.type === 'entity') selectEntity(node.id);
    },
    [selectEntity],
  );

  const onPaneClick = useCallback(() => {
    selectEntity(null);
    selectRelation(null);
  }, [selectEntity, selectRelation]);

  const showStats = visibleEntities.length;
  const minimapNodeColor = useCallback(
    (n: Node) => (n.type === 'entity' ? (n.data as ArchitectureNodeData).category.color : 'transparent'),
    [],
  );

  return (
    <div className="flow2d-shell">
      <div className="flow2d-toolbar">
        <div className="segmented" role="group" aria-label="Vista do grafo">
          {LENSES.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`segmented__item${lens === l.id ? ' is-on' : ''}`}
              aria-pressed={lens === l.id}
              title={l.title}
              onClick={() => setLens(l.id)}
            >
              {l.label}
            </button>
          ))}
        </div>
        <span className="flow2d-toolbar__stat">
          <strong className="mono">{showStats}</strong> entidades, <strong className="mono">{visibleRelations.length}</strong> relações
        </span>
        {explorationMode === 'step' && architecture && (
          <span className="chip chip--info"><span className="chip__dot" />etapa {currentStep} de {architecture.maxStep}</span>
        )}
        {liveModeName && <span className="chip chip--info" title="Modo operacional da simulação na cena Satélite; elementos desligados ficam apagados"><span className="chip__dot" />modo ao vivo: {liveModeName}</span>}
        {showOnlyCrossCategory && <span className="chip chip--neutral">só relações entre categorias</span>}
        {focusedSubsystemId && (
          <span className="chip chip--neutral">
            foco: {architecture?.entitiesById[focusedSubsystemId]?.short ?? architecture?.entitiesById[focusedSubsystemId]?.name ?? focusedSubsystemId}
          </span>
        )}
        <div className="flow2d-toolbar__spacer" />
        <GraphVoiceBar />
        <button type="button" className={`btn btn--ghost btn--sm${minimapOpen ? ' is-on' : ''}`} onClick={toggleMinimap} aria-pressed={minimapOpen}>
          Minimapa
        </button>
      </div>

      <div className="flow2d-canvas" style={{ '--badge-scale': badgeScale } as React.CSSProperties}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
          minZoom={0.2}
          maxZoom={2.5}
          defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
          colorMode={theme}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ type: 'architecture' }}
        >
          <FitOnChange
            depend={[architecture, visibleCategories, visibleRelationTypes, explorationMode, currentStep, lens]}
            entityIds={visibleEntities.map((e) => e.id)}
          />
          <FitOnSelection
            selectedId={selectedEntityId}
            focusIds={focusedNeighbors ? [...focusedNeighbors.entityIds] : []}
            allEntityIds={visibleEntities.map((e) => e.id)}
          />
          <Background variant={BackgroundVariant.Dots} color={theme === 'light' ? 'rgba(20,32,46,0.14)' : 'rgba(255,255,255,0.07)'} gap={32} size={1.2} />
          <Controls showInteractive={false} />
          {minimapOpen && (
            <MiniMap
              pannable
              zoomable
              nodeColor={minimapNodeColor}
              nodeStrokeWidth={0}
              maskColor={theme === 'light' ? 'rgba(233, 237, 242, 0.7)' : 'rgba(15, 20, 27, 0.7)'}
              bgColor="var(--panel)"
              ariaLabel="Minimapa do grafo"
            />
          )}
        </ReactFlow>
        <NavHint mode="2d" />
      </div>
    </div>
  );
}


export function ArchitectureFlow({ active = true }: { active?: boolean }) {
  return (
    <ReactFlowProvider>
      <FlowCanvas active={active} />
    </ReactFlowProvider>
  );
}
