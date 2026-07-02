// DOCX export via the `docx` package. Runs entirely in the renderer: it builds
// a Document and packs it to a base64 string, which the main process writes to
// disk. Deliberately one clean "DOCX layout" (real heading styles so Word's
// navigation pane works, Calibri, sane margins) rather than trying to mirror
// each PDF template pixel-for-pixel — Word layout is not CSS layout. The bullet
// & numbering picker maps to real Word numbering definitions, not literal "•"
// characters, so lists behave and ATS parsers read them correctly.
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, TabStopType, TabStopPosition, LevelFormat, ExternalHyperlink,
} from 'docx';
import { INLINE_SEP } from './contactFields.js';
import { buildExportModel } from './exportModel.js';
import { isNumbered } from './bulletStyles.js';

const BULLET_GLYPH = { disc: '•', circle: '○', square: '▪', dash: '–' };
const NUM_FORMAT = {
  decimal: LevelFormat.DECIMAL,
  'lower-alpha': LevelFormat.LOWER_LETTER,
  'upper-alpha': LevelFormat.UPPER_LETTER,
  'lower-roman': LevelFormat.LOWER_ROMAN,
  'upper-roman': LevelFormat.UPPER_ROMAN,
};

// Every style id used by the picker gets one abstract numbering definition with
// two levels (top + sub). Numbered lists reference these with a fresh instance
// per list so each list restarts at 1 rather than continuing the previous one.
function numberingConfig() {
  const levelProps = (level) => ({
    alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 360 + level * 360, hanging: 260 } } },
  });
  const config = [];

  for (const [id, glyph] of Object.entries(BULLET_GLYPH)) {
    config.push({
      reference: `list-${id}`,
      levels: [
        { level: 0, format: LevelFormat.BULLET, text: glyph, ...levelProps(0) },
        { level: 1, format: LevelFormat.BULLET, text: '○', ...levelProps(1) },
      ],
    });
  }
  for (const [id, format] of Object.entries(NUM_FORMAT)) {
    config.push({
      reference: `list-${id}`,
      levels: [
        { level: 0, format, text: '%1.', ...levelProps(0) },
        { level: 1, format: LevelFormat.LOWER_LETTER, text: '%2.', ...levelProps(1) },
      ],
    });
  }
  return { config };
}

const runsToTextRuns = (runs, extra = {}) =>
  runs.map((r) => new TextRun({ text: r.text, bold: r.bold || extra.bold, italics: r.italic || extra.italics }));

function entryParagraph(block) {
  const children = runsToTextRuns(block.primary, { bold: true });
  if (block.right) children.push(new TextRun({ text: `\t${block.right}`, bold: false }));
  return new Paragraph({
    children,
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing: { before: 160, after: 0 },
  });
}

// A links block becomes one paragraph of real ExternalHyperlinks (blue,
// underlined via docx's built-in "Hyperlink" style) separated by " · ".
function linksParagraph(block) {
  const children = [];
  block.items.forEach((link, i) => {
    if (i > 0) children.push(new TextRun({ text: INLINE_SEP }));
    children.push(new ExternalHyperlink({
      link: link.href,
      children: [new TextRun({ text: link.text, style: 'Hyperlink' })],
    }));
  });
  return new Paragraph({ children, spacing: { after: 40 } });
}

// A list block becomes one Paragraph per item. `none` has no marker, so it
// renders as plain indented paragraphs rather than a numbering definition.
function listParagraphs(block, instance) {
  if (block.style === 'none') {
    return block.items.map((item) => new Paragraph({
      children: runsToTextRuns(item.runs),
      indent: { left: 360 + item.level * 360 },
      spacing: { after: 20 },
    }));
  }
  return block.items.map((item) => new Paragraph({
    children: runsToTextRuns(item.runs),
    numbering: { reference: `list-${block.style}`, level: item.level, instance },
    spacing: { after: 20 },
  }));
}

export function buildResumeDoc(resume) {
  const model = buildExportModel(resume);
  const children = [];

  if (model.name) {
    children.push(new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: model.name, bold: true })],
    }));
  }
  if (model.title) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: model.title, italics: true })],
    }));
  }
  if (model.contacts.length) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: model.contacts.join('  •  ') })],
    }));
  }

  let listInstance = 0;
  for (const section of model.sections) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 60 },
      children: [new TextRun({ text: section.heading })],
    }));
    for (const block of section.blocks) {
      if (block.kind === 'entry') {
        children.push(entryParagraph(block));
      } else if (block.kind === 'paragraph') {
        children.push(new Paragraph({ children: runsToTextRuns(block.runs), spacing: { after: 40 } }));
      } else if (block.kind === 'list') {
        children.push(...listParagraphs(block, isNumbered(block.style) ? ++listInstance : 0));
      } else if (block.kind === 'links') {
        children.push(linksParagraph(block));
      }
    }
  }

  return new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    numbering: numberingConfig(),
    sections: [{
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      children,
    }],
  });
}

// Base64 works in both the renderer (Chromium) and Node (tests) without
// needing Blob or Buffer at the call site; main decodes it to bytes on write.
export function docxBase64(resume) {
  return Packer.toBase64String(buildResumeDoc(resume));
}
