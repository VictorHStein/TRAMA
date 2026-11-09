import type { Explained } from './constants';

export type Maturity = 'cots' | 'modified' | 'new';
export const ECSS_MATURITY_MARGIN: Record<Maturity, number> = { cots: 0.05, modified: 0.1, new: 0.2 };

export interface MassItemInput {
  id: string;
  massKg: number;
  maturity?: Maturity;
  marginFraction?: number;
}

export interface MassBudgetInput {
  items: MassItemInput[];
  systemMarginFraction?: number;
  allocatedDryMassKg?: number;
  propellantMassKg?: number;
}

export interface MassBudgetResult {
  items: { id: string; massKg: number; marginFraction: number; massWithMarginKg: number }[];
  dryMassNominalKg: number;
  dryMassWithItemMarginsKg: number;
  dryMassWithSystemMarginKg: number;
  wetMassKg: number;
  marginRemainingKg: number | null;
  marginRemainingFraction: number | null;
  status: 'ok' | 'warning' | 'critical' | 'over' | 'unknown';
}

/** Mass budget with maturity margins per item plus a system margin (ESA margin philosophy). */
export function massBudget(input: MassBudgetInput): Explained<MassBudgetResult> {
  const sys = input.systemMarginFraction ?? 0.2;
  const items = input.items.map((it) => {
    const m = it.marginFraction ?? (it.maturity ? ECSS_MATURITY_MARGIN[it.maturity] : 0);
    return { id: it.id, massKg: it.massKg, marginFraction: m, massWithMarginKg: it.massKg * (1 + m) };
  });
  const nominal = items.reduce((a, i) => a + i.massKg, 0);
  const withItems = items.reduce((a, i) => a + i.massWithMarginKg, 0);
  const withSystem = withItems * (1 + sys);
  const wet = withSystem + (input.propellantMassKg ?? 0);
  let remainingKg: number | null = null;
  let remainingFrac: number | null = null;
  let status: MassBudgetResult['status'] = 'unknown';
  if (input.allocatedDryMassKg !== undefined && input.allocatedDryMassKg > 0) {
    remainingKg = input.allocatedDryMassKg - withSystem;
    remainingFrac = remainingKg / input.allocatedDryMassKg;
    status = remainingFrac < 0 ? 'over' : remainingFrac < 0.1 ? 'critical' : remainingFrac < 0.2 ? 'warning' : 'ok';
  }
  return {
    items,
    dryMassNominalKg: nominal,
    dryMassWithItemMarginsKg: withItems,
    dryMassWithSystemMarginKg: withSystem,
    wetMassKg: wet,
    marginRemainingKg: remainingKg,
    marginRemainingFraction: remainingFrac,
    status,
    formula: "m_i' = m_i·(1 + μ_i);  M_seca = (Σ m_i')·(1 + margem de sistema);  M_úmida = M_seca + m_prop",
    assumptions: [`Margens de maturidade (filosofia de margens da ESA): COTS 5 %, modificado 10 %, novo 20 %; margem de sistema ${(sys * 100).toFixed(0)} %.`],
    source: 'ESA, Margin philosophy for science assessment studies (SRE-PA/2011.097, v1.3)',
  };
}
