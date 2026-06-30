import { describe, it, expect } from 'vitest';
import { SECTION_TYPES, createSection, normalizeResume, emptyResume } from './data.js';

describe('createSection', () => {
  it('creates an experience section with one blank item', () => {
    const s = createSection('experience');
    expect(s.type).toBe('experience');
    expect(s.title).toBe('Experience');
    expect(s.items).toHaveLength(1);
    expect(s.items[0]).toMatchObject({ role: '', company: '', bullets: [] });
    expect(s.id).toMatch(/^sec-/);
  });

  it('creates a skills section with zero items (flat-array type)', () => {
    const s = createSection('skills');
    expect(s.items).toEqual([]);
  });

  it('creates a custom section with zero items', () => {
    const s = createSection('custom');
    expect(s.items).toEqual([]);
  });

  it('honors a custom title override', () => {
    const s = createSection('projects', 'Side Projects');
    expect(s.title).toBe('Side Projects');
  });

  it('throws for an unknown section type', () => {
    expect(() => createSection('not-a-real-type')).toThrow();
  });

  it('assigns unique ids across repeated calls', () => {
    const a = createSection('experience');
    const b = createSection('experience');
    expect(a.id).not.toBe(b.id);
    expect(a.items[0].id).not.toBe(b.items[0].id);
  });
});

describe('SECTION_TYPES field configs', () => {
  it('every object-array type (has fields) also has newItem and bullets config', () => {
    for (const type of ['experience', 'education', 'projects']) {
      expect(SECTION_TYPES[type].fields).toBeDefined();
      expect(typeof SECTION_TYPES[type].newItem).toBe('function');
      expect(SECTION_TYPES[type].bullets).toBeDefined();
    }
  });

  it('certifications has fields but no bullets block', () => {
    expect(SECTION_TYPES.certifications.fields).toBeDefined();
    expect(SECTION_TYPES.certifications.bullets).toBeUndefined();
  });

  it('only experience is flagged richText for now', () => {
    expect(SECTION_TYPES.experience.bullets.richText).toBe(true);
    expect(SECTION_TYPES.education.bullets.richText).toBeUndefined();
    expect(SECTION_TYPES.projects.bullets.richText).toBeUndefined();
  });

  it('skills and custom are flat-array types with no fields/newItem', () => {
    expect(SECTION_TYPES.skills.fields).toBeUndefined();
    expect(SECTION_TYPES.skills.newItem).toBeNull();
    expect(SECTION_TYPES.custom.fields).toBeUndefined();
    expect(SECTION_TYPES.custom.newItem).toBeNull();
  });
});

describe('normalizeResume', () => {
  it('passes through data that already has a sections array', () => {
    const data = { personal: { name: 'X' }, sections: [{ id: 'a', type: 'skills', items: [] }] };
    expect(normalizeResume(data)).toBe(data);
  });

  it('returns emptyResume for null/undefined input', () => {
    expect(normalizeResume(null)).toBe(emptyResume);
    expect(normalizeResume(undefined)).toBe(emptyResume);
  });

  it('migrates a pre-v2.0 flat resume (experience/education/skills at top level)', () => {
    const legacy = {
      personal: { name: 'Old User' },
      experience: [{ id: 'e1', role: 'Dev', company: 'Co', bullets: [] }],
      education: [{ id: 'ed1', degree: 'BSc', school: 'Uni', bullets: [] }],
      skills: ['JS', 'React'],
    };
    const result = normalizeResume(legacy);
    expect(result.personal).toBe(legacy.personal);
    expect(result.sections).toHaveLength(3);
    expect(result.sections.map((s) => s.type)).toEqual(['experience', 'education', 'skills']);
    expect(result.sections[2].items).toEqual(['JS', 'React']);
  });

  it('omits sections for legacy fields that are missing', () => {
    const legacy = { personal: { name: 'X' }, skills: ['JS'] };
    const result = normalizeResume(legacy);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].type).toBe('skills');
  });

  it('falls back to emptyResume.personal when legacy data has no personal block', () => {
    const result = normalizeResume({ skills: ['JS'] });
    expect(result.personal).toBe(emptyResume.personal);
  });
});
