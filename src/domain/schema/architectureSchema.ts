import { z } from 'zod';

/* ── Atoms ───────────────────────────────────────────────── */
const positiveInt = z.number().int().nonnegative();
const id = z.string().min(1, 'id obrigatório').regex(/^[A-Za-z0-9_-]+$/, 'id pode usar apenas letras, números, "_" e "-"');
const color = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'cor inválida (use hex #rgb ou #rrggbb)');

/* ── Categories ──────────────────────────────────────────── */
export const categoryDefSchema = z.object({
  id,
  label: z.string().min(1),
  color,
  shape2D: z
    .enum(['hexagon', 'document', 'rounded', 'group', 'box', 'check', 'diamond'])
    .optional(),
  shape3D: z
    .enum(['sphere', 'flatPanel', 'capsule', 'box', 'smallBox', 'diamond', 'bar'])
    .optional(),
  description: z.string().optional(),
});

/* ── Relation types ──────────────────────────────────────── */
export const relationTypeDefSchema = z.object({
  id,
  index: positiveInt,
  label: z.string().min(1),
  color,
  lineStyle: z.enum(['solid', 'dashed', 'dotted']).default('solid'),
  directed: z.boolean().default(true),
  description: z.string().min(1),
});

/* ── Budgets per-entity ──────────────────────────────────── */
export const budgetEntrySchema = z.object({
  kind: z.string().min(1),
  allocated: z.number(),
  estimated: z.number(),
  unit: z.string().min(1),
  margin: z.number().optional(),
});

/* ── Parameters (v2) ─────────────────────────────────────── */
const paramId = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'id de parâmetro deve começar com letra e usar só letras, números e "_"');

export const parameterSchema = z.object({
  id: paramId,
  name: z.string().optional(),
  unit: z.string().min(1, 'unidade obrigatória (use "-" para adimensional)'),
  /** Manual / reference value. Ignored when a formula is present. */
  value: z.number().optional(),
  /** Expression evaluated by the engine (see domain/engine/expr.ts). */
  formula: z.string().min(1).optional(),
  source: z.enum(['estimated', 'computed', 'reference', 'measured']).optional(),
  /** Maturity margin preset (ESA margin philosophy): cots 5 %, modified 10 %, new 20 %. */
  maturity: z.enum(['cots', 'modified', 'new']).optional(),
  /** Explicit margin fraction (0.2 = 20 %); overrides the maturity preset. */
  margin: z.number().min(0).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  notes: z.string().optional(),
  history: z
    .array(z.object({ ts: z.string(), value: z.number(), reason: z.string().optional() }))
    .optional(),
}).refine((p) => p.value !== undefined || p.formula !== undefined, {
  message: 'parâmetro precisa de "value" ou "formula"',
});

/* ── Requirement details (v2) ────────────────────────────── */
export const requirementInfoSchema = z.object({
  /** Normative text ("O sistema deve…"). */
  text: z.string().optional(),
  type: z.enum(['functional', 'performance', 'interface', 'environmental', 'operational', 'constraint']).optional(),
  priority: z.enum(['must', 'should', 'could']).optional(),
  rationale: z.string().optional(),
  derivesFrom: z.array(id).optional(),
  acceptance: z.string().optional(),
  /** Boolean expression over parameters; when present the requirement is verified by rule. */
  rule: z.string().min(1).optional(),
  verification: z
    .object({
      method: z.enum(['Test', 'Analysis', 'Inspection', 'Review of Design', 'Demonstration', 'Rule']).optional(),
      level: z.string().optional(),
    })
    .optional(),
});

/* ── Entities ────────────────────────────────────────────── */
export const entitySchema = z.object({
  id,
  name: z.string().min(1),
  /** Official identifier shown instead of the generated PBS code (e.g. "REQ-001"). */
  code: z.string().min(1).optional(),
  /** Short display name / acronym (e.g. "EPS", "TT&C"). */
  short: z.string().min(1).optional(),
  category: id,
  description: z.string().default(''),
  parentId: id.optional(),
  subsystem: z.string().optional(),
  step: positiveInt,
  position2D: z.object({ x: z.number(), y: z.number() }).optional(),
  position3D: z.object({ x: z.number(), y: z.number(), z: z.number() }).optional(),
  budgets: z.array(budgetEntrySchema).optional(),
  status: z
    .enum(['planned', 'in_progress', 'passed', 'failed', 'verified', 'waived'])
    .optional(),
  /** v2: engineering parameters owned by this entity. */
  parameters: z.array(parameterSchema).optional(),
  /** v2: structured requirement fields (only meaningful for requirement entities). */
  requirement: requirementInfoSchema.optional(),
  /** v2: technology readiness level, 1–9. */
  trl: z.number().int().min(1).max(9).optional(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

/* ── Relations ───────────────────────────────────────────── */
export const relationSchema = z.object({
  id,
  type: id,
  source: id,
  target: id,
  label: z.string().optional(),
  description: z.string().optional(),
  step: positiveInt,
  criticality: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  /** Fingerprints of both ends at the last review (suspect links). */
  reviewed: z.object({ source: z.string(), target: z.string(), at: z.string().optional() }).optional(),
});

/* ── Budgets summaries ───────────────────────────────────── */
export const budgetSummarySchema = z
  .object({
    id,
    label: z.string().min(1),
    unit: z.string().min(1),
    /** v1: explicit list of contributions. */
    items: z
      .array(
        z.object({
          entityId: id,
          value: z.number(),
        }),
      )
      .optional(),
    /** v2: aggregate this parameter over the leaf owners (with their margins). */
    parameter: paramId.optional(),
    kind: z.enum(['mass', 'power', 'energy', 'data', 'link', 'cost', 'other']).optional(),
    /** v2: restrict aggregation to the descendants of this entity. */
    rootEntityId: id.optional(),
    /** v2: allocation (ceiling) the total is compared against. */
    allocated: z.number().optional(),
    /** v2: system-level margin fraction applied on top of item margins (ESA margin philosophy: 0.2). */
    systemMargin: z.number().min(0).optional(),
  })
  .refine((b) => b.items !== undefined || b.parameter !== undefined, {
    message: 'budget precisa de "items" (v1) ou "parameter" (v2)',
  });

/* ── Operational modes (v2) ──────────────────────────────── */
export const modeSchema = z.object({
  id,
  name: z.string().min(1),
  description: z.string().optional(),
  /**
   * Fraction of the orbit (or of the reference period) spent in this mode: a
   * number, or an expression such as "engine.orbit_eclipse_max_fraction" or
   * "1 - engine.orbit_eclipse_max_fraction - camera.duty_fraction".
   */
  durationFraction: z.union([z.number().min(0).max(1), z.string().min(1)]).optional(),
  /** Entities switched on in this mode (informative; used by the views to highlight). */
  active: z.array(id).optional(),
  /** Electrical loads in this mode. */
  loads: z
    .array(
      z.object({
        entityId: id,
        powerW: z.number().min(0).optional(),
        /** "entity.param" resolved by the engine instead of a literal powerW. */
        parameterRef: z.string().regex(/^[A-Za-z0-9_-]+\.[A-Za-z_][A-Za-z0-9_]*$/).optional(),
      }),
    )
    .default([]),
});

/* ── Verifications ───────────────────────────────────────── */
export const verificationEntrySchema = z.object({
  id,
  requirementId: id,
  method: z.enum(['Test', 'Analysis', 'Inspection', 'Review of Design', 'Demonstration', 'Rule']),
  level: z.string().optional(),
  status: z.enum(['planned', 'in_progress', 'passed', 'failed', 'verified', 'waived']),
  description: z.string().optional(),
  evidence: z.string().optional(),
  /** v2: item under verification (component, subsystem…). */
  itemId: id.optional(),
  /** v2: verification entity in the graph that this entry documents. */
  verifierId: id.optional(),
});

/* ── Risks ───────────────────────────────────────────────── */
export const riskEntrySchema = z.object({
  id,
  title: z.string().min(1),
  probability: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  mitigation: z.string(),
  status: z.enum(['open', 'mitigated', 'accepted', 'closed']),
  /** v2: entities this risk constrains. */
  entityIds: z.array(id).optional(),
  owner: z.string().optional(),
  category: z.enum(['technical', 'schedule', 'cost', 'safety', 'programmatic']).optional(),
});

/* ── Mission + Metadata + Views ──────────────────────────── */
export const metadataSchema = z.object({
  projectName: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  /** 1 = TG1 format (default), 2 = parameters/rules/modes/orbit. */
  schemaVersion: z.number().int().min(1).max(2).optional(),
});

export const orbitSchema = z.object({
  altitudeKm: z.number().min(100).max(100000),
  inclinationDeg: z.number().min(0).max(180),
  eccentricity: z.number().min(0).max(0.99).default(0),
  raanDeg: z.number().min(0).max(360).optional(),
  /** Local time of ascending node for sun-synchronous orbits (hours, 0–24). */
  ltanHours: z.number().min(0).max(24).optional(),
  /** ISO date used as epoch for the analyses. */
  epoch: z.string().optional(),
});

export const groundStationSchema = z.object({
  id,
  name: z.string().min(1),
  latDeg: z.number().min(-90).max(90),
  lonDeg: z.number().min(-180).max(180),
  altKm: z.number().default(0),
  minElevationDeg: z.number().min(0).max(90).default(10),
});

/** A number, or the key of a declared parameter ("entity.param") or engine value ("engine.x"). */
const numOrRef = z.union([z.number(), z.string().min(1)]);

/** v2: bindings that feed the mission analyses (link, power, data, decay, thermal). */
export const missionAnalysisSchema = z.object({
  link: z.object({
    txPowerW: numOrRef,
    txGainDbi: numOrRef,
    frequencyGHz: numOrRef,
    dataRateMbps: numOrRef,
    rxGainDbi: numOrRef.optional(),
    systemNoiseTempK: numOrRef.optional(),
    rxGT_dBK: numOrRef.optional(),
    requiredEbN0Db: numOrRef.optional(),
    txLineLossDb: numOrRef.optional(),
    atmosphericLossDb: numOrRef.optional(),
    polarizationLossDb: numOrRef.optional(),
    pointingLossDb: numOrRef.optional(),
    implementationLossDb: numOrRef.optional(),
    /** Defaults to the slant range at the station's minimum elevation. */
    distanceKm: numOrRef.optional(),
  }).optional(),
  power: z.object({
    generationW: numOrRef.optional(),
    batteryCapacityWh: numOrRef.optional(),
    depthOfDischarge: numOrRef.optional(),
    /** Battery discharge efficiency used in the SMAD sizing (default 0.9). */
    batteryEfficiency: numOrRef.optional(),
    solarArrayAreaM2: numOrRef.optional(),
    eclipseModeId: z.string().optional(),
    cellEfficiency: numOrRef.optional(),
    degradationPerYear: numOrRef.optional(),
    sunIncidenceDeg: numOrRef.optional(),
  }).optional(),
  data: z.object({
    sources: z.array(z.object({ entityId: id, rateMbps: numOrRef, dutyFraction: numOrRef })).min(1),
    downlinkRateMbps: numOrRef,
    overheadFraction: numOrRef.optional(),
    compressionRatio: numOrRef.optional(),
    storageCapacityMB: numOrRef.optional(),
  }).optional(),
  decay: z.object({
    dragAreaM2: numOrRef,
    dragCoefficient: numOrRef.optional(),
    /** Heaviest mass (with margins): the disposal case, which stays longest in orbit. */
    massKg: numOrRef,
    /** Lightest mass (nominal): the survival case, which decays fastest. */
    massMinKg: numOrRef.optional(),
    solarActivity: z.enum(['low', 'mean', 'high']).optional(),
  }).optional(),
  thermal: z.object({
    absorptivity: numOrRef,
    emissivity: numOrRef,
    sunlitAreaM2: numOrRef,
    radiatorAreaM2: numOrRef,
    earthFacingAreaM2: numOrRef.optional(),
    internalPowerW: numOrRef.optional(),
    /** Dissipation in the hot case (highest-power mode) and in the cold case (lowest). */
    internalPowerHotW: numOrRef.optional(),
    internalPowerColdW: numOrRef.optional(),
    /** Heat capacity m·c of the single node, J/K; without it the analysis is the instantaneous equilibrium. */
    heatCapacityJPerK: numOrRef.optional(),
    tMinC: numOrRef.optional(),
    tMaxC: numOrRef.optional(),
  }).optional(),
});

export const missionSchema = z.object({
  id,
  name: z.string().min(1),
  objectives: z.array(z.string()).optional(),
  /** v2: reference orbit for the mission analyses. */
  orbit: orbitSchema.optional(),
  groundStations: z.array(groundStationSchema).optional(),
  lifetimeYears: z.number().positive().optional(),
  /** v2: bindings for the mission analyses (numbers or parameter references). */
  analysis: missionAnalysisSchema.optional(),
});

export const viewSettingsSchema = z.object({
  defaultStep: positiveInt.default(1),
  maxStep: positiveInt.default(10),
  layout2D: z.enum(['layered', 'radial', 'manual']).optional(),
  layout3D: z.enum(['radial-fan', 'cluster', 'manual']).optional(),
});

/* ── Top-level architecture ──────────────────────────────── */
export const architectureSchema = z.object({
  metadata: metadataSchema,
  mission: missionSchema.optional(),
  categories: z.array(categoryDefSchema).min(1, 'É necessário pelo menos uma categoria'),
  relationTypes: z.array(relationTypeDefSchema).min(1, 'É necessário pelo menos um tipo de relação'),
  entities: z.array(entitySchema).min(1, 'É necessário pelo menos uma entidade'),
  relations: z.array(relationSchema),
  budgets: z.array(budgetSummarySchema).optional(),
  verifications: z.array(verificationEntrySchema).optional(),
  risks: z.array(riskEntrySchema).optional(),
  /** v2: operational modes with their loads. */
  modes: z.array(modeSchema).optional(),
  views: viewSettingsSchema.optional(),
});

export type ArchitectureInputZ = z.infer<typeof architectureSchema>;
