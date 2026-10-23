import { AiController } from './ai';
import type { Sfx } from './audio';
import { AI_PROFILES, BALL, COLORS, PADDLE, SIM_DT, WORLD } from './config';
import type { Input } from './input';
import { Particles } from './particles';
import { createBall, movePaddleToward, serveBall, stepBall } from './physics';
import type { Renderer } from './renderer';
import type { Settings } from '../storage';
import type { Ball, Paddle, Side } from './types';

export type GameState = 'menu' | 'serve' | 'playing' | 'paused' | 'over';

export interface GameHooks {
  onState(state: GameState): void;
  onScore(scores: Record<Side, number>, scorer: Side | null): void;
  onRally(rally: number): void;
  onMatchEnd(winner: Side, scores: Record<Side, number>, longestRally: number): void;
}

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function createPaddle(side: Side): Paddle {
  return {
    side,
    x: side === 'left' ? PADDLE.margin : WORLD.width - PADDLE.margin,
    y: WORLD.height / 2,
    width: PADDLE.width,
    height: PADDLE.height,
    vy: 0,
    flash: 0,
  };
}

export class Game {
  state: GameState = 'menu';
  settings: Settings;

  private readonly ball: Ball = createBall();
  private readonly left = createPaddle('left');
  private readonly right = createPaddle('right');
  private readonly particles = new Particles();
  private readonly trail: { x: number; y: number }[] = [];
  private readonly ai: AiController;

  private scores: Record<Side, number> = { left: 0, right: 0 };
  private rally = 0;
  private longestRally = 0;
  private serveTimer = 0;
  private serveTo: Side = 'left';
  private stateBeforePause: GameState = 'playing';

  private accumulator = 0;
  private lastFrame = 0;
  private time = 0;
  private hitStop = 0;
  private trauma = 0;
  private goalFlash = 0;
  private goalColor: string = COLORS.p1;

  constructor(
    private readonly renderer: Renderer,
    private readonly input: Input,
    private readonly sfx: Sfx,
    private readonly hooks: GameHooks,
    settings: Settings,
  ) {
    this.settings = settings;
    this.ai = new AiController(AI_PROFILES[settings.difficulty]);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
    });
    requestAnimationFrame(this.frame);
  }

  start(): void {
    this.ai.profile = AI_PROFILES[this.settings.difficulty];
    this.input.twoPlayer = this.settings.mode === 'pvp';
    this.input.reset();
    this.sfx.enabled = this.settings.sound;
    this.scores = { left: 0, right: 0 };
    this.longestRally = 0;
    this.left.y = this.right.y = WORLD.height / 2;
    this.particles.clear();
    this.hooks.onScore(this.scores, null);
    this.beginServe(Math.random() < 0.5 ? 'left' : 'right');
  }

  pause(): void {
    if (this.state !== 'playing' && this.state !== 'serve') return;
    this.stateBeforePause = this.state;
    this.setState('paused');
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.lastFrame = performance.now();
    this.setState(this.stateBeforePause);
  }

  togglePause(): void {
    if (this.state === 'paused') this.resume();
    else this.pause();
  }

  quitToMenu(): void {
    this.setState('menu');
  }

  private setState(state: GameState): void {
    this.state = state;
    this.hooks.onState(state);
  }

  private beginServe(toward: Side): void {
    this.serveTo = toward;
    this.serveTimer = BALL.serveDelay;
    this.ball.x = WORLD.width / 2;
    this.ball.y = WORLD.height / 2;
    this.ball.vx = this.ball.vy = 0;
    this.ball.speed = BALL.startSpeed;
    this.trail.length = 0;
    this.rally = 0;
    this.hooks.onRally(0);
    this.setState('serve');
  }

  private readonly frame = (now: number): void => {
    requestAnimationFrame(this.frame);
    this.input.pollGamepads();
    const elapsed = Math.min(0.1, (now - (this.lastFrame || now)) / 1000);
    this.lastFrame = now;

    if (this.state !== 'paused') {
      this.time += elapsed;
      this.accumulator += elapsed;
      while (this.accumulator >= SIM_DT) {
        this.step(SIM_DT);
        this.accumulator -= SIM_DT;
      }
    }

    this.renderer.render({
      time: this.time,
      ball: this.ball,
      ballVisible: this.state !== 'serve' || Math.floor(this.serveTimer * 8) % 2 === 0,
      trail: this.trail,
      paddles: [this.left, this.right],
      particles: this.particles,
      shake: this.shakeOffset(),
      goalFlash: this.goalFlash,
      goalColor: this.goalColor,
    });
  };

  private step(dt: number): void {
    this.particles.update(dt);
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    this.goalFlash = Math.max(0, this.goalFlash - dt * 2.5);
    for (const p of [this.left, this.right]) p.flash = Math.max(0, p.flash - dt * 5);

    if (this.state === 'menu' || this.state === 'over') {
      this.attractMode(dt);
      return;
    }

    if (this.hitStop > 0) {
      this.hitStop -= dt;
      return;
    }

    this.controlHuman(this.left, dt);
    if (this.settings.mode === 'pvp') this.controlHuman(this.right, dt);
    else this.ai.update(this.right, this.ball, dt);

    if (this.state === 'serve') {
      const before = Math.ceil(this.serveTimer * 2);
      this.serveTimer -= dt;
      if (Math.ceil(this.serveTimer * 2) !== before && this.serveTimer > 0) this.sfx.tick();
      if (this.serveTimer <= 0) {
        serveBall(this.ball, this.serveTo);
        this.ai.rerollError();
        this.sfx.serve();
        this.setState('playing');
      }
      return;
    }

    this.simulateBall(dt, true);
  }

  /** Both paddles play by themselves behind the menus. */
  private attractMode(dt: number): void {
    if (this.ball.speed === 0) serveBall(this.ball, 'left');
    for (const p of [this.left, this.right]) {
      const target = this.ball.y + Math.sin(this.time * 1.3 + (p.side === 'left' ? 0 : 2)) * 30;
      movePaddleToward(p, target, 700, dt);
    }
    this.simulateBall(dt, false);
  }

  private controlHuman(paddle: Paddle, dt: number): void {
    const { axis, pointerY } = this.input.intent(paddle.side);
    if (axis === 0 && pointerY !== null) {
      movePaddleToward(paddle, pointerY, PADDLE.pointerSpeed, dt);
    } else {
      movePaddleToward(paddle, paddle.y + axis * WORLD.height, PADDLE.keyboardSpeed * Math.abs(axis), dt);
    }
  }

  private simulateBall(dt: number, live: boolean): void {
    const events = stepBall(this.ball, [this.left, this.right], dt);
    this.trail.unshift({ x: this.ball.x, y: this.ball.y });
    if (this.trail.length > BALL.trailLength) this.trail.pop();

    for (const e of events) {
      const pan = (e.type === 'goal' ? (e.scorer === 'left' ? 1 : -1) : e.x / WORLD.width * 2 - 1) * 0.8;
      switch (e.type) {
        case 'wall':
          this.particles.burst(e.x, e.y, COLORS.wall, 8, 0.6);
          if (live) this.sfx.wall(pan);
          break;
        case 'paddle': {
          const color = e.side === 'left' ? COLORS.p1 : COLORS.p2;
          const ratio = (e.speed - BALL.startSpeed) / (BALL.maxSpeed - BALL.startSpeed);
          this.particles.burst(e.x, e.y, color, 18 + Math.round(ratio * 20), 1 + ratio, e.side === 'left' ? 1 : -1);
          if (!live) break;
          this.sfx.paddle(ratio, pan);
          this.addTrauma(0.25 + ratio * 0.35);
          this.hitStop = 0.03 + ratio * 0.03;
          this.input.rumble(e.side, 0.3 + ratio * 0.6, 80);
          navigator.vibrate?.(12);
          this.ai.rerollError();
          this.rally++;
          this.longestRally = Math.max(this.longestRally, this.rally);
          this.hooks.onRally(this.rally);
          break;
        }
        case 'goal':
          if (live) this.goal(e.scorer, pan);
          else serveBall(this.ball, e.scorer);
          return;
      }
    }
  }

  private goal(scorer: Side, pan: number): void {
    const conceder: Side = scorer === 'left' ? 'right' : 'left';
    const color = scorer === 'left' ? COLORS.p1 : COLORS.p2;
    this.scores[scorer]++;
    this.particles.burst(scorer === 'left' ? WORLD.width : 0, this.ball.y, color, 70, 1.6);
    this.goalFlash = 1;
    this.goalColor = color;
    this.addTrauma(0.8);
    this.sfx.score(pan);
    navigator.vibrate?.([30, 40, 30]);
    this.hooks.onScore(this.scores, scorer);

    if (this.scores[scorer] >= this.settings.pointsToWin) {
      this.ball.speed = 0; // let attract mode re-serve behind the results screen
      this.trail.length = 0;
      this.hooks.onMatchEnd(scorer, { ...this.scores }, this.longestRally);
      if (this.settings.mode === 'cpu' && scorer === 'right') this.sfx.lose();
      else this.sfx.win();
      this.setState('over');
    } else {
      this.beginServe(conceder);
    }
  }

  private addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  private shakeOffset(): { x: number; y: number } {
    if (reducedMotion.matches || this.trauma <= 0) return { x: 0, y: 0 };
    const mag = this.trauma * this.trauma * 16;
    const t = this.time * 60;
    return { x: Math.sin(t * 1.7) * mag, y: Math.cos(t * 2.3) * mag };
  }
}
