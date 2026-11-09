import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useArchitectureStore, type GraphLens, type InspectorTab, type MatrixKind, type ViewMode } from '../../state/architectureStore';
import type { NormalizedArchitecture } from '../../domain/model/ArchitectureTypes';
import { auditArchitecture, type AuditReport } from '../../domain/analysis/audit';
import { computeVcrm, type Vcrm } from '../../domain/analysis/matrices';
import { getMissionReport, type MissionReport } from '../../domain/analysis/mission';
import { missionObjectives } from '../../domain/analysis/objectives';
import { fmtNum, fmtPct, fmtQty } from '../../lib/format';
import { IconChevronRight } from '../ui/icons';
import { HomeOrbitScene } from './HomeOrbitScene';
import { HomeTrailer, type TrailerHandle, type TrailerTarget } from './HomeTrailer';

/**
 * Project home: answers "does the design close?" at a glance and routes to
 * the view that holds each answer. The hero is the thesis itself, the thread
 * mission → requirements → … → verification, with one station per link of
 * the chain. Every number here comes from the engine, the audit, the VCRM or
 * the mission report; nothing is computed only for this screen.
 *
 * It is the one screen with an opening sequence, so it plays once per page
 * load: coming back to this tab shows everything already in place.
 */

let openingPlayed = false;
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type Health = 'ok' | 'warn' | 'fail' | 'neutral';

interface Target { view: ViewMode; lens?: GraphLens; tab?: InspectorTab; matrix?: MatrixKind }

interface Station {
  id: string;
  label: string;
  count: number;
  unit: string;
  detail: string;
  health: Health;
  color: string;
  target: Target;
  hint: string;
}

interface Check {
  id: string;
  health: Health;
  title: string;
  value: string;
  target: Target;
  /** Share of the available amount in use, when the check compares the two. */
  used?: number;
}

const CHECK_GROUPS: Array<{ id: string; title: string; has: (id: string) => boolean }> = [
  { id: 'req', title: 'Requisitos e modelo', has: (id) => id === 'rules' || id === 'verif' || id === 'audit' },
  { id: 'res', title: 'Massa e energia', has: (id) => id.startsWith('budget-') || id === 'power' || id === 'battery' },
  { id: 'ops', title: 'Operação em órbita', has: (id) => id === 'link' || id === 'data' || id === 'decay' || id === 'thermal' },
];

const usedShare = (used: number, available: number) => (available > 0 ? Math.min(1, Math.max(0, used / available)) : undefined);

const HEALTH_LABEL: Record<Health, string> = { ok: 'em dia', warn: 'atenção', fail: 'problema', neutral: 'sem dado' };

export function StatusMark({ health, size = 12 }: { health: Health; size?: number }) {
  const label = HEALTH_LABEL[health];
  return (
    <svg className={`status-mark is-${health}`} width={size} height={size} viewBox="0 0 12 12" role="img" aria-label={label}>
      {health === 'ok' && <circle cx="6" cy="6" r="5" />}
      {health === 'warn' && <path d="M6 1 L11.2 10.5 H0.8 Z" />}
      {health === 'fail' && <rect x="1.2" y="1.2" width="9.6" height="9.6" />}
      {health === 'neutral' && <circle cx="6" cy="6" r="4.4" fill="none" strokeWidth="1.4" />}
    </svg>
  );
}

const worst = (hs: Health[]): Health =>
  hs.includes('fail') ? 'fail' : hs.includes('warn') ? 'warn' : hs.includes('ok') ? 'ok' : 'neutral';

function cover(c: { covered: number; total: number }, failBelow = false): Health {
  if (c.total === 0) return 'neutral';
  if (c.covered === c.total) return 'ok';
  return failBelow ? 'fail' : 'warn';
}

function buildStations(arch: NormalizedArchitecture, audit: AuditReport, vcrm: Vcrm, mission: MissionReport | null): Station[] {
  const byCat = (c: string) => arch.entities.filter((e) => e.category === c);
  const color = (c: string, fallback = 'var(--ink-3)') => arch.categoriesById[c]?.color ?? fallback;
  const physical = new Set(['segment', 'subsystem', 'component']);
  const interfaces = arch.relations.filter((r) =>
    physical.has(arch.entitiesById[r.source]?.category ?? '') && physical.has(arch.entitiesById[r.target]?.category ?? ''));
  const critical = interfaces.filter((r) => r.criticality === 'high' || r.criticality === 'critical').length;
  const cov = audit.coverage;
  const reqs = byCat('requirement');
  const rules = cov.rulesPassing;
  const subsystems = byCat('subsystem');
  const components = byCat('component');
  const parents = new Set(components.map((c) => c.parentId).filter(Boolean));
  const budgets = arch.evaluation.budgets;
  const budgetHealth = budgets.map((b): Health => (b.status === 'over' ? 'fail' : b.status === 'warning' || b.status === 'critical' ? 'warn' : b.status === 'ok' ? 'ok' : 'neutral'));
  const tightest = [...budgets].filter((b) => b.marginRemainingFraction !== null)
    .sort((a, b) => (a.marginRemainingFraction ?? 0) - (b.marginRemainingFraction ?? 0))[0];
  const objectives = missionObjectives(arch);
  const o = mission?.orbit;

  return [
    {
      id: 'mission', label: 'Missão', count: objectives.length, unit: objectives.length === 1 ? 'objetivo' : 'objetivos',
      detail: o ? `${fmtNum(o.altitudeKm, 0)} km, ${fmtNum(o.inclinationDeg, 1)}°` : 'órbita não declarada',
      health: objectives.length > 0 ? 'ok' : 'warn', color: color('mission'),
      target: { view: '2d', lens: 'trace', tab: 'mission' }, hint: 'Abrir a análise de missão',
    },
    {
      id: 'requirements', label: 'Requisitos', count: reqs.length, unit: 'requisitos',
      detail: rules.total > 0 ? `${rules.covered} de ${rules.total} regras atendidas` : 'nenhum com regra',
      health: worst([cover(rules, true), cover(cov.requirementsAllocated)]), color: color('requirement'),
      target: { view: '2d', lens: 'trace', tab: 'analysis' }, hint: 'Ver a rastreabilidade dos requisitos',
    },
    {
      id: 'functions', label: 'Funções', count: byCat('function').length, unit: 'funções',
      detail: `${cov.functionsAllocated.covered} de ${cov.functionsAllocated.total} alocadas`,
      health: cover(cov.functionsAllocated), color: color('function'),
      target: { view: '2d', lens: 'trace' }, hint: 'Ver a alocação de funções',
    },
    {
      id: 'subsystems', label: 'Subsistemas', count: subsystems.length, unit: 'subsistemas',
      detail: `${parents.size} com componentes`,
      health: subsystems.length > 0 ? 'ok' : 'warn', color: color('subsystem'),
      target: { view: '2d', lens: 'interfaces' }, hint: 'Ver a arquitetura física',
    },
    {
      id: 'components', label: 'Componentes', count: components.length, unit: 'componentes',
      detail: `${cov.physicalWithInterface.covered} de ${cov.physicalWithInterface.total} elementos com interface`,
      health: cover(cov.physicalWithInterface), color: color('component'),
      target: { view: '2d', lens: 'interfaces' }, hint: 'Ver componentes e interfaces',
    },
    {
      id: 'interfaces', label: 'Interfaces', count: interfaces.length, unit: 'interfaces',
      detail: critical > 0 ? `${critical} de criticidade alta` : 'nenhuma crítica',
      health: interfaces.length > 0 ? 'ok' : 'warn', color: 'var(--ink-2)',
      target: { view: 'matrices', matrix: 'n2' }, hint: 'Abrir a matriz N²',
    },
    {
      id: 'budgets', label: 'Budgets', count: budgets.length, unit: 'budgets',
      detail: tightest && tightest.total !== null && tightest.allocated !== undefined
        ? `${tightest.label}: ${fmtNum(tightest.total, 1)} de ${fmtNum(tightest.allocated, 1)} ${tightest.unit}`
        : 'sem alocação declarada',
      health: worst(budgetHealth), color: 'var(--ink-2)',
      target: { view: '2d', tab: 'analysis' }, hint: 'Ver budgets e margens',
    },
    {
      id: 'verification', label: 'Verificação', count: byCat('verification').length, unit: 'verificações',
      detail: `${vcrm.coverage.closed} de ${vcrm.coverage.total} requisitos fechados`,
      health: vcrm.summary.failed > 0 ? 'fail' : vcrm.summary.none > 0 ? 'warn' : vcrm.coverage.closed === vcrm.coverage.total ? 'ok' : 'neutral',
      color: color('verification'),
      target: { view: 'matrices', matrix: 'vcrm' }, hint: 'Abrir a VCRM',
    },
  ];
}

function buildChecks(arch: NormalizedArchitecture, audit: AuditReport, mission: MissionReport | null): Check[] {
  const checks: Check[] = [];
  const rules = audit.coverage.rulesPassing;
  if (rules.total > 0) {
    checks.push({
      id: 'rules', health: cover(rules, true), title: 'Regras dos requisitos',
      value: `${rules.covered} de ${rules.total} atendidas`, target: { view: '2d', lens: 'trace', tab: 'analysis' },
    });
  }
  const verified = audit.coverage.requirementsVerified;
  checks.push({
    id: 'verif', health: cover(verified), title: 'Requisitos com verificação prevista',
    value: `${verified.covered} de ${verified.total}`, target: { view: 'matrices', matrix: 'vcrm' },
  });
  for (const b of arch.evaluation.budgets) {
    if (b.total === null) continue;
    const h: Health = b.status === 'over' ? 'fail' : b.status === 'warning' || b.status === 'critical' ? 'warn' : b.status === 'ok' ? 'ok' : 'neutral';
    const tail = b.allocated !== undefined
      ? `${fmtQty(b.total, b.unit, 1)} de ${fmtQty(b.allocated, b.unit, 1)}, margem ${fmtPct(b.marginRemainingFraction)}`
      : fmtQty(b.total, b.unit, 1);
    checks.push({
      id: `budget-${b.id}`, health: h, title: b.label, value: tail, target: { view: '2d', tab: 'analysis' },
      used: b.allocated !== undefined ? usedShare(b.total, b.allocated) : undefined,
    });
  }
  const p = mission?.power;
  if (p && p.marginFraction !== null) {
    checks.push({ id: 'power', health: p.status, title: 'Energia média por órbita', value: `margem ${fmtPct(p.marginFraction)}`, target: { view: '2d', tab: 'mission' } });
  }
  if (p && p.battery && p.declaredCapacityWh !== null) {
    checks.push({
      id: 'battery', health: p.batteryStatus, title: 'Bateria no pior eclipse',
      value: `${fmtQty(p.declaredCapacityWh, 'Wh', 0)} declarados, ${fmtQty(p.battery.capacityWh, 'Wh', 0)} necessários`, target: { view: '2d', tab: 'mission' },
      used: usedShare(p.battery.capacityWh, p.declaredCapacityWh),
    });
  }
  const l = mission?.link;
  if (l) checks.push({ id: 'link', health: l.status, title: 'Enlace de descida', value: `margem ${fmtQty(l.result.marginDb, 'dB', 1)}`, target: { view: '2d', tab: 'mission' } });
  const d = mission?.data;
  if (d) {
    checks.push({
      id: 'data', health: d.status, title: 'Dados por dia',
      value: `${fmtQty(d.result.generatedMBPerDay, 'MB', 0)} gerados, ${fmtQty(d.result.downlinkCapacityMBPerDay, 'MB', 0)} de capacidade de descida`,
      target: { view: '2d', tab: 'mission' },
      used: usedShare(d.result.generatedMBPerDay, d.result.downlinkCapacityMBPerDay),
    });
  }
  const dec = mission?.decay;
  if (dec) {
    const shortest = dec.survival?.result ?? dec.result;
    const yrs = shortest.reachedFloor ? `${fmtNum(shortest.lifetimeYears, 1)} a ${dec.result.reachedFloor ? fmtNum(dec.result.lifetimeYears, 1) : 'mais de 30'} anos em órbita` : 'mais de 30 anos em órbita';
    const yrsOne = dec.survival ? yrs : (dec.result.reachedFloor ? `${fmtNum(dec.result.lifetimeYears, 1)} anos em órbita` : 'mais de 30 anos em órbita');
    const rule = dec.survives === false ? 'reentra antes do fim da missão' : dec.result.meets25YearRule ? 'cumpre os 25 anos' : 'não cumpre os 25 anos';
    checks.push({ id: 'decay', health: dec.status, title: 'Vida orbital', value: `${yrsOne}, ${rule}`, target: { view: '2d', tab: 'mission' } });
  }
  const t = mission?.thermal;
  if (t && t.status !== 'neutral') {
    checks.push({
      id: 'thermal', health: t.status, title: t.transient ? 'Temperatura na órbita' : 'Equilíbrio térmico',
      value: `${fmtNum(t.result.coldCaseC, 0)} °C a ${fmtNum(t.result.hotCaseC, 0)} °C`, target: { view: '2d', tab: 'mission' },
    });
  }
  const { error, warning } = audit.counts;
  checks.push({
    id: 'audit', health: error > 0 ? 'fail' : warning > 0 ? 'warn' : 'ok', title: 'Auditoria do modelo',
    value: error + warning === 0 ? 'nenhuma lacuna' : `${error} ${error === 1 ? 'erro' : 'erros'}, ${warning} ${warning === 1 ? 'alerta' : 'alertas'}`, target: { view: '2d', tab: 'analysis' },
  });
  return checks;
}

function verdict(checks: Check[]): { health: Health; text: string } {
  const fails = checks.filter((c) => c.health === 'fail').length;
  const warns = checks.filter((c) => c.health === 'warn').length;
  if (fails > 0) return { health: 'fail', text: `O projeto ainda não fecha: ${fails} ${fails === 1 ? 'verificação falha' : 'verificações falham'}` };
  if (warns > 0) return { health: 'warn', text: `O projeto fecha, com ${warns} ${warns === 1 ? 'ponto' : 'pontos'} de atenção` };
  return { health: 'ok', text: 'O projeto fecha em todas as verificações' };
}

function hhmm(h: number): string {
  return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
}

/** How much the middle stations rise over the ends; same value as --arc in home.css. */
const ARC_PX = 18;
/** Height of the first and last knots in the track: arc, button padding, knot radius. */
const KNOT_Y = ARC_PX + 28;

/** Rise of a station on the parabola through all the knots: none at the ends, ARC_PX in the middle. */
function stationRise(i: number, n: number): number {
  const u = n > 1 ? (2 * i) / (n - 1) - 1 : 0;
  return ARC_PX * (1 - u * u);
}

/** Counts up once, starting when the thread reaches its station. */
function CountUp({ value, delayMs, play }: { value: number; delayMs: number; play: boolean }) {
  const [shown, setShown] = useState(play ? 0 : value);
  useEffect(() => {
    if (!play) {
      setShown(value);
      return undefined;
    }
    const start = performance.now() + delayMs;
    let raf = requestAnimationFrame(function tick(now) {
      const p = Math.min(1, Math.max(0, (now - start) / 700));
      setShown(Math.round(value * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [value, delayMs, play]);
  return <span className="mono">{shown}</span>;
}

/** The chain as an orbit over the Earth. Pointing at a station lights what it traces back to. */
function Thread({ stations, play, onGo }: { stations: Station[]; play: boolean; onGo: (t: Target) => void }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;
    setWidth(el.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const n = stations.length;
  const x0 = width / (2 * n);
  const path = `M ${x0} ${KNOT_Y} Q ${width / 2} ${KNOT_Y - 2 * ARC_PX} ${width - x0} ${KNOT_Y}`;
  const litOffset = active === null || n < 2 ? 1 : 1 - active / (n - 1);

  return (
    <section className="trama" aria-labelledby="home-trama-title">
      <div className="trama__head">
        <h2 id="home-trama-title" className="trama__title">Da missão à verificação</h2>
        <p className="trama__hint">{active !== null ? stations[active].hint : 'Cada etapa nasce da anterior. Clique em uma para abrir.'}</p>
      </div>
      <div ref={trackRef} className={`trama__track${active !== null ? ' has-active' : ''}`} onMouseLeave={() => setActive(null)}>
        {width > 0 && (
          <svg className="trama__thread" aria-hidden="true">
            <defs>
              <linearGradient id="trama-thread" gradientUnits="userSpaceOnUse" x1={x0} y1="0" x2={width - x0} y2="0">
                {stations.map((s, i) => <stop key={s.id} offset={n > 1 ? i / (n - 1) : 0} style={{ stopColor: s.color }} />)}
              </linearGradient>
            </defs>
            <path className="trama__thread-base" d={path} pathLength={1} stroke="url(#trama-thread)" />
            <path className="trama__thread-lit" d={path} pathLength={1} stroke="url(#trama-thread)" style={{ ['--lit-off' as never]: litOffset }} />
            <path className="trama__thread-bead" d={path} pathLength={1} />
          </svg>
        )}
        <ol className="trama__line">
          {stations.map((s, i) => (
            <li
              key={s.id}
              className={`trama__station${active !== null && i <= active ? ' is-traced' : ''}${active === i ? ' is-active' : ''}`}
              style={{ ['--i' as never]: i, ['--rise' as never]: `${stationRise(i, n)}px` }}
            >
              <button
                type="button"
                className="trama__btn"
                onClick={() => onGo(s.target)}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              >
                <span className="trama__knot" style={{ ['--knot' as never]: s.color }} aria-hidden="true" />
                <span className="trama__text">
                  <span className="trama__label">{s.label}</span>
                  <span className="trama__count">
                    <CountUp value={s.count} delayMs={560 + i * 200} play={play} />
                    <span className="trama__unit">{s.unit}</span>
                  </span>
                  <span className="trama__detail">
                    <StatusMark health={s.health} />
                    <span>{s.detail}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function MissionHome() {
  const architecture = useArchitectureStore((s) => s.architecture);
  const setViewMode = useArchitectureStore((s) => s.setViewMode);
  const setLens = useArchitectureStore((s) => s.setLens);
  const setInspectorTab = useArchitectureStore((s) => s.setInspectorTab);
  const setMatrixKind = useArchitectureStore((s) => s.setMatrixKind);
  const setSceneMode = useArchitectureStore((s) => s.setSceneMode);

  const audit = useMemo(() => (architecture ? auditArchitecture(architecture) : null), [architecture]);
  const vcrm = useMemo(() => (architecture ? computeVcrm(architecture) : null), [architecture]);
  const mission = useMemo(() => (architecture ? getMissionReport(architecture) : null), [architecture]);

  const [still] = useState(prefersReducedMotion);
  const [playOpening] = useState(() => !openingPlayed && !prefersReducedMotion());
  const [heroVisible, setHeroVisible] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const heroRef = useRef<HTMLElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const checksRef = useRef<HTMLElement | null>(null);
  const trailerRef = useRef<TrailerHandle | null>(null);

  useEffect(() => { openingPlayed = true; }, []);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return undefined;
    const observer = new IntersectionObserver(([entry]) => setHeroVisible(entry.isIntersecting));
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || !playOpening) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setRevealed(true);
      observer.disconnect();
    }, { threshold: 0.02 });
    observer.observe(grid);
    return () => observer.disconnect();
  }, [playOpening]);

  if (!architecture || !audit || !vcrm) return null;

  const stations = buildStations(architecture, audit, vcrm, mission);
  const checks = buildChecks(architecture, audit, mission);
  const v = verdict(checks);
  const o = mission?.orbit;
  const station = mission?.station;
  const objectives = missionObjectives(architecture);
  const okCount = checks.filter((c) => c.health === 'ok').length;

  const go = (t: Target) => {
    if (t.lens) setLens(t.lens);
    if (t.tab) setInspectorTab(t.tab);
    if (t.matrix) setMatrixKind(t.matrix);
    setViewMode(t.view);
  };
  const openOrbit = () => {
    setSceneMode('physical');
    setViewMode('3d');
  };
  const openFromTrailer = (t: TrailerTarget) => {
    if (t.orbit) openOrbit();
    else go(t);
  };

  let revealIndex = 0;

  return (
    <div className={`home${playOpening ? ' is-intro' : ''}`}>
      <section ref={heroRef} className={`home__hero${heroVisible ? '' : ' is-paused'}`}>
        <HomeOrbitScene report={mission} playIntro={playOpening} active={heroVisible} still={still} />
        <div className="home__scrim" aria-hidden="true" />
        <div className="home__hero-inner">
          <header className="home__head">
            <h1 className="home__title home__rise">{architecture.mission?.name ?? architecture.metadata.projectName}</h1>
            {architecture.metadata.description && (
              <p className="home__lede home__rise" style={{ ['--d' as never]: 90 }}>{architecture.metadata.description}</p>
            )}
            <div className="home__actions home__rise" style={{ ['--d' as never]: 180 }}>
              <button
                type="button"
                className={`home__verdict is-${v.health}`}
                title="Ver todas as verificações"
                onClick={() => checksRef.current?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })}
              >
                <StatusMark health={v.health} size={14} />
                {v.text}
              </button>
              <button type="button" className="btn btn--secondary home__cta home__cta--play" onClick={() => trailerRef.current?.start()}>
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z" fill="currentColor" /></svg>
                Assistir ao tutorial
              </button>
              <button type="button" className="btn btn--primary home__cta" onClick={openOrbit}>Ver o satélite em órbita</button>
              <button type="button" className="btn btn--secondary home__cta" onClick={() => go({ view: '2d', lens: 'all' })}>Explorar a arquitetura</button>
            </div>
          </header>
          <Thread stations={stations} play={playOpening} onGo={go} />
        </div>
      </section>

      <div className="home__inner">
        <HomeTrailer ref={trailerRef} still={still} onOpen={openFromTrailer} />
        <div ref={gridRef} className={`home__grid${revealed ? ' is-revealed' : ''}`}>
          <section ref={checksRef} className="home__checks" aria-labelledby="home-checks-title">
            <div className="home__h2-row">
              <h2 id="home-checks-title" className="home__h2">O projeto fecha?</h2>
              <span className="home__tally">{okCount} de {checks.length} em dia</span>
            </div>
            <div className="check-strip" aria-hidden="true">
              {checks.map((c) => <span key={c.id} className={`is-${c.health}`} />)}
            </div>
            <div className="checklist">
              {CHECK_GROUPS.map((g) => {
                const rows = checks.filter((c) => g.has(c.id));
                if (rows.length === 0) return null;
                return (
                  <div key={g.id} className="checklist__group">
                    <h3 className="checklist__group-title">{g.title}</h3>
                    <ul>
                      {rows.map((c) => {
                        const i = revealIndex++;
                        return (
                          <li key={c.id} className="home__reveal" style={{ ['--i' as never]: i }}>
                            <button type="button" className="checklist__row" onClick={() => go(c.target)}>
                              <StatusMark health={c.health} />
                              <span className="checklist__name">
                                <span className="checklist__title">{c.title}</span>
                                {c.used !== undefined && (
                                  <span className="checklist__gauge" aria-hidden="true">
                                    <i className={`is-${c.health}`} style={{ ['--used' as never]: c.used, ['--i' as never]: i }} />
                                  </span>
                                )}
                              </span>
                              <span className="checklist__value">{c.value}</span>
                              <IconChevronRight className="checklist__go" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="home__facts" aria-labelledby="home-facts-title">
            <h2 id="home-facts-title" className="home__h2">Órbita e operação</h2>
            {o ? (
              <>
                <dl className="facts-tiles">
                  <div className="home__reveal" style={{ ['--i' as never]: 0 }}><dt>Altitude</dt><dd className="mono">{fmtQty(o.altitudeKm, 'km', 0)}</dd></div>
                  <div className="home__reveal" style={{ ['--i' as never]: 1 }}><dt>Inclinação</dt><dd className="mono">{fmtQty(o.inclinationDeg, '°', 1)}</dd></div>
                  <div className="home__reveal" style={{ ['--i' as never]: 2 }}><dt>Período</dt><dd className="mono">{fmtQty(o.basics.periodMin, 'min', 1)}</dd></div>
                  {mission && <div className="home__reveal" style={{ ['--i' as never]: 3 }}><dt>Eclipse de projeto</dt><dd className="mono">{fmtQty(mission.eclipse.designEclipseMin, 'min', 1)}</dd></div>}
                </dl>
                <dl className="facts">
                  {o.ltanHours !== undefined && <div><dt>Hora local do nodo ascendente</dt><dd className="mono">{hhmm(o.ltanHours)}</dd></div>}
                  {station && <div><dt>Passes por dia em {station.station.name}</dt><dd className="mono">{fmtNum(station.estimate.passesPerDay, 1)}</dd></div>}
                  {station && <div><dt>Contato por dia</dt><dd className="mono">{fmtQty(station.simulation.totalContactMinPerDay, 'min', 0)}</dd></div>}
                </dl>
              </>
            ) : (
              <p className="home__empty">Declare a órbita em <span className="mono">mission.orbit</span> para ver eclipse, passes e vida orbital.</p>
            )}
            {objectives.length > 0 && (
              <>
                <h3 className="home__h3">Objetivos</h3>
                <ul className="home__objectives">
                  {objectives.map((ob) => (
                    <li key={ob.key}>{ob.code && <span className="mono home__objective-code">{ob.code}</span>}{ob.text}</li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
