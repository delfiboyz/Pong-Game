interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

/** Fixed-size particle pool: no allocations during gameplay. */
export class Particles {
  private readonly pool: Particle[];
  private cursor = 0;

  constructor(capacity = 600) {
    this.pool = Array.from({ length: capacity }, () => ({
      x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1, color: '#fff',
    }));
  }

  /** @param dirX bias the burst direction (-1, 0, 1). */
  burst(x: number, y: number, color: string, count: number, power = 1, dirX = 0): void {
    for (let i = 0; i < count; i++) {
      const p = this.pool[this.cursor]!;
      this.cursor = (this.cursor + 1) % this.pool.length;
      const angle = Math.random() * Math.PI * 2;
      const speed = (80 + Math.random() * 420) * power;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed + dirX * speed * 0.8;
      p.vy = Math.sin(angle) * speed;
      p.maxLife = p.life = 0.3 + Math.random() * 0.5;
      p.size = 1.5 + Math.random() * 3;
      p.color = color;
    }
  }

  update(dt: number): void {
    const drag = Math.pow(0.04, dt);
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vx *= drag;
      p.vy *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      const t = p.life / p.maxLife;
      ctx.globalAlpha = t;
      ctx.fillStyle = p.color;
      const s = p.size * (0.5 + t);
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    for (const p of this.pool) p.life = 0;
  }
}
