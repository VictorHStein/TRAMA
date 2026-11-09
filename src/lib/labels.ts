/**
 * Portuguese labels for the English enum values of the JSON model
 * (requirement type and priority, verification method and level).
 * The JSON keeps the English values; only the interface translates them.
 */

export const REQ_TYPE_LABEL: Record<string, string> = {
  functional: 'funcional', performance: 'desempenho', interface: 'interface',
  environmental: 'ambiental', operational: 'operacional', constraint: 'restrição',
};

export const REQ_PRIORITY_LABEL: Record<string, string> = { must: 'obrigatório', should: 'desejável', could: 'opcional' };

/** ECSS-E-ST-10-02C and NASA SP-2016-6105 methods, plus the automatic rule. */
export const METHOD_LABEL: Record<string, string> = {
  Test: 'ensaio', Analysis: 'análise', Inspection: 'inspeção',
  'Review of Design': 'revisão de projeto', Demonstration: 'demonstração', Rule: 'regra automática',
};

/** One-letter column headings of the VCRM (E = ensaio). */
export const METHOD_SHORT: Record<string, string> = {
  Test: 'E', Analysis: 'A', Inspection: 'I', 'Review of Design': 'R', Demonstration: 'D', Rule: 'Regra',
};

const LEVEL_LABEL: Record<string, string> = {
  System: 'sistema', Subsystem: 'subsistema', Component: 'componente', Equipment: 'equipamento', Unit: 'unidade',
  Segment: 'segmento', Mission: 'missão',
};

export const levelLabel = (level: string): string => LEVEL_LABEL[level] ?? level;
export const methodLabel = (method: string): string => METHOD_LABEL[method] ?? method;

export const CRITICALITY_LABEL: Record<string, string> = { low: 'baixa', medium: 'média', high: 'alta', critical: 'crítica' };
export const criticalityLabel = (c: string): string => CRITICALITY_LABEL[c] ?? c;

export const RISK_CATEGORY_LABEL: Record<string, string> = {
  technical: 'técnico', schedule: 'cronograma', cost: 'custo', safety: 'segurança', programmatic: 'programático',
};
