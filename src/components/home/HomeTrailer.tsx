import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import type { GraphLens, InspectorTab, MatrixKind, ViewMode } from '../../state/architectureStore';

/**
 * Guided trailer on the project home. It only starts on a click, so it plays
 * with sound. Each chapter seeks the video, and "Abrir" opens that part of the
 * real app, so watching turns into doing. The video lives in public/video and
 * ships with the bundle: it has to play offline.
 */

export interface TrailerTarget { view: ViewMode; lens?: GraphLens; tab?: InspectorTab; matrix?: MatrixKind; orbit?: boolean }
export interface TrailerHandle { start: () => void }

const BASE = import.meta.env.BASE_URL;

const CHAPTERS: Array<{ at: number; title: string; target?: TrailerTarget }> = [
  { at: 0, title: 'Do zero', target: { view: 'tutorial' } },
  { at: 21.5, title: 'A estrutura por voz', target: { view: 'tutorial' } },
  { at: 79.4, title: 'As ligações', target: { view: '2d', lens: 'all' } },
  { at: 152.4, title: 'A órbita', target: { view: '2d', tab: 'mission' } },
  { at: 194.2, title: 'Os números e a regra', target: { view: 'tutorial' } },
  { at: 246.5, title: 'A regra, termo a termo', target: { view: '2d', lens: 'trace' } },
  { at: 286.0, title: 'Budgets e veredito', target: { view: '2d', tab: 'analysis' } },
  { at: 299.6, title: 'As vistas', target: { view: '3d' } },
  { at: 316.3, title: 'As matrizes', target: { view: 'matrices', matrix: 'vcrm' } },
  { at: 348.4, title: 'O motor trabalhando', target: { view: '2d', tab: 'mission' } },
  { at: 395.1, title: 'Próximo: o DemoSat-TG' },
];

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export const HomeTrailer = forwardRef<TrailerHandle, { still: boolean; onOpen: (t: TrailerTarget) => void }>(function HomeTrailer({ still, onOpen }, ref) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [now, setNow] = useState(0);

  const play = (at?: number) => {
    const v = videoRef.current;
    if (!v) return;
    if (at !== undefined) v.currentTime = at;
    setStarted(true);
    setEnded(false);
    void v.play();
  };

  useImperativeHandle(ref, () => ({
    start: () => {
      sectionRef.current?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
      play(0);
    },
  }));

  const current = CHAPTERS.reduce((best, c, i) => (now >= c.at ? i : best), 0);

  return (
    <section ref={sectionRef} className="trailer" aria-labelledby="home-trailer-title">
      <div className="trailer__head">
        <h2 id="home-trailer-title" className="home__h2">Do zero ao veredito, em menos de sete minutos</h2>
        <p className="trailer__sub">Uma missão montada do zero, por voz, até o motor dar o veredito. Em cada parte, abra o programa e repita.</p>
      </div>
      <div className="trailer__body">
        <div className="trailer__stage">
          <video
            ref={videoRef}
            className="trailer__video"
            src={`${BASE}video/tutorial.mp4`}
            poster={`${BASE}video/tutorial.jpg`}
            preload="metadata"
            playsInline
            controls={started}
            onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
            onPlay={() => { setStarted(true); setEnded(false); }}
            onEnded={() => setEnded(true)}
          />

          {!started && (
            <button type="button" className="trailer__play" onClick={() => play()} aria-label="Assistir ao tutorial com som">
              <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z" fill="currentColor" /></svg>
              <span>Assistir ao tutorial</span>
            </button>
          )}
          {ended && (
            <div className="trailer__end">
              <p>Agora é com você.</p>
              <div className="trailer__end-actions">
                <button type="button" className="btn btn--primary home__cta" onClick={() => onOpen({ view: '3d', orbit: true })}>Ver o satélite em órbita</button>
                <button type="button" className="btn btn--secondary home__cta" onClick={() => play(0)}>Assistir de novo</button>
              </div>
            </div>
          )}
        </div>
        <ol className="trailer__chapters">
          {CHAPTERS.map((c, i) => (
            <li key={c.at} className={started && i === current ? 'is-now' : undefined}>
              <button type="button" className="trailer__chapter" onClick={() => play(c.at)}>
                <span className="mono trailer__time">{clock(c.at)}</span>
                <span>{c.title}</span>
              </button>
              {c.target && <button type="button" className="trailer__open" onClick={() => onOpen(c.target as TrailerTarget)} aria-label={`Abrir ${c.title} no programa`}>Abrir</button>}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
});
