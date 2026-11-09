import { Suspense, useMemo, useRef, useCallback, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Vector3 } from 'three';

import {
  useArchitectureStore,
  computeVisibleEntities,
  computeVisibleRelations,
} from '../../state/architectureStore';
import { EntityMesh } from './EntityMesh';
import { RelationTube } from './RelationTube';
import { SceneMiniMap } from './SceneMiniMap';
import { use3DLayout, type ThreeDPosition } from './use3DLayout';
import { getRelationVisualStyle } from '../../domain/parser/relationStyle';
import { computeFocusedNeighbors, computePairOffsets } from '../../domain/analysis/focus';
import { WASDFlyCam } from './WASDFlyCam';
import { NavHint } from '../layout/NavHint';
import { PhysicalScene } from './physical/PhysicalScene';
import { SceneModeToggle } from './physical/SceneModeToggle';

function CameraControls({
  controlsRef,
  autoRotate,
}: {
  controlsRef: React.MutableRefObject<OrbitControlsImpl | null>;
  autoRotate: boolean;
}) {
  // Bind ref via useEffect on mount of OrbitControls
  return (
    <OrbitControls
      ref={(instance) => {
        if (instance) controlsRef.current = instance;
      }}
      enablePan
      enableZoom
      enableRotate
      autoRotate={autoRotate}
      autoRotateSpeed={1.6}
      minDistance={6}
      maxDistance={90}
      target={[0, 0, 0]}
      maxPolarAngle={Math.PI * 0.85}
    />
  );
}

const DEFAULT_CAMERA_POS: [number, number, number] = [22, 17, 22];
const DEFAULT_CAMERA_TARGET: [number, number, number] = [0, 0, 0];

/**
 * Moves the camera toward `target` on two triggers:
 *   1. The selected entity's id changes (auto-focus on click) — the
 *      classic "click → camera flies to it" feel.
 *   2. The HUD's `focusTick` is bumped (explicit re-focus button).
 *
 * In between, the user can fly freely with WASD or orbit with the mouse;
 * the camera is only nudged on a real selection change. We capture the
 * previous selection id and compare so re-selecting the same entity
 * twice doesn't keep dragging the camera around.
 */
function CameraFocus({
  target,
  selectedId,
  focusTick,
  controlsRef,
}: {
  target: ThreeDPosition | null;
  selectedId: string | null;
  focusTick: number;
  controlsRef: React.MutableRefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  const lastSelectionRef = useRef<string | null>(null);
  const lastTickRef = useRef<number>(0);

  useEffect(() => {
    const selectionChanged = selectedId !== lastSelectionRef.current;
    const tickChanged = focusTick !== lastTickRef.current;
    lastSelectionRef.current = selectedId;
    lastTickRef.current = focusTick;

    // Skip the initial mount (both ticks at 0, no prior selection)
    if (!selectionChanged && !tickChanged) return;
    if (!target || !selectedId) return;

    const t = new Vector3(target.x, target.y, target.z);
    const dist = camera.position.distanceTo(t);
    const dir = new Vector3().subVectors(camera.position, t).normalize();
    // Gentler approach: keep most of the distance the user already has,
    // and never end up too close. Old factors 0.55 / [7, 14] were
    // aggressive enough that the camera jammed right into the target.
    // New: 0.85 of current distance, clamped [16, 36], so you always
    // see the selected entity in context with its neighbours.
    const tightness = Math.min(Math.max(dist * 0.85, 16), 36);
    const next = t.clone().add(dir.multiplyScalar(tightness));
    camera.position.copy(next);
    if (controlsRef.current) {
      controlsRef.current.target.copy(t);
      controlsRef.current.update();
    }
  }, [selectedId, focusTick, target, camera, controlsRef]);
  return null;
}

/**
 * Snaps the camera back to its default position/target whenever the
 * `tick` value changes (incremented by the store on reset-to-demo,
 * load-from-json, or entering 3D view).
 */
function CameraResetWatcher({
  tick,
  controlsRef,
}: {
  tick: number;
  controlsRef: React.MutableRefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(...DEFAULT_CAMERA_POS);
    if (controlsRef.current) {
      controlsRef.current.target.set(...DEFAULT_CAMERA_TARGET);
      controlsRef.current.update();
    }
  }, [tick, camera, controlsRef]);
  return null;
}

function SceneContent({
  controlsRef,
  active,
}: {
  controlsRef: React.MutableRefObject<OrbitControlsImpl | null>;
  active: boolean;
}) {
  const architecture = useArchitectureStore((s) => s.architecture);
  const selectedEntityId = useArchitectureStore((s) => s.selectedEntityId);
  const selectedRelationId = useArchitectureStore((s) => s.selectedRelationId);
  const focusedSubsystemId = useArchitectureStore((s) => s.focusedSubsystemId);
  const selectEntity = useArchitectureStore((s) => s.selectEntity);
  const selectRelation = useArchitectureStore((s) => s.selectRelation);

  const visibleCategories = useArchitectureStore((s) => s.visibleCategories);
  const visibleRelationTypes = useArchitectureStore((s) => s.visibleRelationTypes);
  const explorationMode = useArchitectureStore((s) => s.explorationMode);
  const currentStep = useArchitectureStore((s) => s.currentStep);
  const showOnlyCrossCategory = useArchitectureStore((s) => s.showOnlyCrossCategory);
  const cameraResetTick = useArchitectureStore((s) => s.cameraResetTick);
  const cameraFocusOnSelectedTick = useArchitectureStore((s) => s.cameraFocusOnSelectedTick);

  const visibleEntities = useMemo(
    () => computeVisibleEntities(architecture, visibleCategories, explorationMode, currentStep),
    [architecture, visibleCategories, explorationMode, currentStep],
  );
  const visibleRelations = useMemo(
    () => computeVisibleRelations(architecture, visibleEntities, visibleRelationTypes, explorationMode, currentStep, showOnlyCrossCategory),
    [architecture, visibleEntities, visibleRelationTypes, explorationMode, currentStep, showOnlyCrossCategory],
  );

  const layout = use3DLayout(architecture);

  // Pair offsets rotate the bend of parallel tubes around the source→target
  // axis so they fan out in 3D instead of stacking (shared with the 2D graph).
  const pairData = useMemo(() => computePairOffsets(visibleRelations), [visibleRelations]);

  // Same neighbourhood rule as the 2D graph (children only on explicit focus).
  const focusedNeighbors = useMemo(
    () => computeFocusedNeighbors(architecture, selectedEntityId, focusedSubsystemId),
    [architecture, selectedEntityId, focusedSubsystemId],
  );

  const focusTarget = useMemo<ThreeDPosition | null>(() => {
    if (!architecture) return null;
    const id = selectedEntityId ?? focusedSubsystemId;
    if (!id) return null;
    return layout.positions.get(id) ?? null;
  }, [architecture, selectedEntityId, focusedSubsystemId, layout]);

  if (!architecture) return null;

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[12, 16, 8]} intensity={1.1} color="#ffffff" />
      <pointLight position={[-12, 8, -8]} intensity={0.35} color="#9db9ff" />
      <pointLight position={[0, -10, 0]} intensity={0.2} color="#d6ccff" />
      <pointLight position={[0, 6, 0]} intensity={0.3} color="#e8edf3" distance={20} />

      <Stars radius={120} depth={70} count={2500} factor={3} saturation={0} fade />

      {/* Radial-fan platform — concentric rings one per layer */}
      {[2.4, 5.0, 7.0, 9.5, 12.5, 14.5].map((r, i) => (
        <mesh key={r} rotation={[Math.PI / 2, 0, 0]} position={[0, -3.6, 0]}>
          <ringGeometry args={[r, r + 0.06, 96]} />
          <meshBasicMaterial color="#ffffff" opacity={i === 0 ? 0.14 : 0.05} transparent />
        </mesh>
      ))}
      {/* Center marker */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -3.55, 0]}>
        <circleGeometry args={[0.6, 36]} />
        <meshBasicMaterial color="#ffffff" opacity={0.1} transparent />
      </mesh>

      <CameraResetWatcher tick={cameraResetTick} controlsRef={controlsRef} />
      <CameraFocus
        target={focusTarget}
        selectedId={selectedEntityId}
        focusTick={cameraFocusOnSelectedTick}
        controlsRef={controlsRef}
      />
      <WASDFlyCam controlsRef={controlsRef} active={active} />

      {/* Entity meshes */}
      {visibleEntities.map((entity) => {
        const pos = layout.positions.get(entity.id) ?? { x: 0, y: 0, z: 0 };
        const cat = architecture.categoriesById[entity.category];
        const isSelected = entity.id === selectedEntityId;
        const isHighlighted = focusedNeighbors?.entityIds.has(entity.id) ?? false;
        const isDimmed =
          (selectedEntityId !== null || focusedSubsystemId !== null) && !isHighlighted;
        const showLabel =
          isSelected
          || isHighlighted
          || entity.category === 'mission'
          || entity.category === 'subsystem'
          || !!focusedSubsystemId && entity.id === focusedSubsystemId;
        return (
          <EntityMesh
            key={entity.id}
            entity={entity}
            category={cat}
            position={[pos.x, pos.y, pos.z]}
            breakdownCode={architecture.breakdownCodes[entity.id]}
            isSelected={isSelected}
            isHighlighted={isHighlighted && !isSelected}
            isDimmed={isDimmed}
            showLabel={showLabel}
            onSelect={selectEntity}
          />
        );
      })}

      {/* Relation tubes — pair offsets are pre-computed in pairData */}
      {visibleRelations.map((relation) => {
        const rt = architecture.relationTypesById[relation.type];
        const fromPos = layout.positions.get(relation.source);
        const toPos = layout.positions.get(relation.target);
        if (!fromPos || !toPos) return null;
        const source = architecture.entitiesById[relation.source];
        const target = architecture.entitiesById[relation.target];
        const pairOffset = pairData.get(relation.id) ?? 0;

        const isSelected = relation.id === selectedRelationId;
        const inFocus = focusedNeighbors?.relationIds.has(relation.id) ?? false;
        const isDimmed =
          (selectedEntityId !== null || focusedSubsystemId !== null) && !inFocus && !isSelected;

        const vs = getRelationVisualStyle(relation, rt, source, target, {
          selected: isSelected,
          emphasizedByFilter: inFocus,
          dimmed: isDimmed,
        });

        // Badges only where the eye is: the selected relation and the
        // neighbourhood of the selected entity. At rest the tubes' colours
        // and the legend are the key.
        const showBadge = isSelected || inFocus;

        return (
          <RelationTube
            key={relation.id}
            relationId={relation.id}
            relationIndex={rt.index}
            from={[fromPos.x, fromPos.y, fromPos.z]}
            to={[toPos.x, toPos.y, toPos.z]}
            style={vs}
            selected={isSelected}
            emphasizedByFilter={inFocus}
            dimmed={isDimmed}
            showBadge={showBadge && !isDimmed}
            pairOffset={pairOffset}
            onSelect={selectRelation}
          />
        );
      })}
    </>
  );
}

/* ── Main component ─────────────────────────────────────────── */

export function ArchitectureScene({ active = true }: { active?: boolean }) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const architecture = useArchitectureStore((s) => s.architecture);
  const selectEntity = useArchitectureStore((s) => s.selectEntity);
  const focusSubsystem = useArchitectureStore((s) => s.focusSubsystem);
  const focusedId = useArchitectureStore((s) => s.focusedSubsystemId);
  const selectedEntityId = useArchitectureStore((s) => s.selectedEntityId);
  const requestCameraReset = useArchitectureStore((s) => s.requestCameraReset);
  const requestCameraFocusOnSelected = useArchitectureStore((s) => s.requestCameraFocusOnSelected);
  const [autoRotate, setAutoRotate] = useState(false);
  const sceneMode = useArchitectureStore((s) => s.sceneMode);

  // "Centralizar" now does a full reset — both position AND target snap back
  // to the default vantage point. Previously it only re-centred the target,
  // which meant the user could still end up upside-down after panning.
  const recenter = useCallback(() => {
    selectEntity(null);
    focusSubsystem(null);
    requestCameraReset();
  }, [selectEntity, focusSubsystem, requestCameraReset]);

  const subsystems = useMemo(
    () => architecture?.entities.filter((e) => e.category === 'subsystem') ?? [],
    [architecture],
  );

  if (sceneMode === 'physical') return <PhysicalScene />;

  return (
    <div className="scene3d-shell">
      <Canvas
        camera={{ position: [22, 17, 22], fov: 48 }}
        style={{ width: '100%', height: '100%' }}
        onPointerMissed={() => { selectEntity(null); }}
      >
        <color attach="background" args={['#0F141B']} />
        <Suspense fallback={null}>
          <SceneContent controlsRef={controlsRef} active={active} />
        </Suspense>
        <CameraControls controlsRef={controlsRef} autoRotate={autoRotate} />
      </Canvas>

      {/* Camera HUD */}
      <div className="scene3d-hud">
        <SceneModeToggle />
        <div className="hud-divider" />
        <button type="button" className="btn btn--secondary btn--sm" onClick={recenter} title="Voltar à vista padrão">
          Centralizar
        </button>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={() => requestCameraFocusOnSelected()}
          disabled={!selectedEntityId}
          title={selectedEntityId ? 'Mover a câmera para o elemento selecionado' : 'Selecione algo primeiro'}
        >
          Focar selecionado
        </button>
        <button
          type="button"
          className={`btn btn--secondary btn--sm${autoRotate ? ' is-on' : ''}`}
          onClick={() => setAutoRotate((s) => !s)}
          aria-pressed={autoRotate}
          title="Girar a câmera em torno do alvo"
        >
          {autoRotate ? 'Parar giro' : 'Girar'}
        </button>
        <div className="hud-divider" />
        <span className="support-label">Subsistema</span>
        <div className="hud-chips">
          {subsystems.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`btn btn--ghost btn--sm${focusedId === s.id ? ' is-on' : ''}`}
              onClick={() => focusSubsystem(focusedId === s.id ? null : s.id)}
              aria-pressed={focusedId === s.id}
              title={s.name}
            >
              {s.short ?? s.subsystem ?? s.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      <SceneMiniMap />
      <NavHint mode="3d" />
    </div>
  );
}
