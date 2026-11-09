import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, Position, type EdgeProps } from '@xyflow/react';
import { RelationBadge } from './RelationBadge';
import { edgeShape, pointAt, shapePath, type HandleId } from './edgeGeometry';
import type { RelationVisualStyle } from '../../domain/parser/relationStyle';

export interface ArchitectureEdgeData extends Record<string, unknown> {
  relationId: string;
  /** Just created by a command: the line draws itself. */
  isNew?: boolean;
  style: RelationVisualStyle;
  relationTypeLabel: string;
  relationIndex: number;
  description?: string;
  isSelected: boolean;
  isDimmed: boolean;
  isEmphasized: boolean;
  onClick?: (id: string) => void;
  /** Symmetric offset for parallel edges between the same node pair (… -1, 0, +1 …). */
  pairOffset: number;
  pairTotal: number;
  /** When true, animate a dash flow along the path. */
  animated: boolean;
  /** Where to put the badge along the curve, in (0,1). 0.5 = midpoint. */
  badgeT: number;
  /** Signed horizontal shift in px for obstacle avoidance (cross-row edges). */
  obstacleShift: number;
  /** Badge at rest only for cross-category edges; all edges in focus show it. */
  showBadge?: boolean;
  /** Source and target on the same row: shallow arc that stays out of the next lane. */
  sameRow?: boolean;
  /** Port offsets along the card side, so edges sharing a side fan out. */
  sourceShift?: { x: number; y: number };
  targetShift?: { x: number; y: number };
  /** Height multiplier for same-row arcs. */
  arcScale?: number;
}

/**
 * Cubic-bezier edge that leaves and enters each card PERPENDICULAR to the
 * chosen handle side.
 *
 *   source side normal     target side normal
 *           ↓                     ↑
 *      ╭────────────╮         ╭────────────╮
 *      │   source   │   ↘ ↗   │   target   │
 *      ╰────────────╯         ╰────────────╯
 *
 * The control points extend out along those normals so the curve looks
 * like it grew out of the card naturally instead of grazing its corner.
 * Extension length is proportional to the source→target distance, so
 * long edges curve gently and short edges turn quickly.
 *
 * Parallel edges between the same pair are offset perpendicular to the
 * source→target line so they fan out instead of stacking.
 */
function ArchitectureEdgeImpl(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props;
  const d = data as ArchitectureEdgeData;
  const { style: vs, isSelected, isDimmed, isEmphasized, relationIndex } = d;

  // Same geometry the flow used to place the badge (edgeGeometry.ts).
  const ss = d.sourceShift ?? { x: 0, y: 0 };
  const ts = d.targetShift ?? { x: 0, y: 0 };
  const shape = edgeShape(
    { x: sourceX + ss.x, y: sourceY + ss.y }, { x: targetX + ts.x, y: targetY + ts.y },
    positionToHandle(sourcePosition), positionToHandle(targetPosition),
    d.pairOffset, d.obstacleShift ?? 0, d.sameRow ?? false, d.arcScale ?? 1,
  );
  const path = shapePath(shape);

  // t is chosen by placeBadges in the flow so badges never stack.
  const { x: labelX, y: labelY } = pointAt(shape, d.badgeT ?? 0.5);

  const markerId = `arrow-${d.relationId}`;

  const dashFromStyle = vs.dashArray === 'none' ? undefined : vs.dashArray;
  const animDash = d.animated && !isDimmed ? '12 8' : undefined;
  const strokeDashArray = animDash ?? dashFromStyle;

  // When something is selected and this edge is unrelated, show only a
  // faint outline so the user can still feel the overall project shape
  // without it competing with the active relations.
  if (isDimmed) {
    return (
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: vs.color,
          strokeWidth: 1.2,
          opacity: 0.12,
          fill: 'none',
        }}
      />
    );
  }

  return (
    <>
      <defs>
        {vs.isDirected && (
          <marker
            id={markerId}
            markerWidth="14"
            markerHeight="14"
            refX="11"
            refY="5"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path
              d="M0,1 L0,9 L11,5 z"
              fill={vs.color}
              opacity={1}
            />
          </marker>
        )}
      </defs>

      {/* Soft glow underline for the selected edge only */}
      {isSelected && (
        <BaseEdge
          id={`${id}-glow`}
          path={path}
          style={{
            stroke: vs.color,
            strokeWidth: vs.strokeWidth + 8,
            opacity: 0.18,
            filter: `blur(2px)`,
            fill: 'none',
          }}
        />
      )}

      <BaseEdge
        id={id}
        path={path}
        className={d.isNew ? 'arch-edge-new' : undefined}
        pathLength={d.isNew ? 1 : undefined}
        style={{
          stroke: vs.color,
          strokeWidth: vs.strokeWidth,
          strokeDasharray: d.isNew ? undefined : strokeDashArray,
          strokeLinecap: 'round',
          opacity: vs.opacity,
          fill: 'none',
          animation: d.animated
            ? `arch-edge-flow ${isSelected ? 1.4 : 2.2}s linear infinite`
            : undefined,
        }}
        markerEnd={vs.isDirected ? `url(#${markerId})` : undefined}
      />

      {/* Numeric badge with tooltip */}
      {d.showBadge !== false && (
      <EdgeLabelRenderer>
        <button
          type="button"
          className="arch-edge-badge-wrap nodrag nopan"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            // Above every edge layer (edges use 1, 5 and 30 when selected), so the
            // selected line and its click band never cover a number.
            zIndex: isSelected ? 41 : 40,
          }}
          onClick={(e) => {
            e.stopPropagation();
            d.onClick?.(d.relationId);
          }}
          aria-label={`Relação ${relationIndex}: ${d.relationTypeLabel}`}
          aria-pressed={isSelected}
          title={`${relationIndex}. ${d.relationTypeLabel}${d.description ? ` — ${d.description}` : ''}`}
        >
          <RelationBadge index={relationIndex} color={vs.color} emphasized={isEmphasized} selected={isSelected} />
        </button>
      </EdgeLabelRenderer>
      )}
    </>
  );
}

function positionToHandle(p: Position): HandleId {
  switch (p) {
    case Position.Top: return 'top';
    case Position.Right: return 'right';
    case Position.Bottom: return 'bottom';
    case Position.Left: return 'left';
  }
}

export const ArchitectureEdge = memo(ArchitectureEdgeImpl);
