import { create } from 'zustand';

/** Values the physical scene publishes a few times per second for the HUD. */
export interface Telemetry {
  tSeconds: number;
  utc: string;
  altitudeKm: number;
  latDeg: number;
  lonDeg: number;
  sunlit: boolean;
  contact: boolean;
  elevationDeg: number;
  rangeKm: number;
  orbitNumber: number;
  modeId: string | null;
  modeName: string | null;
  loadW: number | null;
  /** Solar array output at this instant (zero in the shadow). */
  genW: number | null;
  soc: number | null;
  betaDeg: number | null;
}

interface SimState {
  playing: boolean;
  /** Simulated seconds per real second. */
  speed: number;
  follow: boolean;
  resetTick: number;
  overviewTick: number;
  telemetry: Telemetry | null;
  setPlaying: (v: boolean) => void;
  setSpeed: (v: number) => void;
  setFollow: (v: boolean) => void;
  reset: () => void;
  overview: () => void;
  setTelemetry: (t: Telemetry) => void;
}

export const SPEEDS = [1, 10, 60, 600] as const;

export const useSimStore = create<SimState>()((set) => ({
  playing: true,
  speed: 60,
  follow: true,
  resetTick: 0,
  overviewTick: 0,
  telemetry: null,
  setPlaying: (v) => set({ playing: v }),
  setSpeed: (v) => set({ speed: v }),
  setFollow: (v) => set({ follow: v }),
  reset: () => set((s) => ({ resetTick: s.resetTick + 1 })),
  overview: () => set((s) => ({ overviewTick: s.overviewTick + 1, follow: false })),
  setTelemetry: (t) => set({ telemetry: t }),
}));
