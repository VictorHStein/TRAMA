import type { ArchitectureInput, NormalizedArchitecture } from '../model/ArchitectureTypes';

export interface MissionObjective {
  key: string;
  /** Entity id when the objective is an entity of the graph. */
  id?: string;
  code?: string;
  text: string;
}

/**
 * Mission objectives: the objective entities when the model has them (they
 * take part in traceability), otherwise the plain text list in mission.
 */
export function missionObjectives(arch: NormalizedArchitecture | ArchitectureInput): MissionObjective[] {
  const entities = arch.entities.filter((e) => e.category === 'objective');
  if (entities.length > 0) {
    const codes = 'breakdownCodes' in arch ? arch.breakdownCodes : {};
    return entities.map((e) => ({ key: e.id, id: e.id, code: e.code ?? codes[e.id], text: e.description ?? e.name }));
  }
  return (arch.mission?.objectives ?? []).map((text) => ({ key: text, text }));
}
