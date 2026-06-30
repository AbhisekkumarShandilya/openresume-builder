// Pure text-editing helpers shared by Editor.jsx's Bold/Italic/¶ toolbar
// logic. Split out from Editor.jsx (a React component) so this logic is
// independently unit-testable without rendering anything.

// Markers, longest first: a selection wrapped in *** must be detected as
// *** (bold+italic), not mistaken for ** (bold) by a shorter prefix check.
export const MARKERS = ['***', '**', '*'];

// Find an existing marker wrapping the selection [s, e) in `value` and
// report its span + unwrapped inner text, so the caller can strip/replace it
// instead of naively wrapping again. Two cases, checked longest-marker-first
// in each:
//   A. markers sit just outside [s, e) — what our own re-selection leaves
//      after applying a mark, e.g. selecting "text" inside "**text**".
//   B. the selection itself includes the markers — e.g. the user drag- or
//      triple-click-selected the whole "**text**". Without this check,
//      re-wrapping added a marker around the markers too, corrupting it
//      to "****text****".
export function detectWrap(value, s, e) {
  for (const m of MARKERS) {
    const start = s - m.length;
    const end = e + m.length;
    if (start < 0 || end > value.length) continue;
    if (value.slice(start, s) === m && value.slice(e, end) === m) {
      return { marker: m, start, end, inner: value.slice(s, e) };
    }
  }
  const selected = value.slice(s, e);
  for (const m of MARKERS) {
    if (selected.length > m.length * 2 && selected.startsWith(m) && selected.endsWith(m)) {
      return { marker: m, start: s, end: e, inner: selected.slice(m.length, -m.length) };
    }
  }
  return null;
}

// Moves line(s) [firstLine, lastLine] across the intro/list boundary that
// splitIntroAndBullets (format.jsx) reads at render time: lines before the
// first blank line are the plain intro, lines after are the bulleted list.
// This is the core of what the toolbar's "¶" button does — pulling a
// highlighted line out of the list (or back into it) without disturbing any
// other line. Returns the new lines array, or null if the selection
// straddles the blank separator itself (no-op). No assumption about how the
// caller located firstLine/lastLine (character offsets for a textarea, DOM
// line index for the rich field).
export function applyLineToggle(lines, firstLine, lastLine) {
  const blankIdx = lines.findIndex((l) => l.trim() === '');
  const picked = lines.slice(firstLine, lastLine + 1);

  if (blankIdx === -1) {
    // No intro yet: the picked line(s) become a brand-new intro block.
    const rest = [...lines.slice(0, firstLine), ...lines.slice(lastLine + 1)];
    return [...picked, '', ...rest];
  }

  if (lastLine < blankIdx) {
    // Picked line(s) are already intro — demote back into the list.
    const introRest = [...lines.slice(0, firstLine), ...lines.slice(lastLine + 1, blankIdx)];
    const listRest = lines.slice(blankIdx + 1);
    return introRest.length === 0
      ? [...picked, ...listRest]
      : [...introRest, '', ...picked, ...listRest];
  }

  if (firstLine > blankIdx) {
    // Picked line(s) are in the list — promote into the intro block.
    const intro = lines.slice(0, blankIdx);
    const listRest = [...lines.slice(blankIdx + 1, firstLine), ...lines.slice(lastLine + 1)];
    return [...intro, ...picked, '', ...listRest];
  }

  return null; // selection straddles the blank separator itself — no-op
}

// selStart/selEnd-based wrapper for textarea bullet fields.
export function toggleLinesBullet(value, selStart, selEnd) {
  const lines = value.split('\n');

  let firstLine = null;
  let lastLine = null;
  let pos = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineEndPos = pos + lines[i].length;
    if (firstLine === null && selStart <= lineEndPos) firstLine = i;
    if (selEnd <= lineEndPos) {
      lastLine = i;
      break;
    }
    pos = lineEndPos + 1; // +1 for the '\n'
  }
  if (firstLine === null) firstLine = lines.length - 1;
  if (lastLine === null) lastLine = lines.length - 1;

  const result = applyLineToggle(lines, firstLine, lastLine);
  return result === null ? value : result.join('\n');
}
