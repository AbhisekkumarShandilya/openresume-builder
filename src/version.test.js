import { describe, it, expect } from 'vitest';
import { formatVersion } from './version.js';

describe('formatVersion', () => {
  it('drops a trailing .0 patch segment', () => {
    expect(formatVersion('2.2.0')).toBe('2.2');
  });

  it('keeps a non-zero patch segment', () => {
    expect(formatVersion('1.0.1')).toBe('1.0.1');
  });

  it('keeps a multi-digit patch segment', () => {
    expect(formatVersion('1.0.156')).toBe('1.0.156');
  });

  it('formats a beta version leading up to the next minor', () => {
    expect(formatVersion('2.2.0-beta.1')).toBe('2.2 beta 1');
  });

  it('keeps the patch segment in a beta for a patch release', () => {
    expect(formatVersion('2.2.1-beta.1')).toBe('2.2.1 beta 1');
  });

  it('falls back to the raw string for unrecognized formats', () => {
    expect(formatVersion('not-a-version')).toBe('not-a-version');
  });
});
