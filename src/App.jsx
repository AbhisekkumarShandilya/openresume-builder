import { useState, useEffect, useRef } from 'react';
import { emptyResume, normalizeResume } from './data.js';
import SectionNav from './SectionNav.jsx';
import Editor from './Editor.jsx';
import Preview from './Preview.jsx';
import TemplateGallery from './TemplateGallery.jsx';
import { improveWithAI } from './ai.js';
import { version as appVersion } from '../package.json';
import { formatVersion } from './version.js';

const STORAGE_KEY = 'resume-builder:resume';
const SNAPSHOTS_KEY = 'resume-builder:snapshots';

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeResume(JSON.parse(raw)) : emptyResume;
  } catch {
    return emptyResume;
  }
}

function loadSnapshots() {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [resume, setResume] = useState(loadFromStorage);
  const [template, setTemplate] = useState('resumatic');
  const [status, setStatus] = useState('');
  const [activeSection, setActiveSection] = useState('personal');
  const [activeTab, setActiveTab] = useState('details');
  const [saveState, setSaveState] = useState('saved');
  const [snapshots, setSnapshots] = useState(loadSnapshots);
  const [showSettings, setShowSettings] = useState(false);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const isFirstRender = useRef(true);
  const resumeRef = useRef(resume);
  resumeRef.current = resume;

  // Autosave (debounced) — shows "Saving…" then "All changes saved" so the
  // user can see their work is persisted without an explicit Save button.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setSaveState('saving');
    const t = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(resume));
      setSaveState('saved');
    }, 400);
    return () => clearTimeout(t);
  }, [resume]);

  const load = async () => {
    const res = await window.api.loadResume();
    if (res.ok) {
      setResume(normalizeResume(res.data));
      setActiveSection('personal');
      setStatus('Loaded.');
    }
  };

  const saveAs = async () => {
    const res = await window.api.saveResume(resumeRef.current);
    setStatus(res.ok ? 'Saved.' : 'Save cancelled.');
  };

  // File > Open / Save As live in the native menu bar; they ping us here to
  // run the same dialog flow the old toolbar buttons used.
  useEffect(() => {
    window.api.onMenuOpen(load);
    window.api.onMenuSaveAs(saveAs);
  }, []);

  const exportPDF = async () => {
    const res = await window.api.exportPDF();
    setStatus(res.ok ? 'Exported PDF.' : 'Export cancelled.');
  };

  // AI stub — wired up but does nothing until you fill in ai.js later.
  const aiImprove = async () => {
    setStatus('AI not configured yet.');
    await improveWithAI(resume);
  };

  const persistSnapshots = (next) => {
    setSnapshots(next);
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(next));
  };

  const makeSnapshot = () => {
    const snap = { id: Date.now(), name: '', label: new Date().toLocaleString(), data: resume };
    persistSnapshots([snap, ...snapshots].slice(0, 20));
    setStatus('Snapshot saved.');
  };

  const renameSnapshot = (id, name) =>
    persistSnapshots(snapshots.map((s) => (s.id === id ? { ...s, name } : s)));

  const restoreSnapshot = (snap) => {
    const ok = window.confirm(
      `Restore snapshot "${snap.name || snap.label}" (${snap.label})?\n\nThis replaces everything currently in the editor. Changes made since this snapshot was taken will be lost unless you've snapshotted them too.`
    );
    if (!ok) return;
    setResume(normalizeResume(snap.data));
    setActiveSection('personal');
    setShowSnapshots(false);
    setStatus('Snapshot restored.');
  };

  const deleteSnapshot = (id) => {
    const ok = window.confirm('Delete this snapshot? This cannot be undone.');
    if (!ok) return;
    persistSnapshots(snapshots.filter((s) => s.id !== id));
  };

  const resetResume = () => {
    const ok = window.confirm('Reset to a blank resume? This replaces everything currently in the editor.');
    if (!ok) return;
    setResume(JSON.parse(JSON.stringify(emptyResume)));
    setActiveSection('personal');
    setShowSettings(false);
    setStatus('Resume reset.');
  };

  const clearSnapshots = () => {
    const ok = window.confirm('Delete all snapshots? This cannot be undone.');
    if (!ok) return;
    persistSnapshots([]);
    setShowSettings(false);
  };

  const checkForUpdates = async () => {
    setUpdateChecking(true);
    setUpdateMessage('');
    const res = await window.api.checkForUpdates();
    setUpdateChecking(false);
    if (!res.ok && res.reason === 'dev-mode') {
      setUpdateMessage('Update checks are disabled in development.');
    } else if (!res.ok) {
      setUpdateMessage(`Update check failed: ${res.message || 'unknown error'}`);
    } else if (res.hasUpdate) {
      setUpdateMessage(`Update available: v${res.latest} (you have v${res.version}).`);
    } else {
      setUpdateMessage(`You're on the latest version (v${res.version}).`);
    }
  };

  return (
    <div className="app">
      <header className="toolbar">
        <div className="toolbar-row toolbar-row-tabs">
          <div className="toolbar-group">
            <button className="icon-btn" title="Settings" onClick={() => { setShowSettings((v) => !v); setShowSnapshots(false); }}>
              ⚙
            </button>
            {showSettings && (
              <div className="popover settings-popover">
                <div className="popover-header">
                  <strong>Settings</strong>
                  <button className="popover-close" onClick={() => setShowSettings(false)}>×</button>
                </div>
                <p className="popover-hint">Changes autosave automatically to this device.</p>
                <p className="popover-hint">OpenResume Builder v{formatVersion(appVersion)}</p>
                <button className="popover-action" disabled={updateChecking} onClick={checkForUpdates}>
                  {updateChecking ? 'Checking…' : 'Check for Updates'}
                </button>
                {updateMessage && <p className="popover-hint">{updateMessage}</p>}
                <button className="popover-action danger" onClick={resetResume}>Reset resume to blank</button>
              </div>
            )}
          </div>

          <div className="tabs-group">
            <div className="tabs">
              <button className={activeTab === 'template' ? 'active' : ''} onClick={() => setActiveTab('template')}>
                Template
              </button>
              <button className={activeTab === 'details' ? 'active' : ''} onClick={() => setActiveTab('details')}>
                Details
              </button>
              <button className={activeTab === 'preview' ? 'active' : ''} onClick={() => setActiveTab('preview')}>
                Final Preview
              </button>
            </div>

            <button onClick={exportPDF}>Export PDF</button>
          </div>
        </div>

        <div className="toolbar-row">
          <div className="toolbar-group">
            <button onClick={makeSnapshot}>📸 Make Snapshot</button>
            <button onClick={() => { setShowSnapshots((v) => !v); setShowSettings(false); }}>
              Snapshot Restore ({snapshots.length})
            </button>
            {showSnapshots && (
              <div className="popover snapshots-popover">
                <div className="popover-header">
                  <strong>Snapshots</strong>
                  <button className="popover-close" onClick={() => setShowSnapshots(false)}>×</button>
                </div>
                <button className="popover-action danger" disabled={snapshots.length === 0} onClick={clearSnapshots}>
                  Clear All Snapshots
                </button>
                {snapshots.length === 0 ? (
                  <p className="popover-hint">No snapshots yet — take one before making risky changes.</p>
                ) : (
                  <table className="snapshot-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Date &amp; Time</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshots.map((s, i) => (
                        <tr key={s.id}>
                          <td>{i + 1}</td>
                          <td>
                            <input
                              className="snapshot-name-input"
                              placeholder="Untitled"
                              value={s.name || ''}
                              onChange={(e) => renameSnapshot(s.id, e.target.value)}
                            />
                          </td>
                          <td>{s.label}</td>
                          <td>
                            <div className="snapshot-actions">
                              <button onClick={() => restoreSnapshot(s)}>Restore</button>
                              <button className="danger" onClick={() => deleteSnapshot(s.id)}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          <div className="toolbar-left">
            <span className={`save-status ${saveState}`}>
              {saveState === 'saving' ? 'Saving…' : 'All changes saved'}
            </span>
          </div>

          <div className="spacer" />

          <button className="ai-btn" onClick={aiImprove} title="Add AI later">
            ✨ Improve with AI
          </button>
          <span className="status">{status}</span>
        </div>
      </header>

      <main className="workspace">
        {activeTab === 'template' && (
          <TemplateGallery resume={resume} template={template} setTemplate={setTemplate} />
        )}

        {activeTab === 'details' && (
          <>
            <SectionNav
              resume={resume}
              setResume={setResume}
              activeSection={activeSection}
              setActiveSection={setActiveSection}
            />
            <section className="editor-pane">
              <Editor resume={resume} setResume={setResume} activeSection={activeSection} />
            </section>
            <section className="preview-pane">
              <Preview resume={resume} template={template} />
            </section>
          </>
        )}

        {activeTab === 'preview' && (
          <section className="final-preview-pane">
            <Preview resume={resume} template={template} />
          </section>
        )}
      </main>
    </div>
  );
}
