// Named resume profiles: the app used to keep a single resume under
// `resume-builder:resume`. Now it keeps an *index* of profiles plus one
// storage key per profile body and one per profile's snapshots, so switching
// between "base resume", "resume tailored for job X", etc. is cheap and
// autosave only rewrites the active profile.
//
// Storage layout:
//   resume-builder:profiles            → { profiles: [{id,name,createdAt,updatedAt}], activeProfileId }
//   resume-builder:profile:<id>        → the resume JSON for that profile
//   resume-builder:snapshots:<id>      → the snapshot array for that profile
//
// The functions split into two groups: pure index transforms (no I/O, easily
// unit-tested) and storage helpers that take a Web-Storage-like object so
// tests can pass a fake and App.jsx passes real localStorage.

export const PROFILES_KEY = 'resume-builder:profiles';
export const LEGACY_RESUME_KEY = 'resume-builder:resume';
export const LEGACY_SNAPSHOTS_KEY = 'resume-builder:snapshots';

export const profileBodyKey = (id) => `resume-builder:profile:${id}`;
export const profileSnapshotsKey = (id) => `resume-builder:snapshots:${id}`;

let idCounter = 0;
export function newProfileId() {
  return `p-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;
}

// A default profile name from the resume's own header, falling back to a
// generic label so a nameless resume still gets a sensible profile name.
export function defaultProfileName(resume) {
  const name = resume && resume.personal && typeof resume.personal.name === 'string'
    ? resume.personal.name.trim()
    : '';
  return name || 'My Resume';
}

// Returns `base` if free, otherwise `base (2)`, `base (3)`, … so New and
// Duplicate never collide with an existing profile name.
export function uniqueName(existingNames, base) {
  if (!existingNames.includes(base)) return base;
  let n = 2;
  while (existingNames.includes(`${base} (${n})`)) n++;
  return `${base} (${n})`;
}

export function copyName(existingNames, sourceName) {
  return uniqueName(existingNames, `Copy of ${sourceName}`);
}

export function makeProfileMeta(name, id = newProfileId(), now = Date.now()) {
  return { id, name, createdAt: now, updatedAt: now };
}

// ---- Pure index transforms (no I/O) -------------------------------------

export function addProfileMeta(index, meta) {
  return { profiles: [...index.profiles, meta], activeProfileId: meta.id };
}

export function removeProfileMeta(index, id) {
  const profiles = index.profiles.filter((p) => p.id !== id);
  const activeProfileId =
    index.activeProfileId === id ? (profiles[0] ? profiles[0].id : null) : index.activeProfileId;
  return { profiles, activeProfileId };
}

export function renameProfileMeta(index, id, name, now = Date.now()) {
  return {
    ...index,
    profiles: index.profiles.map((p) => (p.id === id ? { ...p, name, updatedAt: now } : p)),
  };
}

export function touchProfileMeta(index, id, now = Date.now()) {
  return {
    ...index,
    profiles: index.profiles.map((p) => (p.id === id ? { ...p, updatedAt: now } : p)),
  };
}

export function setActiveProfile(index, id) {
  return { ...index, activeProfileId: id };
}

export function findProfile(index, id) {
  return index.profiles.find((p) => p.id === id) || null;
}

// ---- Storage helpers (take a Web-Storage-like object) -------------------

export function readIndex(storage) {
  try {
    const raw = storage.getItem(PROFILES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && Array.isArray(parsed.profiles) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeIndex(storage, index) {
  storage.setItem(PROFILES_KEY, JSON.stringify(index));
}

export function readBody(storage, id) {
  try {
    const raw = storage.getItem(profileBodyKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeBody(storage, id, body) {
  storage.setItem(profileBodyKey(id), JSON.stringify(body));
}

export function readSnapshots(storage, id) {
  try {
    const raw = storage.getItem(profileSnapshotsKey(id));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function writeSnapshots(storage, id, snapshots) {
  storage.setItem(profileSnapshotsKey(id), JSON.stringify(snapshots));
}

// Idempotent migration from the legacy single-resume layout to the profiles
// layout. Safe to call on every startup:
//   - If an index already exists, returns it untouched.
//   - Otherwise creates a "Default" profile (named from the resume header),
//     copies the legacy resume body and snapshots under it, writes the index,
//     and only then removes the legacy keys — and only if the new structure
//     reads back correctly. A crash/quota-failure mid-migration therefore
//     leaves the legacy key intact, because destroying someone's only resume
//     here is the one unrecoverable bug.
export function migrateToProfiles(storage, { genId = newProfileId, now = Date.now } = {}) {
  const existing = readIndex(storage);
  if (existing) return existing;

  const legacyRaw = storage.getItem(LEGACY_RESUME_KEY);
  const legacySnapsRaw = storage.getItem(LEGACY_SNAPSHOTS_KEY);

  let body = null;
  let parsedOk = false;
  let name = 'My Resume';
  if (legacyRaw != null) {
    try {
      body = JSON.parse(legacyRaw);
      parsedOk = true;
      name = defaultProfileName(body);
    } catch {
      parsedOk = false;
    }
  }

  const t = now();
  const id = genId();
  const index = { profiles: [{ id, name, createdAt: t, updatedAt: t }], activeProfileId: id };

  if (legacyRaw != null && parsedOk) {
    writeBody(storage, id, body);
  } else if (legacyRaw != null) {
    // Couldn't parse the legacy resume — keep the raw bytes under the body key
    // so nothing is silently lost, and (below) leave the legacy key in place.
    storage.setItem(profileBodyKey(id), legacyRaw);
  }
  if (legacySnapsRaw != null) {
    storage.setItem(profileSnapshotsKey(id), legacySnapsRaw);
  }
  writeIndex(storage, index);

  // Verify the new structure is really written before touching the legacy key.
  const verified = readIndex(storage);
  const bodyWritten = legacyRaw == null || storage.getItem(profileBodyKey(id)) != null;
  const structureOk = verified && verified.profiles.length === 1 && bodyWritten;

  if (structureOk) {
    // Only delete the legacy resume when we could parse it (and therefore
    // stored a clean copy). If parsing failed, keep it for manual recovery.
    if (legacyRaw != null && parsedOk) storage.removeItem(LEGACY_RESUME_KEY);
    if (legacySnapsRaw != null) storage.removeItem(LEGACY_SNAPSHOTS_KEY);
  }

  return verified || index;
}

// Runs migration and returns everything App needs to boot: the index, the
// active profile id, and its raw resume body (or null → caller uses the empty
// resume).
export function bootstrap(storage) {
  const index = migrateToProfiles(storage);
  const active = findProfile(index, index.activeProfileId) || index.profiles[0] || null;
  const activeId = active ? active.id : null;
  const body = activeId ? readBody(storage, activeId) : null;
  return { index, activeId, body };
}
