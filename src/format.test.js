import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderFormatted, splitIntroAndBullets } from './format.jsx';

const html = (node) => renderToStaticMarkup(React.createElement(React.Fragment, null, node));

describe('renderFormatted', () => {
  it('returns plain text untouched', () => {
    expect(html(renderFormatted('plain text'))).toBe('plain text');
  });

  it('renders **bold**', () => {
    expect(html(renderFormatted('a **bold** word'))).toBe('a <strong>bold</strong> word');
  });

  it('renders *italic*', () => {
    expect(html(renderFormatted('a *italic* word'))).toBe('a <em>italic</em> word');
  });

  it('renders _italic_ (underscore variant)', () => {
    expect(html(renderFormatted('a _italic_ word'))).toBe('a <em>italic</em> word');
  });

  it('renders ***bold+italic*** as nested strong>em', () => {
    expect(html(renderFormatted('***both***'))).toBe('<strong><em>both</em></strong>');
  });

  it('does not mistake *** for ** (longest match wins)', () => {
    expect(html(renderFormatted('***x***'))).toBe('<strong><em>x</em></strong>');
  });

  it('leaves an unpaired marker as literal text', () => {
    expect(html(renderFormatted('odd ** marker'))).toBe('odd ** marker');
  });
});

describe('renderFormatted - multiple spans', () => {
  it('handles multiple marked spans on one line', () => {
    expect(html(renderFormatted('**A** and *B* and plain'))).toBe(
      '<strong>A</strong> and <em>B</em> and plain'
    );
  });

  it('returns the input unchanged for empty/falsy text', () => {
    expect(renderFormatted('')).toBe('');
    expect(renderFormatted(undefined)).toBe(undefined);
  });
});

describe('splitIntroAndBullets', () => {
  it('treats every line as the bullet list when there is no blank line', () => {
    const result = splitIntroAndBullets(['one', 'two', 'three']);
    expect(result).toEqual({ intro: '', bulletLines: ['one', 'two', 'three'] });
  });

  it('splits an intro sentence from the list when a blank line is followed by content', () => {
    const result = splitIntroAndBullets(['I lead DevOps', '', 'point1', 'point2']);
    expect(result).toEqual({ intro: 'I lead DevOps', bulletLines: ['point1', 'point2'] });
  });

  it('does NOT split when the blank line is trailing (nothing after it)', () => {
    // This is the documented case: pressing Enter after the last point
    // leaves a trailing blank line, which must not swallow every point
    // into one merged intro with no list.
    const result = splitIntroAndBullets(['point1', 'point2', '']);
    expect(result).toEqual({ intro: '', bulletLines: ['point1', 'point2', ''] });
  });

  it('handles an empty/undefined input', () => {
    expect(splitIntroAndBullets(undefined)).toEqual({ intro: '', bulletLines: [] });
    expect(splitIntroAndBullets([])).toEqual({ intro: '', bulletLines: [] });
  });

  it('joins a multi-line intro with spaces and trims it', () => {
    const result = splitIntroAndBullets(['line one', 'line two', '', 'point1']);
    expect(result).toEqual({ intro: 'line one line two', bulletLines: ['point1'] });
  });
});
