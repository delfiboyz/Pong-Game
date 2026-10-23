import './style.css';
import { Sfx } from './game/audio';
import { COLORS, type Difficulty, type Mode, type PointsToWin } from './game/config';
import { Game, type GameState } from './game/game';
import { Input } from './game/input';
import { Renderer } from './game/renderer';
import type { Side } from './game/types';
import { load, save, type Settings } from './storage';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el as T;
};

const saved = load();
const canvas = $<HTMLCanvasElement>('court');
const form = $<HTMLFormElement>('settings');
const screens = document.querySelectorAll<HTMLElement>('.screen');
const pauseBtn = $<HTMLButtonElement>('pause-btn');

const renderer = new Renderer(canvas);
const input = new Input(canvas, renderer.toWorld);
const sfx = new Sfx();

const labels = (): Record<Side, string> =>
  game.settings.mode === 'cpu' ? { left: 'KAMU', right: 'CPU' } : { left: 'P1', right: 'P2' };

const game = new Game(
  renderer,
  input,
  sfx,
  {
    onState: showScreen,
    onScore(scores, scorer) {
      for (const side of ['left', 'right'] as const) {
        const el = $(side === 'left' ? 'p1-score' : 'p2-score');
        el.textContent = String(scores[side]);
        if (side === scorer) bump(el);
      }
    },
    onRally(rally) {
      const el = $('rally');
      el.textContent = String(rally);
      if (rally > 0 && rally % 5 === 0) bump(el);
    },
    onMatchEnd(winner, scores, longestRally) {
      const { stats } = saved;
      stats.bestRally = Math.max(stats.bestRally, longestRally);
      const vsCpu = game.settings.mode === 'cpu';
      if (vsCpu) {
        if (winner === 'left') stats.wins++;
        else stats.losses++;
      }
      save(saved);

      const title = $('result-title');
      title.textContent = vsCpu
        ? winner === 'left' ? 'KAMU MENANG!' : 'CPU MENANG'
        : `${labels()[winner]} MENANG!`;
      title.style.setProperty('--accent', winner === 'left' ? COLORS.p1 : COLORS.p2);
      $('final-score').textContent = `${scores.left} — ${scores.right}`;
      $('final-rally').textContent = `Rally terpanjang: ${longestRally} · Rekor: ${stats.bestRally}`;
    },
  },
  saved.settings,
);

function bump(el: HTMLElement): void {
  el.animate(
    [{ transform: 'scale(1.6)', filter: 'brightness(2)' }, { transform: 'scale(1)', filter: 'none' }],
    { duration: 400, easing: 'cubic-bezier(.2,.8,.2,1)' },
  );
}

function showScreen(state: GameState): void {
  const swap = (): void => {
    for (const s of screens) s.hidden = s.dataset.screen !== state;
    pauseBtn.hidden = state !== 'playing' && state !== 'serve';
    document.body.dataset.state = state;
    if (state === 'menu') renderStats();
    document.querySelector<HTMLElement>('.screen:not([hidden]) .btn.primary')?.focus({ preventScroll: true });
  };
  // View Transitions API for smooth screen changes where supported.
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.startViewTransition(swap);
  } else swap();
}

function renderStats(): void {
  const { wins, losses, bestRally } = saved.stats;
  $('stats').textContent = `Menang ${wins} · Kalah ${losses} · Rally terbaik ${bestRally}`;
}

function applySettingsToForm(s: Settings): void {
  for (const [name, value] of Object.entries({ mode: s.mode, difficulty: s.difficulty, pointsToWin: s.pointsToWin })) {
    const radio = form.querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`);
    if (radio) radio.checked = true;
  }
  form.querySelector<HTMLInputElement>('input[name="sound"]')!.checked = s.sound;
}

function readSettingsFromForm(): Settings {
  const data = new FormData(form);
  return {
    mode: data.get('mode') as Mode,
    difficulty: data.get('difficulty') as Difficulty,
    pointsToWin: Number(data.get('pointsToWin')) as PointsToWin,
    sound: data.get('sound') === 'on',
  };
}

function startMatch(): void {
  sfx.unlock();
  const l = labels();
  $('p1-label').textContent = l.left;
  $('p2-label').textContent = l.right;
  game.start();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  saved.settings = game.settings = readSettingsFromForm();
  save(saved);
  startMatch();
});
form.addEventListener('change', () => {
  sfx.unlock();
  sfx.enabled = readSettingsFromForm().sound;
  sfx.click();
});

$('resume-btn').addEventListener('click', () => game.resume());
$('restart-btn').addEventListener('click', startMatch);
$('rematch-btn').addEventListener('click', startMatch);
$('quit-btn').addEventListener('click', () => game.quitToMenu());
$('menu-btn').addEventListener('click', () => game.quitToMenu());
pauseBtn.addEventListener('click', () => game.pause());

input.on('pause', () => {
  if (game.state === 'over') game.quitToMenu();
  else game.togglePause();
});
input.on('confirm', () => {
  if (game.state === 'menu') form.requestSubmit();
  else if (game.state === 'over') startMatch();
  else if (game.state === 'paused') game.resume();
});

applySettingsToForm(saved.settings);
showScreen('menu');

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
