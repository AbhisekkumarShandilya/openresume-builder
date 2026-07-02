// Pure helpers for the two "declarative" section types added in Task 5:
// Languages (rendered as a compact inline list) and Links (label + clickable
// URL). Kept framework-free so Preview.jsx, exportModel.js and the DOCX/TXT
// exporters all agree on the same formatting, and so the logic is unit-testable
// without a DOM.

// Separator between inline items (languages, and links in the preview header).
export const INLINE_SEP = ' · ';

// Prepend a scheme when the user typed a bare host ("github.com/you"). Anything
// that already carries a scheme ("https://…", "http://…", "mailto:…") is left
// untouched. Deliberately permissive — over-eager URL rewriting rejects valid
// links, which is worse than a slightly odd one.
export function normalizeUrl(raw) {
  const url = (raw || '').trim();
  if (!url) return '';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url) || /^mailto:/i.test(url)) return url;
  return `https://${url}`;
}

// Light "does this look like a URL?" check purely to drive a non-blocking
// warning in the editor. Empty is treated as valid (nothing to warn about) —
// the field is simply incomplete, not wrong.
export function isLikelyValidUrl(raw) {
  const url = (raw || '').trim();
  if (!url) return true;
  if (/\s/.test(url)) return false;
  try {
    const u = new URL(normalizeUrl(url));
    if (u.protocol === 'mailto:') return /.+@.+\..+/.test(u.pathname);
    // A hostname with a dot rules out obvious typos like "https://localhost".
    return u.hostname.includes('.');
  } catch {
    return false;
  }
}

// "English (Native)" or just "English" when no proficiency is given.
export function languageLabel(entry) {
  const lang = (entry?.language || '').trim();
  const prof = (entry?.proficiency || '').trim();
  if (!lang) return '';
  return prof ? `${lang} (${prof})` : lang;
}

// Only languages with a name actually render.
export function visibleLanguages(items) {
  return (items || []).filter((e) => (e?.language || '').trim());
}

// "English (Native) · German (B2)".
export function languagesInline(items) {
  return visibleLanguages(items).map(languageLabel).join(INLINE_SEP);
}

// A link needs a URL to be useful (a bare label links nowhere). The href is the
// normalized URL; the visible text is the label, falling back to the raw URL.
export function visibleLinks(items) {
  return (items || [])
    .filter((l) => (l?.url || '').trim())
    .map((l) => ({
      text: (l.label || '').trim() || l.url.trim(),
      href: normalizeUrl(l.url),
      url: l.url.trim(),
    }));
}
