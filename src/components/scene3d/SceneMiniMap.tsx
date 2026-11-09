import { useMemo } from 'react';
import {
  useArchitectureStore,
  computeVisibleEntities,
} from '../../state/architectureStore';
import { use3DLayout } from './use3DLayout';

const SIZE = 200;
const PAD = 12;

/**
 * 2D overhead minimap. Each entity becomes a coloured dot; the selected
 * entity has a stronger outline. We don't render actual 3D — just a XZ
 * orthographic projection rendered as SVG in the corner.
 */
export function SceneMiniMap() {
  const architecture = useArchitectureStore((s) => s.architecture);
  const selectedId = useArchitectureStore((s) => s.selectedEntityId);
  const focusSubsystem = useArchitectureStore((s) => s.focusedSubsystemId);
  const selectEntity = useArchitectureStore((s) => s.selectEntity);
  const visibleCategories = useArchitectureStore((s) => s.visibleCategories);
  const explorationMode = useArchitectureStore((s) => s.explorationMode);
  const currentStep = useArchitectureStore((s) => s.currentStep);

  const visibleEntities = useMemo(
    () => computeVisibleEntities(architecture, visibleCategories, explorationMode, currentStep),
    [architecture, visibleCategories, explorationMode, currentStep],
  );
  const layout = use3DLayout(architecture);

  const points = useMemo(() => {
    if (!architecture) return [];
    return visibleEntities
      .map((e) => {
        const p = layout.positions.get(e.id);
        if (!p) return null;
        return {
          id: e.id,
          name: e.name,
          x: p.x,
          z: p.z,
          color: architecture.categoriesById[e.category]?.color ?? '#94a3b8',
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
  }, [architecture, visibleEntities, layout]);

  if (!architecture || points.length === 0) return null;

  // Bounds for projection
  const xs = points.map((p) => p.x);
  const zs = points.map((p) => p.z);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const w = Math.max(maxX - minX, 1);
  const h = Math.max(maxZ - minZ, 1);
  const scale = (SIZE - PAD * 2) / Math.max(w, h);

  const project = (x: number, z: number) => ({
    cx: PAD + (x - minX) * scale + (SIZE - PAD * 2 - w * scale) / 2,
    cy: PAD + (z - minZ) * scale + (SIZE - PAD * 2 - h * scale) / 2,
  });

  return (
    <div className="scene-minimap">
      <div className="scene-minimap__head">Vista de cima</div>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <rect width={SIZE} height={SIZE} fill="#0F141B" />
        {/* concentric rings */}
        {[40, 70, 95].map((r, i) => (
          <circle key={i} cx={SIZE / 2} cy={SIZE / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" />
        ))}
        {points.map((p) => {
          const { cx, cy } = project(p.x, p.z);
          const isSel = p.id === selectedId;
          const isFocus = p.id === focusSubsystem;
          return (
            <circle
              key={p.id}
              cx={cx}
              cy={cy}
              r={isSel ? 5 : isFocus ? 4 : 3}
              fill={p.color}
              stroke={isSel || isFocus ? '#fff' : 'transparent'}
              strokeWidth={isSel ? 1.5 : 0}
              opacity={isSel ? 1 : isFocus ? 0.95 : 0.8}
              onClick={() => selectEntity(p.id)}
              style={{ cursor: 'pointer' }}
            >
              <title>{p.name}</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
}
