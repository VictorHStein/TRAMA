import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CategoryDef } from '../../domain/model/ArchitectureTypes';
import { CategoryIcon } from '../ui/icons';

export interface ArchitectureNodeData extends Record<string, unknown> {
  entityId: string;
  name: string;
  short?: string;
  category: CategoryDef;
  status?: string;
  isSelected: boolean;
  isDimmed: boolean;
  isHighlighted: boolean;
  step: number;
  parentId?: string;
  /** PBS code or official id, e.g. "1.2.1" or "REQ-001". */
  breakdownCode: string;
  /** Verification rule result for requirements (pass / fail / error). */
  ruleResult?: 'pass' | 'fail' | 'error' | 'unknown';
  /** Distance from the last edit (0 = edited entity); set only while the impact pulse plays. */
  rippleLevel?: number;
  /** Just created by a command: enters with an effect. */
  isNew?: boolean;
  rippleTick?: number;
  /** Switched off in the operational mode the simulation is in. */
  isOff?: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  planned: 'planejado', in_progress: 'em andamento', passed: 'aprovado', failed: 'reprovado', verified: 'verificado', waived: 'dispensado',
};
const STATUS_TONE: Record<string, string> = {
  planned: 'neutral', in_progress: 'info', passed: 'ok', failed: 'fail', verified: 'ok', waived: 'neutral',
};

/**
 * One handle per side, each declared both as source AND target so any edge
 * can leave or enter the card on whichever side gets it closest to its
 * partner. The picker in ArchitectureFlow decides which side.
 */
const HANDLE_POSITIONS: { id: 'top' | 'right' | 'bottom' | 'left'; pos: Position }[] = [
  { id: 'top', pos: Position.Top },
  { id: 'right', pos: Position.Right },
  { id: 'bottom', pos: Position.Bottom },
  { id: 'left', pos: Position.Left },
];

/**
 * Card for one entity. The body is neutral; the category shows as a 3 px
 * stripe and a small icon, so the coloured edges stay the loudest thing on
 * the canvas. Code in mono, name in sentence case, status as a small chip.
 */
function ArchitectureNodeImpl({ data }: NodeProps) {
  const d = data as ArchitectureNodeData;
  const color = d.category.color;
  const cls = [
    'arch-node',
    d.isSelected ? 'is-selected' : '',
    d.isDimmed ? 'is-dimmed' : '',
    d.isHighlighted ? 'is-highlighted' : '',
    d.isOff ? 'is-off' : '',
    d.rippleLevel !== undefined ? 'is-rippling' : '',
    d.isNew ? 'is-new' : '',
  ].filter(Boolean).join(' ');
  const statusTone = d.ruleResult === 'fail' ? 'fail' : d.ruleResult === 'pass' ? 'ok' : d.status ? STATUS_TONE[d.status] : undefined;
  const statusText = d.ruleResult === 'fail' ? 'viola regra' : d.ruleResult === 'pass' ? 'atende' : d.status ? STATUS_LABEL[d.status] ?? d.status : undefined;

  return (
    <div className={cls} style={{ ['--node-color' as never]: color, ['--ripple-delay' as never]: `${(d.rippleLevel ?? 0) * 90}ms` }}>
      {HANDLE_POSITIONS.map((h) => (
        <Handle key={`s-${h.id}`} id={h.id} type="source" position={h.pos} className="arch-node__handle" />
      ))}
      {HANDLE_POSITIONS.map((h) => (
        <Handle key={`t-${h.id}`} id={h.id} type="target" position={h.pos} className="arch-node__handle" />
      ))}
      <span className="arch-node__stripe" />
      <div className="arch-node__main">
        <div className="arch-node__head">
          <CategoryIcon category={d.category.id} size={14} className="arch-node__icon" />
          <span className="arch-node__code">{d.breakdownCode}</span>
          {statusText && statusTone && (
            <span className={`arch-node__status chip chip--${statusTone}`}><span className="chip__dot" />{statusText}</span>
          )}
        </div>
        <div className="arch-node__name" title={d.name}>{d.name}</div>
      </div>
    </div>
  );
}

export const ArchitectureNode = memo(ArchitectureNodeImpl);
