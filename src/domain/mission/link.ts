import { BOLTZMANN_DBW_K_HZ, SPEED_OF_LIGHT_KM_S, type Explained } from './constants';

export function freeSpacePathLossDb(input: { distanceKm: number; frequencyGHz: number }): Explained<{ fsplDb: number }> {
  const fspl = 92.45 + 20 * Math.log10(input.distanceKm) + 20 * Math.log10(input.frequencyGHz);
  return {
    fsplDb: fspl,
    formula: 'FSPL[dB] = 92,45 + 20·log₁₀(d[km]) + 20·log₁₀(f[GHz])',
    assumptions: ['Propagação em espaço livre.'],
    source: 'Friis; SMAD, cap. 13',
  };
}

export function parabolicGainDbi(input: { diameterM: number; frequencyGHz: number; efficiency?: number }): Explained<{ gainDbi: number; wavelengthM: number }> {
  const eta = input.efficiency ?? 0.55;
  const lambda = (SPEED_OF_LIGHT_KM_S * 1000) / (input.frequencyGHz * 1e9);
  const gain = 10 * Math.log10(eta * (Math.PI * input.diameterM / lambda) ** 2);
  return {
    gainDbi: gain,
    wavelengthM: lambda,
    formula: 'G = 10·log₁₀( η·(π·D/λ)² )',
    assumptions: [`Eficiência de abertura η = ${eta}.`],
    source: 'SMAD, cap. 13, eq. 13-18',
  };
}

/** Required Eb/N0 (dB) for BER 1e-5 with typical coding, from SMAD. */
export const REQUIRED_EBN0_TABLE_DB: { scheme: string; ebN0Db: number }[] = [
  { scheme: 'BPSK/QPSK sem codificação', ebN0Db: 9.6 },
  { scheme: 'BPSK/QPSK + convolucional r=1/2, K=7 (soft)', ebN0Db: 4.4 },
  { scheme: 'BPSK/QPSK + Reed-Solomon + convolucional', ebN0Db: 2.5 },
  { scheme: 'BPSK/QPSK + LDPC/turbo (aprox.)', ebN0Db: 1.5 },
];

export interface LinkBudgetInput {
  txPowerW: number;
  txLineLossDb?: number;
  txGainDbi: number;
  frequencyGHz: number;
  distanceKm: number;
  atmosphericLossDb?: number;
  polarizationLossDb?: number;
  pointingLossDb?: number;
  /** Receiver figure of merit G/T in dB/K. If absent, rxGainDbi + systemNoiseTempK are used. */
  rxGT_dBK?: number;
  rxGainDbi?: number;
  systemNoiseTempK?: number;
  dataRateBps: number;
  requiredEbN0Db: number;
  implementationLossDb?: number;
}

export interface LinkBudgetResult {
  eirpDbW: number;
  fsplDb: number;
  gtDbK: number;
  cN0DbHz: number;
  ebN0Db: number;
  marginDb: number;
  status: 'ok' | 'marginal' | 'fail';
  lines: { label: string; valueDb: number }[];
}

/** Classic RF link budget (AMSAT/IARU sheet layout). */
export function linkBudget(input: LinkBudgetInput): Explained<LinkBudgetResult> {
  const txLine = input.txLineLossDb ?? 1;
  const atm = input.atmosphericLossDb ?? 0.5;
  const pol = input.polarizationLossDb ?? 0.5;
  const point = input.pointingLossDb ?? 0.5;
  const impl = input.implementationLossDb ?? 1;
  const txPowerDbW = 10 * Math.log10(input.txPowerW);
  const eirp = txPowerDbW - txLine + input.txGainDbi;
  const fspl = freeSpacePathLossDb({ distanceKm: input.distanceKm, frequencyGHz: input.frequencyGHz }).fsplDb;
  const gt = input.rxGT_dBK ?? ((input.rxGainDbi ?? 0) - 10 * Math.log10(input.systemNoiseTempK ?? 290));
  const cN0 = eirp - fspl - atm - pol - point + gt - BOLTZMANN_DBW_K_HZ;
  const ebN0 = cN0 - 10 * Math.log10(input.dataRateBps);
  const margin = ebN0 - input.requiredEbN0Db - impl;
  return {
    eirpDbW: eirp,
    fsplDb: fspl,
    gtDbK: gt,
    cN0DbHz: cN0,
    ebN0Db: ebN0,
    marginDb: margin,
    status: margin >= 3 ? 'ok' : margin >= 0 ? 'marginal' : 'fail',
    lines: [
      { label: 'Potência de transmissão (dBW)', valueDb: txPowerDbW },
      { label: 'Perdas de linha TX (dB)', valueDb: -txLine },
      { label: 'Ganho da antena TX (dBi)', valueDb: input.txGainDbi },
      { label: 'EIRP (dBW)', valueDb: eirp },
      { label: 'Perda de espaço livre (dB)', valueDb: -fspl },
      { label: 'Perda atmosférica (dB)', valueDb: -atm },
      { label: 'Perda de polarização (dB)', valueDb: -pol },
      { label: 'Perda de apontamento (dB)', valueDb: -point },
      { label: 'G/T do receptor (dB/K)', valueDb: gt },
      { label: '−k (dBW/K/Hz)', valueDb: -BOLTZMANN_DBW_K_HZ },
      { label: 'C/N₀ (dB·Hz)', valueDb: cN0 },
      { label: '−10·log₁₀(taxa de bits)', valueDb: -10 * Math.log10(input.dataRateBps) },
      { label: 'Eb/N₀ obtido (dB)', valueDb: ebN0 },
      { label: 'Eb/N₀ requerido (dB)', valueDb: -input.requiredEbN0Db },
      { label: 'Perda de implementação (dB)', valueDb: -impl },
      { label: 'Margem (dB)', valueDb: margin },
    ],
    formula: 'EIRP = P_t − L_linha + G_t;  C/N₀ = EIRP − FSPL − L_atm − L_pol − L_apont + G/T − k;  Eb/N₀ = C/N₀ − 10·log₁₀(R_b);  margem = Eb/N₀ − Eb/N₀_req − L_impl',
    assumptions: ['Margem ≥ 3 dB considerada adequada; entre 0 e 3 dB marginal.', `Temperatura de sistema ${input.systemNoiseTempK ?? '—'} K quando G/T não é dado.`],
    source: 'SMAD, cap. 13; planilha AMSAT/IARU (Jan King)',
  };
}
