import { useRef, useState } from 'react';
import { SECTION_TYPES } from './data.js';
import { JOB_TITLE_SUGGESTIONS, DEGREE_SUGGESTIONS, PROFICIENCY_SUGGESTIONS } from './autocompleteData.js';
import { isLikelyValidUrl } from './contactFields.js';
import { BULLET_STYLE_GROUPS, normalizeBulletStyle } from './bulletStyles.js';
import RichBulletField, { buildLineElement, lineElementToMarkerText, getLineElement } from './RichBulletField.jsx';
import { detectWrap, applyLineToggle, toggleLinesBullet } from './textEditing.js';
import MonthYearField from './MonthYearField.jsx';

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

  // Bold and Italic toggle independently and combine into *** rather than
  // overwriting each other: selecting bold text and clicking Italic yields
  // bold+italic; clicking the same button again removes just that one mark.
  const applyMark = (which) => {
    const el = activeFieldRef.current;
    const update = activeUpdateRef.current;
    if (!el || !update) return;
    // Rich (contenteditable) bullet fields have no selectionStart/End and
    // store no markers in the DOM at all — let the browser's native
    // bold/italic toggle handle wrap/unwrap/merge against the real
    // Selection; the field's own onInput re-serializes to marker text.
    if (el.isContentEditable) {
      el.focus();
      document.execCommand(which === 'bold' ? 'bold' : 'italic');
      return;
    }

    const { selectionStart: s, selectionEnd: e, value } = el;

    const wrap = detectWrap(value, s, e);
    // Nothing selected and no existing markup under the cursor to toggle off —
    // do nothing rather than insert a literal "text" placeholder, which used
    // to get stuck in the field permanently once un-bolded/un-italicized.
    if (!wrap && s === e) return;
    const current = wrap ? wrap.marker : '';
    const content = wrap ? wrap.inner : value.slice(s, e);
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

  // Contenteditable has no selectionStart/End — find the touched line(s) by
  // walking the Selection's start/end containers up to their .rb-line
  // ancestor instead, then reuse the same applyLineToggle core. The field
  // stays focused throughout this operation, so RichBulletField's own
  // "skip resync while focused" guard would never pick up the reordered
  // lines — rebuild its DOM directly here rather than waiting on that.
  const toggleLineBulletRich = (root, update) => {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const lineEls = Array.from(root.children).filter((c) => c.classList && c.classList.contains('rb-line'));
    const indexOfLine = (node) => {
      const lineEl = getLineElement(node, root);
      return lineEl ? lineEls.indexOf(lineEl) : -1;
    };
    const a = indexOfLine(range.startContainer);
    const b = indexOfLine(range.endContainer);
    if (a === -1 || b === -1) return;
    const firstLine = Math.min(a, b);
    const lastLine = Math.max(a, b);

    const lines = lineEls.map(lineElementToMarkerText);
    const result = applyLineToggle(lines, firstLine, lastLine);
    if (result === null) return;

    root.innerHTML = '';
    result.forEach((line) => root.appendChild(buildLineElement(line)));
    update(result.join('\n'));
    requestAnimationFrame(() => root.focus());
  };

  const toggleLineBullet = () => {
    const el = activeFieldRef.current;
    const update = activeUpdateRef.current;
    if (!el || !update || activeListStyle === null) return;
    if (el.isContentEditable) {
      toggleLineBulletRich(el, update);
      return;
    }
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
                      title={opt.name}
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
      <datalist id="degree-suggestions">
        {DEGREE_SUGGESTIONS.map((d) => <option key={d} value={d} />)}
      </datalist>
      <datalist id="proficiency-suggestions">
        {PROFICIENCY_SUGGESTIONS.map((p) => <option key={p} value={p} />)}
      </datalist>

      {section.type === 'skills' && (
        <div className="skills-list">
          {section.items.map((skill, i) => {
            const setSkill = (v) => {
              const items = [...section.items];
              items[i] = v;
              setItems(section.id, items);
            };
            return (
              <div className="skill-row" key={i}>
                <RichBulletField
                  singleLine
                  className="rich-skill-field"
                  placeholder="Skill"
                  value={skill}
                  onChange={setSkill}
                  onFocusField={registerFormattable(setSkill)}
                />
                <button
                  className="danger"
                  title="Remove skill"
                  onClick={() => setItems(section.id, section.items.filter((_, idx) => idx !== i))}
                >
                  ×
                </button>
              </div>
            );
          })}
          <button onClick={() => setItems(section.id, [...section.items, ''])}>+ Add Skill</button>
        </div>
      )}

      {section.type === 'custom' && (
        <RichBulletField
          className="bullet-field rich-bullet-field"
          placeholder="One bullet per line (Ctrl+]/Ctrl+[ to indent a sub-bullet)"
          value={section.items.join('\n')}
          onChange={(v) => setItems(section.id, v.split('\n'))}
          onFocusField={registerFormattable(
            (v) => setItems(section.id, v.split('\n')),
            { style: section.bulletStyle, setStyle: (s) => setSectionBulletStyle(section.id, s) }
          )}
        />
      )}

      {SECTION_TYPES[section.type].fields && section.items.map((x, i) => (
        <div className="card" key={x.id}>
          <CardControls index={i} total={section.items.length} onRemove={() => removeItem(section.id, x.id)} />
          {SECTION_TYPES[section.type].fields.map((f, fi) =>
            f.row ? (
              <div className="row" key={fi}>
                {f.row.map((rf) =>
                  rf.monthYear ? (
                    <MonthYearField
                      key={rf.key}
                      placeholder={rf.placeholder}
                      allowPresent={rf.allowPresent}
                      spellCheck={rf.spellCheck}
                      value={x[rf.key]}
                      onChange={(v) => updateItem(section.id, x.id, rf.key, v)}
                    />
                  ) : (
                    <input
                      key={rf.key}
                      spellCheck={rf.spellCheck}
                      list={rf.list}
                      placeholder={rf.placeholder}
                      value={x[rf.key]}
                      onChange={(e) => updateItem(section.id, x.id, rf.key, e.target.value)}
                    />
                  )
                )}
              </div>
            ) : f.validateUrl ? (
              <div className="field-with-warning" key={f.key}>
                <input
                  spellCheck={f.spellCheck}
                  placeholder={f.placeholder}
                  value={x[f.key]}
                  onChange={(e) => updateItem(section.id, x.id, f.key, e.target.value)}
                />
                {(x[f.key] || '').trim() && !isLikelyValidUrl(x[f.key]) && (
                  <span className="field-warning">
                    This doesn't look like a URL — it'll still be exported as typed.
                  </span>
                )}
              </div>
            ) : (
              <input
                key={f.key}
                spellCheck={f.spellCheck}
                placeholder={f.placeholder}
                value={x[f.key]}
                onChange={(e) => updateItem(section.id, x.id, f.key, e.target.value)}
              />
            )
          )}
          {SECTION_TYPES[section.type].bullets && SECTION_TYPES[section.type].bullets.richText && (
            <RichBulletField
              className="bullet-field rich-bullet-field"
              placeholder={SECTION_TYPES[section.type].bullets.placeholder}
              value={(x.bullets || []).join('\n')}
              onChange={(v) => setBullets(section.id, x.id, v)}
              onFocusField={registerFormattable((v) => setBullets(section.id, x.id, v), { style: x.bulletStyle, setStyle: (s) => setBulletStyle(section.id, x.id, s) })}
            />
          )}
          {SECTION_TYPES[section.type].bullets && !SECTION_TYPES[section.type].bullets.richText && (
            <textarea
              spellCheck
              className="bullet-field"
              placeholder={SECTION_TYPES[section.type].bullets.placeholder}
              value={(x.bullets || []).join('\n')}
              onFocus={registerFormattable((v) => setBullets(section.id, x.id, v), { style: x.bulletStyle, setStyle: (s) => setBulletStyle(section.id, x.id, s) })}
              onChange={(e) => setBullets(section.id, x.id, e.target.value)}
              onKeyDown={handleBulletKeyDown((v) => setBullets(section.id, x.id, v))}
            />
          )}
        </div>
      ))}

      {SECTION_TYPES[section.type].newItem && (
        <button onClick={() => addItem(section)}>+ Add {SECTION_TYPES[section.type].label.replace(/s$/, '')}</button>
      )}
    </div>
  );
}
