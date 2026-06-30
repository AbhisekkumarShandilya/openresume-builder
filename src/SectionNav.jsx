import { SECTION_TYPES, createSection } from './data.js';

export default function SectionNav({ resume, setResume, activeSection, setActiveSection }) {
  const move = (index, dir) => {
    const j = index + dir;
    if (j < 0 || j >= resume.sections.length) return;
    const sections = [...resume.sections];
    [sections[index], sections[j]] = [sections[j], sections[index]];
    setResume({ ...resume, sections });
  };

  const addSection = (type) => {
    const section = createSection(type);
    setResume({ ...resume, sections: [...resume.sections, section] });
    setActiveSection(section.id);
  };

  const removeSection = (id) => {
    setResume({ ...resume, sections: resume.sections.filter((s) => s.id !== id) });
    if (activeSection === id) setActiveSection('personal');
  };

  // Skills/custom store raw strings (which can be blank while typing a new
  // one), so count only the filled-in ones rather than the raw array length.
  const countItems = (s) => (s.type === 'skills' || s.type === 'custom' ? s.items.filter((i) => i.trim()).length : s.items.length);

  return (
    <nav className="nav-pane">
      <button
        className={`nav-item ${activeSection === 'personal' ? 'active' : ''}`}
        onClick={() => setActiveSection('personal')}
      >
        Personal
      </button>

      {resume.sections.map((s, i) => (
        <div className="nav-row" key={s.id}>
          <button
            className={`nav-item ${activeSection === s.id ? 'active' : ''}`}
            onClick={() => setActiveSection(s.id)}
          >
            {s.title} ({countItems(s)})
          </button>
          <div className="nav-arrows">
            <button title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
            <button title="Move down" disabled={i === resume.sections.length - 1} onClick={() => move(i, 1)}>▼</button>
            <button title="Remove section" className="nav-remove" onClick={() => removeSection(s.id)}>×</button>
          </div>
        </div>
      ))}

      <select
        className="nav-add"
        value=""
        onChange={(e) => {
          if (e.target.value) addSection(e.target.value);
          e.target.value = '';
        }}
      >
        <option value="" disabled>+ Add section…</option>
        {Object.entries(SECTION_TYPES).map(([type, def]) => (
          <option key={type} value={type}>{def.label}</option>
        ))}
      </select>
    </nav>
  );
}
