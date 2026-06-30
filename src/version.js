// Converts package.json's strict-semver version string into the
// friendly display form described in DEVELOPMENT.md's Versioning section:
// trailing .0 segments dropped, betas spelled out as "X.Y beta N".
export function formatVersion(semver) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/.exec(semver);
  if (!match) return semver;

  const [, major, minor, patch, beta] = match;
  const base = patch === '0' ? `${major}.${minor}` : `${major}.${minor}.${patch}`;
  return beta ? `${base} beta ${beta}` : base;
}
