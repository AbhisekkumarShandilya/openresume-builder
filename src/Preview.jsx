import { renderFormatted, splitIntroAndBullets } from './format.jsx';
import { normalizeBulletStyle } from './bulletStyles.js';
import { languagesInline, visibleLinks, INLINE_SEP } from './contactFields.js';

// Languages render as one compact inline line (English (Native) · German (B2))
// rather than a card-height row per language.
function LanguagesLine({ items }) {
  const inline = languagesInline(items);
  return inline ? <p className="r-languages">{inline}</p> : null;
}

// Links show the label but the URL is a real clickable anchor (carried into the
// PDF by Chromium's print-to-PDF). Separated by the same middot as languages.
function LinksLine({ items }) {
  const links = visibleLinks(items);
  if (!links.length) return null;
  return (
    <p className="r-links">
      {links.map((l, i) => (
        <span key={i}>
          {i > 0 && INLINE_SEP}
          <a href={l.href} target="_blank" rel="noreferrer">{l.text}</a>
        </span>
      ))}
    </p>
  );
}

// Each non-blank skill is its own stacked line (not a chip/pill) — typically
// a "Label: comma, separated, items" category, with B/I markup honored so a
// leading "**Label:**" renders genuinely bold.
function SkillLines({ items }) {
  const skills = items.filter((s) => s.trim());
  if (skills.length === 0) return null;
  return (
    <div className="r-skills">
      {skills.map((s, i) => (
        <p className="r-skill-line" key={i}>{renderFormatted(s.trim())}</p>
      ))}
    </div>
  );
}

function Bullets({ bullets, className, style }) {
  // A field can hold an intro line (rendered as a plain paragraph) before
  // its list — see splitIntroAndBullets. The editor also keeps blank lines
  // around while typing the list itself (e.g. the line you're about to fill
  // in after pressing Enter) — those are dropped only here, at render time.
  const { intro, bulletLines } = splitIntroAndBullets(bullets);
  const visible = bulletLines.filter((b) => b.trim());
  if (!intro && visible.length === 0) return null;
  // A single point doesn't read as a "list" — drop the marker and show it
  // as plain text, matching how a lone bullet usually looks in a real resume.
  const isSinglePoint = visible.length === 1;
  return (
    <>
      {intro && <p className="r-bullet-intro">{renderFormatted(intro)}</p>}
      {isSinglePoint && <p className="r-bullet-intro">{renderFormatted(visible[0].trim())}</p>}
      {visible.length > 1 && (
        <ul className={[className, 'r-list', `style-${normalizeBulletStyle(style)}`].filter(Boolean).join(' ')}>
          {visible.map((b, i) => (
            <li key={i} className={/^\s/.test(b) ? 'sub' : ''}>{renderFormatted(b.trim())}</li>
          ))}
        </ul>
      )}
    </>
  );
}

// --- Resumatic: bold name/dates row, italic role/location row, square+circle bullets ---

function ResumaticSection({ section }) {
  switch (section.type) {
    case 'experience':
      return (
        <section key={section.id}>
          <h3>{section.title}</h3>
          {section.items.map((x) => (
            <div className="r-entry" key={x.id}>
              <div className="r-entry-head">
                <strong>{x.company}</strong>
                <span>{x.start} – {x.end}</span>
              </div>
              <div className="r-entry-sub">
                <em>{x.role}</em>
                <em>{x.location}</em>
              </div>
              <Bullets bullets={x.bullets} className="r-bullets" style={x.bulletStyle} />
            </div>
          ))}
        </section>
      );
    case 'projects':
      return (
        <section key={section.id}>
          <h3>{section.title}</h3>
          {section.items.map((x) => (
            <div className="r-entry" key={x.id}>
              <div className="r-entry-head">
                <strong>{x.name}</strong>
                <span>{x.start} – {x.end}</span>
              </div>
              <div className="r-entry-sub">
                <em>{x.role}</em>
                <em>{x.link}</em>
              </div>
              <Bullets bullets={x.bullets} className="r-bullets" style={x.bulletStyle} />
            </div>
          ))}
        </section>
      );
    case 'education':
      return (
        <section key={section.id}>
          <h3>{section.title}</h3>
          {section.items.map((x) => (
            <div className="r-entry" key={x.id}>
              <div className="r-entry-head">
                <strong>{x.school}</strong>
                <span>{x.start} – {x.end}</span>
              </div>
              <div className="r-entry-sub">
                <em>{x.degree}</em>
                <em>{x.location}</em>
              </div>
              <Bullets bullets={x.bullets} className="r-bullets" style={x.bulletStyle} />
            </div>
          ))}
        </section>
      );
    case 'certifications':
      return (
        <section key={section.id}>
          <h3>{section.title}</h3>
          {section.items.map((x) => (
            <div className="r-entry" key={x.id}>
              <div className="r-entry-head">
                <strong>{x.name}</strong>
                <span>{x.date}</span>
              </div>
              <div className="r-entry-sub">
                <em>{x.issuer}</em>
              </div>
            </div>
          ))}
        </section>
      );
    case 'languages':
      return languagesInline(section.items) ? (
        <section key={section.id}>
          <h3>{section.title}</h3>
          <LanguagesLine items={section.items} />
        </section>
      ) : null;
    case 'links':
      return visibleLinks(section.items).length ? (
        <section key={section.id}>
          <h3>{section.title}</h3>
          <LinksLine items={section.items} />
        </section>
      ) : null;
    case 'skills':
      return section.items.some((b) => b.trim()) ? (
        <section key={section.id}>
          <h3>{section.title}</h3>
          <SkillLines items={section.items} />
        </section>
      ) : null;
    case 'custom':
      return section.items.some((b) => b.trim()) ? (
        <section key={section.id}>
          <h3>{section.title}</h3>
          <Bullets bullets={section.items} className="r-bullets" style={section.bulletStyle} />
        </section>
      ) : null;
    default:
      return null;
  }
}

function ResumaticPreview({ resume }) {
  const { personal: p, sections } = resume;

  return (
    <div className="resume-sheet tpl-resumatic">
      <div className="r-header">
        <h1>{p.name}</h1>
        <div className="r-contact">
          {[p.email, p.phone, p.location, p.website].filter(Boolean).join('  ❖  ')}
        </div>
      </div>

      {p.summary && (
        <section>
          <p className="r-summary">{renderFormatted(p.summary)}</p>
        </section>
      )}

      {sections.map((s) => <ResumaticSection section={s} key={s.id} />)}
    </div>
  );
}

// --- Classic / Modern: role/name+dates row, plain sub line, bulleted list ---

function StandardSection({ section }) {
  switch (section.type) {
    case 'experience':
      return (
        <section key={section.id}>
          <h3>{section.title}</h3>
          {section.items.map((x) => (
            <div className="r-entry" key={x.id}>
              <div className="r-entry-head">
                <strong>{x.role}</strong>
                <span>{x.start} – {x.end}</span>
              </div>
              <div className="r-sub">{[x.company, x.location].filter(Boolean).join(' — ')}</div>
              <Bullets bullets={x.bullets} style={x.bulletStyle} />
            </div>
          ))}
        </section>
      );
    case 'projects':
      return (
        <section key={section.id}>
          <h3>{section.title}</h3>
          {section.items.map((x) => (
            <div className="r-entry" key={x.id}>
              <div className="r-entry-head">
                <strong>{x.name}</strong>
                <span>{x.start} – {x.end}</span>
              </div>
              <div className="r-sub">{[x.role, x.link].filter(Boolean).join(' — ')}</div>
              <Bullets bullets={x.bullets} style={x.bulletStyle} />
            </div>
          ))}
        </section>
      );
    case 'education':
      return (
        <section key={section.id}>
          <h3>{section.title}</h3>
          {section.items.map((x) => (
            <div className="r-entry" key={x.id}>
              <div className="r-entry-head">
                <strong>{x.degree}</strong>
                <span>{x.start} – {x.end}</span>
              </div>
              <div className="r-sub">{[x.school, x.location].filter(Boolean).join(' — ')}</div>
              <Bullets bullets={x.bullets} style={x.bulletStyle} />
            </div>
          ))}
        </section>
      );
    case 'certifications':
      return (
        <section key={section.id}>
          <h3>{section.title}</h3>
          {section.items.map((x) => (
            <div className="r-entry" key={x.id}>
              <div className="r-entry-head">
                <strong>{x.name}</strong>
                <span>{x.date}</span>
              </div>
              <div className="r-sub">{x.issuer}</div>
            </div>
          ))}
        </section>
      );
    case 'languages':
      return languagesInline(section.items) ? (
        <section key={section.id}>
          <h3>{section.title}</h3>
          <LanguagesLine items={section.items} />
        </section>
      ) : null;
    case 'links':
      return visibleLinks(section.items).length ? (
        <section key={section.id}>
          <h3>{section.title}</h3>
          <LinksLine items={section.items} />
        </section>
      ) : null;
    case 'skills':
      return section.items.some((b) => b.trim()) ? (
        <section key={section.id}>
          <h3>{section.title}</h3>
          <SkillLines items={section.items} />
        </section>
      ) : null;
    case 'custom':
      return section.items.some((b) => b.trim()) ? (
        <section key={section.id}>
          <h3>{section.title}</h3>
          <Bullets bullets={section.items} style={section.bulletStyle} />
        </section>
      ) : null;
    default:
      return null;
  }
}

function StandardPreview({ resume, template }) {
  const { personal: p, sections } = resume;

  return (
    <div className={`resume-sheet tpl-${template}`}>
      <div className="r-header">
        <h1>{p.name}</h1>
        <div className="r-title">{p.title}</div>
        <div className="r-contact">
          {[p.email, p.phone, p.location, p.website].filter(Boolean).join('  •  ')}
        </div>
      </div>

      {p.summary && (
        <section>
          <h3>Summary</h3>
          <p>{renderFormatted(p.summary)}</p>
        </section>
      )}

      {sections.map((s) => <StandardSection section={s} key={s.id} />)}
    </div>
  );
}

export default function Preview({ resume, template }) {
  if (template === 'resumatic') return <ResumaticPreview resume={resume} />;
  return <StandardPreview resume={resume} template={template} />;
}
