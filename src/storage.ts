import { POINTS_TO_WIN_OPTIONS, type Difficulty, type Mode, type PointsToWin } from './game/config';

export interface Settings {
  mode: Mode;
  difficulty: Difficulty;
  pointsToWin: PointsToWin;
  sound: boolean;
}

export interface Stats {
  wins: number;
  losses: number;
  bestRally: number;
}

const KEY = 'neon-pong:v2';

interface Saved {
  settings: Settings;
  stats: Stats;
}

const DEFAULTS: Saved = {
  settings: { mode: 'cpu', difficulty: 'normal', pointsToWin: 7, sound: true },
  stats: { wins: 0, losses: 0, bestRally: 0 },
};

export function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const data = JSON.parse(raw) as Partial<Saved>;
    const settings = { ...DEFAULTS.settings, ...data.settings };
    if (!POINTS_TO_WIN_OPTIONS.includes(settings.pointsToWin)) settings.pointsToWin = 7;
    return { settings, stats: { ...DEFAULTS.stats, ...data.stats } };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function save(data: Saved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage may be unavailable (private mode, quota); the game still works.
  }
}
