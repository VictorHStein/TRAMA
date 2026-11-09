import { useState } from 'react';
import { ArchitectureFlow } from '../graph2d/ArchitectureFlow';
import { ArchitectureScene } from '../scene3d/ArchitectureScene';

/**
 * Side-by-side canvas with per-panel keyboard focus.
 *
 *   - One panel is "active" at a time (default: the 2D one).
 *   - Click anywhere inside a panel → it becomes active.
 *   - WASD / Q / E / arrow keys only drive the active panel's camera /
 *     viewport. The other panel is frozen as far as keystrokes go.
 *   - Selection state lives in the store, so clicking an entity in
 *     either panel still updates BOTH views' highlighting / dimming /
 *     side-panel trace cascade. The user's mental model is preserved.
 *
 * A small "Teclado neste painel" badge sits at the bottom of the focused
 * panel so the user always knows which one the keys will move.
 */
export function SplitCanvas() {
  const [active, setActive] = useState<'2d' | '3d'>('2d');

  return (
    <div className="split-canvas">
      <div
        className={`split-canvas__cell${active === '2d' ? ' is-active' : ''}`}
        onMouseDown={() => setActive('2d')}
      >
        {active === '2d' && <ActiveBadge text="Teclado neste painel" />}
        <ArchitectureFlow active={active === '2d'} />
      </div>
      <div className="split-canvas__divider" />
      <div
        className={`split-canvas__cell${active === '3d' ? ' is-active' : ''}`}
        onMouseDown={() => setActive('3d')}
      >
        {active === '3d' && <ActiveBadge text="Teclado neste painel" />}
        <ArchitectureScene active={active === '3d'} />
      </div>
    </div>
  );
}

function ActiveBadge({ text }: { text: string }) {
  return (
    <div className="split-canvas__badge">
      <span className="split-canvas__badge-dot" />
      {text}
    </div>
  );
}
