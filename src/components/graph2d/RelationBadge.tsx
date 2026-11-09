interface RelationBadgeProps {
  index: number;
  color: string;
  emphasized?: boolean;
  selected?: boolean;
}

/**
 * Numbered badge on a relation edge (2D) or next to a 3D tube. The number
 * is the relation type's index and the colour its colour — the same pair the
 * legend shows, so the badge is a key, not decoration.
 */
export function RelationBadge({ index, color, emphasized, selected }: RelationBadgeProps) {
  return (
    <span
      className={`num-badge relation-badge${selected ? ' is-selected' : ''}${emphasized ? ' is-emphasized' : ''}`}
      style={{ background: color }}
    >
      {index}
    </span>
  );
}
