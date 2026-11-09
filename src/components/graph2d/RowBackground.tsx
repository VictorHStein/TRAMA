import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';

interface RowBackgroundData extends Record<string, unknown> {
  label: string;
  color: string;
  width: number;
  height: number;
}

/**
 * Swimlane drawn behind a category row: a faint tint of the category colour
 * with the category name in the top-left corner. Not interactive.
 */
function RowBackgroundImpl({ data }: NodeProps) {
  const d = data as RowBackgroundData;
  return (
    <div
      className="arch-row-bg"
      style={{
        width: d.width,
        height: d.height,
        ['--row-color' as never]: d.color,
      }}
    >
      <span className="arch-row-bg__label">{d.label}</span>
    </div>
  );
}

export const RowBackground = memo(RowBackgroundImpl);

interface FamilyBackgroundData extends Record<string, unknown> {
  parentName: string;
  color: string;
  width: number;
  height: number;
}

/**
 * Dashed outline behind the components of one subsystem, so siblings read
 * as a group even before the user selects anything.
 */
function FamilyBackgroundImpl({ data }: NodeProps) {
  const d = data as FamilyBackgroundData;
  return (
    <div
      className="arch-family-bg"
      style={{ width: d.width, height: d.height, ['--row-color' as never]: d.color }}
      title={`Componentes de ${d.parentName}`}
    />
  );
}

export const FamilyBackground = memo(FamilyBackgroundImpl);
