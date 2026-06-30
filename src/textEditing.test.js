import { describe, it, expect } from 'vitest';
import { detectWrap, applyLineToggle, toggleLinesBullet } from './textEditing.js';

describe('detectWrap', () => {
  it('detects ** markers sitting just outside the selection', () => {
    const value = 'Led **migration** to a modular architecture.';
    // "migration" spans [6, 15)
    const wrap = detectWrap(value, 6, 15);
    expect(wrap).toEqual({ marker: '**', start: 4, end: 17, inner: 'migration' });
  });

  it('detects *** (bold+italic) over ** (longest-marker-first)', () => {
    const value = 'a ***both*** b';
    const wrap = detectWrap(value, 5, 9); // "both"
    expect(wrap.marker).toBe('***');
    expect(wrap.inner).toBe('both');
  });

  it('detects a selection that includes the markers themselves', () => {
    const value = 'plain **bold** plain';
    const wrap = detectWrap(value, 6, 14); // the whole "**bold**"
    expect(wrap).toEqual({ marker: '**', start: 6, end: 14, inner: 'bold' });
  });

  it('returns null when there is no marker and no selection', () => {
    expect(detectWrap('plain text', 5, 5)).toBeNull();
  });

  it('returns null for an unmarked real selection', () => {
    expect(detectWrap('plain text', 0, 5)).toBeNull();
  });

  it('does not false-positive when neighboring chars happen to be spaces, not markers', () => {
    const value = 'Led migration to a modular architecture.';
    expect(detectWrap(value, 4, 13)).toBeNull(); // "migration", no markers anywhere
  });
});

describe('applyLineToggle', () => {
  it('promotes the first line to a new intro block when there is no blank line yet', () => {
    const lines = ['point1', 'point2', 'point3'];
    expect(applyLineToggle(lines, 0, 0)).toEqual(['point1', '', 'point2', 'point3']);
  });

  it('demotes an intro line back into the list', () => {
    const lines = ['intro', '', 'point1', 'point2'];
    expect(applyLineToggle(lines, 0, 0)).toEqual(['intro', 'point1', 'point2']);
  });

  it('promotes a list line into the intro block, keeping existing intro', () => {
    const lines = ['intro', '', 'point1', 'point2'];
    expect(applyLineToggle(lines, 2, 2)).toEqual(['intro', 'point1', '', 'point2']);
  });

  it('promotes a multi-line selection together as one unit', () => {
    const lines = ['point1', 'point2', 'point3'];
    expect(applyLineToggle(lines, 0, 1)).toEqual(['point1', 'point2', '', 'point3']);
  });

  it('returns null when the selection straddles the blank separator itself', () => {
    const lines = ['intro', '', 'point1'];
    expect(applyLineToggle(lines, 0, 2)).toBeNull();
  });

  it('demoting the only intro line removes the separator, keeping it as an ordinary list line', () => {
    const lines = ['intro', '', 'point1'];
    expect(applyLineToggle(lines, 0, 0)).toEqual(['intro', 'point1']);
  });
});

describe('toggleLinesBullet (textarea offset wrapper)', () => {
  it('round-trips: promote then demote returns the original text', () => {
    const original = 'point1\npoint2';
    const promoted = toggleLinesBullet(original, 0, 6); // select "point1"
    expect(promoted).toBe('point1\n\npoint2');
    const demoted = toggleLinesBullet(promoted, 0, 6); // re-select "point1" at its new position
    expect(demoted).toBe('point1\npoint2');
  });

  it('returns the value unchanged when toggling is a no-op (straddles separator)', () => {
    const value = 'intro\n\npoint1';
    // selection spans from inside "intro" to inside "point1", straddling the blank line
    const result = toggleLinesBullet(value, 2, 12);
    expect(result).toBe(value);
  });

  it('defaults to the last line when the selection end is past every line', () => {
    const value = 'a\nb\nc';
    const result = toggleLinesBullet(value, 4, 999);
    // Promoting the last line ("c") makes it the new intro block, ahead of the rest.
    expect(result).toBe('c\n\na\nb');
  });
});
