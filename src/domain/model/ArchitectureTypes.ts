/**
 * Unified architecture model — single source of truth for 2D, 3D, panels and timeline.
 *
 * The JSON the user provides is validated by Zod (see schema/architectureSchema.ts) and
 * normalized into the `NormalizedArchitecture` shape below. All visualizations and panels
 * consume that normalized shape.
 */

export type LineStyle = 'solid' | 'dashed' | 'dotted';

export type Shape2D =
  | 'hexagon' | 'document' | 'rounded' | 'group' | 'box' | 'check' | 'diamond';

export type Shape3D =
  | 'sphere' | 'flatPanel' | 'capsule' | 'box' | 'smallBox' | 'diamond' | 'bar';

export type VerificationMethod =
  | 'Test' | 'Analysis' | 'Inspection' | 'Review of Design' | 'Demonstration';

export type VerificationStatus =
  | 'planned' | 'in_progress' | 'passed' | 'failed' | 'verified' | 'waived';

export type RiskStatus = 'open' | 'mitigated' | 'accepted' | 'closed';
export type Criticality = 'low' | 'medium' | 'high' | 'critical';

/** Visual + semantic descriptor for a kind of entity (mission, requirement, subsystem, …). */
export interface CategoryDef {
  id: string;
  label: string;
  color: string;
  shape2D?: Shape2D;
  shape3D?: Shape3D;
  description?: string;
}

/** Visual + semantic descriptor for a kind of relation (provides_power_to, satisfies, …). */
export interface RelationTypeDef {
  id: string;
  /** Sequential number — appears as the badge on edges and tubes. */
  index: number;
  label: string;
  color: string;
  lineStyle: LineStyle;
  directed: boolean;
  description: string;
}

export interface BudgetEntry {
  kind: string;
  allocated: number;
  estimated: number;
  unit: string;
  margin?: number;
}

export type ParameterSource = 'estimated' | 'computed' | 'reference' | 'measured';
export type Maturity = 'cots' | 'modified' | 'new';

/** v2: an engineering value owned by an entity (Valispace "Vali", COMET "Parameter"). */
export interface ParameterDef {
  id: string;
  name?: string;
  unit: string;
  value?: number;
  formula?: string;
  source?: ParameterSource;
  maturity?: Maturity;
  margin?: number;
  min?: number;
  max?: number;
  notes?: string;
  history?: { ts: string; value: number; reason?: string }[];
}

export type RequirementType = 'functional' | 'performance' | 'interface' | 'environmental' | 'operational' | 'constraint';
export type RequirementPriority = 'must' | 'should' | 'could';

/** v2: structured requirement fields. */
export interface RequirementInfo {
  text?: string;
  type?: RequirementType;
  priority?: RequirementPriority;
  rationale?: string;
  derivesFrom?: string[];
  acceptance?: string;
  rule?: string;
  verification?: { method?: VerificationMethod | 'Rule'; level?: string };
}

/** v2: operational mode with its electrical loads. */
export interface ModeDef {
  id: string;
  name: string;
  description?: string;
  /** Number, or an expression evaluated by the engine (e.g. "engine.orbit_eclipse_max_fraction"). */
  durationFraction?: number | string;
  active?: string[];
  loads: { entityId: string; powerW?: number; parameterRef?: string }[];
}

export interface OrbitDef {
  altitudeKm: number;
  inclinationDeg: number;
  eccentricity: number;
  raanDeg?: number;
  ltanHours?: number;
  epoch?: string;
}

export interface GroundStationDef {
  id: string;
  name: string;
  latDeg: number;
  lonDeg: number;
  altKm: number;
  minElevationDeg: number;
}

/** A number, or the key of a declared parameter ("entity.param") or engine value ("engine.x"). */
export type NumOrRef = number | string;

export interface MissionAnalysisConfig {
  link?: {
    txPowerW: NumOrRef;
    txGainDbi: NumOrRef;
    frequencyGHz: NumOrRef;
    dataRateMbps: NumOrRef;
    rxGainDbi?: NumOrRef;
    systemNoiseTempK?: NumOrRef;
    rxGT_dBK?: NumOrRef;
    requiredEbN0Db?: NumOrRef;
    txLineLossDb?: NumOrRef;
    atmosphericLossDb?: NumOrRef;
    polarizationLossDb?: NumOrRef;
    pointingLossDb?: NumOrRef;
    implementationLossDb?: NumOrRef;
    distanceKm?: NumOrRef;
  };
  power?: {
    generationW?: NumOrRef;
    batteryCapacityWh?: NumOrRef;
    depthOfDischarge?: NumOrRef;
    batteryEfficiency?: NumOrRef;
    solarArrayAreaM2?: NumOrRef;
    eclipseModeId?: string;
    cellEfficiency?: NumOrRef;
    degradationPerYear?: NumOrRef;
    sunIncidenceDeg?: NumOrRef;
  };
  data?: {
    sources: { entityId: string; rateMbps: NumOrRef; dutyFraction: NumOrRef }[];
    downlinkRateMbps: NumOrRef;
    overheadFraction?: NumOrRef;
    compressionRatio?: NumOrRef;
    storageCapacityMB?: NumOrRef;
  };
  decay?: {
    dragAreaM2: NumOrRef;
    dragCoefficient?: NumOrRef;
    /** Heaviest mass: disposal case. */
    massKg: NumOrRef;
    /** Lightest mass: survival case. */
    massMinKg?: NumOrRef;
    solarActivity?: 'low' | 'mean' | 'high';
  };
  thermal?: {
    absorptivity: NumOrRef;
    emissivity: NumOrRef;
    sunlitAreaM2: NumOrRef;
    radiatorAreaM2: NumOrRef;
    earthFacingAreaM2?: NumOrRef;
    internalPowerW?: NumOrRef;
    internalPowerHotW?: NumOrRef;
    internalPowerColdW?: NumOrRef;
    heatCapacityJPerK?: NumOrRef;
    tMinC?: NumOrRef;
    tMaxC?: NumOrRef;
  };
}

export interface ArchitectureEntity {
  id: string;
  name: string;
  /** Official identifier shown instead of the generated PBS code (e.g. "REQ-001"). */
  code?: string;
  /** Short display name / acronym (e.g. "EPS", "TT&C"). */
  short?: string;
  /** Must reference an existing CategoryDef.id. */
  category: string;
  description: string;
  /** Optional hierarchy parent (for `contains`-like grouping in the same JSON). */
  parentId?: string;
  /** Optional subsystem grouping (used by 3D layout to cluster components). */
  subsystem?: string;
  /** Step in which this entity first appears (1..maxStep). */
  step: number;
  /** Optional explicit 2D position (otherwise computed by useFlowLayout). */
  position2D?: { x: number; y: number };
  /** Optional explicit 3D position (otherwise computed by use3DLayout). */
  position3D?: { x: number; y: number; z: number };
  budgets?: BudgetEntry[];
  status?: VerificationStatus;
  parameters?: ParameterDef[];
  requirement?: RequirementInfo;
  trl?: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface ArchitectureRelation {
  id: string;
  /** Must reference an existing RelationTypeDef.id. */
  type: string;
  /** Must reference an existing ArchitectureEntity.id. */
  source: string;
  /** Must reference an existing ArchitectureEntity.id. */
  target: string;
  label?: string;
  description?: string;
  /** Step in which this relation first appears. */
  step: number;
  criticality?: Criticality;
  metadata?: Record<string, string | number | boolean>;
  /** Fingerprints of both ends at the last review; a later change makes the link suspect. */
  reviewed?: { source: string; target: string; at?: string };
}

export interface RiskEntry {
  id: string;
  title: string;
  probability: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  mitigation: string;
  status: RiskStatus;
  entityIds?: string[];
  owner?: string;
  category?: 'technical' | 'schedule' | 'cost' | 'safety' | 'programmatic';
}

export interface VerificationEntry {
  id: string;
  requirementId: string;
  method: VerificationMethod | 'Rule';
  level?: string;
  status: VerificationStatus;
  description?: string;
  evidence?: string;
  itemId?: string;
  verifierId?: string;
}

export interface BudgetSummary {
  id: string;
  label: string;
  unit: string;
  items?: { entityId: string; value: number }[];
  parameter?: string;
  kind?: 'mass' | 'power' | 'energy' | 'data' | 'link' | 'cost' | 'other';
  rootEntityId?: string;
  allocated?: number;
  systemMargin?: number;
}

export interface ArchitectureMetadata {
  projectName: string;
  version: string;
  description?: string;
  schemaVersion?: number;
}

export interface MissionSummary {
  id: string;
  name: string;
  objectives?: string[];
  orbit?: OrbitDef;
  groundStations?: GroundStationDef[];
  lifetimeYears?: number;
  analysis?: MissionAnalysisConfig;
}

export interface ViewSettings {
  defaultStep: number;
  maxStep: number;
  layout2D?: 'layered' | 'radial' | 'manual';
  layout3D?: 'radial-fan' | 'cluster' | 'manual';
}

/** Raw architecture as it appears in the JSON file (after Zod parsing). */
export interface ArchitectureInput {
  metadata: ArchitectureMetadata;
  mission?: MissionSummary;
  categories: CategoryDef[];
  relationTypes: RelationTypeDef[];
  entities: ArchitectureEntity[];
  relations: ArchitectureRelation[];
  budgets?: BudgetSummary[];
  verifications?: VerificationEntry[];
  risks?: RiskEntry[];
  modes?: ModeDef[];
  views?: ViewSettings;
}

/**
 * Trace chain for one entity — the path of artefacts that justify its
 * existence according to the MBSE V-model (Mission → Requirement → Function
 * → Subsystem → Component, with Verifications closing the loop).
 */
export interface TraceChain {
  mission?: string;
  requirement?: string;
  function?: string;
  subsystem?: string;
  component?: string;
  verifications: string[];
}

import type { EngineResult } from '../engine/evaluate';
import type { TraceSets } from '../analysis/trace';

/** Architecture after normalization — entity/relation lookups + step bounds. */
export interface NormalizedArchitecture extends ArchitectureInput {
  /** Parametric engine result: every parameter, rule, budget and mode evaluated. */
  evaluation: EngineResult;
  /** Multi-path traceability (all requirements/functions/… reachable from each entity). */
  traceAll: Record<string, TraceSets>;
  entitiesById: Record<string, ArchitectureEntity>;
  relationTypesById: Record<string, RelationTypeDef>;
  categoriesById: Record<string, CategoryDef>;
  maxStep: number;
  /** Convenience: relations indexed by entity id (both directions). */
  relationsByEntity: Record<string, { incoming: ArchitectureRelation[]; outgoing: ArchitectureRelation[] }>;
  /**
   * Hierarchical breakdown code per entity, computed automatically.
   *
   *  - Mission        → "1"
   *  - Subsystems     → "1.1", "1.2", "1.3", … (children of the mission)
   *  - Components     → "1.1.1", "1.1.2", … (children of their parent subsystem)
   *  - Requirements   → "R-001", "R-002", …  (flat in requirement order)
   *  - Functions      → "F-001", "F-002", …
   *  - Verifications  → "V-001", "V-002", …
   *
   * This is the WBS/PBS-style codification used in systems engineering for
   * traceability. The first part chains physical decomposition, the
   * R/F/V prefixes mark logical artefacts.
   */
  breakdownCodes: Record<string, string>;
  /** Pre-computed trace chain (Mission → Req → Fn → Sub → Comp + Verifs) per entity. */
  traceById: Record<string, TraceChain>;
}
