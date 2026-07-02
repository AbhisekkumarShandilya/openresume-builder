// The one place the light markup syntax is parsed: **bold**, *italic* (or
// _italic_), and ***bold+italic***. Both the on-screen renderer (format.jsx)
// and the DOCX/TXT exporters consume `parseRuns`, so all three agree on what
// the markup means. Triple-star must be tested before double-star, since
// "***x***" also satisfies a naive "starts/ends with **" check.
const TOKEN = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g;

// Break a string into styled runs: [{ text, bold, italic }, ...]. Plain text
// yields a single unstyled run; empty/falsy input yields an empty array.
export function parseRuns(text) {
  if (!text) return [];
  return text
    .split(TOKEN)
    .filter((part) => part !== '')
    .map((part) => {
      if (part.startsWith('***') && part.endsWith('***')) {
        return { text: part.slice(3, -3), bold: true, italic: true };
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return { text: part.slice(2, -2), bold: true, italic: false };
      }
      if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
        return { text: part.slice(1, -1), bold: false, italic: true };
      }
      return { text: part, bold: false, italic: false };
    });
}

// Markup removed, text kept — for plain-text export and anywhere the styling
// can't be represented.
export function stripMarkup(text) {
  return parseRuns(text).map((r) => r.text).join('');
}

// Lets a bullet field hold an intro sentence before the list — e.g.
//   I am head of DevOps engineering
//   <blank line>
//   point1
//   point2
// Everything before the first blank line becomes a plain paragraph; the
// rest is the bulleted/numbered list as usual. No blank line (the common
// case, and every pre-existing resume) means no intro — fully backward
// compatible, since it falls back to treating every line as a list item.
//
// Only splits if there's real list content after the blank line. Without
// that check, simply pressing Enter after your last point (totally normal —
// it's how you continue the list) leaves a trailing blank line that would
// otherwise swallow every point into one merged "intro" sentence with no
// list at all.
export function splitIntroAndBullets(lines) {
  const all = lines || [];
  const blankIndex = all.findIndex((l) => l.trim() === '');
  if (blankIndex === -1) return { intro: '', bulletLines: all };
  const after = all.slice(blankIndex + 1);
  if (!after.some((l) => l.trim() !== '')) return { intro: '', bulletLines: all };
  return { intro: all.slice(0, blankIndex).join(' ').trim(), bulletLines: after };
}
