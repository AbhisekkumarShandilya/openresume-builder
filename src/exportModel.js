// Format-agnostic intermediate the DOCX and TXT exporters both consume, so a
// single place decides *what* goes into an export and in what order. The
// per-format modules only decide *how* to render each block. The mapping
// mirrors Preview.jsx (which fields are primary/sub, the intro-sentence and
// single-point rules, list styles) so exports match what the user sees.
import { normalizeResume, SECTION_TYPES } from './data.js';
import { normalizeBulletStyle } from './bulletStyles.js';
import { parseRuns, splitIntroAndBullets } from './richText.js';
import { languagesInline, visibleLinks } from './contactFields.js';

// Block shapes produced below:
//   { kind: 'entry', primary: Run[], right: string, sub: Run[] }
//   { kind: 'paragraph', runs: Run[] }
//   { kind: 'list', style: string, items: [{ level: 0|1, runs: Run[] }] }
//   { kind: 'links', items: [{ text, href, url }] }
// where Run = { text, bold, italic }.

const joinDash = (parts) => parts.filter(Boolean).join(' — ');

function dateRange(start, end) {
  const a = (start || '').trim();
  const b = (end || '').trim();
  if (a && b) return `${a} – ${b}`;
  return a || b || '';
}

// Turn a bullet field (array of lines) into blocks, matching Preview's rules:
// an optional intro paragraph, a lone point rendered as plain text (no
// marker), otherwise a list. Leading whitespace on a line marks a sub-item.
function bulletBlocks(bullets, style) {
  const { intro, bulletLines } = splitIntroAndBullets(bullets || []);
  const visible = bulletLines.filter((b) => b.trim());
  const blocks = [];
  if (intro) blocks.push({ kind: 'paragraph', runs: parseRuns(intro) });
  if (visible.length === 1) {
    blocks.push({ kind: 'paragraph', runs: parseRuns(visible[0].trim()) });
  } else if (visible.length > 1) {
    blocks.push({
      kind: 'list',
      style: normalizeBulletStyle(style),
      items: visible.map((b) => ({ level: /^\s/.test(b) ? 1 : 0, runs: parseRuns(b.trim()) })),
    });
  }
  return blocks;
}

function sectionModel(section) {
  const heading = section.title || SECTION_TYPES[section.type]?.label || '';
  const blocks = [];
  const items = section.items || [];

  switch (section.type) {
    case 'experience':
      for (const x of items) {
        blocks.push({ kind: 'entry', primary: parseRuns(x.role), right: dateRange(x.start, x.end), sub: parseRuns(joinDash([x.company, x.location])) });
        blocks.push(...bulletBlocks(x.bullets, x.bulletStyle));
      }
      break;
    case 'education':
      for (const x of items) {
        blocks.push({ kind: 'entry', primary: parseRuns(x.degree), right: dateRange(x.start, x.end), sub: parseRuns(joinDash([x.school, x.location])) });
        blocks.push(...bulletBlocks(x.bullets, x.bulletStyle));
      }
      break;
    case 'projects':
      for (const x of items) {
        blocks.push({ kind: 'entry', primary: parseRuns(x.name), right: dateRange(x.start, x.end), sub: parseRuns(joinDash([x.role, x.link])) });
        blocks.push(...bulletBlocks(x.bullets, x.bulletStyle));
      }
      break;
    case 'certifications':
      for (const x of items) {
        blocks.push({ kind: 'entry', primary: parseRuns(x.name), right: (x.date || '').trim(), sub: parseRuns(x.issuer || '') });
      }
      break;
    case 'languages': {
      const inline = languagesInline(items);
      if (inline) blocks.push({ kind: 'paragraph', runs: parseRuns(inline) });
      break;
    }
    case 'links': {
      const links = visibleLinks(items);
      if (links.length) blocks.push({ kind: 'links', items: links });
      break;
    }
    case 'skills':
      for (const s of items) if (s.trim()) blocks.push({ kind: 'paragraph', runs: parseRuns(s.trim()) });
      break;
    case 'custom':
      blocks.push(...bulletBlocks(items, section.bulletStyle));
      break;
    default:
      break;
  }

  return { heading, blocks };
}

// Full export model: header + ordered sections. Empty sections (no renderable
// blocks) are dropped so exports don't carry bare headings.
export function buildExportModel(resume) {
  const r = normalizeResume(resume);
  const p = r.personal || {};
  const sections = [];

  if (p.summary && p.summary.trim()) {
    sections.push({ heading: 'Summary', blocks: [{ kind: 'paragraph', runs: parseRuns(p.summary.trim()) }] });
  }
  for (const s of r.sections || []) {
    const m = sectionModel(s);
    if (m.blocks.length) sections.push(m);
  }

  return {
    name: (p.name || '').trim(),
    title: (p.title || '').trim(),
    contacts: [p.email, p.phone, p.location, p.website].map((c) => (c || '').trim()).filter(Boolean),
    sections,
  };
}

// "Jane Doe — Resume.docx". Falls back to "Resume" when the name is blank, and
// strips characters that are illegal in filenames on Windows/macOS/Linux.
export function exportFilename(resume, ext) {
  const name = (resume?.personal?.name || '').trim();
  const base = name ? `${name} — Resume` : 'Resume';
  const safe = base.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
  return `${safe}.${ext}`;
}
