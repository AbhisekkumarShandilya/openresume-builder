import { useState, useEffect, useRef } from 'react';
import { emptyResume, normalizeResume } from './data.js';
import useHistory from './useHistory.js';
import SectionNav from './SectionNav.jsx';
import Editor from './Editor.jsx';
import Preview from './Preview.jsx';
import TemplateGallery from './TemplateGallery.jsx';
import { improveWithAI } from './ai.js';
import { serializeText } from './textExport.js';
import { docxBase64 } from './docxExport.js';
import { exportFilename } from './exportModel.js';
import { version as appVersion } from '../package.json';
import { formatVersion } from './version.js';
import { readThemeSetting, writeThemeSetting, resolveTheme, THEME_SETTINGS } from './theme.js';
import {
  bootstrap,
  newProfileId,
  makeProfileMeta,
  uniqueName,
  copyName,
  findProfile,
  addProfileMeta,
  renameProfileMeta,
  removeProfileMeta,
  touchProfileMeta,
  setActiveProfile,
  writeIndex,
  readBody,
  writeBody,
  readSnapshots,
  writeSnapshots,
  profileBodyKey,
  profileSnapshotsKey,
} from './profiles.js';

const SNAPSHOT_LIMIT = 20;

// Runs migration and loads the active profile once, on first render.
const boot = bootstrap(localStorage);

function bodyToResume(body) {
  return body ? normalizeResume(body) : JSON.parse(JSON.stringify(emptyResume));
}

export default function App() {
  const { value: resume, set: setResume, reset: resetHistory, undo, redo, canUndo, canRedo } =
    useHistory(() => bodyToResume(boot.body));
  const [template, setTemplate] = useState('resumatic');
  const [themeSetting, setThemeSetting] = useState(() => readThemeSetting(localStorage));
  const [status, setStatus] = useState('');
  const [activeSection, setActiveSection] = useState('personal');
  const [activeTab, setActiveTab] = useState('details');
  const [saveState, setSaveState] = useState('saved');
  const [profileIndex, setProfileIndex] = useState(boot.index);
  const [activeId, setActiveId] = useState(boot.activeId);
  const [snapshots, setSnapshots] = useState(() => readSnapshots(localStorage, boot.activeId));
  const [showSettings, setShowSettings] = useState(false);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [showProfiles, setShowProfiles] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const isFirstRender = useRef(true);
  // Set right before a profile switch so the autosave effect (which fires
  // because both `resume` and `activeId` change) doesn't count the load as an
  // edit and bump the just-loaded profile's updatedAt.
  const skipNextSave = useRef(false);
  const resumeRef = useRef(resume);
  resumeRef.current = resume;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  const activeProfile = findProfile(profileIndex, activeId);

  // Autosave (debounced) — writes the active profile's body and bumps its
  // updatedAt, then shows "All changes saved" so the user can see their work
  // is persisted without an explicit Save button.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (!activeId) return;
    setSaveState('saving');
    const t = setTimeout(() => {
      writeBody(localStorage, activeId, resume);
      setProfileIndex((idx) => {
        const next = touchProfileMeta(idx, activeId);
        writeIndex(localStorage, next);
        return next;
      });
      setSaveState('saved');
    }, 400);
    return () => clearTimeout(t);
  }, [resume, activeId]);

  // Flush any pending edit to storage immediately (before switch/duplicate/
  // delete) so the 400ms autosave debounce can't drop the last keystrokes.
  const flushActiveBody = () => {
    if (activeIdRef.current) writeBody(localStorage, activeIdRef.current, resumeRef.current);
  };

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

  // Apply the theme: set data-theme on <html> (drives the CSS variables) and
  // push the raw setting to the main process so Electron's own chrome
  // (menus/dialogs/native scrollbars) follows via nativeTheme.themeSource,
  // which accepts exactly 'system' | 'light' | 'dark'. In System mode we also
  // re-apply when the OS flips prefers-color-scheme.
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.setAttribute('data-theme', resolveTheme(themeSetting, mql.matches));
    };
    apply();
    window.api.setTheme?.(themeSetting);
    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, [themeSetting]);

  const changeTheme = (setting) => setThemeSetting(writeThemeSetting(localStorage, setting));

  // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y (Cmd on macOS). preventDefault stops the
  // browser's native input undo, which would fight the controlled state. A
  // focused contenteditable is blurred first because RichBulletField treats
  // its DOM as the source of truth while focused and only resyncs from the
  // value prop once unfocused.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      const isUndo = key === 'z' && !e.shiftKey;
      const isRedo = key === 'y' || (key === 'z' && e.shiftKey);
      if (!isUndo && !isRedo) return;
      e.preventDefault();
      if (document.activeElement && document.activeElement.isContentEditable) {
        document.activeElement.blur();
      }
      (isUndo ? undo : redo)();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  // Undo/redo can remove the section the editor pane is showing; fall back
  // to Personal instead of leaving a dead "Section not found" pane.
  useEffect(() => {
    if (activeSection !== 'personal' && !resume.sections.some((s) => s.id === activeSection)) {
      setActiveSection('personal');
    }
  }, [resume, activeSection]);

  const exportPDF = async () => {
    setShowExport(false);
    const res = await window.api.exportPDF(exportFilename(resumeRef.current, 'pdf'));
    setStatus(res.ok ? 'Exported PDF.' : 'Export cancelled.');
  };

  const exportDOCX = async () => {
    setShowExport(false);
    try {
      const base64 = await docxBase64(resumeRef.current);
      const res = await window.api.exportDocx(base64, exportFilename(resumeRef.current, 'docx'));
      setStatus(res.ok ? 'Exported DOCX.' : 'Export cancelled.');
    } catch (err) {
      console.error('DOCX export failed:', err);
      setStatus('DOCX export failed.');
    }
  };

  const exportTXT = async () => {
    setShowExport(false);
    const text = serializeText(resumeRef.current);
    const res = await window.api.exportText(text, exportFilename(resumeRef.current, 'txt'));
    setStatus(res.ok ? 'Exported text.' : 'Export cancelled.');
  };

  // AI stub — wired up but does nothing until you fill in ai.js later.
  const aiImprove = async () => {
    setStatus('AI not configured yet.');
    await improveWithAI(resume);
  };

  const persistSnapshots = (next) => {
    setSnapshots(next);
    if (activeId) writeSnapshots(localStorage, activeId, next);
  };

  const makeSnapshot = () => {
    const snap = { id: Date.now(), name: '', label: new Date().toLocaleString(), data: resume };
    persistSnapshots([snap, ...snapshots].slice(0, SNAPSHOT_LIMIT));
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

  // ---- Profiles -------------------------------------------------------------
  // Load a profile into the editor: point state at it and start a fresh undo
  // session (switching profiles must not let Ctrl+Z rewind into another
  // document). `skipNextSave` stops the resulting render from being counted as
  // an edit against the freshly-loaded profile.
  const activateProfile = (id, snaps) => {
    skipNextSave.current = true;
    setActiveId(id);
    resetHistory(bodyToResume(readBody(localStorage, id)));
    setSnapshots(snaps ?? readSnapshots(localStorage, id));
    setActiveSection('personal');
  };

  const switchProfile = (id) => {
    setShowProfiles(false);
    if (id === activeId) return;
    flushActiveBody();
    const next = setActiveProfile(profileIndex, id);
    setProfileIndex(next);
    writeIndex(localStorage, next);
    activateProfile(id);
    setStatus(`Switched to "${findProfile(next, id).name}".`);
  };

  const newProfile = () => {
    setShowProfiles(false);
    flushActiveBody();
    const name = uniqueName(profileIndex.profiles.map((p) => p.name), 'Untitled resume');
    const meta = makeProfileMeta(name, newProfileId());
    const blank = JSON.parse(JSON.stringify(emptyResume));
    writeBody(localStorage, meta.id, blank);
    writeSnapshots(localStorage, meta.id, []);
    const next = addProfileMeta(profileIndex, meta);
    setProfileIndex(next);
    writeIndex(localStorage, next);
    activateProfile(meta.id, []);
    setStatus(`Created "${name}".`);
  };

  const duplicateProfile = () => {
    setShowProfiles(false);
    flushActiveBody();
    const source = findProfile(profileIndex, activeId);
    const name = copyName(profileIndex.profiles.map((p) => p.name), source ? source.name : 'Resume');
    const meta = makeProfileMeta(name, newProfileId());
    const body = JSON.parse(JSON.stringify(resumeRef.current));
    writeBody(localStorage, meta.id, body);
    writeSnapshots(localStorage, meta.id, []);
    const next = addProfileMeta(profileIndex, meta);
    setProfileIndex(next);
    writeIndex(localStorage, next);
    activateProfile(meta.id, []);
    setStatus(`Duplicated to "${name}".`);
  };

  const renameActiveProfile = () => {
    setShowProfiles(false);
    const current = findProfile(profileIndex, activeId);
    if (!current) return;
    const input = window.prompt('Rename this profile:', current.name);
    if (input == null) return;
    const trimmed = input.trim();
    if (!trimmed || trimmed === current.name) return;
    const others = profileIndex.profiles.filter((p) => p.id !== activeId).map((p) => p.name);
    const next = renameProfileMeta(profileIndex, activeId, uniqueName(others, trimmed));
    setProfileIndex(next);
    writeIndex(localStorage, next);
    setStatus('Profile renamed.');
  };

  const deleteActiveProfile = () => {
    if (profileIndex.profiles.length <= 1) {
      window.alert("You can't delete your only profile. Create another first.");
      return;
    }
    const target = findProfile(profileIndex, activeId);
    const ok = window.confirm(
      `Delete profile "${target.name}"?\n\nA final snapshot of it is saved under the profile you land on, as insurance. This can't be undone.`
    );
    if (!ok) return;
    flushActiveBody();
    const body = bodyToResume(readBody(localStorage, activeId));
    const next = removeProfileMeta(profileIndex, activeId);
    const landingId = next.activeProfileId;
    localStorage.removeItem(profileBodyKey(activeId));
    localStorage.removeItem(profileSnapshotsKey(activeId));
    setProfileIndex(next);
    writeIndex(localStorage, next);
    // Free insurance: drop the deleted resume's content as a snapshot under the
    // profile we land on, so a mis-click is recoverable via Snapshot Restore.
    const finalSnap = {
      id: Date.now(),
      name: `Deleted: ${target.name}`,
      label: new Date().toLocaleString(),
      data: body,
    };
    const landingSnaps = [finalSnap, ...readSnapshots(localStorage, landingId)].slice(0, SNAPSHOT_LIMIT);
    writeSnapshots(localStorage, landingId, landingSnaps);
    activateProfile(landingId, landingSnaps);
    setShowProfiles(false);
    setStatus(`Deleted "${target.name}".`);
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
                <p className="popover-hint">Appearance</p>
                <div className="theme-toggle" role="group" aria-label="Appearance">
                  {THEME_SETTINGS.map((t) => (
                    <button
                      key={t}
                      className={themeSetting === t ? 'active' : ''}
                      aria-pressed={themeSetting === t}
                      onClick={() => changeTheme(t)}
                    >
                      {t === 'system' ? 'System' : t === 'light' ? 'Light' : 'Dark'}
                    </button>
                  ))}
                </div>
                <p className="popover-hint">OpenResume Builder v{formatVersion(appVersion)}</p>
                <button className="popover-action" disabled={updateChecking} onClick={checkForUpdates}>
                  {updateChecking ? 'Checking…' : 'Check for Updates'}
                </button>
                {updateMessage && <p className="popover-hint">{updateMessage}</p>}
                <button className="popover-action danger" onClick={resetResume}>Reset resume to blank</button>
              </div>
            )}
          </div>

          <div className="toolbar-group">
            <button
              className="profile-switch-btn"
              title="Switch resume profile"
              onClick={() => { setShowProfiles((v) => !v); setShowSettings(false); setShowSnapshots(false); setShowExport(false); }}
            >
              📄 {activeProfile ? activeProfile.name : 'Resume'} ▾
            </button>
            {showProfiles && (
              <div className="popover profiles-popover">
                <div className="popover-header">
                  <strong>Resume profiles</strong>
                  <button className="popover-close" onClick={() => setShowProfiles(false)}>×</button>
                </div>
                <ul className="profile-list">
                  {profileIndex.profiles.map((p) => (
                    <li key={p.id}>
                      <button
                        className={`profile-item${p.id === activeId ? ' active' : ''}`}
                        onClick={() => switchProfile(p.id)}
                      >
                        <span className="profile-item-name">{p.name}</span>
                        <span className="profile-item-meta">
                          {p.id === activeId ? 'current · ' : ''}updated {new Date(p.updatedAt).toLocaleString()}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="profile-actions">
                  <button className="popover-action" onClick={newProfile}>New</button>
                  <button className="popover-action" onClick={duplicateProfile}>Duplicate</button>
                  <button className="popover-action" onClick={renameActiveProfile}>Rename</button>
                  <button
                    className="popover-action danger"
                    disabled={profileIndex.profiles.length <= 1}
                    onClick={deleteActiveProfile}
                  >
                    Delete
                  </button>
                </div>
                <p className="popover-hint">Duplicate to tailor a copy for a specific job.</p>
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

            <div className="toolbar-group">
              <button onClick={() => { setShowExport((v) => !v); setShowSettings(false); setShowSnapshots(false); }}>
                Export ▾
              </button>
              {showExport && (
                <div className="popover export-popover">
                  <div className="popover-header">
                    <strong>Export resume</strong>
                    <button className="popover-close" onClick={() => setShowExport(false)}>×</button>
                  </div>
                  <button className="popover-action" onClick={exportPDF}>PDF (.pdf)</button>
                  <button className="popover-action" onClick={exportDOCX}>Word (.docx)</button>
                  <button className="popover-action" onClick={exportTXT}>Plain text (.txt)</button>
                  <p className="popover-hint">Plain text is the most ATS-safe format.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="toolbar-row">
          <div className="toolbar-group">
            <button className="icon-btn" title="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo}>↶</button>
            <button className="icon-btn" title="Redo (Ctrl+Y)" onClick={redo} disabled={!canRedo}>↷</button>
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
