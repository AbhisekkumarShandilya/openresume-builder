import React, { useRef, useState } from 'react';
import { SECTION_TYPES } from './data.js';
import { SKILL_SUGGESTIONS, JOB_TITLE_SUGGESTIONS, DEGREE_SUGGESTIONS } from './autocompleteData.js';
import { BULLET_STYLE_GROUPS, normalizeBulletStyle } from './bulletStyles.js';

// Moves the line(s) touched by [selStart, selEnd) across the intro/list
// boundary that splitIntroAndBullets (format.jsx) reads at render time:
// lines before the first blank line are the plain intro, lines after are
// the bulleted list. This is what the toolbar's "¶" button does — pulling
// a highlighted line out of the list (or back into it) without disturbing
// any other line. Pure function, no React state, so it's easy to verify
// against raw textarea values.
function toggleLinesBullet(value, selStart, selEnd) {
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

  const blankIdx = lines.findIndex((l) => l.trim() === '');
  const picked = lines.slice(firstLine, lastLine + 1);

  if (blankIdx === -1) {
    // No intro yet: the picked line(s) become a brand-new intro block.
    const rest = [...lines.slice(0, firstLine), ...lines.slice(lastLine + 1)];
    return [...picked, '', ...rest].join('\n');
  }

  if (lastLine < blankIdx) {
    // Picked line(s) are already intro — demote back into the list.
    const introRest = [...lines.slice(0, firstLine), ...lines.slice(lastLine + 1, blankIdx)];
    const listRest = lines.slice(blankIdx + 1);
    return introRest.length === 0
      ? [...picked, ...listRest].join('\n')
      : [...introRest, '', ...picked, ...listRest].join('\n');
  }

  if (firstLine > blankIdx) {
    // Picked line(s) are in the list — promote into the intro block.
    const intro = lines.slice(0, blankIdx);
    const listRest = [...lines.slice(blankIdx + 1, firstLine), ...lines.slice(lastLine + 1)];
    return [...intro, ...picked, '', ...listRest].join('\n');
  }

  return value; // selection straddles the blank separator itself — no-op
}

export default function Editor({ resume, setResume, activeSection }) {
  // Functional setResume(prev => ...) everywhere below, NOT setResume({...resume, ...}).
  // The format toolbar (Bold/Italic/"1.") stashes these update functions in a ref at
  // focus-time and calls them later, by which point further typing has moved `resume`
  // on — closing over the prop directly would silently overwrite newer edits with that
  // stale snapshot. The functional form always reads the latest state at call time.
  const setPersonal = (field, value) =>
    setResume((prev) => ({ ...prev, personal: { ...prev.personal, [field]: value } }));

  const updateSection = (id, updater) =>
    setResume((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === id ? updater(s) : s)),
    }));

  const setTitle = (id, title) => updateSection(id, (s) => ({ ...s, title }));
  const setItems = (id, items) => updateSection(id, (s) => ({ ...s, items }));

  const updateItem = (sectionId, itemId, field, value) =>
    updateSection(sectionId, (s) => ({
      ...s,
      items: s.items.map((it) => (it.id === itemId ? { ...it, [field]: value } : it)),
    }));

  // Keep blank lines while typing (e.g. the line you're about to type a new
  // bullet on after pressing Enter) — Preview filters them out at render time.
  const setBullets = (sectionId, itemId, text) =>
    updateItem(sectionId, itemId, 'bullets', text.split('\n'));

  const addItem = (section) =>
    updateSection(section.id, (s) => ({ ...s, items: [...s.items, SECTION_TYPES[s.type].newItem()] }));

  const removeItem = (sectionId, itemId) =>
    updateSection(sectionId, (s) => ({ ...s, items: s.items.filter((it) => it.id !== itemId) }));

  const moveItem = (sectionId, index, dir) =>
    updateSection(sectionId, (s) => {
      const j = index + dir;
      if (j < 0 || j >= s.items.length) return s;
      const items = [...s.items];
      [items[index], items[j]] = [items[j], items[index]];
      return { ...s, items };
    });

  // Bold/Italic/list toolbar — operates on whichever formattable textarea
  // was last focused, tracked via these refs rather than per-field state,
  // since there can be many bullet textareas (one per entry) sharing one
  // toolbar. activeListSetStyleRef is only set for bullet fields (null for
  // Summary, which isn't a list), so the list-style button is disabled there.
  // activeListStyle mirrors the focused field's style in real React state
  // purely so the popover can highlight the current selection.
  const activeFieldRef = useRef(null);
  const activeUpdateRef = useRef(null);
  const activeListSetStyleRef = useRef(null);
  const [activeListStyle, setActiveListStyle] = useState(null);
  const [listPopoverOpen, setListPopoverOpen] = useState(false);

  const registerFormattable = (updateFn, listInfo = null) => (e) => {
    activeFieldRef.current = e.target;
    activeUpdateRef.current = updateFn;
    activeListSetStyleRef.current = listInfo ? listInfo.setStyle : null;
    setActiveListStyle(listInfo ? normalizeBulletStyle(listInfo.style) : null);
    setListPopoverOpen(false);
  };

  // Markers, longest first: a selection wrapped in *** must be detected as
  // *** (bold+italic), not mistaken for ** (bold) by a shorter prefix check.
  const MARKERS = ['***', '**', '*'];

  // Find an existing marker wrapping the selection and report its span +
  // unwrapped inner text, so the caller can strip/replace it instead of
  // naively wrapping again. Two cases, checked longest-marker-first in each:
  //   A. markers sit just outside [s, e) — what our own re-selection leaves
  //      after applying a mark, e.g. selecting "text" inside "**text**".
  //   B. the selection itself includes the markers — e.g. the user drag- or
  //      triple-click-selected the whole "**text**". Without this check,
  //      re-wrapping added a marker around the markers too, corrupting it
  //      to "****text****".
  const detectWrap = (value, s, e) => {
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
  };

  // Bold and Italic toggle independently and combine into *** rather than
  // overwriting each other: selecting bold text and clicking Italic yields
  // bold+italic; clicking the same button again removes just that one mark.
  const applyMark = (which) => {
    const el = activeFieldRef.current;
    const update = activeUpdateRef.current;
    if (!el || !update) return;
    const { selectionStart: s, selectionEnd: e, value } = el;

    const wrap = detectWrap(value, s, e);
    const current = wrap ? wrap.marker : '';
    const content = wrap ? wrap.inner : value.slice(s, e) || 'text';
    let bold = current === '**' || current === '***';
    let italic = current === '*' || current === '***';
    if (which === 'bold') bold = !bold;
    else italic = !italic;

    const marker = bold && italic ? '***' : bold ? '**' : italic ? '*' : '';
    const start = wrap ? wrap.start : s;
    const end = wrap ? wrap.end : e;
    const newValue = value.slice(0, start) + marker + content + marker + value.slice(end);
    update(newValue);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + marker.length, start + marker.length + content.length);
    });
  };

  const pickListStyle = (styleId) => {
    if (!activeListSetStyleRef.current) return;
    activeListSetStyleRef.current(styleId);
    setActiveListStyle(styleId);
    setListPopoverOpen(false);
    const el = activeFieldRef.current;
    if (el) requestAnimationFrame(() => el.focus());
  };

  const setBulletStyle = (sectionId, itemId, style) =>
    updateSection(sectionId, (s) => ({
      ...s,
      items: s.items.map((it) => (it.id === itemId ? { ...it, bulletStyle: style } : it)),
    }));

  const setSectionBulletStyle = (sectionId, style) =>
    updateSection(sectionId, (s) => ({ ...s, bulletStyle: style }));

  const toggleLineBullet = () => {
    const el = activeFieldRef.current;
    const update = activeUpdateRef.current;
    if (!el || !update || activeListStyle === null) return;
    const { selectionStart: s, selectionEnd: en, value } = el;
    const newValue = toggleLinesBullet(value, s, en);
    if (newValue === value) return;
    update(newValue);
    requestAnimationFrame(() => el.focus());
  };

  // Word/LibreOffice-style list editing for bullet textareas: Ctrl+]/Ctrl+[
  // indents/outdents the current line by one sub-bullet level (2 spaces —
  // the same leading-space convention Preview already uses to detect sub
  // bullets). Tab/Shift+Tab are deliberately left alone so they move focus
  // to the next/previous field like any other input, instead of being
  // trapped for indenting. Enter on an indented line continues at that same
  // level instead of resetting to top-level, Enter on an empty indented line
  // outdents instead of adding a deeper blank line, Shift+Enter is a no-op,
  // and Backspace right at the start of an indented line's text outdents
  // instead of merging into the line above.
  const handleBulletKeyDown = (setValue) => (e) => {
    const el = e.target;
    const { selectionStart: s, selectionEnd: en, value: v } = el;
    const lineStart = v.lastIndexOf('\n', s - 1) + 1;
    const indentOf = (text) => (text.match(/^ */) || [''])[0];

    if (e.ctrlKey && (e.key === ']' || e.key === '[')) {
      e.preventDefault();
      if (e.key === '[') {
        const remove = Math.min(2, indentOf(v.slice(lineStart)).length);
        if (remove === 0) return;
        setValue(v.slice(0, lineStart) + v.slice(lineStart + remove));
        const pos = (p) => Math.max(lineStart, p - remove);
        requestAnimationFrame(() => el.setSelectionRange(pos(s), pos(en)));
      } else {
        setValue(v.slice(0, lineStart) + '  ' + v.slice(lineStart));
        requestAnimationFrame(() => el.setSelectionRange(s + 2, en + 2));
      }
      return;
    }

    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault(); // Shift+Enter is a no-op in a bullet field
      return;
    }

    if (e.key === 'Enter' && s === en) {
      const lineEnd = v.indexOf('\n', s) === -1 ? v.length : v.indexOf('\n', s);
      const line = v.slice(lineStart, lineEnd);
      const indent = indentOf(line);
      if (!indent) return; // top-level line: default newline is already correct

      e.preventDefault();
      if (line.trim() === '') {
        const newIndent = indent.slice(0, Math.max(0, indent.length - 2));
        setValue(v.slice(0, lineStart) + newIndent + v.slice(lineEnd));
        const pos = lineStart + newIndent.length;
        requestAnimationFrame(() => el.setSelectionRange(pos, pos));
      } else {
        setValue(v.slice(0, s) + '\n' + indent + v.slice(s));
        const pos = s + 1 + indent.length;
        requestAnimationFrame(() => el.setSelectionRange(pos, pos));
      }
      return;
    }

    if (e.key === 'Backspace' && s === en) {
      const indent = indentOf(v.slice(lineStart));
      if (indent.length > 0 && s === lineStart + indent.length) {
        e.preventDefault();
        const remove = Math.min(2, indent.length);
        setValue(v.slice(0, lineStart) + v.slice(lineStart + remove));
        const pos = s - remove;
        requestAnimationFrame(() => el.setSelectionRange(pos, pos));
      }
    }
  };

  const FormatToolbar = () => (
    <div className="format-toolbar">
      <button type="button" title="Bold selected text" onMouseDown={(e) => e.preventDefault()} onClick={() => applyMark('bold')}>
        <strong>B</strong>
      </button>
      <button type="button" title="Italicize selected text" onMouseDown={(e) => e.preventDefault()} onClick={() => applyMark('italic')}>
        <em>I</em>
      </button>
      <div className="list-style-wrap">
        <button
          type="button"
          title="Bullet or numbering style, for the focused list field"
          disabled={activeListStyle === null}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setListPopoverOpen((v) => !v)}
        >
          ≡▾
        </button>
        {listPopoverOpen && activeListStyle !== null && (
          <div className="list-style-popover">
            {BULLET_STYLE_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="list-style-group-label">{group.label}</div>
                <div className="list-style-options">
                  {group.options.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={activeListStyle === opt.id ? 'active' : ''}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickListStyle(opt.id)}
                    >
                      {opt.glyph}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        title="Move the highlighted line(s) into or out of the bulleted list"
        disabled={activeListStyle === null}
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggleLineBullet}
      >
        ¶
      </button>
      <span className="format-hint">Select text in Summary or a bullet field for B/I (combine both on the same selection for bold+italic). In a bullet field: Ctrl+]/Ctrl+[ indents/outdents a sub-bullet, Tab moves to the next field, Enter starts a new point. Highlight a line and click ¶ to pull it out of the list (or back in). Use the list-style button to pick a bullet or numbering style.</span>
    </div>
  );

  const CardControls = ({ index, total, onRemove }) => (
    <div className="card-controls">
      <button title="Move up" disabled={index === 0} onClick={() => moveItem(section.id, index, -1)}>▲</button>
      <button title="Move down" disabled={index === total - 1} onClick={() => moveItem(section.id, index, 1)}>▼</button>
      <button className="danger" onClick={onRemove}>Remove</button>
    </div>
  );

  if (activeSection === 'personal') {
    const p = resume.personal;
    return (
      <div className="editor">
        <FormatToolbar />
        <h2>Personal</h2>
        <input spellCheck={false} placeholder="Name" value={p.name} onChange={(e) => setPersonal('name', e.target.value)} />
        <input spellCheck list="job-title-suggestions" placeholder="Title" value={p.title} onChange={(e) => setPersonal('title', e.target.value)} />
        <input spellCheck={false} placeholder="Email" value={p.email} onChange={(e) => setPersonal('email', e.target.value)} />
        <input spellCheck={false} placeholder="Phone" value={p.phone} onChange={(e) => setPersonal('phone', e.target.value)} />
        <input spellCheck placeholder="Location" value={p.location} onChange={(e) => setPersonal('location', e.target.value)} />
        <input spellCheck={false} placeholder="Website" value={p.website} onChange={(e) => setPersonal('website', e.target.value)} />
        <textarea
          spellCheck
          placeholder="Summary"
          value={p.summary}
          onFocus={registerFormattable((v) => setPersonal('summary', v))}
          onChange={(e) => setPersonal('summary', e.target.value)}
        />
        <datalist id="job-title-suggestions">
          {JOB_TITLE_SUGGESTIONS.map((t) => <option key={t} value={t} />)}
        </datalist>
      </div>
    );
  }

  const section = resume.sections.find((s) => s.id === activeSection);
  if (!section) return <div className="editor"><p>Section not found.</p></div>;

  return (
    <div className="editor">
      <FormatToolbar />
      <h2>
        <input
          className="section-title-input"
          value={section.title}
          onChange={(e) => setTitle(section.id, e.target.value)}
        />
      </h2>
      <datalist id="job-title-suggestions">
        {JOB_TITLE_SUGGESTIONS.map((t) => <option key={t} value={t} />)}
      </datalist>

      {section.type === 'skills' && (
        <div className="skills-list">
          {section.items.map((skill, i) => (
            <div className="skill-row" key={i}>
              <input
                spellCheck
                list="skill-suggestions"
                placeholder="Skill"
                value={skill}
                onChange={(e) => {
                  const items = [...section.items];
                  items[i] = e.target.value;
                  setItems(section.id, items);
                }}
              />
              <button className="danger" title="Remove" onClick={() => setItems(section.id, section.items.filter((_, idx) => idx !== i))}>×</button>
            </div>
          ))}
          <button onClick={() => setItems(section.id, [...section.items, ''])}>+ Add Skill</button>
          <datalist id="skill-suggestions">
            {SKILL_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>
      )}

      {section.type === 'custom' && (
        <textarea
          spellCheck
          className="bullet-field"
          placeholder="One bullet per line (Ctrl+]/Ctrl+[ to indent a sub-bullet)"
          value={section.items.join('\n')}
          onFocus={registerFormattable(
            (v) => setItems(section.id, v.split('\n')),
            { style: section.bulletStyle, setStyle: (s) => setSectionBulletStyle(section.id, s) }
          )}
          onChange={(e) => setItems(section.id, e.target.value.split('\n'))}
          onKeyDown={handleBulletKeyDown((v) => setItems(section.id, v.split('\n')))}
        />
      )}

      {section.type === 'experience' && section.items.map((x, i) => (
        <div className="card" key={x.id}>
          <CardControls index={i} total={section.items.length} onRemove={() => removeItem(section.id, x.id)} />
          <input spellCheck={false} placeholder="Company" value={x.company} onChange={(e) => updateItem(section.id, x.id, 'company', e.target.value)} />
          <div className="row">
            <input spellCheck list="job-title-suggestions" placeholder="Role" value={x.role} onChange={(e) => updateItem(section.id, x.id, 'role', e.target.value)} />
            <input spellCheck placeholder="City, ST" value={x.location} onChange={(e) => updateItem(section.id, x.id, 'location', e.target.value)} />
          </div>
          <div className="row">
            <input spellCheck={false} placeholder="Start" value={x.start} onChange={(e) => updateItem(section.id, x.id, 'start', e.target.value)} />
            <input spellCheck={false} placeholder="End" value={x.end} onChange={(e) => updateItem(section.id, x.id, 'end', e.target.value)} />
          </div>
          <textarea
            spellCheck
            className="bullet-field"
            placeholder="One bullet per line (Ctrl+]/Ctrl+[ to indent a sub-bullet)"
            value={x.bullets.join('\n')}
            onFocus={registerFormattable((v) => setBullets(section.id, x.id, v), { style: x.bulletStyle, setStyle: (s) => setBulletStyle(section.id, x.id, s) })}
            onChange={(e) => setBullets(section.id, x.id, e.target.value)}
            onKeyDown={handleBulletKeyDown((v) => setBullets(section.id, x.id, v))}
          />
        </div>
      ))}

      {section.type === 'education' && section.items.map((x, i) => (
        <div className="card" key={x.id}>
          <CardControls index={i} total={section.items.length} onRemove={() => removeItem(section.id, x.id)} />
          <input spellCheck={false} placeholder="School" value={x.school} onChange={(e) => updateItem(section.id, x.id, 'school', e.target.value)} />
          <div className="row">
            <input spellCheck list="degree-suggestions" placeholder="Degree" value={x.degree} onChange={(e) => updateItem(section.id, x.id, 'degree', e.target.value)} />
            <input spellCheck placeholder="City, ST" value={x.location} onChange={(e) => updateItem(section.id, x.id, 'location', e.target.value)} />
          </div>
          <div className="row">
            <input spellCheck={false} placeholder="Start" value={x.start} onChange={(e) => updateItem(section.id, x.id, 'start', e.target.value)} />
            <input spellCheck={false} placeholder="End" value={x.end} onChange={(e) => updateItem(section.id, x.id, 'end', e.target.value)} />
          </div>
          <textarea
            spellCheck
            className="bullet-field"
            placeholder="One bullet per line (optional; Ctrl+]/Ctrl+[ to indent a sub-bullet)"
            value={(x.bullets || []).join('\n')}
            onFocus={registerFormattable((v) => setBullets(section.id, x.id, v), { style: x.bulletStyle, setStyle: (s) => setBulletStyle(section.id, x.id, s) })}
            onChange={(e) => setBullets(section.id, x.id, e.target.value)}
            onKeyDown={handleBulletKeyDown((v) => setBullets(section.id, x.id, v))}
          />
          <datalist id="degree-suggestions">
            {DEGREE_SUGGESTIONS.map((d) => <option key={d} value={d} />)}
          </datalist>
        </div>
      ))}

      {section.type === 'projects' && section.items.map((x, i) => (
        <div className="card" key={x.id}>
          <CardControls index={i} total={section.items.length} onRemove={() => removeItem(section.id, x.id)} />
          <input spellCheck={false} placeholder="Project name" value={x.name} onChange={(e) => updateItem(section.id, x.id, 'name', e.target.value)} />
          <div className="row">
            <input spellCheck list="job-title-suggestions" placeholder="Role (optional)" value={x.role} onChange={(e) => updateItem(section.id, x.id, 'role', e.target.value)} />
            <input spellCheck={false} placeholder="Link (optional)" value={x.link} onChange={(e) => updateItem(section.id, x.id, 'link', e.target.value)} />
          </div>
          <div className="row">
            <input spellCheck={false} placeholder="Start" value={x.start} onChange={(e) => updateItem(section.id, x.id, 'start', e.target.value)} />
            <input spellCheck={false} placeholder="End" value={x.end} onChange={(e) => updateItem(section.id, x.id, 'end', e.target.value)} />
          </div>
          <textarea
            spellCheck
            className="bullet-field"
            placeholder="One bullet per line (Ctrl+]/Ctrl+[ to indent a sub-bullet)"
            value={x.bullets.join('\n')}
            onFocus={registerFormattable((v) => setBullets(section.id, x.id, v), { style: x.bulletStyle, setStyle: (s) => setBulletStyle(section.id, x.id, s) })}
            onChange={(e) => setBullets(section.id, x.id, e.target.value)}
            onKeyDown={handleBulletKeyDown((v) => setBullets(section.id, x.id, v))}
          />
        </div>
      ))}

      {section.type === 'certifications' && section.items.map((x, i) => (
        <div className="card" key={x.id}>
          <CardControls index={i} total={section.items.length} onRemove={() => removeItem(section.id, x.id)} />
          <input spellCheck={false} placeholder="Certification name" value={x.name} onChange={(e) => updateItem(section.id, x.id, 'name', e.target.value)} />
          <div className="row">
            <input spellCheck={false} placeholder="Issuer" value={x.issuer} onChange={(e) => updateItem(section.id, x.id, 'issuer', e.target.value)} />
            <input spellCheck={false} placeholder="Date" value={x.date} onChange={(e) => updateItem(section.id, x.id, 'date', e.target.value)} />
          </div>
        </div>
      ))}

      {SECTION_TYPES[section.type].newItem && (
        <button onClick={() => addItem(section)}>+ Add {SECTION_TYPES[section.type].label.replace(/s$/, '')}</button>
      )}
    </div>
  );
}
