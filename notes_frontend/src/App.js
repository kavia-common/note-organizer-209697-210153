import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import { api, getToken, setToken } from "./apiClient";

function LoadingLine({ text }) {
  return <div className="muted">{text}</div>;
}

function ErrorBox({ error, onDismiss }) {
  if (!error) return null;
  return (
    <div className="errorBox" role="alert">
      <div className="errorTitle">Error</div>
      <div className="errorMessage">{String(error.message || error)}</div>
      {onDismiss ? (
        <button className="btn btnGhost" onClick={onDismiss}>
          Dismiss
        </button>
      ) : null}
    </div>
  );
}

function AuthCard({ mode, onModeChange, onAuthed }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "register") {
        await api.register({ email, password });
      }
      const tok = await api.login({ email, password });
      setToken(tok.access_token);
      await onAuthed();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card authCard">
      <div className="cardHeader">
        <div>
          <div className="brand">Retro Notes</div>
          <div className="subtitle">Sign in to organize your thoughts.</div>
        </div>
        <div className="segmented" role="tablist" aria-label="Auth mode">
          <button
            className={`segBtn ${mode === "login" ? "active" : ""}`}
            onClick={() => onModeChange("login")}
            type="button"
          >
            Login
          </button>
          <button
            className={`segBtn ${mode === "register" ? "active" : ""}`}
            onClick={() => onModeChange("register")}
            type="button"
          >
            Register
          </button>
        </div>
      </div>

      <ErrorBox error={error} onDismiss={() => setError(null)} />

      <form onSubmit={submit} className="form">
        <label className="label">
          Email
          <input
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@domain.com"
            required
          />
        </label>

        <label className="label">
          Password
          <input
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            placeholder="••••••••"
            type="password"
            required
            minLength={6}
          />
        </label>

        <button className="btn btnPrimary" type="submit" disabled={busy}>
          {busy ? "Working..." : mode === "register" ? "Create account" : "Login"}
        </button>

        <div className="hint">
          Tip: after login → create folder → create note → edit → delete.
        </div>
      </form>
    </div>
  );
}

// PUBLIC_INTERFACE
function App() {
  /** Main application component for Notes UI. */
  const [authMode, setAuthMode] = useState("login");
  const [me, setMe] = useState(null);

  const [folders, setFolders] = useState([]);
  const [activeFolderId, setActiveFolderId] = useState(null);

  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeNoteId) || null,
    [notes, activeNoteId]
  );

  async function loadAll() {
    setError(null);
    setBusy(true);
    try {
      const user = await api.me();
      setMe(user);

      const fs = await api.listFolders();
      setFolders(fs);

      // Preserve folder selection if possible
      const folderToUse =
        activeFolderId && fs.some((f) => f.id === activeFolderId) ? activeFolderId : null;
      setActiveFolderId(folderToUse);

      const ns = await api.listNotes(folderToUse || undefined);
      setNotes(ns);
      setActiveNoteId((prev) => (ns.some((n) => n.id === prev) ? prev : (ns[0]?.id ?? null)));
    } catch (err) {
      setError(err);
      // Token might be invalid; force logout on 401
      if (err && err.status === 401) {
        setToken(null);
        setMe(null);
      }
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (getToken()) {
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function logout() {
    setToken(null);
    setMe(null);
    setFolders([]);
    setNotes([]);
    setActiveFolderId(null);
    setActiveNoteId(null);
  }

  async function createFolder() {
    const name = prompt("Folder name?");
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const f = await api.createFolder({ name });
      const nextFolders = [...folders, f];
      setFolders(nextFolders);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function deleteFolder(folderId) {
    if (!window.confirm("Delete this folder? Notes will be moved to 'All Notes'."))
      return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteFolder(folderId);
      const nextFolders = folders.filter((f) => f.id !== folderId);
      setFolders(nextFolders);
      if (activeFolderId === folderId) setActiveFolderId(null);
      await loadAll();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function selectFolder(folderId) {
    setActiveFolderId(folderId);
    setBusy(true);
    setError(null);
    try {
      const ns = await api.listNotes(folderId || undefined);
      setNotes(ns);
      setActiveNoteId(ns[0]?.id ?? null);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function createNote() {
    setBusy(true);
    setError(null);
    try {
      const n = await api.createNote({
        folder_id: activeFolderId,
        title: "Untitled",
        content: "",
      });
      const nextNotes = [n, ...notes];
      setNotes(nextNotes);
      setActiveNoteId(n.id);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function deleteNote(noteId) {
    if (!window.confirm("Delete this note?")) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteNote(noteId);
      const next = notes.filter((n) => n.id !== noteId);
      setNotes(next);
      setActiveNoteId(next[0]?.id ?? null);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function saveNoteEdits({ title, content }) {
    if (!activeNote) return;
    setError(null);
    try {
      const updated = await api.updateNote(activeNote.id, { title, content });
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    } catch (err) {
      setError(err);
    }
  }

  if (!me) {
    return (
      <div className="appShell">
        <div className="bgGrid" />
        <div className="center">
          <AuthCard
            mode={authMode}
            onModeChange={setAuthMode}
            onAuthed={loadAll}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="appShell">
      <div className="bgGrid" />
      <div className="topbar">
        <div className="brandRow">
          <div className="brand">Retro Notes</div>
          <div className="pill">Signed in as {me.email}</div>
        </div>
        <div className="topbarActions">
          <button className="btn btnGhost" onClick={loadAll} disabled={busy}>
            Refresh
          </button>
          <button className="btn btnDanger" onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      <div className="layout">
        <aside className="sidebar">
          <div className="sidebarHeader">
            <div className="sidebarTitle">Folders</div>
            <button className="btn btnPrimary btnSmall" onClick={createFolder} disabled={busy}>
              + New
            </button>
          </div>

          <div className="folderList">
            <button
              className={`folderItem ${activeFolderId === null ? "active" : ""}`}
              onClick={() => selectFolder(null)}
            >
              <span className="folderDot" />
              All Notes
            </button>

            {folders.map((f) => (
              <div key={f.id} className={`folderRow ${activeFolderId === f.id ? "active" : ""}`}>
                <button className="folderItem" onClick={() => selectFolder(f.id)}>
                  <span className="folderDot" />
                  {f.name}
                </button>
                <button
                  className="iconBtn"
                  title="Delete folder"
                  onClick={() => deleteFolder(f.id)}
                  disabled={busy}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="sidebarFooter">
            {busy ? <LoadingLine text="Syncing..." /> : <div className="muted">Ready.</div>}
          </div>
        </aside>

        <main className="main">
          <div className="mainHeader">
            <div>
              <div className="sectionTitle">Notes</div>
              <div className="muted">
                {activeFolderId ? "Filtered by folder" : "All notes"} • {notes.length} total
              </div>
            </div>
            <div className="mainActions">
              <button className="btn btnPrimary" onClick={createNote} disabled={busy}>
                + New Note
              </button>
              {activeNote ? (
                <button className="btn btnDanger" onClick={() => deleteNote(activeNote.id)} disabled={busy}>
                  Delete
                </button>
              ) : null}
            </div>
          </div>

          <ErrorBox error={error} onDismiss={() => setError(null)} />

          <div className="contentSplit">
            <div className="notesList">
              {notes.length === 0 ? (
                <div className="empty">
                  No notes yet. Create one to get started.
                </div>
              ) : (
                notes.map((n) => (
                  <button
                    key={n.id}
                    className={`noteCard ${n.id === activeNoteId ? "active" : ""}`}
                    onClick={() => setActiveNoteId(n.id)}
                  >
                    <div className="noteTitle">{n.title || "Untitled"}</div>
                    <div className="notePreview">
                      {(n.content || "").slice(0, 80) || "—"}
                    </div>
                    <div className="noteMeta">
                      Updated {new Date(n.updated_at).toLocaleString()}
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="editor">
              {!activeNote ? (
                <div className="empty">Select a note to edit.</div>
              ) : (
                <NoteEditor note={activeNote} onSave={saveNoteEdits} />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function NoteEditor({ note, onSave }) {
  const [title, setTitle] = useState(note.title || "");
  const [content, setContent] = useState(note.content || "");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(note.title || "");
    setContent(note.content || "");
    setDirty(false);
  }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setSaving(true);
    try {
      await onSave({ title, content });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="editorInner">
      <div className="editorRow">
        <input
          className="input inputTitle"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setDirty(true);
          }}
          placeholder="Title"
        />
        <button className="btn btnGhost" onClick={save} disabled={!dirty || saving}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
      <textarea
        className="textarea"
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setDirty(true);
        }}
        placeholder="Write your note..."
      />
      <div className="muted small">
        Created {new Date(note.created_at).toLocaleString()} • Updated{" "}
        {new Date(note.updated_at).toLocaleString()}
      </div>
    </div>
  );
}

export default App;
