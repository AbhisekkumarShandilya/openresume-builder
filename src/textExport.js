// Plain-text export — the most ATS-safe format. Walks the shared export model
// (exportModel.js) so it stays in step with the DOCX export and the on-screen
// preview. No hard wrapping: paste-into-a-web-form is the target workflow, and
// the portal's textarea handles wrapping.
import { buildExportModel } from './exportModel.js';
import { isNumbered } from './bulletStyles.js';

const SUB_INDENT = '   ';

const runsToText = (runs) => runs.map((r) => r.text).join('');

function listLines(block) {
  const numbered = isNumbered(block.style);
  const bare = block.style === 'none';
  const lines = [];
  let n0 = 0;
  let n1 = 0;
  for (const item of block.items) {
    let marker;
    let indent;
    if (item.level === 0) {
      n0 += 1;
      n1 = 0;
      indent = '';
      marker = numbered ? `${n0}. ` : bare ? '' : '- ';
    } else {
      n1 += 1;
      indent = SUB_INDENT;
      marker = numbered ? `${n1}. ` : bare ? '' : '- ';
    }
    lines.push(`${indent}${marker}${runsToText(item.runs)}`);
  }
  return lines;
}

function blockLines(block) {
  switch (block.kind) {
    case 'entry': {
      const primary = runsToText(block.primary);
      const head = block.right ? `${primary} (${block.right})` : primary;
      const sub = runsToText(block.sub);
      return sub ? [head, sub] : [head];
    }
    case 'paragraph':
      return [runsToText(block.runs)];
    case 'list':
      return listLines(block);
    case 'links':
      // Plain text can't be clickable, so the bare URL must appear (a label
      // alone links nowhere). "Label: url" when a label was given, else the url.
      return block.items.map((l) => (l.text && l.text !== l.url ? `${l.text}: ${l.href}` : l.href));
    default:
      return [];
  }
}

export function serializeText(resume) {
  const model = buildExportModel(resume);
  const parts = [];

  const header = [];
  if (model.name) header.push(model.name);
  if (model.title) header.push(model.title);
  if (model.contacts.length) header.push(model.contacts.join(' | '));
  if (header.length) parts.push(header.join('\n'));

  for (const section of model.sections) {
    const lines = [section.heading.toUpperCase()];
    section.blocks.forEach((block, i) => {
      // A blank line separates consecutive entries; a bullet/intro list stays
      // attached to the entry above it.
      if (block.kind === 'entry' && i > 0) lines.push('');
      lines.push(...blockLines(block));
    });
    parts.push(lines.join('\n'));
  }

  return `${parts.join('\n\n').trimEnd()}\n`;
}
