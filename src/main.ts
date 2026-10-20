import { Sound } from './audio/sound';
import { SCREEN_H, SCREEN_W } from './game/constants';
import { Game } from './game/game';
import { bindInput } from './input';
import { Renderer } from './render/renderer';
import { loadSave, writeSave } from './storage';

const STEP_MS = 1000 / 60;

function boot(): void {
  const canvas = document.getElementById('screen') as HTMLCanvasElement | null;
  const stage = document.getElementById('stage');
  if (!canvas || !stage) return;

  const saved = loadSave();
  const game = new Game();
  game.hiScore = saved.hi;
  const sound = new Sound();
  sound.setMuted(saved.muted);
  const renderer = new Renderer(canvas);
  renderer.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  // Canvas text only triggers a web-font download if we ask for it.
  void document.fonts?.load(`16px "Press Start 2P"`).catch(() => undefined);

  const pauseBtn = document.getElementById('btn-pause');
  const soundBtn = document.getElementById('btn-sound');
  const persist = () => writeSave({ hi: game.hiScore, muted: sound.muted });
  const refreshButtons = () => {
    if (pauseBtn) {
      pauseBtn.textContent = game.paused ? 'Resume' : 'Pause';
      pauseBtn.toggleAttribute('disabled', !game.inGame);
    }
    if (soundBtn) {
      soundBtn.textContent = sound.muted ? 'Sound off' : 'Sound on';
      soundBtn.setAttribute('aria-pressed', String(!sound.muted));
    }
  };
  const togglePause = () => {
    game.togglePause();
    refreshButtons();
  };
  const toggleMute = () => {
    sound.unlock();
    sound.setMuted(!sound.muted);
    persist();
    refreshButtons();
  };

  bindInput(stage, {
    direction: (d) => game.setDirection(d),
    start: () => {
      sound.unlock();
      game.pressStart();
    },
    pause: togglePause,
    mute: toggleMute,
    gesture: () => sound.unlock(),
  });
  pauseBtn?.addEventListener('click', togglePause);
  soundBtn?.addEventListener('click', toggleMute);

  const fit = () => {
    const cs = getComputedStyle(stage);
    const w = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const h = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const cssWidth = Math.max(160, Math.floor(Math.min(w, (h * SCREEN_W) / SCREEN_H)));
    renderer.resize(cssWidth, Math.min(window.devicePixelRatio || 1, 3));
  };
  new ResizeObserver(fit).observe(stage);
  fit();

  const hide = () => {
    if (game.inGame && !game.paused) game.togglePause();
    refreshButtons();
    persist();
  };
  document.addEventListener('visibilitychange', () => document.hidden && hide());
  window.addEventListener('pagehide', persist);

  let last = performance.now();
  let acc = 0;
  let wasInGame = game.inGame;
  const frame = (now: number) => {
    acc += Math.min(now - last, 200);
    last = now;
    while (acc >= STEP_MS) {
      game.tick();
      acc -= STEP_MS;
    }
    const events = game.drainEvents();
    sound.handle(events);
    sound.setAmbience(game.ambience, game.progress);
    if (events.includes('gameOver')) persist();
    if (wasInGame !== game.inGame) {
      wasInGame = game.inGame;
      refreshButtons();
    }
    renderer.draw(game);
    requestAnimationFrame(frame);
  };
  refreshButtons();
  requestAnimationFrame(frame);
}

boot();
