// Progress saving: cash and story position in localStorage, so the title
// screen can offer Continue. Wrapped in try/catch — private modes and
// file:// pages may refuse storage, and the game must run anyway.

const KEY = 'sunfall-neon-harbor-save';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function storeSave(cash, missionIndex) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ cash, missionIndex }));
  } catch { /* storage unavailable: play on without saving */ }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}
