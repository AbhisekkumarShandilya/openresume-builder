// List-style gallery for description bullets, modeled on Word/LibreOffice's
// bullet & numbering pickers: a handful of bullet glyphs plus the standard
// numbering formats (1., a., A., i., I.). Stored as a plain string on the
// item/section (`bulletStyle`) and rendered via CSS in Preview.jsx.

export const BULLET_STYLE_GROUPS = [
  {
    label: 'Bullets',
    options: [
      { id: 'disc', glyph: '•', name: 'Disc bullets' },
      { id: 'circle', glyph: '○', name: 'Circle bullets' },
      { id: 'square', glyph: '▪', name: 'Square bullets' },
      { id: 'dash', glyph: '–', name: 'Dash bullets' },
      { id: 'none', glyph: '∅', name: 'No bullet (plain lines)' },
    ],
  },
  {
    label: 'Numbering',
    options: [
      { id: 'decimal', glyph: '1.', name: 'Numbered: 1. 2. 3.' },
      { id: 'lower-alpha', glyph: 'a.', name: 'Numbered: a. b. c.' },
      { id: 'upper-alpha', glyph: 'A.', name: 'Numbered: A. B. C.' },
      { id: 'lower-roman', glyph: 'i.', name: 'Numbered: i. ii. iii.' },
      { id: 'upper-roman', glyph: 'I.', name: 'Numbered: I. II. III.' },
    ],
  },
];

const NUMBERED_IDS = new Set(['decimal', 'lower-alpha', 'upper-alpha', 'lower-roman', 'upper-roman']);
const VALID_IDS = new Set(BULLET_STYLE_GROUPS.flatMap((g) => g.options.map((o) => o.id)));

// Pre-v2.1 saves only ever had 'bullet' (or nothing) vs 'numbered'.
export function normalizeBulletStyle(style) {
  if (style === 'numbered') return 'decimal';
  if (VALID_IDS.has(style)) return style;
  return 'disc';
}

export function isNumbered(style) {
  return NUMBERED_IDS.has(normalizeBulletStyle(style));
}
