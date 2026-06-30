import { describe, it, expect } from 'vitest';
import { BULLET_STYLE_GROUPS, normalizeBulletStyle, isNumbered } from './bulletStyles.js';

describe('normalizeBulletStyle', () => {
  it('maps the legacy "numbered" value to decimal', () => {
    expect(normalizeBulletStyle('numbered')).toBe('decimal');
  });

  it('passes through any valid style id unchanged', () => {
    for (const group of BULLET_STYLE_GROUPS) {
      for (const opt of group.options) {
        expect(normalizeBulletStyle(opt.id)).toBe(opt.id);
      }
    }
  });

  it('falls back to disc for unknown/undefined/null styles', () => {
    expect(normalizeBulletStyle(undefined)).toBe('disc');
    expect(normalizeBulletStyle(null)).toBe('disc');
    expect(normalizeBulletStyle('bogus')).toBe('disc');
    expect(normalizeBulletStyle('')).toBe('disc');
  });
});

describe('isNumbered', () => {
  it('is true for every numbering id', () => {
    expect(isNumbered('decimal')).toBe(true);
    expect(isNumbered('lower-alpha')).toBe(true);
    expect(isNumbered('upper-roman')).toBe(true);
  });

  it('is false for bullet glyph ids and the legacy "bullet" value', () => {
    expect(isNumbered('disc')).toBe(false);
    expect(isNumbered('none')).toBe(false);
    expect(isNumbered('bullet')).toBe(false);
    expect(isNumbered(undefined)).toBe(false);
  });

  it('treats the legacy "numbered" value as numbered', () => {
    expect(isNumbered('numbered')).toBe(true);
  });
});
