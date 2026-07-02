// On-screen rendering of the light markup syntax. The actual parsing lives in
// richText.js so the DOCX/TXT exporters share exactly one definition of what
// **bold**/*italic*/***both*** mean. splitIntroAndBullets is re-exported here
// for the existing Preview import path.
import { parseRuns, splitIntroAndBullets } from './richText.js';

export { splitIntroAndBullets };

export function renderFormatted(text) {
  if (!text) return text;
  return parseRuns(text).map((run, i) => {
    if (run.bold && run.italic) return <strong key={i}><em>{run.text}</em></strong>;
    if (run.bold) return <strong key={i}>{run.text}</strong>;
    if (run.italic) return <em key={i}>{run.text}</em>;
    return run.text;
  });
}
