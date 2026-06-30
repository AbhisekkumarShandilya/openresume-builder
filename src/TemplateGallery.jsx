import Preview from './Preview.jsx';

const TEMPLATES = [
  { id: 'resumatic', label: 'Resumatic' },
  { id: 'classic', label: 'Classic' },
  { id: 'modern', label: 'Modern' },
];

// Live-rendered thumbnails (scaled-down actual previews) instead of static
// screenshots, so the gallery always reflects the resume you're editing.
export default function TemplateGallery({ resume, template, setTemplate }) {
  return (
    <div className="template-gallery">
      {TEMPLATES.map((t) => (
        <button
          key={t.id}
          className={`template-card ${template === t.id ? 'active' : ''}`}
          onClick={() => setTemplate(t.id)}
        >
          <div className="template-thumb">
            <div className="template-thumb-inner">
              <Preview resume={resume} template={t.id} />
            </div>
          </div>
          <div className="template-label">{t.label}</div>
        </button>
      ))}
    </div>
  );
}
