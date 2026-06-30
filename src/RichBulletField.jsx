import { useEffect, useRef } from 'react';

// A contenteditable bullet editor that LOOKS like real bold/italic (no
// visible ** / * markers) while still reading/writing the same marker-string
// format (`**bold**`, `*italic*`, `***both***`) the rest of the app uses for
// storage — Preview.jsx and format.jsx need zero changes. Each line is its
// own <div class="rb-line"> so multi-bullet fields keep working the same way
// a textarea's '\n'-joined lines did.
//
// Bold/Italic toggling is delegated to document.execCommand, which handles
// wrap/unwrap/merge against a real DOM Selection — far more robust than
// reimplementing that against Range math. Sub-bullet indent (Ctrl+]/Ctrl+[)
// and Enter/Backspace list-continuation are reimplemented here against the
// DOM since they have no native contenteditable equivalent that matches the
// textarea version's behavior.
//
// The ¶ (move line into/out of list) toolbar button and the bullet/numbering
// style picker are wired up from Editor.jsx, which detects a contenteditable
// field via el.isContentEditable and operates on its DOM Selection directly
// rather than the string-offset logic those buttons use for textareas.
//
// Pass singleLine for a one-line field (e.g. a Skill) — Enter and Ctrl+]/[
// become no-ops instead of splitting/indenting, since there's no second line
// to create.

const TOKEN = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g;

export function buildLineElement(lineText) {
  const div = document.createElement('div');
  div.className = 'rb-line';
  if (lineText === '') {
    div.appendChild(document.createElement('br'));
    return div;
  }
  const parts = lineText.split(TOKEN).filter((p) => p !== '');
  for (const part of parts) {
    if (part.startsWith('***') && part.endsWith('***')) {
      const strong = document.createElement('strong');
      const em = document.createElement('em');
      em.textContent = part.slice(3, -3);
      strong.appendChild(em);
      div.appendChild(strong);
    } else if (part.startsWith('**') && part.endsWith('**')) {
      const strong = document.createElement('strong');
      strong.textContent = part.slice(2, -2);
      div.appendChild(strong);
    } else if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      const em = document.createElement('em');
      em.textContent = part.slice(1, -1);
      div.appendChild(em);
    } else {
      div.appendChild(document.createTextNode(part));
    }
  }
  return div;
}

// Inverse of buildLineElement — walks one line's top-level children back
// into marker-string form. Tolerates both <strong>/<em> (what we create) and
// <b>/<i> (what execCommand actually inserts in Chromium).
export function lineElementToMarkerText(lineEl) {
  let out = '';
  for (const node of lineEl.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent;
      continue;
    }
    if (node.nodeName === 'BR') continue;
    const text = node.textContent;
    if (!text) continue; // drop empty inline elements (e.g. an empty <b></b> execCommand can leave behind)
    const name = node.nodeName;
    if (name === 'STRONG' || name === 'B') {
      const hasItalic = node.querySelector && node.querySelector('em, i');
      out += hasItalic ? `***${text}***` : `**${text}**`;
    } else if (name === 'EM' || name === 'I') {
      const hasBold = node.querySelector && node.querySelector('strong, b');
      out += hasBold ? `***${text}***` : `*${text}*`;
    } else {
      out += text;
    }
  }
  return out;
}

function serialize(rootEl) {
  const lines = Array.from(rootEl.children).filter((c) => c.classList.contains('rb-line'));
  return lines.map(lineElementToMarkerText).join('\n');
}

export function getLineElement(node, root) {
  let n = node;
  while (n && n !== root) {
    if (n.nodeType === Node.ELEMENT_NODE && n.classList && n.classList.contains('rb-line')) return n;
    n = n.parentNode;
  }
  return null;
}

function getCaretOffsetInLine(lineEl, node, offset) {
  const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT);
  let total = 0;
  let n;
  while ((n = walker.nextNode())) {
    if (n === node) return total + offset;
    total += n.textContent.length;
  }
  return total;
}

function setCaretAtLineOffset(lineEl, targetOffset) {
  const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT);
  let total = 0;
  let n;
  let chosenNode = null;
  let chosenOffset = 0;
  while ((n = walker.nextNode())) {
    const len = n.textContent.length;
    if (total + len >= targetOffset) {
      chosenNode = n;
      chosenOffset = targetOffset - total;
      break;
    }
    total += len;
    chosenNode = n;
    chosenOffset = len;
  }
  const sel = window.getSelection();
  const range = document.createRange();
  if (chosenNode) {
    range.setStart(chosenNode, chosenOffset);
  } else {
    range.selectNodeContents(lineEl);
  }
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

const indentOf = (text) => (text.match(/^ */) || [''])[0];

function getLineIndent(lineEl) {
  const first = lineEl.firstChild;
  return first && first.nodeType === Node.TEXT_NODE ? indentOf(first.textContent) : '';
}

function addIndent(lineEl) {
  const first = lineEl.firstChild;
  if (first && first.nodeType === Node.TEXT_NODE) {
    first.textContent = '  ' + first.textContent;
  } else {
    lineEl.insertBefore(document.createTextNode('  '), lineEl.firstChild);
  }
}

function removeIndent(lineEl, count) {
  const first = lineEl.firstChild;
  if (first && first.nodeType === Node.TEXT_NODE) first.textContent = first.textContent.slice(count);
}

// Splits lineEl at the given collapsed range into a new line directly
// after it, moving everything from the caret to the end of the line —
// using Range.extractContents so bold/italic spans split correctly without
// needing to round-trip through marker-string offsets.
function splitLine(lineEl, range) {
  const newLine = document.createElement('div');
  newLine.className = 'rb-line';
  const moveRange = document.createRange();
  moveRange.setStart(range.startContainer, range.startOffset);
  if (lineEl.lastChild) moveRange.setEndAfter(lineEl.lastChild);
  else moveRange.setEnd(lineEl, 0);
  newLine.appendChild(moveRange.extractContents());
  if (!newLine.hasChildNodes()) newLine.appendChild(document.createElement('br'));
  if (!lineEl.hasChildNodes()) lineEl.appendChild(document.createElement('br'));
  lineEl.parentNode.insertBefore(newLine, lineEl.nextSibling);
  setCaretAtLineOffset(newLine, 0);
  return newLine;
}

export default function RichBulletField({ value, onChange, onFocusField, placeholder, className, singleLine }) {
  const ref = useRef(null);

  // DOM is the live source of truth while focused (so typing never gets
  // clobbered mid-edit); only resync from the value prop when this field
  // isn't the one being edited (entry switch, snapshot restore, etc).
  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    el.innerHTML = '';
    (value || '').split('\n').forEach((line) => el.appendChild(buildLineElement(line)));
  }, [value]);

  const emit = () => {
    const el = ref.current;
    if (el) onChange(serialize(el));
  };

  const handleKeyDown = (e) => {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const lineEl = getLineElement(range.startContainer, el);
    if (!lineEl) return;

    if (e.ctrlKey && (e.key === ']' || e.key === '[')) {
      if (singleLine) {
        e.preventDefault(); // no sub-bullet indent concept for a one-line field
        return;
      }
      e.preventDefault();
      const caret = getCaretOffsetInLine(lineEl, range.startContainer, range.startOffset);
      if (e.key === '[') {
        const indent = getLineIndent(lineEl);
        const remove = Math.min(2, indent.length);
        if (remove === 0) return;
        removeIndent(lineEl, remove);
        setCaretAtLineOffset(lineEl, Math.max(0, caret - remove));
      } else {
        addIndent(lineEl);
        setCaretAtLineOffset(lineEl, caret + 2);
      }
      emit();
      return;
    }

    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      return;
    }

    if (e.key === 'Enter' && singleLine) {
      e.preventDefault(); // a single-line field (e.g. one Skill) never splits into a new line
      return;
    }

    if (e.key === 'Enter' && sel.isCollapsed) {
      const indent = getLineIndent(lineEl);
      if (!indent) {
        e.preventDefault();
        splitLine(lineEl, range);
        emit();
        return;
      }
      e.preventDefault();
      if (lineEl.textContent.trim() === '') {
        const newIndent = indent.slice(0, Math.max(0, indent.length - 2));
        lineEl.innerHTML = '';
        if (newIndent) lineEl.appendChild(document.createTextNode(newIndent));
        else lineEl.appendChild(document.createElement('br'));
        setCaretAtLineOffset(lineEl, newIndent.length);
      } else {
        const newLine = splitLine(lineEl, range);
        const first = newLine.firstChild;
        if (first && first.nodeType === Node.TEXT_NODE) first.textContent = indent + first.textContent;
        else newLine.insertBefore(document.createTextNode(indent), newLine.firstChild);
        setCaretAtLineOffset(newLine, indent.length);
      }
      emit();
      return;
    }

    if (e.key === 'Backspace' && sel.isCollapsed) {
      const indent = getLineIndent(lineEl);
      const caret = getCaretOffsetInLine(lineEl, range.startContainer, range.startOffset);
      if (indent.length > 0 && caret === indent.length) {
        e.preventDefault();
        const remove = Math.min(2, indent.length);
        removeIndent(lineEl, remove);
        setCaretAtLineOffset(lineEl, caret - remove);
        emit();
      }
    }
  };

  const isEmpty = !value || !value.trim();

  return (
    <div className="rich-bullet-wrap">
      <div
        ref={ref}
        className={className}
        contentEditable
        suppressContentEditableWarning
        onFocus={onFocusField}
        onInput={emit}
        onKeyDown={handleKeyDown}
      />
      {isEmpty && <span className="rb-placeholder">{placeholder}</span>}
    </div>
  );
}
