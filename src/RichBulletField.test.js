import { describe, it, expect } from 'vitest';
import { buildLineElement, lineElementToMarkerText, getLineElement } from './RichBulletField.jsx';

describe('buildLineElement', () => {
  it('builds a plain text line with no markup', () => {
    const el = buildLineElement('plain text');
    expect(el.className).toBe('rb-line');
    expect(el.textContent).toBe('plain text');
    expect(el.children).toHaveLength(0);
  });

  it('builds a <strong> for **bold**, with no asterisks in the visible text', () => {
    const el = buildLineElement('Led **migration** forward');
    expect(el.textContent).toBe('Led migration forward');
    const strong = el.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong.textContent).toBe('migration');
  });

  it('builds an <em> for *italic*', () => {
    const el = buildLineElement('a *word* here');
    const em = el.querySelector('em');
    expect(em.textContent).toBe('word');
    expect(el.textContent).toBe('a word here');
  });

  it('builds nested <strong><em> for ***both***', () => {
    const el = buildLineElement('***both***');
    const strong = el.querySelector('strong');
    expect(strong).not.toBeNull();
    const em = strong.querySelector('em');
    expect(em).not.toBeNull();
    expect(em.textContent).toBe('both');
    expect(el.textContent).toBe('both');
  });

  it('represents an empty line as a single <br>', () => {
    const el = buildLineElement('');
    expect(el.children).toHaveLength(1);
    expect(el.children[0].tagName).toBe('BR');
    expect(el.textContent).toBe('');
  });

  it('handles multiple marked spans on one line', () => {
    const el = buildLineElement('**A** and *B* and plain');
    expect(el.querySelectorAll('strong')).toHaveLength(1);
    expect(el.querySelectorAll('em')).toHaveLength(1);
    expect(el.textContent).toBe('A and B and plain');
  });
});

describe('lineElementToMarkerText (round-trip with buildLineElement)', () => {
  const roundTrip = (text) => lineElementToMarkerText(buildLineElement(text));

  it('round-trips plain text', () => {
    expect(roundTrip('plain text')).toBe('plain text');
  });

  it('round-trips **bold**', () => {
    expect(roundTrip('Led **migration** forward')).toBe('Led **migration** forward');
  });

  it('round-trips *italic*', () => {
    expect(roundTrip('a *word* here')).toBe('a *word* here');
  });

  it('round-trips ***bold+italic***', () => {
    expect(roundTrip('***both***')).toBe('***both***');
  });

  it('round-trips an empty line back to an empty string', () => {
    expect(roundTrip('')).toBe('');
  });

  it('recognizes execCommand-style <b>/<i> tags, not just <strong>/<em>', () => {
    const line = document.createElement('div');
    line.className = 'rb-line';
    const b = document.createElement('b');
    b.textContent = 'bold';
    line.appendChild(document.createTextNode('plain '));
    line.appendChild(b);
    expect(lineElementToMarkerText(line)).toBe('plain **bold**');
  });

  it('drops an empty inline element left behind by execCommand', () => {
    const line = document.createElement('div');
    line.className = 'rb-line';
    line.appendChild(document.createTextNode('text'));
    line.appendChild(document.createElement('b')); // empty <b></b>
    expect(lineElementToMarkerText(line)).toBe('text');
  });

  it('detects nested bold+italic regardless of which tag is outer', () => {
    const outerB = document.createElement('div');
    outerB.className = 'rb-line';
    const b = document.createElement('b');
    const i = document.createElement('i');
    i.textContent = 'both';
    b.appendChild(i);
    outerB.appendChild(b);
    expect(lineElementToMarkerText(outerB)).toBe('***both***');

    const outerI = document.createElement('div');
    outerI.className = 'rb-line';
    const i2 = document.createElement('i');
    const b2 = document.createElement('b');
    b2.textContent = 'both';
    i2.appendChild(b2);
    outerI.appendChild(i2);
    expect(lineElementToMarkerText(outerI)).toBe('***both***');
  });
});

describe('getLineElement', () => {
  it('walks up from a text node to its .rb-line ancestor', () => {
    const root = document.createElement('div');
    const line = buildLineElement('hello world');
    root.appendChild(line);
    const textNode = line.firstChild;
    expect(getLineElement(textNode, root)).toBe(line);
  });

  it('walks up through an inline <strong> wrapper to the line', () => {
    const root = document.createElement('div');
    const line = buildLineElement('**bold**');
    root.appendChild(line);
    const strongTextNode = line.querySelector('strong').firstChild;
    expect(getLineElement(strongTextNode, root)).toBe(line);
  });

  it('returns null when the node is outside the root', () => {
    const root = document.createElement('div');
    const outside = document.createElement('div');
    expect(getLineElement(outside, root)).toBeNull();
  });
});
