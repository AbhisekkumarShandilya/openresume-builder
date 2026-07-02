import { describe, it, expect } from 'vitest';
import {
  normalizeUrl, isLikelyValidUrl, languageLabel, visibleLanguages,
  languagesInline, visibleLinks,
} from './contactFields.js';

describe('normalizeUrl', () => {
  it('prepends https:// when a scheme is missing', () => {
    expect(normalizeUrl('github.com/you')).toBe('https://github.com/you');
    expect(normalizeUrl('www.example.com')).toBe('https://www.example.com');
  });

  it('leaves an existing scheme untouched', () => {
    expect(normalizeUrl('http://x.com')).toBe('http://x.com');
    expect(normalizeUrl('https://x.com')).toBe('https://x.com');
    expect(normalizeUrl('mailto:me@x.com')).toBe('mailto:me@x.com');
  });

  it('trims and treats blank as empty', () => {
    expect(normalizeUrl('  x.com ')).toBe('https://x.com');
    expect(normalizeUrl('   ')).toBe('');
    expect(normalizeUrl(undefined)).toBe('');
  });
});

describe('isLikelyValidUrl', () => {
  it('accepts bare hosts and full URLs', () => {
    expect(isLikelyValidUrl('github.com/you')).toBe(true);
    expect(isLikelyValidUrl('https://linkedin.com/in/me')).toBe(true);
    expect(isLikelyValidUrl('mailto:me@x.com')).toBe(true);
  });

  it('treats empty as valid (nothing to warn about)', () => {
    expect(isLikelyValidUrl('')).toBe(true);
    expect(isLikelyValidUrl('   ')).toBe(true);
  });

  it('flags obviously malformed input without being overzealous', () => {
    expect(isLikelyValidUrl('not a url')).toBe(false); // space
    expect(isLikelyValidUrl('localhost')).toBe(false); // no dot in host
    expect(isLikelyValidUrl('mailto:nope')).toBe(false);
  });
});

describe('languageLabel', () => {
  it('formats language with proficiency in parens', () => {
    expect(languageLabel({ language: 'English', proficiency: 'Native' })).toBe('English (Native)');
  });
  it('omits parens when proficiency is blank', () => {
    expect(languageLabel({ language: 'German', proficiency: '' })).toBe('German');
  });
  it('returns empty when there is no language', () => {
    expect(languageLabel({ language: '', proficiency: 'Fluent' })).toBe('');
  });
});

describe('visibleLanguages / languagesInline', () => {
  const items = [
    { language: 'English', proficiency: 'Native' },
    { language: '', proficiency: 'Fluent' },
    { language: 'German', proficiency: 'B2' },
  ];
  it('drops entries with no language', () => {
    expect(visibleLanguages(items)).toHaveLength(2);
  });
  it('joins with a middot separator', () => {
    expect(languagesInline(items)).toBe('English (Native) · German (B2)');
  });
  it('returns empty string for no visible languages', () => {
    expect(languagesInline([{ language: '' }])).toBe('');
    expect(languagesInline(undefined)).toBe('');
  });
});

describe('visibleLinks', () => {
  it('requires a url, normalizes href, falls back to url for missing label', () => {
    const links = visibleLinks([
      { label: 'GitHub', url: 'github.com/you' },
      { label: '', url: 'https://x.com' },
      { label: 'No URL', url: '' },
    ]);
    expect(links).toEqual([
      { text: 'GitHub', href: 'https://github.com/you', url: 'github.com/you' },
      { text: 'https://x.com', href: 'https://x.com', url: 'https://x.com' },
    ]);
  });
});
