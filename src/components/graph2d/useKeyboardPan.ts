import { useEffect, useRef } from 'react';
import { isEditableTarget } from '../../lib/dom';
import { useReactFlow, useStoreApi } from '@xyflow/react';
import { useArchitectureStore } from '../../state/architectureStore';
import { NODE_WIDTH, NODE_HEIGHT } from './useFlowLayout';
import { computeFlowLayout } from './useFlowLayout';
import { computeVisibleEntities } from '../../state/architectureStore';

/**
 * Keyboard navigation for the 2D React Flow viewport.
 *
 *   W / S → pan up / down
 *   A / D → pan left / right
 *   Q / − → zoom out
 *   E / + → zoom in
 *   Shift  → 3× sprint
 *
 * Pan
 *   Speed scales with 1 / zoom so screen-space movement stays constant.
 *
 * Zoom
 *   Step is small (0.02 per frame) so the user can feather the zoom.
 *   Holding Shift gives 3× zoom speed.
 *
 * Zoom anchor
 *   - When an entity is selected, the zoom pivots on its world centre,
 *     so the selected card stays glued to the same screen pixel.
 *   - When nothing is selected, the zoom pivots on the SCREEN CENTRE
 *     (whatever is in the middle of the canvas right now), which is
 *     what the user expects from a typical viewer.
 *
 *   Math (standard pinch-zoom):
 *     newViewport = oldViewport + worldAnchor × (oldZoom − newZoom)
 */
const PAN_BASE = 10;
/**
 * Cap on world-units-per-frame pan, so that at low zoom (where 1/zoom
 * blows up) the camera doesn't fly across the canvas in one keystroke.
 * High zoom keeps the natural 1/zoom screen-constant feel; low zoom
 * is throttled.
 */
const PAN_CAP = 6;
const ZOOM_STEP = 0.02;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.5;

export function useKeyboardPan(active: boolean = true): void {
  const { getViewport, setViewport } = useReactFlow();
  const store = useStoreApi();
  const keys = useRef<Record<string, boolean>>({});
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(k)) {
        keys.current[k] = true;
        e.preventDefault();
      } else if (k === 'q' || e.key === '-' || e.key === '_') {
        keys.current.zoomOut = true;
        e.preventDefault();
      } else if (k === 'e' || e.key === '+' || e.key === '=') {
        keys.current.zoomIn = true;
        e.preventDefault();
      }
      if (e.key === 'Shift') keys.current.shift = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(k)) keys.current[k] = false;
      if (k === 'q' || e.key === '-' || e.key === '_') keys.current.zoomOut = false;
      if (k === 'e' || e.key === '+' || e.key === '=') keys.current.zoomIn = false;
      if (e.key === 'Shift') keys.current.shift = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const loop = () => {
      const v = getViewport();
      const sprint = keys.current.shift ? 3 : 1;
      // 1/zoom keeps screen-pixels-per-frame constant, but at low zoom
      // (fit-view ~0.5) that means 20 world units per frame — way too
      // much. Cap it so low-zoom navigation feels deliberate while
      // high-zoom keeps the same touch.
      const panSpeed = Math.min(PAN_BASE / v.zoom, PAN_CAP) * sprint;

      let dx = 0, dy = 0;
      if (keys.current.w) dy += panSpeed;
      if (keys.current.s) dy -= panSpeed;
      if (keys.current.a) dx += panSpeed;
      if (keys.current.d) dx -= panSpeed;

      let dz = 0;
      if (keys.current.zoomOut) dz -= ZOOM_STEP * sprint;
      if (keys.current.zoomIn) dz += ZOOM_STEP * sprint;

      if (dx !== 0 || dy !== 0 || dz !== 0) {
        let newZoom = v.zoom;
        let newX = v.x + dx;
        let newY = v.y + dy;

        if (dz !== 0) {
          newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.zoom + dz));

          // Pick a world-space anchor for the zoom pivot
          const anchor =
            getSelectedAnchor() ??
            getScreenCenterAnchor(store, v);

          if (anchor) {
            newX = newX + anchor.x * (v.zoom - newZoom);
            newY = newY + anchor.y * (v.zoom - newZoom);
          }
        }

        if (newX !== v.x || newY !== v.y || newZoom !== v.zoom) {
          setViewport({ x: newX, y: newY, zoom: newZoom });
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      keys.current = {};
    };
  }, [active, getViewport, setViewport, store]);
}

/**
 * World-space centre of the currently selected entity, or null if there
 * isn't one. Triggers the "zoom around the selected card" behaviour.
 */
function getSelectedAnchor(): { x: number; y: number } | null {
  const s = useArchitectureStore.getState();
  if (!s.selectedEntityId || !s.architecture) return null;
  const visible = computeVisibleEntities(
    s.architecture,
    s.visibleCategories,
    s.explorationMode,
    s.currentStep,
  );
  const layout = computeFlowLayout(s.architecture, visible);
  const pos = layout.positions.get(s.selectedEntityId);
  if (!pos) return null;
  return {
    x: pos.x + NODE_WIDTH / 2,
    y: pos.y + NODE_HEIGHT / 2,
  };
}

/**
 * World-space coordinate of the current screen-centre. Used as the
 * fallback zoom anchor when nothing is selected — what the user is
 * "looking at" in the canvas right now stays under the same pixel.
 */
function getScreenCenterAnchor(
  store: ReturnType<typeof useStoreApi>,
  v: { x: number; y: number; zoom: number },
): { x: number; y: number } | null {
  const domNode = store.getState().domNode as HTMLElement | null | undefined;
  if (!domNode) return null;
  const screenCx = domNode.clientWidth / 2;
  const screenCy = domNode.clientHeight / 2;
  return {
    x: (screenCx - v.x) / v.zoom,
    y: (screenCy - v.y) / v.zoom,
  };
}
