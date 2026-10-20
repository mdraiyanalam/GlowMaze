/** Glowmaze colours: thin neon-pink walls on a black arcade screen. */
export const PALETTE = {
  bg: '#000000',
  wall: '#ff2e88',
  wallFlash: '#ffffff',
  door: '#ffc1dc',
  dot: '#ffe2c4',
  power: '#ffffff',
  powerEdge: '#3ff3ff',
  ink: '#ffffff',
  muted: '#9a8cb5',
  accent: '#3ff3ff',
  warn: '#ff7a45',

  // VOLT, the yellow robot
  hero: '#fff35c',
  heroLight: '#fffbc2',
  heroShade: '#c9a100',
  heroVisor: '#2b1d00',
  heroEye: '#ffffff',

  // The Glitches: VIPER, LURK, FLUX, DRIFT
  enemies: ['#a3ff3a', '#b974ff', '#ffb43a', '#ff6a3d'],
  enemyLight: ['#e0ffb8', '#e6d2ff', '#ffe2b0', '#ffc2ad'],
  enemyShade: ['#5ca31a', '#7a3fc4', '#c27a12', '#b8401c'],
  pupil: '#120a1f',
  thruster: '#3ff3ff',

  fright: '#7b8bb8',
  frightFill: '#141a36',
  flash: '#ffffff',
  shade: 'rgba(0, 0, 0, 0.72)',
} as const;

export const FONT = '"Press Start 2P", ui-monospace, Menlo, Consolas, monospace';
