import React, { useState, useEffect } from 'react';
import { emptyResume } from './data.js';
import Editor from './Editor.jsx';
import Preview from './Preview.jsx';
import { improveWithAI } from './ai.js';

const STORAGE_KEY = 'resume-builder:resume';

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : emptyResume;
  } catch {
    return emptyResume;
  }
}

export default function App() {
  const [resume, setResume] = useState(loadFromStorage);
  const [template, setTemplate] = useState('classic');
  const [status, setStatus] = useState('');

  // Autosave every change so work survives app restarts/crashes.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resume));
  }, [resume]);

  const save = async () => {
    const res = await window.api.saveResume(resume);
    setStatus(res.ok ? 'Saved.' : 'Save cancelled.');
  };

  const load = async () => {
    const res = await window.api.loadResume();
    if (res.ok) {
      setResume(res.data);
      setStatus('Loaded.');
    }
  };

  const exportPDF = async () => {
    const res = await window.api.exportPDF();
    setStatus(res.ok ? 'Exported PDF.' : 'Export cancelled.');
  };

  // AI stub — wired up but does nothing until you fill in ai.js later.
  const aiImprove = async () => {
    setStatus('AI not configured yet.');
    await improveWithAI(resume);
  };

  return (
    <div className="app">
      <header className="toolbar">
        <strong>OpenResume Builder</strong>
        <div className="spacer" />
        <select value={template} onChange={(e) => setTemplate(e.target.value)}>
          <option value="classic">Classic</option>
          <option value="modern">Modern</option>
        </select>
        <button onClick={load}>Open</button>
        <button onClick={save}>Save</button>
        <button onClick={exportPDF}>Export PDF</button>
        <button className="ai-btn" onClick={aiImprove} title="Add AI later">
          ✨ Improve with AI
        </button>
        <span className="status">{status}</span>
      </header>

      <main className="workspace">
        <section className="editor-pane">
          <Editor resume={resume} setResume={setResume} />
        </section>
        <section className="preview-pane">
          <Preview resume={resume} template={template} />
        </section>
      </main>
    </div>
  );
}
