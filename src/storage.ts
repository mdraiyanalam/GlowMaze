/** High score and sound setting, kept in this browser only. Storage can be blocked, so every call is guarded. */

const KEY = 'glowmaze:v1';

export interface SaveData {
  hi: number;
  muted: boolean;
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<SaveData>;
      return { hi: Math.max(0, Number(v.hi) || 0), muted: v.muted === true };
    }
  } catch {
    /* storage unavailable */
  }
  return { hi: 0, muted: false };
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable */
  }
}
