// The whole resume is just this JSON object. Save/load/export all use it.
// `sections` is an ordered list — order here is render/editor order, and is
// user-editable (add/remove/reorder) without touching this file.
let uidCounter = 0;
const nextId = () => `${Date.now()}-${uidCounter++}`;

// `fields` drives the Editor's generic card renderer for object-array
// sections (experience/education/projects/certifications) — each entry is
// either a standalone field or a `row` of fields shown side by side. Adding
// a new field here is enough; no per-section JSX block needed in Editor.jsx.
export const SECTION_TYPES = {
  experience: {
    label: 'Experience',
    newItem: () => ({ id: nextId(), role: '', company: '', location: '', start: '', end: '', bullets: [] }),
    fields: [
      { key: 'company', placeholder: 'Company', spellCheck: false },
      { row: [
        { key: 'role', placeholder: 'Role', spellCheck: true, list: 'job-title-suggestions' },
        { key: 'location', placeholder: 'City, ST', spellCheck: true },
      ] },
      { row: [
        { key: 'start', placeholder: 'Start', spellCheck: false, monthYear: true },
        { key: 'end', placeholder: 'End', spellCheck: false, monthYear: true, allowPresent: true },
      ] },
    ],
    bullets: { placeholder: 'One bullet per line (Ctrl+]/Ctrl+[ to indent a sub-bullet)', richText: true },
  },
  education: {
    label: 'Education',
    newItem: () => ({ id: nextId(), degree: '', school: '', location: '', start: '', end: '', bullets: [] }),
    fields: [
      { key: 'school', placeholder: 'School', spellCheck: false },
      { row: [
        { key: 'degree', placeholder: 'Degree', spellCheck: true, list: 'degree-suggestions' },
        { key: 'location', placeholder: 'City, ST', spellCheck: true },
      ] },
      { row: [
        { key: 'start', placeholder: 'Start', spellCheck: false, monthYear: true },
        { key: 'end', placeholder: 'End', spellCheck: false, monthYear: true, allowPresent: true },
      ] },
    ],
    bullets: { placeholder: 'One bullet per line (optional; Ctrl+]/Ctrl+[ to indent a sub-bullet)' },
  },
  projects: {
    label: 'Projects',
    newItem: () => ({ id: nextId(), name: '', role: '', link: '', start: '', end: '', bullets: [] }),
    fields: [
      { key: 'name', placeholder: 'Project name', spellCheck: false },
      { row: [
        { key: 'role', placeholder: 'Role (optional)', spellCheck: true, list: 'job-title-suggestions' },
        { key: 'link', placeholder: 'Link (optional)', spellCheck: false },
      ] },
      { row: [
        { key: 'start', placeholder: 'Start', spellCheck: false, monthYear: true },
        { key: 'end', placeholder: 'End', spellCheck: false, monthYear: true, allowPresent: true },
      ] },
    ],
    bullets: { placeholder: 'One bullet per line (Ctrl+]/Ctrl+[ to indent a sub-bullet)' },
  },
  certifications: {
    label: 'Certifications',
    newItem: () => ({ id: nextId(), name: '', issuer: '', date: '' }),
    fields: [
      { key: 'name', placeholder: 'Certification name', spellCheck: false },
      { row: [
        { key: 'issuer', placeholder: 'Issuer', spellCheck: false },
        { key: 'date', placeholder: 'Date', spellCheck: false },
      ] },
    ],
  },
  languages: {
    label: 'Languages',
    // Rendered compactly inline (English (Native) · German (B2)) rather than
    // one card-height row per language — see Preview/exportModel.
    newItem: () => ({ id: nextId(), language: '', proficiency: '' }),
    fields: [
      { row: [
        { key: 'language', placeholder: 'Language', spellCheck: false },
        { key: 'proficiency', placeholder: 'Proficiency', spellCheck: false, list: 'proficiency-suggestions' },
      ] },
    ],
  },
  links: {
    label: 'Links',
    // The label is shown; the url becomes a real clickable hyperlink in the
    // preview/PDF/DOCX and prints as the bare URL in TXT. Light validation only
    // (a scheme is prepended if missing) — see src/contactFields.js.
    newItem: () => ({ id: nextId(), label: '', url: '' }),
    fields: [
      { key: 'label', placeholder: 'Label (e.g. GitHub, LinkedIn, Portfolio)', spellCheck: false },
      { key: 'url', placeholder: 'URL (github.com/you)', spellCheck: false, validateUrl: true },
    ],
  },
  skills: {
    label: 'Skills',
    newItem: null, // items is a flat array of skill strings, edited via ChipInput
  },
  custom: {
    label: 'Custom Section',
    newItem: null, // items is a flat array of strings (one bullet per line)
  },
};

export function createSection(type, title) {
  const def = SECTION_TYPES[type];
  if (!def) throw new Error(`Unknown section type: ${type}`);
  return {
    id: `sec-${nextId()}`,
    type,
    title: title || def.label,
    items: def.newItem ? [def.newItem()] : [],
  };
}

export const emptyResume = {
  personal: {
    name: 'Jane Doe',
    title: 'Software Engineer',
    email: 'jane@example.com',
    phone: '+1 555 0100',
    location: 'Melbourne, AU',
    website: 'github.com/janedoe',
    summary:
      'Engineer with 5 years building reliable web and desktop apps. Focused on clean architecture and shipping.',
  },
  sections: [
    {
      id: 'sec-experience',
      type: 'experience',
      title: 'Experience',
      items: [
        {
          id: 'exp-1',
          role: 'Senior Developer',
          company: 'Acme Corp',
          location: 'Melbourne, AU',
          start: '2022',
          end: 'Present',
          bullets: [
            'Led migration to a modular architecture, cutting build times 40%.',
            'Mentored 4 junior engineers.',
          ],
        },
      ],
    },
    {
      id: 'sec-education',
      type: 'education',
      title: 'Education',
      items: [
        {
          id: 'edu-1',
          degree: 'BSc Computer Science',
          school: 'University of Melbourne',
          location: 'Melbourne, AU',
          start: '2015',
          end: '2018',
          bullets: [],
        },
      ],
    },
    {
      id: 'sec-skills',
      type: 'skills',
      title: 'Skills',
      items: ['JavaScript', 'React', 'Electron', 'Node.js', 'SQL'],
    },
  ],
};

// Older saves only had personal/experience/education/skills at the top
// level. Convert those into the sections format so old localStorage data
// and old saved files keep working.
export function normalizeResume(data) {
  if (!data) return emptyResume;
  if (Array.isArray(data.sections)) return data;

  const sections = [];
  if (Array.isArray(data.experience)) {
    sections.push({ id: 'sec-experience', type: 'experience', title: 'Experience', items: data.experience });
  }
  if (Array.isArray(data.education)) {
    sections.push({ id: 'sec-education', type: 'education', title: 'Education', items: data.education });
  }
  if (Array.isArray(data.skills)) {
    sections.push({ id: 'sec-skills', type: 'skills', title: 'Skills', items: data.skills });
  }
  return { personal: data.personal || emptyResume.personal, sections };
}
