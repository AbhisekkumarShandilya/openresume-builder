// Minimal formatting syntax supported in Summary/bullet text: **bold**,
// *italic* (or _italic_), and ***bold+italic*** (applying both from the
// toolbar combines rather than corrupting the markup — see applyMark in
// Editor.jsx). Kept intentionally small — this is plain-text storage with
// light markup, not a rich-text editor. Triple-star must be checked before
// double-star, since "***x***" also satisfies a naive "starts/ends with **" test.
const TOKEN = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g;

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

export function renderFormatted(text) {
  if (!text) return text;
  return text.split(TOKEN).map((part, i) => {
    if (part.startsWith('***') && part.endsWith('***')) {
      return <strong key={i}><em>{part.slice(3, -3)}</em></strong>;
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}
