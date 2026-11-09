import type { Explained } from './constants';

export interface DataBudgetInput {
  sources: { entityId: string; rateBps: number; dutyFraction: number }[];
  downlinkRateBps: number;
  contactMinPerDay: number;
  overheadFraction?: number;
  compressionRatio?: number;
  /** Longest interval without a pass, minutes (sizes the on-board memory). */
  longestGapMin?: number;
}

export interface DataBudgetResult {
  generatedMBPerDay: number;
  downlinkCapacityMBPerDay: number;
  marginFraction: number;
  storageRequiredMB: number;
  status: 'ok' | 'marginal' | 'fail';
}

/** Daily data generation vs downlink capacity, plus on-board storage needed. */
export function dataBudget(input: DataBudgetInput): Explained<DataBudgetResult> {
  const overhead = input.overheadFraction ?? 0.1;
  const compression = input.compressionRatio ?? 1;
  const genBitsPerDay = input.sources.reduce((a, s) => a + s.rateBps * s.dutyFraction * 86400, 0) / compression;
  const capBitsPerDay = input.downlinkRateBps * input.contactMinPerDay * 60 * (1 - overhead);
  const toMB = (bits: number) => bits / 8 / 1e6;
  const generatedMB = toMB(genBitsPerDay);
  const capacityMB = toMB(capBitsPerDay);
  const margin = capacityMB > 0 ? (capacityMB - generatedMB) / capacityMB : -1;
  const gapMin = input.longestGapMin ?? 1440;
  const storageMB = generatedMB * (gapMin / 1440);
  return {
    generatedMBPerDay: generatedMB,
    downlinkCapacityMBPerDay: capacityMB,
    marginFraction: margin,
    storageRequiredMB: storageMB,
    status: margin >= 0.2 ? 'ok' : margin >= 0 ? 'marginal' : 'fail',
    formula: 'D_dia = Σ R_i·duty_i·86400 / compressão;  Cap_dia = R_b·t_contato·(1 − overhead);  memória = D_dia · (maior intervalo sem passe / 24 h)',
    assumptions: [`Overhead de protocolo ${overhead}, compressão ${compression}:1.`, 'Downlink contínuo durante todo o passe acima da elevação mínima.'],
    source: 'SMAD, cap. 13 e 16',
  };
}
