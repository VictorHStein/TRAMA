import type { ArchitectureInput, NormalizedArchitecture } from '../model/ArchitectureTypes';

const DERIVED_FIELDS = new Set([
  'evaluation', 'traceAll', 'entitiesById', 'relationTypesById', 'categoriesById', 'maxStep', 'relationsByEntity', 'breakdownCodes', 'traceById',
]);

/** Strips the derived fields so a normalized architecture is a valid input document again (shares the inner objects). */
export function toInputDocument(arch: NormalizedArchitecture | Record<string, unknown>): ArchitectureInput {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(arch)) if (!DERIVED_FIELDS.has(k)) out[k] = v;
  return out as unknown as ArchitectureInput;
}

/** Deep copy of the input document, safe to mutate (the model is plain JSON). */
export function cloneInputDocument(arch: NormalizedArchitecture): ArchitectureInput {
  return JSON.parse(JSON.stringify(toInputDocument(arch))) as ArchitectureInput;
}
