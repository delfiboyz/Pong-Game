import { BALL, COLORS, WORLD } from './config';
import type { Particles } from './particles';
import type { Ball, Paddle } from './types';

export interface Scene {
  time: number;
  ball: Ball;
  ballVisible: boolean;
  trail: readonly { x: number; y: number }[];
  paddles: readonly Paddle[];
  particles: Particles;
  shake: { x: number; y: number };
  /** 0..1 flash of the whole court after a goal. */
  goalFlash: number;
  goalColor: string;
}

/**
 * Canvas 2D renderer with HiDPI support and a cheap bloom pass
 * (blurred down-sampled copy composited additively).
 */
export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly bloom = document.createElement('canvas');
  private readonly bloomCtx: CanvasRenderingContext2D;
  private readonly bloomSupported: boolean;
  private scale = 1;

  constructor(readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    const bloomCtx = this.bloom.getContext('2d');
    if (!ctx || !bloomCtx) throw new Error('Canvas 2D is not supported');
    this.ctx = ctx;
    this.bloomCtx = bloomCtx;
    this.bloomCtx.filter = 'blur(1px)';
    this.bloomSupported = this.bloomCtx.filter === 'blur(1px)';

    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  /** Convert a client (CSS pixel) coordinate into world space. */
  toWorld = (clientX: number, clientY: number): { x: number; y: number } => {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - r.left) / r.width) * WORLD.width,
      y: ((clientY - r.top) / r.height) * WORLD.height,
    };
  };

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    this.canvas.width = w;
    this.canvas.height = h;
    this.bloom.width = Math.max(1, Math.round(w / 4));
    this.bloom.height = Math.max(1, Math.round(h / 4));
    this.scale = w / WORLD.width;
  }

  render(scene: Scene): void {
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.setTransform(this.scale, 0, 0, this.scale, scene.shake.x * this.scale, scene.shake.y * this.scale);
    this.drawCourt(scene);
    this.drawTrail(scene);
    for (const p of scene.paddles) this.drawPaddle(p);
    if (scene.ballVisible) this.drawBall(scene.ball);
    ctx.globalCompositeOperation = 'lighter';
    scene.particles.draw(ctx);
    ctx.globalCompositeOperation = 'source-over';

    if (scene.goalFlash > 0) {
      ctx.globalAlpha = scene.goalFlash * 0.25;
      ctx.fillStyle = scene.goalColor;
      ctx.fillRect(-50, -50, WORLD.width + 100, WORLD.height + 100);
      ctx.globalAlpha = 1;
    }

    this.applyBloom();
  }

  private drawCourt(scene: Scene): void {
    const { ctx } = this;
    // Scrolling synthwave grid.
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    const size = 64;
    const offset = (scene.time * 12) % size;
    ctx.beginPath();
    for (let x = -size + offset; x <= WORLD.width; x += size) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD.height);
    }
    for (let y = 0; y <= WORLD.height; y += size) {
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.width, y);
    }
    ctx.stroke();

    // Center line and circle.
    ctx.strokeStyle = 'rgba(230, 236, 255, 0.18)';
    ctx.lineWidth = 4;
    ctx.setLineDash([18, 22]);
    ctx.beginPath();
    ctx.moveTo(WORLD.width / 2, 0);
    ctx.lineTo(WORLD.width / 2, WORLD.height);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(WORLD.width / 2, WORLD.height / 2, 90, 0, Math.PI * 2);
    ctx.stroke();

    // Top / bottom rails.
    ctx.fillStyle = COLORS.wall;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(0, 0, WORLD.width, 3);
    ctx.fillRect(0, WORLD.height - 3, WORLD.width, 3);
    ctx.globalAlpha = 1;
  }

  private drawTrail(scene: Scene): void {
    if (!scene.ballVisible || scene.trail.length < 2) return;
    const { ctx } = this;
    const hue = ballHue(scene.ball);
    ctx.lineCap = 'round';
    for (let i = 1; i < scene.trail.length; i++) {
      const a = scene.trail[i - 1]!;
      const b = scene.trail[i]!;
      const t = 1 - i / scene.trail.length;
      ctx.strokeStyle = `hsl(${hue} 100% 65% / ${t * 0.5})`;
      ctx.lineWidth = scene.ball.radius * 2 * t;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  private drawPaddle(p: Paddle): void {
    const { ctx } = this;
    const color = p.side === 'left' ? COLORS.p1 : COLORS.p2;
    // Squash & stretch on hit.
    const w = p.width * (1 + p.flash * 0.5);
    const h = p.height * (1 - p.flash * 0.08);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(p.x - w / 2, p.y - h / 2, w, h, w / 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 255, 255, ${0.35 + p.flash * 0.65})`;
    ctx.beginPath();
    ctx.roundRect(p.x - 2, p.y - h / 2 + 8, 4, h - 16, 2);
    ctx.fill();
  }

  private drawBall(ball: Ball): void {
    const { ctx } = this;
    ctx.fillStyle = `hsl(${ballHue(ball)} 100% 70%)`;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  private applyBloom(): void {
    if (!this.bloomSupported) return;
    const { ctx, bloomCtx, bloom } = this;
    bloomCtx.globalCompositeOperation = 'copy';
    bloomCtx.filter = `blur(${Math.max(2, bloom.width / 220)}px)`;
    bloomCtx.drawImage(this.canvas, 0, 0, bloom.width, bloom.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.9;
    ctx.drawImage(bloom, 0, 0, this.canvas.width, this.canvas.height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

/** Ball shifts from yellow toward hot red as it speeds up. */
function ballHue(ball: Ball): number {
  const t = Math.min(1, Math.max(0, (ball.speed - BALL.startSpeed) / (BALL.maxSpeed - BALL.startSpeed)));
  return 55 - t * 55;
}
