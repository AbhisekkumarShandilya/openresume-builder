import { describe, it, expect } from 'vitest';
import {
  THEME_KEY,
  THEME_SETTINGS,
  readThemeSetting,
  writeThemeSetting,
  resolveTheme,
} from './theme.js';

// Minimal in-memory Web-Storage double. `throwOn` lets a test simulate a
// storage that rejects a call (private mode / quota) so we can prove the
// helpers degrade gracefully rather than throwing into the render.
function fakeStorage({ throwOn = null } = {}) {
  const map = new Map();
  return {
    getItem: (k) => {
      if (throwOn === 'get') throw new Error('blocked');
      return map.has(k) ? map.get(k) : null;
    },
    setItem: (k, v) => {
      if (throwOn === 'set') throw new Error('blocked');
      map.set(k, String(v));
    },
    _map: map,
  };
}

describe('readThemeSetting', () => {
  it('defaults to system when nothing is saved', () => {
    expect(readThemeSetting(fakeStorage())).toBe('system');
  });

  it('returns a valid saved setting', () => {
    const s = fakeStorage();
    s.setItem(THEME_KEY, 'dark');
    expect(readThemeSetting(s)).toBe('dark');
  });

  it('falls back to system for an unrecognized value', () => {
    const s = fakeStorage();
    s.setItem(THEME_KEY, 'solarized');
    expect(readThemeSetting(s)).toBe('system');
  });

  it('falls back to system when storage throws', () => {
    expect(readThemeSetting(fakeStorage({ throwOn: 'get' }))).toBe('system');
  });
});

describe('writeThemeSetting', () => {
  it('persists a valid setting and returns it', () => {
    const s = fakeStorage();
    expect(writeThemeSetting(s, 'light')).toBe('light');
    expect(s.getItem(THEME_KEY)).toBe('light');
  });

  it('coerces an invalid setting to system', () => {
    const s = fakeStorage();
    expect(writeThemeSetting(s, 'neon')).toBe('system');
    expect(s.getItem(THEME_KEY)).toBe('system');
  });

  it('does not throw when storage is unavailable', () => {
    expect(() => writeThemeSetting(fakeStorage({ throwOn: 'set' }), 'dark')).not.toThrow();
  });
});

describe('resolveTheme', () => {
  it('pins light/dark regardless of OS preference', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('light', false)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('dark', true)).toBe('dark');
  });

  it('follows the OS preference in system mode', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('exposes exactly the three supported settings', () => {
    expect(THEME_SETTINGS).toEqual(['system', 'light', 'dark']);
  });
});
