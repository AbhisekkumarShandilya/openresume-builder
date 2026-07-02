import { describe, it, expect } from 'vitest';
import { buildResumeDoc, docxBase64 } from './docxExport.js';
import { emptyResume } from './data.js';

const rich = {
  personal: { name: 'Jane Doe', title: 'Engineer', email: 'j@x.com', summary: 'Ships ***great*** work.' },
  sections: [
    {
      id: 's1', type: 'experience', title: 'Experience',
      items: [{
        id: 'e1', role: 'Dev', company: 'Acme', location: 'AU', start: '2022', end: 'Present',
        bulletStyle: 'decimal',
        bullets: ['Did **a**', ' sub point', 'Did b', 'Did c'],
      }],
    },
    {
      id: 's2', type: 'custom', title: 'Notes', bulletStyle: 'disc',
      items: ['one', 'two', 'three'],
    },
    {
      id: 's3', type: 'languages', title: 'Languages',
      items: [{ id: 'l1', language: 'English', proficiency: 'Native' }],
    },
    {
      id: 's4', type: 'links', title: 'Links',
      items: [{ id: 'k1', label: 'GitHub', url: 'github.com/you' }],
    },
  ],
};

describe('buildResumeDoc', () => {
  it('builds a Document without throwing for the sample resume', () => {
    expect(() => buildResumeDoc(emptyResume)).not.toThrow();
  });

  it('builds a Document with combined markup and numbered/nested lists', () => {
    expect(() => buildResumeDoc(rich)).not.toThrow();
  });
});

describe('docxBase64', () => {
  it('packs to a valid .docx (zip) — base64 decodes to bytes starting with "PK"', async () => {
    const b64 = await docxBase64(rich);
    expect(typeof b64).toBe('string');
    expect(b64.length).toBeGreaterThan(100);
    const bytes = Buffer.from(b64, 'base64');
    // Every .docx is a ZIP archive, whose local file header magic is "PK\x03\x04".
    expect(bytes[0]).toBe(0x50); // P
    expect(bytes[1]).toBe(0x4b); // K
  });
});
