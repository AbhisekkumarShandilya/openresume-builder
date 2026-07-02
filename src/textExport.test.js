import { describe, it, expect } from 'vitest';
import { serializeText } from './textExport.js';
import { exportFilename } from './exportModel.js';

const base = {
  personal: {
    name: 'Jane Doe',
    title: 'Software Engineer',
    email: 'jane@example.com',
    phone: '+1 555 0100',
    location: 'Melbourne, AU',
    website: 'github.com/janedoe',
    summary: 'Engineer with **five** years shipping apps.',
  },
  sections: [],
};

describe('serializeText', () => {
  it('renders the header block with name, title, and pipe-joined contacts', () => {
    const out = serializeText(base);
    const lines = out.split('\n');
    expect(lines[0]).toBe('Jane Doe');
    expect(lines[1]).toBe('Software Engineer');
    expect(lines[2]).toBe('jane@example.com | +1 555 0100 | Melbourne, AU | github.com/janedoe');
  });

  it('uppercases section headings and strips markup from the summary', () => {
    const out = serializeText(base);
    expect(out).toContain('SUMMARY');
    expect(out).toContain('Engineer with five years shipping apps.');
    expect(out).not.toContain('**');
  });

  it('formats an experience entry with dates and org sub-line', () => {
    const resume = {
      personal: { name: 'A' },
      sections: [{
        id: 's1', type: 'experience', title: 'Experience',
        items: [{
          id: 'e1', role: 'Senior Developer', company: 'Acme Corp', location: 'Melbourne, AU',
          start: '2022', end: 'Present',
          bullets: ['Led **migration** to modules.', 'Mentored 4 engineers.'],
        }],
      }],
    };
    const out = serializeText(resume);
    expect(out).toContain('Senior Developer (2022 – Present)');
    expect(out).toContain('Acme Corp — Melbourne, AU');
    expect(out).toContain('- Led migration to modules.');
    expect(out).toContain('- Mentored 4 engineers.');
  });

  it('numbers items for a numbered bullet style and indents sub-items', () => {
    const resume = {
      personal: { name: 'A' },
      sections: [{
        id: 's1', type: 'custom', title: 'Notes', bulletStyle: 'decimal',
        items: ['first', 'second', ' sub of second', 'third'],
      }],
    };
    const out = serializeText(resume);
    expect(out).toContain('1. first');
    expect(out).toContain('2. second');
    expect(out).toContain('   1. sub of second');
    expect(out).toContain('3. third');
  });

  it('renders a lone bullet as plain text (no marker) and an intro before a list', () => {
    const resume = {
      personal: { name: 'A' },
      sections: [{
        id: 's1', type: 'experience', title: 'Experience',
        items: [{
          id: 'e1', role: 'Dev', company: 'Co', location: '', start: '', end: '',
          bullets: ['I lead the team', '', 'shipped x', 'shipped y'],
        }, {
          id: 'e2', role: 'Intern', company: 'Co2', location: '', start: '', end: '',
          bullets: ['just one point'],
        }],
      }],
    };
    const out = serializeText(resume);
    expect(out).toContain('I lead the team');
    expect(out).toContain('- shipped x');
    expect(out).toContain('just one point');
    expect(out).not.toContain('- just one point');
  });

  it('renders languages as one inline line under the heading', () => {
    const resume = {
      personal: { name: 'A' },
      sections: [{
        id: 's1', type: 'languages', title: 'Languages',
        items: [
          { id: 'l1', language: 'English', proficiency: 'Native' },
          { id: 'l2', language: 'German', proficiency: 'B2' },
        ],
      }],
    };
    const out = serializeText(resume);
    expect(out).toContain('LANGUAGES');
    expect(out).toContain('English (Native) · German (B2)');
  });

  it('prints links as "Label: url" (bare url when no label)', () => {
    const resume = {
      personal: { name: 'A' },
      sections: [{
        id: 's1', type: 'links', title: 'Links',
        items: [
          { id: 'k1', label: 'GitHub', url: 'github.com/you' },
          { id: 'k2', label: '', url: 'https://portfolio.dev' },
        ],
      }],
    };
    const out = serializeText(resume);
    expect(out).toContain('GitHub: https://github.com/you');
    expect(out).toContain('https://portfolio.dev');
  });

  it('drops sections with no renderable content', () => {
    const resume = {
      personal: { name: 'A' },
      sections: [{ id: 's1', type: 'skills', title: 'Skills', items: ['', '  '] }],
    };
    const out = serializeText(resume);
    expect(out).not.toContain('SKILLS');
  });

  it('ends with exactly one trailing newline', () => {
    expect(serializeText(base).endsWith('\n')).toBe(true);
    expect(serializeText(base).endsWith('\n\n')).toBe(false);
  });
});

describe('exportFilename', () => {
  it('uses the person name with an em-dash', () => {
    expect(exportFilename(base, 'docx')).toBe('Jane Doe — Resume.docx');
  });

  it('falls back to Resume when the name is blank', () => {
    expect(exportFilename({ personal: { name: '' } }, 'txt')).toBe('Resume.txt');
    expect(exportFilename({}, 'pdf')).toBe('Resume.pdf');
  });

  it('strips characters illegal in filenames', () => {
    expect(exportFilename({ personal: { name: 'A/B:C*?' } }, 'txt')).toBe('ABC — Resume.txt');
  });
});
