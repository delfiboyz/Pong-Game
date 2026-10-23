import { WORLD } from './config';
import type { Side } from './types';

export interface PlayerIntent {
  /** -1 (up) .. 1 (down) from keyboard / gamepad. */
  axis: number;
  /** Absolute world-space y from mouse / touch, or null when not in use. */
  pointerY: number | null;
}

type Action = 'pause' | 'confirm';

const DEADZONE = 0.18;

/**
 * Unified input: keyboard, mouse, multi-touch (Pointer Events) and the Gamepad API.
 * In two-player mode the screen is split: pointers on the left half drive the
 * left paddle and vice versa.
 */
export class Input {
  twoPlayer = false;
  private readonly keys = new Set<string>();
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private readonly pointerY: Record<Side, number | null> = { left: null, right: null };
  private readonly listeners = new Map<Action, Set<() => void>>();
  private readonly prevButtons = new Map<string, boolean>();

  constructor(
    target: HTMLElement,
    private readonly toWorld: (clientX: number, clientY: number) => { x: number; y: number },
  ) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Escape' || e.code === 'KeyP' || e.code === 'Space') {
        if (e.target instanceof HTMLButtonElement && e.code === 'Space') return;
        e.preventDefault();
        this.emit('pause');
      }
      if (e.code === 'Enter' && !(e.target instanceof HTMLButtonElement)) this.emit('confirm');
      if (e.code.startsWith('Arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    target.addEventListener('pointerdown', (e) => {
      target.setPointerCapture(e.pointerId);
      this.trackPointer(e);
    });
    target.addEventListener('pointermove', (e) => this.trackPointer(e));
    const release = (e: PointerEvent): void => {
      this.pointers.delete(e.pointerId);
      // Touch fingers lift off; the mouse keeps its last position.
      if (e.pointerType !== 'mouse') this.recomputePointerTargets();
    };
    target.addEventListener('pointerup', release);
    target.addEventListener('pointercancel', release);
  }

  on(action: Action, fn: () => void): void {
    let set = this.listeners.get(action);
    if (!set) this.listeners.set(action, (set = new Set()));
    set.add(fn);
  }

  /** Clear pointer targets, e.g. when a new match starts. */
  reset(): void {
    this.pointers.clear();
    this.pointerY.left = this.pointerY.right = null;
  }

  intent(side: Side): PlayerIntent {
    let axis = 0;
    const up = side === 'left' ? ['KeyW'] : ['ArrowUp'];
    const down = side === 'left' ? ['KeyS'] : ['ArrowDown'];
    if (!this.twoPlayer && side === 'left') {
      up.push('ArrowUp');
      down.push('ArrowDown');
    }
    if (up.some((k) => this.keys.has(k))) axis -= 1;
    if (down.some((k) => this.keys.has(k))) axis += 1;

    const pad = this.gamepadFor(side);
    if (pad) {
      const stick = pad.axes[1] ?? 0;
      if (Math.abs(stick) > DEADZONE) axis += stick;
      if (pad.buttons[12]?.pressed) axis -= 1;
      if (pad.buttons[13]?.pressed) axis += 1;
    }

    axis = Math.max(-1, Math.min(1, axis));
    // Keyboard / gamepad take over from the pointer as soon as they're used.
    if (axis !== 0) this.pointerY[side] = null;
    return { axis, pointerY: this.pointerY[side] };
  }

  /** Poll gamepad buttons for menu actions. Call once per frame. */
  pollGamepads(): void {
    for (const pad of navigator.getGamepads?.() ?? []) {
      if (!pad) continue;
      this.edge(`${pad.index}:start`, !!pad.buttons[9]?.pressed, 'pause');
      this.edge(`${pad.index}:a`, !!pad.buttons[0]?.pressed, 'confirm');
    }
  }

  rumble(side: Side, strength: number, ms: number): void {
    const pad = this.gamepadFor(side);
    void pad?.vibrationActuator?.playEffect('dual-rumble', {
      duration: ms,
      strongMagnitude: strength,
      weakMagnitude: strength,
    }).catch(() => {});
  }

  private gamepadFor(side: Side): Gamepad | null {
    const pads = (navigator.getGamepads?.() ?? []).filter((p): p is Gamepad => !!p);
    if (!this.twoPlayer) return side === 'left' ? (pads[0] ?? null) : null;
    return pads[side === 'left' ? 0 : 1] ?? null;
  }

  private trackPointer(e: PointerEvent): void {
    if (e.pointerType === 'mouse' || this.pointers.has(e.pointerId) || e.type === 'pointerdown') {
      this.pointers.set(e.pointerId, this.toWorld(e.clientX, e.clientY));
      this.recomputePointerTargets();
    }
  }

  private recomputePointerTargets(): void {
    let left: number | null = null;
    let right: number | null = null;
    for (const p of this.pointers.values()) {
      if (!this.twoPlayer || p.x < WORLD.width / 2) left = p.y;
      else right = p.y;
    }
    if (left !== null) this.pointerY.left = left;
    if (right !== null) this.pointerY.right = right;
  }

  private edge(key: string, pressed: boolean, action: Action): void {
    if (pressed && !this.prevButtons.get(key)) this.emit(action);
    this.prevButtons.set(key, pressed);
  }

  private emit(action: Action): void {
    this.listeners.get(action)?.forEach((fn) => fn());
  }
}
