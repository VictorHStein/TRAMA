import { create } from 'zustand';
import type {
  ArchitectureEntity,
  ArchitectureInput,
  ArchitectureRelation,
  NormalizedArchitecture,
} from '../domain/model/ArchitectureTypes';
import { toInputDocument, cloneInputDocument } from '../domain/parser/inputDocument';
import { computeRipple } from '../domain/analysis/ripple';
import { normalizeArchitecture } from '../domain/parser/normalizeArchitecture';
import { tourPending } from '../lib/tour';
import { validateArchitecture, type ValidationIssue } from '../domain/parser/validateArchitecture';
import demoJson from '../data/demoArchitecture.json';

export type ViewMode = 'home' | '2d' | '3d' | 'split' | 'matrices' | 'tutorial';
/** Tab of the right-hand inspector. */
export type InspectorTab = 'entity' | 'analysis' | 'mission';
/** Engineering matrix shown in the Matrizes view. */
export type MatrixKind = 'n2' | 'vcrm' | 'risks';
export type Theme = 'dark' | 'light';
/** What the 3D canvas shows: the entity network or the physical satellite in orbit. */
export type SceneMode = 'network' | 'physical';
export type ExplorationMode = 'all' | 'step';
/**
 * Viewpoint of the 2D graph, in the sense of a modelling tool's diagram type:
 * everything, the traceability chain (mission, requirements, functions,
 * verification) or the physical interfaces between subsystems and components.
 */
export type GraphLens = 'all' | 'trace' | 'interfaces';

interface ArchitectureState {
  /* ── Data ────────────────────────────────────────────────────── */
  architecture: NormalizedArchitecture | null;
  lastIssues: ValidationIssue[];
  jsonSourceName: string | null;

  /* ── Selection ──────────────────────────────────────────────── */
  selectedEntityId: string | null;
  selectedRelationId: string | null;

  /* ── Visualization mode ─────────────────────────────────────── */
  viewMode: ViewMode;
  sceneMode: SceneMode;
  explorationMode: ExplorationMode;
  currentStep: number;

  /* ── Filters ────────────────────────────────────────────────── */
  /** Set of relationType ids currently visible. */
  visibleRelationTypes: Set<string>;
  /** Set of category ids currently visible. */
  visibleCategories: Set<string>;
  /** When set, only the focused subsystem + its components/relations are emphasized. */
  focusedSubsystemId: string | null;
  /** When true, only cross-category relations are shown. */
  showOnlyCrossCategory: boolean;
  /** Viewpoint of the 2D graph. */
  lens: GraphLens;

  /* ── Panel state ────────────────────────────────────────────── */
  inspectorTab: InspectorTab;
  matrixKind: MatrixKind;
  /** Colour theme; light is meant for projectors and printing. Remembered per browser. */
  theme: Theme;
  minimapOpen: boolean;
  /** First-run guided tour on screen (opens by itself on the first visit). */
  tourOpen: boolean;
  /** Left legend collapsed into a 56 px rail (remembered per browser). */
  legendCollapsed: boolean;
  /** Unsaved text of the Construtor editor. Kept here so it survives switching tabs. */
  builderDraft: string | null;
  /**
   * Monotonic counter incremented whenever the 3D camera should snap back to
   * its default framing (entering 3D, resetting the demo, manual recenter).
   * The 3D scene watches this number — primitive equality, so a re-render is
   * triggered exactly when the value changes.
   */
  cameraResetTick: number;
  /**
   * Counter incremented when the user explicitly asks the 3D camera to
   * move toward the currently-selected entity (HUD button "Focar
   * selecionado"). The 3D scene also nudges the camera on a real selection
   * change (see CameraFocus in ArchitectureScene); this tick lets the user
   * re-focus the same selection after flying away with WASD.
   */
  cameraFocusOnSelectedTick: number;

  /* ── Editing ────────────────────────────────────────────────── */
  /** Input documents before each edit (undo stack, newest last, capped at 50). */
  history: ArchitectureInput[];
  /** Documents undone, for redo (newest last). */
  future: ArchitectureInput[];
  lastEditLabel: string | null;
  /** Entities to pulse in the graph after an edit, with their distance from the change. */
  ripple: { tick: number; levels: Record<string, number> } | null;
  /** Operational mode currently driven by the physical simulation, if any. */
  liveModeId: string | null;

  /* ── Actions ────────────────────────────────────────────────── */
  loadArchitectureFromJson: (raw: unknown, sourceName?: string) => { ok: boolean; issues: ValidationIssue[] };
  resetToDemo: () => void;
  selectEntity: (id: string | null) => void;
  selectRelation: (id: string | null) => void;
  setStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  toggleRelationType: (id: string) => void;
  setVisibleRelationTypes: (ids: string[]) => void;
  toggleCategory: (id: string) => void;
  setViewMode: (mode: ViewMode) => void;
  setSceneMode: (mode: SceneMode) => void;
  setTourOpen: (open: boolean) => void;
  setExplorationMode: (mode: ExplorationMode) => void;
  focusSubsystem: (id: string | null) => void;
  toggleMinimap: () => void;
  setInspectorTab: (tab: InspectorTab) => void;
  setMatrixKind: (kind: MatrixKind) => void;
  setTheme: (theme: Theme) => void;
  setLens: (lens: GraphLens) => void;
  toggleCrossCategoryOnly: () => void;
  setBuilderDraft: (text: string | null) => void;
  requestCameraReset: () => void;
  requestCameraFocusOnSelected: () => void;
  toggleLegendCollapsed: () => void;
  /**
   * Edits the model: mutates a copy of the input document, validates and
   * normalizes it. `seeds` (parameter keys or "engine.orbit_*") drive the
   * impact ripple in the graph. Undoable.
   */
  applyEdit: (label: string, mutate: (doc: ArchitectureInput) => void, seeds?: string[]) => { ok: boolean; issues: ValidationIssue[] };
  undo: () => void;
  redo: () => void;
  clearRipple: () => void;
  setLiveModeId: (id: string | null) => void;
}

const THEME_KEY = 'tg2.theme';
function readTheme(): Theme {
  try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
}
/** Stamps the theme on <html> so the CSS tokens switch. */
export function applyThemeToDocument(theme: Theme): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme;
}

const LEGEND_KEY = 'tg2.legendCollapsed';
function readLegendCollapsed(): boolean {
  try { return localStorage.getItem(LEGEND_KEY) === '1'; } catch { return false; }
}

function loadDemo() {
  const result = validateArchitecture(demoJson);
  if (!result.ok || !result.data) {
    // Should never happen — demo is hand-authored and validated.
    console.error('Demo architecture failed validation', result.issues);
    throw new Error('Demo architecture invalid');
  }
  return normalizeArchitecture(result.data);
}

const initialArchitecture = loadDemo();
const initialRelationTypeIds = new Set(initialArchitecture.relationTypes.map((r) => r.id));
const initialCategoryIds = new Set(initialArchitecture.categories.map((c) => c.id));

export const useArchitectureStore = create<ArchitectureState>((set, get) => ({
  architecture: initialArchitecture,
  lastIssues: [],
  jsonSourceName: 'demoArchitecture.json',

  selectedEntityId: null,
  selectedRelationId: null,

  viewMode: 'home',
  sceneMode: 'network',
  explorationMode: 'all',
  currentStep: initialArchitecture.views?.defaultStep ?? initialArchitecture.maxStep,

  visibleRelationTypes: initialRelationTypeIds,
  visibleCategories: initialCategoryIds,
  focusedSubsystemId: null,
  showOnlyCrossCategory: false,
  lens: 'all',

  inspectorTab: 'entity',
  matrixKind: 'n2',
  theme: readTheme(),
  minimapOpen: false,
  tourOpen: tourPending(),
  legendCollapsed: readLegendCollapsed(),
  builderDraft: null,
  cameraResetTick: 0,
  cameraFocusOnSelectedTick: 0,
  history: [],
  future: [],
  lastEditLabel: null,
  ripple: null,
  liveModeId: null,

  loadArchitectureFromJson: (raw, sourceName) => {
    const result = validateArchitecture(raw);
    if (!result.ok || !result.data) {
      set({ lastIssues: result.issues });
      return { ok: false, issues: result.issues };
    }
    const normalized = normalizeArchitecture(result.data);
    set((s) => ({
      architecture: normalized,
      lastIssues: [],
      jsonSourceName: sourceName ?? null,
      selectedEntityId: null,
      selectedRelationId: null,
      visibleRelationTypes: new Set(normalized.relationTypes.map((r) => r.id)),
      visibleCategories: new Set(normalized.categories.map((c) => c.id)),
      currentStep: normalized.views?.defaultStep ?? normalized.maxStep,
      explorationMode: 'all',
      focusedSubsystemId: null,
      showOnlyCrossCategory: false,
      builderDraft: null,
      cameraResetTick: s.cameraResetTick + 1,
      history: [],
      future: [],
      lastEditLabel: null,
      ripple: null,
    }));
    return { ok: true, issues: [] };
  },

  resetToDemo: () => {
    const normalized = loadDemo();
    set((s) => ({
      architecture: normalized,
      lastIssues: [],
      jsonSourceName: 'demoArchitecture.json',
      selectedEntityId: null,
      selectedRelationId: null,
      visibleRelationTypes: new Set(normalized.relationTypes.map((r) => r.id)),
      visibleCategories: new Set(normalized.categories.map((c) => c.id)),
      currentStep: normalized.views?.defaultStep ?? normalized.maxStep,
      explorationMode: 'all',
      focusedSubsystemId: null,
      showOnlyCrossCategory: false,
      builderDraft: null,
      cameraResetTick: s.cameraResetTick + 1,
      history: [],
      future: [],
      lastEditLabel: null,
      ripple: null,
    }));
  },

  selectEntity: (id) => set({ selectedEntityId: id, selectedRelationId: null }),
  selectRelation: (id) => set({ selectedRelationId: id, selectedEntityId: null }),

  setStep: (step) => {
    const arch = get().architecture;
    if (!arch) return;
    const clamped = Math.max(1, Math.min(step, arch.maxStep));
    set({ currentStep: clamped });
  },
  // ‹ › jump between steps that actually introduce something (the timeline
  // hides empty steps, so walking ±1 would land on invisible ones).
  nextStep: () => {
    const { currentStep, architecture } = get();
    if (!architecture) return;
    const next = usedSteps(architecture).find((s) => s > currentStep);
    if (next !== undefined) set({ currentStep: next });
  },
  previousStep: () => {
    const { currentStep, architecture } = get();
    if (!architecture) return;
    const prev = [...usedSteps(architecture)].reverse().find((s) => s < currentStep);
    if (prev !== undefined) set({ currentStep: prev });
  },

  toggleRelationType: (id) =>
    set((s) => {
      const next = new Set(s.visibleRelationTypes);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { visibleRelationTypes: next };
    }),

  setVisibleRelationTypes: (ids) => set({ visibleRelationTypes: new Set(ids) }),

  toggleCategory: (id) =>
    set((s) => {
      const next = new Set(s.visibleCategories);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { visibleCategories: next };
    }),

  setSceneMode: (mode) => set({ sceneMode: mode }),
  setTourOpen: (open) => set({ tourOpen: open }),
  setViewMode: (mode) => set((s) => ({
    viewMode: mode,
    // Re-frame the 3D camera every time the user lands on the 3D scene,
    // so they always start from a known good vantage point.
    cameraResetTick: mode === '3d' ? s.cameraResetTick + 1 : s.cameraResetTick,
  })),
  setExplorationMode: (mode) => set({ explorationMode: mode }),
  focusSubsystem: (id) => set({ focusedSubsystemId: id }),
  toggleMinimap: () => set((s) => ({ minimapOpen: !s.minimapOpen })),
  setLens: (lens) => set({ lens }),
  setInspectorTab: (tab) => set({ inspectorTab: tab }),
  setMatrixKind: (kind) => set({ matrixKind: kind }),
  setTheme: (theme) => {
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* private mode etc. */ }
    applyThemeToDocument(theme);
    set({ theme });
  },
  toggleCrossCategoryOnly: () => set((s) => ({ showOnlyCrossCategory: !s.showOnlyCrossCategory })),
  setBuilderDraft: (text) => set({ builderDraft: text }),
  toggleLegendCollapsed: () => set((s) => {
    const next = !s.legendCollapsed;
    try { localStorage.setItem(LEGEND_KEY, next ? '1' : '0'); } catch { /* private mode etc. */ }
    return { legendCollapsed: next };
  }),
  applyEdit: (label, mutate, seeds) => {
    const arch = get().architecture;
    if (!arch) return { ok: false, issues: [] };
    const before = toInputDocument(arch);
    const doc = cloneInputDocument(arch);
    mutate(doc);
    const result = validateArchitecture(doc);
    if (!result.ok || !result.data) {
      set({ lastIssues: result.issues });
      return { ok: false, issues: result.issues };
    }
    const normalized = normalizeArchitecture(result.data);
    const levels = seeds && seeds.length ? computeRipple(normalized, seeds) : {};
    set((s) => ({
      architecture: normalized,
      lastIssues: [],
      history: [...s.history.slice(-49), before],
      future: [],
      lastEditLabel: label,
      ripple: Object.keys(levels).length ? { tick: (s.ripple?.tick ?? 0) + 1, levels } : s.ripple,
    }));
    return { ok: true, issues: [] };
  },
  undo: () => {
    const { history, architecture } = get();
    const prev = history[history.length - 1];
    if (!prev || !architecture) return;
    const result = validateArchitecture(prev);
    if (!result.ok || !result.data) return;
    const normalized = normalizeArchitecture(result.data);
    set((s) => ({
      architecture: normalized,
      lastIssues: [],
      history: s.history.slice(0, -1),
      future: [...s.future, toInputDocument(architecture)],
      ripple: null,
    }));
  },
  redo: () => {
    const { future, architecture } = get();
    const next = future[future.length - 1];
    if (!next || !architecture) return;
    const result = validateArchitecture(next);
    if (!result.ok || !result.data) return;
    const normalized = normalizeArchitecture(result.data);
    set((s) => ({
      architecture: normalized,
      lastIssues: [],
      future: s.future.slice(0, -1),
      history: [...s.history.slice(-49), toInputDocument(architecture)],
      ripple: null,
    }));
  },
  clearRipple: () => set((s) => (s.ripple ? { ripple: null } : s)),
  setLiveModeId: (id) => set((s) => (s.liveModeId === id ? s : { liveModeId: id })),
  requestCameraReset: () => set((s) => ({ cameraResetTick: s.cameraResetTick + 1 })),
  requestCameraFocusOnSelected: () => set((s) => ({ cameraFocusOnSelectedTick: s.cameraFocusOnSelectedTick + 1 })),
}));

/** Sorted list of steps in which at least one entity or relation appears. */
export function usedSteps(architecture: NormalizedArchitecture): number[] {
  const used = new Set<number>();
  for (const e of architecture.entities) used.add(e.step);
  for (const r of architecture.relations) used.add(r.step);
  return [...used].sort((a, b) => a - b);
}

/* ── Helpers ──────────────────────────────────────────────────
 *
 * These take the primitives explicitly so consumers can wrap them in `useMemo`
 * with the right dependency list. We deliberately do NOT export them as
 * Zustand selectors (`useStore(selector)`), because the selectors return new
 * arrays on every call which breaks React's `useSyncExternalStore` ref check
 * and produces an infinite render loop inside React Flow.
 */

export function computeVisibleEntities(
  architecture: NormalizedArchitecture | null,
  visibleCategories: Set<string>,
  explorationMode: ExplorationMode,
  currentStep: number,
): ArchitectureEntity[] {
  if (!architecture) return [];
  return architecture.entities.filter((e) => {
    if (!visibleCategories.has(e.category)) return false;
    if (explorationMode === 'step' && e.step > currentStep) return false;
    return true;
  });
}

export function computeVisibleRelations(
  architecture: NormalizedArchitecture | null,
  visibleEntities: ArchitectureEntity[],
  visibleRelationTypes: Set<string>,
  explorationMode: ExplorationMode,
  currentStep: number,
  showOnlyCrossCategory: boolean,
): ArchitectureRelation[] {
  if (!architecture) return [];
  const visibleIds = new Set(visibleEntities.map((e) => e.id));
  return architecture.relations.filter((r) => {
    if (!visibleRelationTypes.has(r.type)) return false;
    if (explorationMode === 'step' && r.step > currentStep) return false;
    if (!visibleIds.has(r.source) || !visibleIds.has(r.target)) return false;
    if (showOnlyCrossCategory) {
      const s = architecture.entitiesById[r.source];
      const t = architecture.entitiesById[r.target];
      if (!s || !t || s.category === t.category) return false;
    }
    return true;
  });
}

/**
 * Selectors that return the SAME object reference when nothing relevant
 * changed. Safe to use as `useArchitectureStore(selectSelectedEntity)`.
 */
export const selectSelectedEntity = (state: ArchitectureState) => {
  const a = state.architecture;
  if (!a || !state.selectedEntityId) return null;
  return a.entitiesById[state.selectedEntityId] ?? null;
};

export const selectSelectedRelation = (state: ArchitectureState) => {
  const a = state.architecture;
  if (!a || !state.selectedRelationId) return null;
  return a.relations.find((r) => r.id === state.selectedRelationId) ?? null;
};
