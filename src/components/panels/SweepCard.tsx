import { useMemo, useState } from 'react';
import { useArchitectureStore } from '../../state/architectureStore';
import type { NormalizedArchitecture } from '../../domain/model/ArchitectureTypes';
import {
  applyVariable, currentValue, defaultRange, linspace, runSweep, sweepVariables, type SweepPoint, type SweepVariable,
} from '../../domain/analysis/sweep';
import { fmtNum, fmtPct, fmtQty } from '../../lib/format';
import { NumberField } from '../ui/NumberField';

type Tone = 'ok' | 'warn' | 'fail' | '';

function Cell({ text, tone }: { text: string; tone?: Tone }) {
  return <td className={`num mono sp-sweep__cell${tone ? ` is-${tone}` : ''}`}>{text}</td>;
}

/**
 * "Varredura de projeto": vary one input over a range and read, for each
 * value, eclipse, passes, link margin, power margin, battery, lifetime and
 * how many requirement rules still pass. Any row can be applied to the model.
 */
export function SweepCard({ architecture }: { architecture: NormalizedArchitecture }) {
  const applyEdit = useArchitectureStore((s) => s.applyEdit);
  const variables = useMemo(() => sweepVariables(architecture), [architecture]);
  const [varId, setVarId] = useState(() => variables[0]?.id ?? '');
  const variable: SweepVariable | undefined = variables.find((v) => v.id === varId) ?? variables[0];
  const current = variable ? currentValue(architecture, variable) : null;
  const [range, setRange] = useState(() => (variable ? defaultRange(variable, current) : { min: 0, max: 1, steps: 5 }));
  const [result, setResult] = useState<{ variable: SweepVariable; points: SweepPoint[]; archRef: NormalizedArchitecture } | null>(null);
  const [running, setRunning] = useState(false);
  if (!variable) return null;

  const choose = (id: string) => {
    const v = variables.find((x) => x.id === id);
    if (!v) return;
    setVarId(id);
    setRange(defaultRange(v, currentValue(architecture, v)));
    setResult(null);
  };

  const run = () => {
    setRunning(true);
    // Let the button repaint before the synchronous evaluation.
    setTimeout(() => {
      const values = linspace(range.min, range.max, range.steps);
      setResult({ variable, points: runSweep(architecture, variable, values), archRef: architecture });
      setRunning(false);
    }, 16);
  };

  const apply = (value: number) => {
    applyEdit(`${variable.label} = ${value} ${variable.unit}`, (doc) => applyVariable(doc, variable, value), variable.seeds);
  };

  const stale = result !== null && result.archRef !== architecture;
  const pts = result?.points ?? [];
  const nearest = pts.length && current !== null ? pts.reduce((best, p) => (Math.abs(p.value - current) < Math.abs(best.value - current) ? p : best), pts[0]) : null;
  const missionYears = pts.find((p) => p.missionLifetimeYears !== null)?.missionLifetimeYears ?? null;
  // Show a column only when it actually responds to the variable (constant columns are noise in a 360 px panel).
  const has = (k: keyof SweepPoint) => {
    const vals = pts.map((p) => p[k]).filter((x) => x !== null && x !== undefined);
    if (vals.length === 0) return false;
    return new Set(vals.map((x) => (typeof x === 'number' ? Math.round(x * 1000) / 1000 : x))).size > 1;
  };

  return (
    <section className="sp-section">
      <div className="sp-section__head">
        <h3 className="section-title">Varredura de projeto</h3>
        {current !== null && <span className="support-label">atual {fmtQty(current, variable.unit)}</span>}
      </div>
      <div className="sp-sweep__form">
        <label className="sp-field sp-field--wide">
          <span className="support-label">Variar</span>
          <select className="sp-select" value={variable.id} onChange={(e) => choose(e.target.value)} aria-label="Variável da varredura">
            {variables.some((v) => v.kind === 'orbit') && (
              <optgroup label="Órbita">
                {variables.filter((v) => v.kind === 'orbit').map((v) => <option key={v.id} value={v.id}>{v.label} ({v.unit})</option>)}
              </optgroup>
            )}
            <optgroup label="Parâmetros">
              {variables.filter((v) => v.kind === 'param').map((v) => <option key={v.id} value={v.id}>{v.label} ({v.unit})</option>)}
            </optgroup>
          </select>
        </label>
        <label className="sp-field"><span className="support-label">de</span><NumberField value={range.min} ariaLabel="Valor mínimo" onCommit={(v) => setRange((r) => ({ ...r, min: v }))} /></label>
        <label className="sp-field"><span className="support-label">até</span><NumberField value={range.max} ariaLabel="Valor máximo" onCommit={(v) => setRange((r) => ({ ...r, max: v }))} /></label>
        <label className="sp-field"><span className="support-label">pontos</span><NumberField value={range.steps} ariaLabel="Número de pontos" onCommit={(v) => setRange((r) => ({ ...r, steps: Math.max(2, Math.min(25, Math.round(v))) }))} /></label>
        <button type="button" className="btn btn--primary btn--sm sp-sweep__run" onClick={run} disabled={running}>
          {running ? 'Varrendo…' : 'Varrer'}
        </button>
      </div>
      {result && (
        <>
          {stale && <p className="support-label sp-warn">O modelo mudou depois desta varredura; varra de novo para atualizar.</p>}
          <div className="sp-sweep__wrap">
            <table className="sp-table sp-table--dense sp-sweep">
              <thead>
                <tr>
                  <th>{result.variable.unit && result.variable.unit !== '-' ? result.variable.unit : 'valor'}</th>
                  {has('eclipseMaxMin') && <th className="num" title="Eclipse máximo (β = 0°)">eclipse</th>}
                  {has('contactMinPerDay') && <th className="num" title="Contato simulado por dia">contato/dia</th>}
                  {has('linkMarginDb') && <th className="num" title="Margem do enlace">enlace</th>}
                  {has('powerMarginFraction') && <th className="num" title="Margem de energia (geração média vs consumo)">energia</th>}
                  {has('batteryRequiredWh') && <th className="num" title="Bateria necessária (declarada)">bateria</th>}
                  {has('lifetimeYears') && <th className="num" title="Vida orbital">vida</th>}
                  {has('massTotal') && <th className="num" title="Massa total com margens (alocada)">massa</th>}
                  <th className="num" title="Regras de requisito atendidas">regras</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pts.map((p) => {
                  const isCurrent = nearest === p;
                  if (!p.ok) return <tr key={p.value} className={isCurrent ? 'is-current' : ''}><td className="mono">{fmtNum(p.value)}</td><td colSpan={9} className="support-label">{p.issue ?? 'valor inválido'}</td></tr>;
                  const linkTone: Tone = p.linkMarginDb === null ? '' : p.linkMarginDb < 0 ? 'fail' : p.linkMarginDb < 3 ? 'warn' : 'ok';
                  const powerTone: Tone = p.powerMarginFraction === null ? '' : p.powerMarginFraction < 0 ? 'fail' : p.powerMarginFraction < 0.1 ? 'warn' : 'ok';
                  const battTone: Tone = p.batteryRequiredWh === null || p.batteryDeclaredWh === null ? '' : p.batteryRequiredWh > p.batteryDeclaredWh ? 'fail' : 'ok';
                  const lifeTone: Tone = p.lifetimeYears === null ? '' : missionYears !== null && p.lifetimeYears < missionYears ? 'fail' : p.lifetimeYears > 25 ? 'warn' : 'ok';
                  const massTone: Tone = p.massTotal === null || p.massAllocated === null ? '' : p.massTotal > p.massAllocated ? 'fail' : (p.massAllocated - p.massTotal) / p.massAllocated < 0.1 ? 'warn' : 'ok';
                  const rulesTone: Tone = p.rulesTotal === 0 ? '' : p.rulesPass === p.rulesTotal ? 'ok' : 'fail';
                  return (
                    <tr key={p.value} className={isCurrent ? 'is-current' : ''}>
                      <td className="mono">{fmtNum(p.value)}</td>
                      {has('eclipseMaxMin') && <Cell text={p.eclipseMaxMin === null ? '—' : `${fmtNum(p.eclipseMaxMin, 1)} min`} />}
                      {has('contactMinPerDay') && <Cell text={p.contactMinPerDay === null ? '—' : `${fmtNum(p.contactMinPerDay, 0)} min`} />}
                      {has('linkMarginDb') && <Cell text={p.linkMarginDb === null ? '—' : `${fmtNum(p.linkMarginDb, 1)} dB`} tone={linkTone} />}
                      {has('powerMarginFraction') && <Cell text={fmtPct(p.powerMarginFraction)} tone={powerTone} />}
                      {has('batteryRequiredWh') && <Cell text={p.batteryRequiredWh === null ? '—' : `${fmtNum(p.batteryRequiredWh, 0)}${p.batteryDeclaredWh !== null ? ` (${fmtNum(p.batteryDeclaredWh, 0)})` : ''} Wh`} tone={battTone} />}
                      {has('lifetimeYears') && <Cell text={p.lifetimeYears === null ? '—' : p.lifetimeYears === Infinity ? '> 30 a' : `${fmtNum(p.lifetimeYears, 1)} a`} tone={lifeTone} />}
                      {has('massTotal') && <Cell text={p.massTotal === null ? '—' : `${fmtNum(p.massTotal, 1)}${p.massAllocated !== null ? ` (${fmtNum(p.massAllocated, 0)})` : ''} kg`} tone={massTone} />}
                      <Cell text={`${p.rulesPass}/${p.rulesTotal}`} tone={rulesTone} />
                      <td className="num">
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => apply(p.value)} disabled={isCurrent && !stale} title={`Aplicar ${fmtNum(p.value)} ${result.variable.unit} ao modelo`}>
                          Aplicar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="support-label">Cada linha reavalia o modelo inteiro (motor + análise de missão rápida); só aparecem as colunas que mudam. "Aplicar" edita o modelo e pode ser desfeito.</p>
        </>
      )}
    </section>
  );
}
