import { useMemo, type ReactNode } from 'react';
import { useArchitectureStore } from '../../state/architectureStore';
import { getMissionReport, type MissionReport, type MissionStatus, type ResolvedInput, type Working } from '../../domain/analysis/mission';
import { fmtNum, fmtPct, fmtQty } from '../../lib/format';
import { Sparkline } from '../ui/Sparkline';
import { OrbitFieldEditor } from './ParamEditor';
import { SweepCard } from './SweepCard';

/**
 * "Missão" tab of the inspector: phase 0/A mission analysis computed from the
 * reference orbit, the ground station, the operational modes and the
 * `mission.analysis` bindings. Every card can show the maths behind it.
 */
export function MissionPanel() {
  const architecture = useArchitectureStore((s) => s.architecture);
  const report = useMemo(() => (architecture ? getMissionReport(architecture) : null), [architecture]);
  if (!architecture) return null;
  if (!report) {
    return (
      <div className="sp-stack">
        <p className="sp-empty">
          Declare <span className="mono">mission.orbit</span> no JSON (altitude, inclinação, LTAN ou RAAN e época) para habilitar a análise de missão.
        </p>
      </div>
    );
  }
  return (
    <div className="sp-stack">
      <OrbitCard r={report} />
      <EclipseCard r={report} />
      <StationCard r={report} />
      <PowerCard r={report} />
      <LinkCard r={report} />
      <DataCard r={report} />
      <DecayCard r={report} />
      <ThermalCard r={report} />
      <SweepCard architecture={architecture} />
      {report.missing.length > 0 && (
        <section className="sp-section">
          <h3 className="section-title">Análises não configuradas</h3>
          <ul className="sp-bullets">
            {report.missing.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ── Building blocks ─────────────────────────────────────── */

function Card({ title, status, statusLabel, children, working, inputs }: {
  title: string; status?: MissionStatus; statusLabel?: string; children: ReactNode; working?: Working[]; inputs?: ResolvedInput[];
}) {
  return (
    <section className="sp-section">
      <div className="sp-section__head">
        <h3 className="section-title">{title}</h3>
        {status && statusLabel && <span className={`chip chip--${status === 'neutral' ? 'neutral' : status}`}><span className="chip__dot" />{statusLabel}</span>}
      </div>
      {children}
      {working && working.length > 0 && <WorkingBlock working={working} inputs={inputs} />}
    </section>
  );
}

function WorkingBlock({ working, inputs }: { working: Working[]; inputs?: ResolvedInput[] }) {
  return (
    <details className="sp-math">
      <summary className="sp-math__summary">Mostrar a conta</summary>
      <div className="sp-math__body">
        {inputs && inputs.length > 0 && (
          <div className="sp-math__inputs">
            {inputs.map((i) => (
              <div key={i.label} className="sp-math__input">
                <span>{i.label}</span>
                <span className="mono">
                  {fmtQty(i.value, i.unit ?? '', 2)}
                  {i.ref && <span className="sp-math__ref"> ← {i.ref}</span>}
                </span>
              </div>
            ))}
          </div>
        )}
        {working.map((w, k) => (
          <div key={k} className="sp-math__block">
            <code className="sp-math__formula">{w.formula}</code>
            <ul className="sp-bullets">{w.assumptions.map((a, j) => <li key={j}>{a}</li>)}</ul>
            <span className="support-label">Fonte: {w.source}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

function Metric({ label, value, tone, sub }: { label: string; value: string; tone?: MissionStatus; sub?: string }) {
  return (
    <div className={`sp-metric${tone && tone !== 'neutral' ? ` sp-metric--${tone}` : ''}`}>
      <span className="sp-metric__value mono">{value}</span>
      <span className="sp-metric__label">{label}{sub ? <span className="sp-metric__of"> {sub}</span> : null}</span>
    </div>
  );
}

function Kv({ k, v }: { k: string; v: ReactNode }) {
  return <div className="kv"><span className="kv__k">{k}</span><span className="kv__v mono">{v}</span></div>;
}

const w = (x: Working): Working => ({ formula: x.formula, assumptions: x.assumptions, source: x.source });
const hhmm = (iso: string) => iso.slice(11, 16);
const fmtYears = (y: number, reached: boolean) => (reached ? `${fmtNum(y, 1)} anos` : '> 30 anos');

/* ── Cards ───────────────────────────────────────────────── */

function OrbitCard({ r }: { r: MissionReport }) {
  const o = r.orbit;
  const b = o.basics;
  const ssoStatus: MissionStatus = b.isSunSynchronous ? 'ok' : 'neutral';
  return (
    <Card title="Órbita" status={ssoStatus} statusLabel={b.isSunSynchronous ? 'héliossíncrona' : 'não héliossíncrona'} working={[w(b)]}>
      <Kv k="Altitude" v={<OrbitFieldEditor field="altitudeKm" value={o.altitudeKm} unit="km" />} />
      <Kv k="Inclinação" v={<OrbitFieldEditor field="inclinationDeg" value={o.inclinationDeg} unit="°" />} />
      <Kv k="LTAN" v={<span className="sp-param__edit"><OrbitFieldEditor field="ltanHours" value={o.ltanHours ?? null} unit="h" />{o.ltanHours !== undefined && <span className="support-label">{`${String(Math.floor(o.ltanHours)).padStart(2, '0')}:${String(Math.round((o.ltanHours % 1) * 60)).padStart(2, '0')}`}</span>}</span>} />
      {o.raanDeg !== null && <Kv k="RAAN na época" v={fmtQty(o.raanDeg, '°', 1)} />}
      <Kv k="Época" v={o.epochKnown ? o.epoch.toISOString().slice(0, 10) : `${o.epoch.toISOString().slice(0, 10)} (padrão)`} />
      <div className="sp-metrics">
        <Metric label="período" value={fmtQty(b.periodMin, 'min', 1)} />
        <Metric label="velocidade" value={fmtQty(b.velocityKmS, 'km/s')} />
        <Metric label="órbitas por dia" value={fmtNum(b.orbitsPerDay, 1)} />
        <Metric label="regressão nodal" value={fmtQty(b.nodalRegressionDegPerDay, '°/dia')} sub={Number.isFinite(b.sunSynchronousInclinationDeg) ? `(SSO a ${fmtNum(b.sunSynchronousInclinationDeg, 1)}°)` : undefined} />
      </div>
    </Card>
  );
}

function EclipseCard({ r }: { r: MissionReport }) {
  const e = r.eclipse;
  const working = [w(e.atEpoch)];
  if (e.year) working.push(e.year.working);
  return (
    <Card title="Eclipse" working={working}>
      <div className="sp-metrics">
        <Metric label="β na época" value={e.betaDeg === null ? '—' : fmtQty(e.betaDeg, '°', 1)} />
        <Metric label="eclipse na época" value={fmtQty(e.atEpoch.eclipseMin, 'min', 1)} sub={`(${fmtPct(e.atEpoch.fraction)} da órbita)`} />
        <Metric label="pior caso geométrico (β = 0°)" value={fmtQty(e.worst.eclipseMin, 'min', 1)} sub={`(${fmtPct(e.worst.fraction)})`} />
        <Metric label="sem eclipse acima de |β|" value={fmtQty(e.worst.betaStarDeg, '°', 1)} />
      </div>
      {e.year && (
        <Sparkline
          values={e.year.days.map((d) => d.eclipseMin)}
          ariaLabel={`Duração do eclipse ao longo de ${e.year.year}`}
          captionLeft={`${e.year.year}: eclipse de ${fmtNum(e.year.minEclipseMin, 1)} a ${fmtNum(e.year.maxEclipseMin, 1)} min`}
          captionRight={`β de ${fmtNum(e.year.minBetaDeg, 0)}° a ${fmtNum(e.year.maxBetaDeg, 0)}°`}
        />
      )}
      <p className="support-label">Dimensionamento usa {fmtNum(e.designEclipseMin, 1)} min de eclipse ({e.year ? 'máximo do ano' : 'pior caso geométrico'}).</p>
    </Card>
  );
}

function StationCard({ r }: { r: MissionReport }) {
  const s = r.station;
  if (!s) return null;
  const sim = s.simulation;
  const passes = sim.passes;
  return (
    <Card title="Cobertura e passes" status={passes.length > 0 ? 'ok' : 'fail'} statusLabel={`${passes.length} passes em 24 h`} working={[w(s.coverage), w(s.estimate), w(sim)]}>
      <Kv k="Estação" v={<span className="sp-kv-text">{s.station.name}</span>} />
      <Kv k="Posição" v={`${fmtNum(s.station.latDeg)}°, ${fmtNum(s.station.lonDeg)}°, elevação mínima ${s.station.minElevationDeg}°`} />
      <div className="sp-metrics">
        <Metric label="contato por dia" value={fmtQty(sim.totalContactMinPerDay, 'min', 1)} sub={`(estimativa analítica ${fmtNum(s.estimate.passesPerDay, 1)} passes)`} />
        <Metric label="maior intervalo sem passe" value={fmtQty(sim.longestGapMin / 60, 'h', 1)} />
        <Metric label="passe máximo (zenital)" value={fmtQty(s.coverage.maxPassDurationMin, 'min', 1)} />
        <Metric label="alcance na elevação mínima" value={fmtQty(s.coverage.slantRangeKm, 'km', 0)} />
      </div>
      {passes.length > 0 && (
        <table className="sp-table sp-passes">
          <thead><tr><th>AOS (UTC)</th><th className="num">duração</th><th className="num">elevação máx.</th></tr></thead>
          <tbody>
            {passes.slice(0, 8).map((p) => (
              <tr key={p.aosUtc}>
                <td className="mono">{hhmm(p.aosUtc)}</td>
                <td className="num mono">{fmtQty(p.durationMin, 'min', 1)}</td>
                <td className="num mono">{fmtQty(p.maxElevationDeg, '°', 0)}</td>
              </tr>
            ))}
          </tbody>
          {passes.length > 8 && <tfoot><tr><td colSpan={3}>… e mais {passes.length - 8} passes</td></tr></tfoot>}
        </table>
      )}
    </Card>
  );
}

function PowerCard({ r }: { r: MissionReport }) {
  const p = r.power;
  if (!p) return null;
  const working: Working[] = [];
  if (p.array) working.push(w(p.array));
  if (p.battery) working.push(w(p.battery));
  if (p.profile) working.push(w(p.profile));
  const label = p.marginFraction === null ? 'sem geração declarada' : p.marginFraction < 0 ? 'geração insuficiente' : `${fmtPct(p.marginFraction)} de margem`;
  return (
    <Card title="Energia" status={p.status} statusLabel={label} working={working} inputs={p.inputs}>
      <div className="sp-metrics">
        <Metric label="consumo médio por órbita" value={fmtQty(p.averageW, 'W', 1)} />
        <Metric label="geração média por órbita" value={fmtQty(p.generationAvgW, 'W', 1)} sub={p.sunPowerW !== null ? `(${fmtNum(p.sunPowerW, 0)} W ao Sol)` : undefined} tone={p.status} />
        <Metric label="no eclipse" value={fmtQty(p.eclipseW, 'W', 1)} sub={`por ${fmtNum(p.designEclipseMin, 0)} min`} />
        <Metric label="ao Sol" value={fmtQty(p.dayW, 'W', 1)} />
      </div>
      {(p.array || p.battery) && (
        <table className="sp-table">
          <thead><tr><th>Dimensionamento</th><th className="num">necessário</th><th className="num">declarado</th></tr></thead>
          <tbody>
            {p.array && (
              <tr>
                <td>Painel solar</td>
                <td className="num mono">{fmtQty(p.array.areaM2, 'm²')} <span className="support-label">({fmtQty(p.array.requiredArrayPowerW, 'W', 0)})</span></td>
                <td className="num mono">{p.declaredArrayAreaM2 === null ? '—' : <span className={`chip chip--${p.arrayStatus}`}><span className="chip__dot" />{fmtQty(p.declaredArrayAreaM2, 'm²')}</span>}</td>
              </tr>
            )}
            {p.battery && (
              <tr>
                <td>Bateria <span className="support-label">(DoD {fmtPct(p.battery.usedDoD)})</span></td>
                <td className="num mono">{fmtQty(p.battery.capacityWh, 'Wh', 0)}</td>
                <td className="num mono">{p.declaredCapacityWh === null ? '—' : <span className={`chip chip--${p.batteryStatus}`}><span className="chip__dot" />{fmtQty(p.declaredCapacityWh, 'Wh', 0)}</span>}</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
      {p.profile && (
        <Sparkline
          values={p.profile.points.map((x) => x.soc * 100)}
          min={0}
          max={100}
          shadeFrom={(p.profile.points.length - Math.round(p.designEclipseMin)) / p.profile.points.length}
          ariaLabel="Estado de carga da bateria ao longo de uma órbita"
          captionLeft={`Estado de carga em uma órbita: mínimo ${fmtPct(p.profile.minSoc)}`}
          captionRight={p.profile.energyDeficitWh > 0 ? `déficit ${fmtQty(p.profile.energyDeficitWh, 'Wh', 1)}` : 'sem déficit'}
        />
      )}
    </Card>
  );
}

function LinkCard({ r }: { r: MissionReport }) {
  const l = r.link;
  if (!l) return null;
  const res = l.result;
  return (
    <Card title="Enlace de dados" status={l.status} statusLabel={`margem ${fmtNum(res.marginDb, 1)} dB`} working={[w(res)]} inputs={l.inputs}>
      <div className="sp-metrics">
        <Metric label="EIRP" value={fmtQty(res.eirpDbW, 'dBW', 1)} />
        <Metric label="perda de espaço livre" value={fmtQty(res.fsplDb, 'dB', 1)} sub={`a ${fmtNum(l.distanceKm, 0)} km`} />
        <Metric label="C/N₀" value={fmtQty(res.cN0DbHz, 'dB·Hz', 1)} />
        <Metric label="Eb/N₀ obtido" value={fmtQty(res.ebN0Db, 'dB', 1)} tone={l.status} />
      </div>
      <details className="sp-math">
        <summary className="sp-math__summary">Linha a linha</summary>
        <table className="sp-table sp-table--dense">
          <tbody>
            {res.lines.map((ln) => (
              <tr key={ln.label}><td>{ln.label}</td><td className="num mono">{fmtNum(ln.valueDb, 1)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </Card>
  );
}

function DataCard({ r }: { r: MissionReport }) {
  const d = r.data;
  if (!d) return null;
  const res = d.result;
  const label = res.status === 'fail' ? 'downlink insuficiente' : d.status === 'warn' && res.status === 'ok' ? 'memória insuficiente' : `${fmtPct(res.marginFraction)} de margem`;
  return (
    <Card title="Dados" status={d.status} statusLabel={label} working={[w(res)]} inputs={d.inputs}>
      <div className="sp-metrics">
        <Metric label="gerado por dia" value={fmtQty(res.generatedMBPerDay, 'MB', 0)} />
        <Metric label="capacidade de downlink por dia" value={fmtQty(res.downlinkCapacityMBPerDay, 'MB', 0)} tone={res.status === 'fail' ? 'fail' : undefined} />
        <Metric label="memória necessária" value={fmtQty(res.storageRequiredMB, 'MB', 0)} sub={d.storageCapacityMB !== null ? `(declarada ${fmtNum(d.storageCapacityMB, 0)} MB)` : undefined} tone={d.storageCapacityMB !== null && d.storageCapacityMB < res.storageRequiredMB ? 'warn' : undefined} />
        <Metric label="contato por dia" value={fmtQty(d.contactMinPerDay, 'min', 1)} />
      </div>
    </Card>
  );
}

function DecayCard({ r }: { r: MissionReport }) {
  const d = r.decay;
  if (!d) return null;
  const res = d.result;
  const surv = d.survival;
  const label = d.survives === false ? 'reentra antes do fim da missão' : res.meets25YearRule ? 'cumpre a regra dos 25 anos' : 'precisa de desorbitação';
  const hist = res.history;
  return (
    <Card title="Decaimento orbital" status={d.status} statusLabel={label} working={surv ? [w(surv.result), w(res)] : [w(res)]} inputs={d.inputs}>
      <div className="sp-metrics">
        {surv && (
          <Metric label="vida orbital, massa nominal (sobrevivência)" value={fmtYears(surv.result.lifetimeYears, surv.result.reachedFloor)} tone={d.survives === false ? 'fail' : 'ok'} sub={d.missionLifetimeYears !== null ? `(missão de ${d.missionLifetimeYears} anos)` : undefined} />
        )}
        <Metric label={surv ? 'vida orbital, massa com margens (descarte)' : 'vida orbital estimada'} value={fmtYears(res.lifetimeYears, res.reachedFloor)} tone={surv ? undefined : d.status} sub={!surv && d.missionLifetimeYears !== null ? `(missão de ${d.missionLifetimeYears} anos)` : undefined} />
        <Metric label="coeficiente balístico (descarte)" value={fmtQty(d.ballisticCoefficient, 'm²/kg', 3)} />
        <Metric label="regra dos 5 anos (FCC)" value={res.meets5YearRule ? 'cumpre' : 'não cumpre'} tone={res.meets5YearRule ? 'ok' : 'neutral'} />
        <Metric label="regra dos 25 anos (IADC)" value={res.meets25YearRule ? 'cumpre' : 'não cumpre'} tone={res.meets25YearRule ? 'ok' : 'warn'} />
      </div>
      {hist.length > 2 && (
        <Sparkline
          values={hist.map((h) => h.altitudeKm)}
          min={100}
          ariaLabel="Altitude ao longo da vida orbital"
          captionLeft={`Altitude: ${fmtNum(hist[0].altitudeKm, 0)} km → ${fmtNum(hist[hist.length - 1].altitudeKm, 0)} km`}
          captionRight={res.reachedFloor ? `em ${fmtNum(res.lifetimeYears, 1)} anos` : 'em 30 anos'}
        />
      )}
    </Card>
  );
}

function ThermalCard({ r }: { r: MissionReport }) {
  const t = r.thermal;
  if (!t) return null;
  const res = t.result;
  const limits = t.tMinC !== null || t.tMaxC !== null ? `${t.tMinC ?? '−∞'} a ${t.tMaxC ?? '∞'} °C` : null;
  return (
    <Card title="Térmico" status={t.status} statusLabel={t.status === 'neutral' ? 'sem limites declarados' : t.status === 'ok' ? 'dentro dos limites' : 'fora dos limites'} working={[w(res)]} inputs={t.inputs}>
      <div className="sp-metrics">
        <Metric label={t.transient ? 'máxima no caso quente' : 'caso quente (equilíbrio)'} value={fmtQty(res.hotCaseC, '°C', 0)} tone={t.tMaxC !== null && res.hotCaseC > t.tMaxC ? 'fail' : undefined} />
        <Metric label={t.transient ? 'mínima no caso frio' : 'caso frio (equilíbrio)'} value={fmtQty(res.coldCaseC, '°C', 0)} tone={t.tMinC !== null && res.coldCaseC < t.tMinC ? 'fail' : undefined} />
        {t.transient && res.timeConstantH !== undefined
          ? <Metric label="constante de tempo térmica" value={fmtQty(res.timeConstantH, 'h', 1)} />
          : <Metric label="absorvido no caso quente" value={fmtQty(res.absorbedHotW, 'W', 0)} />}
        <Metric label="fator de vista da Terra" value={fmtNum(res.viewFactor, 2)} />
      </div>
      {limits && (
        <p className="support-label">
          Limites: {limits}.{' '}
          {t.transient && res.equilibriumColdC !== undefined && res.equilibriumHotC !== undefined
            ? `Sem a inércia térmica, o equilíbrio instantâneo daria ${fmtNum(res.equilibriumColdC, 0)} °C a ${fmtNum(res.equilibriumHotC, 0)} °C; com ${fmtNum(res.timeConstantH ?? 0, 1)} h de constante de tempo, a temperatura oscila pouco em torno da média da órbita.`
            : 'O caso frio é o equilíbrio em eclipse contínuo; informe a capacidade térmica para calcular a variação real ao longo da órbita.'}
        </p>
      )}
    </Card>
  );
}
