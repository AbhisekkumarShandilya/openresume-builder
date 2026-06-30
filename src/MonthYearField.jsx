import { useEffect, useRef, useState } from 'react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Parses "Mar 2022" (any 3+ letter month name + 4-digit year) back into
// {month, year} so the popover can highlight the current value and default
// its year view to it. Anything else (old free-text data like "2022",
// "Present", or a custom string) just doesn't highlight — the field stays
// editable as plain text either way, so old data keeps displaying as-is.
function parseValue(value) {
  if (!value) return null;
  const m = value.trim().match(/^([A-Za-z]{3,9})\s+(\d{4})$/);
  if (!m) return null;
  const month = MONTHS.findIndex((mo) => mo.toLowerCase() === m[1].slice(0, 3).toLowerCase());
  if (month === -1) return null;
  return { month, year: Number(m[2]) };
}

// A job/degree can't start or end in the future — block picking any month
// past the real system date. Read once per render rather than memoized:
// this is cheap and means a field left open across midnight (unlikely, but
// free) still reflects the right "today".
function currentYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

// Start/End date field: a plain text input (so "Present", a bare year, or
// any free-text value someone already saved keeps working unchanged) plus a
// small popover — a year header with ‹ › navigation and a month grid — that
// writes "Mon YYYY" into it. Reusable across any section with start/end
// fields; Experience is the first one wired up.
export default function MonthYearField({ value, onChange, placeholder, allowPresent, spellCheck }) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => parseValue(value)?.year || new Date().getFullYear());
  const wrapRef = useRef(null);
  const { year: currentYear, month: currentMonth } = currentYearMonth();

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  const openPicker = () => {
    // Clamp to the current year so the popover doesn't open on an
    // entirely-future, entirely-disabled month grid by default.
    const parsedYear = parseValue(value)?.year;
    setViewYear(parsedYear && parsedYear <= currentYear ? parsedYear : currentYear);
    setOpen(true);
  };

  const pickMonth = (i) => {
    onChange(`${MONTHS[i]} ${viewYear}`);
    setOpen(false);
  };

  const parsed = parseValue(value);

  return (
    <div className="month-year-field" ref={wrapRef}>
      <input
        spellCheck={spellCheck}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={openPicker}
      />
      <button
        type="button"
        className="month-year-toggle"
        title="Pick month & year"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => (open ? setOpen(false) : openPicker())}
      >
        📅
      </button>
      {open && (
        <div className="month-year-popover">
          <div className="month-year-nav">
            <button type="button" onClick={() => setViewYear((y) => y - 1)}>‹</button>
            <span>{viewYear}</span>
            <button type="button" disabled={viewYear >= currentYear} onClick={() => setViewYear((y) => y + 1)}>›</button>
          </div>
          <div className="month-year-grid">
            {MONTHS.map((m, i) => {
              const future = viewYear > currentYear || (viewYear === currentYear && i > currentMonth);
              return (
                <button
                  type="button"
                  key={m}
                  disabled={future}
                  title={future ? "Can't pick a date in the future" : undefined}
                  className={parsed && parsed.month === i && parsed.year === viewYear ? 'active' : ''}
                  onClick={() => pickMonth(i)}
                >
                  {m}
                </button>
              );
            })}
          </div>
          <div className="month-year-actions">
            {allowPresent && (
              <button type="button" onClick={() => { onChange('Present'); setOpen(false); }}>Present</button>
            )}
            <button type="button" className="danger" onClick={() => { onChange(''); setOpen(false); }}>Clear</button>
          </div>
        </div>
      )}
    </div>
  );
}
