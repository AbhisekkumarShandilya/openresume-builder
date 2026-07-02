import { describe, it, expect } from 'vitest';
import { parseRuns, stripMarkup, splitIntroAndBullets } from './richText.js';

describe('parseRuns', () => {
  it('returns an empty array for falsy input', () => {
    expect(parseRuns('')).toEqual([]);
    expect(parseRuns(undefined)).toEqual([]);
  });

  it('returns one unstyled run for plain text', () => {
    expect(parseRuns('plain text')).toEqual([{ text: 'plain text', bold: false, italic: false }]);
  });

  it('parses **bold**', () => {
    expect(parseRuns('a **b** c')).toEqual([
      { text: 'a ', bold: false, italic: false },
      { text: 'b', bold: true, italic: false },
      { text: ' c', bold: false, italic: false },
    ]);
  });

  it('parses *italic* and _italic_', () => {
    expect(parseRuns('*x*')).toEqual([{ text: 'x', bold: false, italic: true }]);
    expect(parseRuns('_y_')).toEqual([{ text: 'y', bold: false, italic: true }]);
  });

  it('parses ***bold+italic*** as both, longest match first', () => {
    expect(parseRuns('***both***')).toEqual([{ text: 'both', bold: true, italic: true }]);
  });

  it('leaves an unpaired marker as literal text', () => {
    expect(parseRuns('odd ** marker')).toEqual([{ text: 'odd ** marker', bold: false, italic: false }]);
  });
});

describe('stripMarkup', () => {
  it('removes markup but keeps text', () => {
    expect(stripMarkup('a **b** and *c* and ***d***')).toBe('a b and c and d');
  });

  it('handles empty input', () => {
    expect(stripMarkup('')).toBe('');
  });
});

describe('splitIntroAndBullets', () => {
  it('treats every line as a bullet when there is no blank line', () => {
    expect(splitIntroAndBullets(['one', 'two'])).toEqual({ intro: '', bulletLines: ['one', 'two'] });
  });

  it('splits an intro from the list on a blank line followed by content', () => {
    expect(splitIntroAndBullets(['lead', '', 'p1', 'p2'])).toEqual({ intro: 'lead', bulletLines: ['p1', 'p2'] });
  });

  it('does not split on a trailing blank line', () => {
    expect(splitIntroAndBullets(['p1', 'p2', ''])).toEqual({ intro: '', bulletLines: ['p1', 'p2', ''] });
  });
});
