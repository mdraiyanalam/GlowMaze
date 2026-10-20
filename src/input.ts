import { DOWN, LEFT, RIGHT, UP } from './game/constants';
import type { Dir } from './game/constants';

export interface InputHandlers {
  direction(d: Dir): void;
  start(): void;
  pause(): void;
  mute(): void;
  /** Any key press or touch; used to unlock audio. */
  gesture(): void;
}

const KEYS: Record<string, Dir> = {
  ArrowUp: UP,
  KeyW: UP,
  ArrowLeft: LEFT,
  KeyA: LEFT,
  ArrowDown: DOWN,
  KeyS: DOWN,
  ArrowRight: RIGHT,
  KeyD: RIGHT,
};

const SWIPE_PX = 14;

/** Keyboard anywhere on the page; swipes and taps on the play surface. */
export function bindInput(surface: HTMLElement, h: InputHandlers): void {
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (target?.tagName === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter')) return;
    h.gesture();
    const d = KEYS[e.code];
    if (d !== undefined) {
      e.preventDefault();
      h.direction(d);
    } else if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      h.start();
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
      h.pause();
    } else if (e.code === 'KeyM') {
      h.mute();
    }
  });

  let sx = 0;
  let sy = 0;
  let tracking = false;
  let swiped = false;
  surface.addEventListener('pointerdown', (e) => {
    h.gesture();
    tracking = true;
    swiped = false;
    sx = e.clientX;
    sy = e.clientY;
    try {
      surface.setPointerCapture(e.pointerId);
    } catch {
      /* not supported */
    }
  });
  surface.addEventListener('pointermove', (e) => {
    if (!tracking) return;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
    h.direction(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? RIGHT : LEFT) : dy > 0 ? DOWN : UP);
    // Re-anchor so one long drag can steer through several turns.
    sx = e.clientX;
    sy = e.clientY;
    swiped = true;
  });
  surface.addEventListener('pointerup', () => {
    if (tracking && !swiped) h.start();
    tracking = false;
  });
  surface.addEventListener('pointercancel', () => {
    tracking = false;
  });
}
