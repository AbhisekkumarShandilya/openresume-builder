import { describe, it, expect, beforeEach } from 'vitest';
import {
  PROFILES_KEY,
  LEGACY_RESUME_KEY,
  LEGACY_SNAPSHOTS_KEY,
  profileBodyKey,
  profileSnapshotsKey,
  defaultProfileName,
  uniqueName,
  copyName,
  addProfileMeta,
  removeProfileMeta,
  renameProfileMeta,
  touchProfileMeta,
  setActiveProfile,
  findProfile,
  makeProfileMeta,
  readIndex,
  writeIndex,
  readBody,
  writeBody,
  readSnapshots,
  writeSnapshots,
  migrateToProfiles,
  bootstrap,
} from './profiles.js';

// Minimal in-memory Web-Storage double. `blockKey` lets a test simulate a
// write that silently doesn't stick (e.g. quota failure) for the specific
// key, so we can prove the verify-before-delete guard holds.
function fakeStorage({ blockKey = null } = {}) {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      if (k === blockKey) return;
      map.set(k, String(v));
    },
    removeItem: (k) => map.delete(k),
    _map: map,
    _keys: () => [...map.keys()],
  };
}

const sampleResume = {
  personal: { name: 'Ada Lovelace', title: 'Engineer' },
  sections: [{ id: 'sec-skills', type: 'skills', title: 'Skills', items: ['Math'] }],
};

let counter;
const genId = () => `id-${counter++}`;

beforeEach(() => {
  counter = 0;
});

describe('pure name helpers', () => {
  it('defaultProfileName uses the resume name, trimmed', () => {
    expect(defaultProfileName({ personal: { name: '  Ada  ' } })).toBe('Ada');
  });

  it('defaultProfileName falls back when there is no name', () => {
    expect(defaultProfileName({ personal: {} })).toBe('My Resume');
    expect(defaultProfileName(null)).toBe('My Resume');
    expect(defaultProfileName({})).toBe('My Resume');
  });

  it('uniqueName returns the base when free, else disambiguates', () => {
    expect(uniqueName([], 'Base')).toBe('Base');
    expect(uniqueName(['Base'], 'Base')).toBe('Base (2)');
    expect(uniqueName(['Base', 'Base (2)'], 'Base')).toBe('Base (3)');
  });

  it('copyName prefixes "Copy of" and disambiguates', () => {
    expect(copyName([], 'Frontend')).toBe('Copy of Frontend');
    expect(copyName(['Copy of Frontend'], 'Frontend')).toBe('Copy of Frontend (2)');
  });
});

describe('pure index transforms', () => {
  const base = () => ({
    profiles: [
      { id: 'a', name: 'A', createdAt: 1, updatedAt: 1 },
      { id: 'b', name: 'B', createdAt: 2, updatedAt: 2 },
    ],
    activeProfileId: 'a',
  });

  it('addProfileMeta appends and activates the new profile', () => {
    const meta = makeProfileMeta('C', 'c', 3);
    const next = addProfileMeta(base(), meta);
    expect(next.profiles.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(next.activeProfileId).toBe('c');
  });

  it('removeProfileMeta drops the profile and repoints active when needed', () => {
    const next = removeProfileMeta(base(), 'a');
    expect(next.profiles.map((p) => p.id)).toEqual(['b']);
    expect(next.activeProfileId).toBe('b');
  });

  it('removeProfileMeta keeps active when a different profile is removed', () => {
    const next = removeProfileMeta(base(), 'b');
    expect(next.activeProfileId).toBe('a');
  });

  it('removeProfileMeta yields null active when the last profile goes', () => {
    const single = { profiles: [{ id: 'a', name: 'A', createdAt: 1, updatedAt: 1 }], activeProfileId: 'a' };
    expect(removeProfileMeta(single, 'a')).toEqual({ profiles: [], activeProfileId: null });
  });

  it('renameProfileMeta renames and bumps updatedAt', () => {
    const next = renameProfileMeta(base(), 'a', 'Renamed', 99);
    expect(findProfile(next, 'a')).toMatchObject({ name: 'Renamed', updatedAt: 99 });
    expect(findProfile(next, 'b').name).toBe('B');
  });

  it('touchProfileMeta only bumps updatedAt of the target', () => {
    const next = touchProfileMeta(base(), 'b', 77);
    expect(findProfile(next, 'b').updatedAt).toBe(77);
    expect(findProfile(next, 'a').updatedAt).toBe(1);
  });

  it('setActiveProfile changes only the active pointer', () => {
    const next = setActiveProfile(base(), 'b');
    expect(next.activeProfileId).toBe('b');
    expect(next.profiles).toEqual(base().profiles);
  });

  it('transforms do not mutate their input', () => {
    const original = base();
    addProfileMeta(original, makeProfileMeta('C', 'c', 3));
    removeProfileMeta(original, 'a');
    renameProfileMeta(original, 'a', 'X');
    expect(original).toEqual(base());
  });
});

describe('migrateToProfiles', () => {
  it('wraps a legacy resume as a Default profile named from the resume', () => {
    const s = fakeStorage();
    s.setItem(LEGACY_RESUME_KEY, JSON.stringify(sampleResume));

    const index = migrateToProfiles(s, { genId });

    expect(index.profiles).toHaveLength(1);
    expect(index.profiles[0]).toMatchObject({ id: 'id-0', name: 'Ada Lovelace' });
    expect(index.activeProfileId).toBe('id-0');
    // Body copied under the new key, byte-for-byte content preserved.
    expect(readBody(s, 'id-0')).toEqual(sampleResume);
    // Legacy key removed only after the new structure verified.
    expect(s.getItem(LEGACY_RESUME_KEY)).toBeNull();
  });

  it('migrates legacy snapshots under the default profile', () => {
    const s = fakeStorage();
    const snaps = [{ id: 1, name: 'x', label: 'l', data: sampleResume }];
    s.setItem(LEGACY_RESUME_KEY, JSON.stringify(sampleResume));
    s.setItem(LEGACY_SNAPSHOTS_KEY, JSON.stringify(snaps));

    const index = migrateToProfiles(s, { genId });

    expect(readSnapshots(s, index.activeProfileId)).toEqual(snaps);
    expect(s.getItem(LEGACY_SNAPSHOTS_KEY)).toBeNull();
  });

  it('is idempotent — running twice does not duplicate or lose data', () => {
    const s = fakeStorage();
    s.setItem(LEGACY_RESUME_KEY, JSON.stringify(sampleResume));

    const first = migrateToProfiles(s, { genId });
    const second = migrateToProfiles(s, { genId });

    expect(second).toEqual(first);
    expect(second.profiles).toHaveLength(1);
    expect(readBody(s, second.activeProfileId)).toEqual(sampleResume);
    // No new id was consumed on the second run (index already existed).
    expect(counter).toBe(1);
  });

  it('creates a single empty profile for a brand-new user (no legacy data)', () => {
    const s = fakeStorage();
    const index = migrateToProfiles(s, { genId });

    expect(index.profiles).toHaveLength(1);
    expect(index.profiles[0].name).toBe('My Resume');
    // No body written yet — the app falls back to the empty resume.
    expect(readBody(s, index.activeProfileId)).toBeNull();
  });

  it('preserves a corrupted legacy resume and does NOT delete the legacy key', () => {
    const s = fakeStorage();
    s.setItem(LEGACY_RESUME_KEY, '{not valid json');

    const index = migrateToProfiles(s, { genId });

    expect(index.profiles).toHaveLength(1);
    // Raw bytes preserved under the body key…
    expect(s.getItem(profileBodyKey(index.activeProfileId))).toBe('{not valid json');
    // …and the legacy key is kept for manual recovery.
    expect(s.getItem(LEGACY_RESUME_KEY)).toBe('{not valid json');
  });

  it('does NOT delete the legacy key if the index write did not stick', () => {
    // Simulate the index write failing (quota/crash). The guard must keep the
    // legacy resume so the user's only document survives.
    const s = fakeStorage({ blockKey: PROFILES_KEY });
    s.setItem(LEGACY_RESUME_KEY, JSON.stringify(sampleResume));

    const index = migrateToProfiles(s, { genId });

    expect(s.getItem(PROFILES_KEY)).toBeNull();
    expect(s.getItem(LEGACY_RESUME_KEY)).toBe(JSON.stringify(sampleResume));
    // Still returns a usable in-memory index so the app can run this session.
    expect(index.profiles).toHaveLength(1);
  });

  it('leaves an already-migrated index untouched', () => {
    const s = fakeStorage();
    const preexisting = {
      profiles: [{ id: 'keep', name: 'Keep', createdAt: 5, updatedAt: 5 }],
      activeProfileId: 'keep',
    };
    writeIndex(s, preexisting);
    // A stale legacy key that should be ignored (not re-migrated).
    s.setItem(LEGACY_RESUME_KEY, JSON.stringify(sampleResume));

    const index = migrateToProfiles(s, { genId });

    expect(index).toEqual(preexisting);
    expect(s.getItem(LEGACY_RESUME_KEY)).toBe(JSON.stringify(sampleResume));
  });
});

describe('storage read/write round-trips', () => {
  it('body and snapshots round-trip; readers tolerate corruption', () => {
    const s = fakeStorage();
    writeBody(s, 'x', sampleResume);
    writeSnapshots(s, 'x', [{ id: 1 }]);
    expect(readBody(s, 'x')).toEqual(sampleResume);
    expect(readSnapshots(s, 'x')).toEqual([{ id: 1 }]);

    s.setItem(profileBodyKey('x'), '{broken');
    s.setItem(profileSnapshotsKey('x'), '{broken');
    expect(readBody(s, 'x')).toBeNull();
    expect(readSnapshots(s, 'x')).toEqual([]);
  });

  it('readIndex returns null for missing or malformed data', () => {
    const s = fakeStorage();
    expect(readIndex(s)).toBeNull();
    s.setItem(PROFILES_KEY, '{"nope": true}');
    expect(readIndex(s)).toBeNull();
  });
});

describe('bootstrap', () => {
  it('migrates then returns index + active id + body', () => {
    const s = fakeStorage();
    s.setItem(LEGACY_RESUME_KEY, JSON.stringify(sampleResume));

    const { index, activeId, body } = bootstrap(s);

    expect(index.profiles).toHaveLength(1);
    expect(activeId).toBe(index.activeProfileId);
    expect(body).toEqual(sampleResume);
  });

  it('returns a null body for a fresh install', () => {
    const s = fakeStorage();
    const { activeId, body } = bootstrap(s);
    expect(activeId).toBeTruthy();
    expect(body).toBeNull();
  });
});
