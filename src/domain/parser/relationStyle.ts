import type {
  ArchitectureEntity,
  ArchitectureRelation,
  RelationTypeDef,
} from '../model/ArchitectureTypes';

export interface RelationVisualStyle {
  color: string;
  strokeWidth: number;
  opacity: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  dashArray: string;
  badgeLabel: string;
  badgeColor: string;
  isCrossCategory: boolean;
  isDirected: boolean;
  isCritical: boolean;
}

/**
 * Single source of truth for how a relation should be rendered (2D and 3D).
 * Used by ArchitectureEdge, RelationTube, LegendPanel and SidePanel so the
 * same color, dash and badge appear everywhere.
 */
export function getRelationVisualStyle(
  relation: ArchitectureRelation,
  relationType: RelationTypeDef,
  source: ArchitectureEntity | undefined,
  target: ArchitectureEntity | undefined,
  options: { selected?: boolean; emphasizedByFilter?: boolean; dimmed?: boolean } = {},
): RelationVisualStyle {
  const isCrossCategory =
    !!source && !!target && source.category !== target.category;
  const isCritical = relation.criticality === 'high' || relation.criticality === 'critical';

  let strokeWidth = isCrossCategory ? 3.2 : 2;
  let opacity = isCrossCategory ? 0.95 : 0.65;

  if (options.dimmed) {
    strokeWidth = 1;
    opacity = 0.18;
  }

  if (options.selected) {
    strokeWidth = Math.max(strokeWidth + 1.5, 4);
    opacity = 1;
  } else if (options.emphasizedByFilter) {
    strokeWidth += 0.5;
    opacity = Math.min(opacity + 0.15, 1);
  }

  if (isCritical && !options.dimmed) {
    strokeWidth += 0.5;
  }

  const dashArray =
    relationType.lineStyle === 'dashed'
      ? '8 4'
      : relationType.lineStyle === 'dotted'
        ? '2 4'
        : 'none';

  return {
    color: relationType.color,
    strokeWidth,
    opacity,
    lineStyle: relationType.lineStyle,
    dashArray,
    badgeLabel: String(relationType.index),
    badgeColor: relationType.color,
    isCrossCategory,
    isDirected: relationType.directed,
    isCritical,
  };
}
