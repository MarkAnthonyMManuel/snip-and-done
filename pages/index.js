import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { supabase } from '../lib/supabase';
import {
    Search, Plus, Copy, Settings as SettingsIcon,
    LayoutDashboard, Bookmark, Trash2, Save, Edit3,
    Sun, Moon, Download, Upload,
    LogOut, Mail, Lock, Eye, EyeOff, ChevronLeft, ChevronRight, CheckCircle, X
} from 'lucide-react';

/** Extract unique variables from {{ var }} tokens */
function extractVars(text) {
    const matches = text?.match(/{{\s*([^}]+?)\s*}}/g) ?? [];
    const vars = matches.map(m => m.replace(/{{|}}/g, '').trim());
    return Array.from(new Set(vars));
}

/** Apply variable values; missing becomes [var] */
function applyVars(text, values) {
    return String(text ?? '').replace(/{{\s*([^}]+?)\s*}}/g, (_m, rawKey) => {
        const key = String(rawKey).trim();
        const v = (values?.[key] ?? '').trim();
        return v !== '' ? v : `[${key}]`;
    });
}

function safeParseJSON(raw) {
    try {
        return { ok: true, value: JSON.parse(raw) };
    } catch {
        return { ok: false, error: 'Invalid JSON file.' };
    }
}

export default function CannedNotesApp() {
    const [mounted, setMounted] = useState(false);

    const [user, setUser] = useState(null);
    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const [view, setView] = useState('notes'); // 'notes' | 'pinned' | 'settings'
    const [notes, setNotes] = useState([]);
    const [search, setSearch] = useState('');

    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [editingNote, setEditingNote] = useState(null);

    const [activeNoteForVars, setActiveNoteForVars] = useState(null); // { ...note, vars: [] }
    const [varValues, setVarValues] = useState({});

    const [signature, setSignature] = useState('');
    const [isDark, setIsDark] = useState(false);

    const [showToast, setShowToast] = useState(false);
    const toastTimer = useRef(null);

    const [isSavingSig, setIsSavingSig] = useState(false);
    const [isSavingNote, setIsSavingNote] = useState(false);

    const [isQuickEmailOpen, setIsQuickEmailOpen] = useState(false);
    const [quickCustomerName, setQuickCustomerName] = useState('');
    const [quickBody, setQuickBody] = useState('');
    const openQuickEmail = () => {
        setQuickCustomerName('');
        setQuickBody('');
        setIsQuickEmailOpen(true);
    };

    const closeQuickEmail = () => {
        setIsQuickEmailOpen(false);
        setQuickCustomerName('');
        setQuickBody('');
    };

    const buildQuickEmailText = () => {
        const name = quickCustomerName.trim() || 'Customer';
        const body = quickBody.trim();

        // exact requirement: "Hi {{Customer Name}}," + signature attached
        // we’ll replace placeholder with typed name at copy-time
        const greeting = `Hi ${name},`;

        return `${greeting}\n\n${body}\n\n${signature}`.trim();
    };

    const copyQuickEmail = async () => {
        const full = buildQuickEmailText();
        await navigator.clipboard.writeText(full);

        setShowToast(true);
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setShowToast(false), 2000);

        closeQuickEmail();
    };
    // ---------------- INIT ----------------
    useEffect(() => {
        setMounted(true);

        const localDark = localStorage.getItem('dark_mode') === 'true';
        setIsDark(localDark);

        supabase.auth.getSession().then(({ data, error }) => {
            if (!error) setUser(data.session?.user ?? null);
        });

        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => {
            listener.subscription.unsubscribe();
            if (toastTimer.current) window.clearTimeout(toastTimer.current);
        };
    }, []);

    useEffect(() => {
        if (!user?.id) return;
        void fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    const fetchData = async () => {
        if (!user?.id) return;

        const { data: allNotes, error: notesErr } = await supabase
            .from('notes')
            .select('*')
            .eq('user_id', user.id)
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false });

        if (notesErr) {
            console.error(notesErr);
            alert(`Failed to load notes: ${notesErr.message}`);
            return;
        }

        const { data: sigData, error: sigErr } = await supabase
            .from('signatures')
            .select('content')
            .eq('user_id', user.id)
            .maybeSingle();

        if (sigErr) console.error(sigErr);

        setNotes(allNotes ?? []);
        setSignature(sigData?.content ?? '');
    };

    // ---------------- AUTH ----------------
    const handleLogin = async (e) => {
        e.preventDefault();
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) alert(error.message);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setNotes([]);
        setSignature('');
        setView('notes');
    };

    // ---------------- THEME ----------------
    const toggleDarkMode = () => {
        const newDark = !isDark;
        setIsDark(newDark);
        localStorage.setItem('dark_mode', String(newDark));
    };

    // ---------------- EXPORT / IMPORT ----------------
    const exportData = () => {
        const payload = {
            exported_at: new Date().toISOString(),
            notes,
            signature,
        };
        const dataStr = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
        const a = document.createElement('a');
        a.href = dataStr;
        a.download = `snip_done_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    };

    const importData = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !user?.id) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const raw = String(event.target?.result ?? '');
            const parsed = safeParseJSON(raw);
            if (!parsed.ok) return alert(parsed.error);

            const incomingNotes = Array.isArray(parsed.value?.notes) ? parsed.value.notes : parsed.value;
            if (!Array.isArray(incomingNotes)) return alert('Backup format not recognized.');

            const cleanNotes = incomingNotes
                .filter((n) => n && typeof n.title === 'string' && typeof n.content === 'string')
                .map((n) => {
                    const tags = Array.isArray(n.tags) ? n.tags.map((t) => String(t).trim()).filter(Boolean) : [];
                    return {
                        title: n.title,
                        content: n.content,
                        tags,
                        is_pinned: Boolean(n.is_pinned),
                        usage_count: typeof n.usage_count === 'number' ? n.usage_count : 0,
                        user_id: user.id,
                    };
                });

            if (cleanNotes.length === 0) return alert('No valid notes found in backup.');

            const { error } = await supabase.from('notes').insert(cleanNotes);
            if (error) {
                console.error(error);
                return alert(`Import failed: ${error.message}`);
            }

            const sig = typeof parsed.value?.signature === 'string' ? parsed.value.signature : null;
            if (sig !== null) {
                await supabase
                    .from('signatures')
                    .upsert({ user_id: user.id, content: sig }, { onConflict: 'user_id' });
            }

            await fetchData();
            alert('Backup restored! 🍊');
            e.target.value = '';
        };

        reader.readAsText(file);
    };

    // ---------------- NOTES CRUD ----------------
    const openNewNote = () => {
        setEditingNote(null);
        setIsDrawerOpen(true);
    };

    const openEditNote = (note) => {
        setEditingNote(note);
        setIsDrawerOpen(true);
    };

    const closeDrawer = () => {
        setIsDrawerOpen(false);
        setEditingNote(null);
    };

    const handleSaveNote = async (e) => {
        e.preventDefault();
        if (!user?.id) return;

        setIsSavingNote(true);

        const formData = new FormData(e.currentTarget);
        const title = String(formData.get('title') ?? '').trim();
        const content = String(formData.get('content') ?? '');
        const tagsRaw = String(formData.get('tags') ?? '');

        const noteData = {
            title,
            content,
            tags: tagsRaw.split(',').map(t => t.trim()).filter(Boolean),
            user_id: user.id,
        };

        try {
            if (!title) {
                alert('Title is required.');
                return;
            }

            if (editingNote) {
                const { error } = await supabase
                    .from('notes')
                    .update(noteData)
                    .eq('id', editingNote.id)
                    .eq('user_id', user.id);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('notes')
                    .insert([{ ...noteData, is_pinned: false, usage_count: 0 }]);

                if (error) throw error;
            }

            closeDrawer();
            await fetchData();
        } catch (err) {
            console.error(err);
            alert(`Save failed: ${err?.message ?? 'Unknown error'}`);
        } finally {
            setIsSavingNote(false);
        }
    };

    const togglePin = async (note) => {
        const { error } = await supabase
            .from('notes')
            .update({ is_pinned: !note.is_pinned })
            .eq('id', note.id)
            .eq('user_id', user.id);

        if (error) return alert(`Pin failed: ${error.message}`);
        await fetchData();
    };

    const deleteNote = async (note) => {
        if (!confirm('Delete this template?')) return;

        const { error } = await supabase
            .from('notes')
            .delete()
            .eq('id', note.id)
            .eq('user_id', user.id);

        if (error) return alert(`Delete failed: ${error.message}`);
        await fetchData();
    };

    // ---------------- COPY FLOW ----------------
    const handleCopyRequest = (note) => {
        const vars = extractVars(note.content);
        if (vars.length > 0) {
            setActiveNoteForVars({ ...note, vars });
            setVarValues({});
        } else {
            void finalizeCopy(note.id, note.content, note.usage_count ?? 0);
        }
    };

    const finalizeCopy = async (noteId, text, currentCount) => {
        if (!user?.id) return;

        const processed = applyVars(text, varValues);
        await navigator.clipboard.writeText(`${processed}\n\n${signature}`.trim());

        const { error } = await supabase
            .from('notes')
            .update({ usage_count: (currentCount ?? 0) + 1 })
            .eq('id', noteId)
            .eq('user_id', user.id);

        if (error) console.error(error);

        setShowToast(true);
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setShowToast(false), 2000);

        setActiveNoteForVars(null);
        setVarValues({});
        await fetchData();
    };

    // ---------------- DERIVED LIST ----------------
    const filteredNotes = useMemo(() => {
        const q = search.trim().toLowerCase();

        return notes
            .filter((n) => (view === 'pinned' ? n.is_pinned : true))
            .filter((n) => {
                if (!q) return true;
                const hay = [n.title ?? '', n.content ?? '', ...(n.tags ?? [])].join(' ').toLowerCase();
                return hay.includes(q);
            });
    }, [notes, search, view]);

    if (!mounted) return null;

    // ---------------- AUTH VIEW ----------------
    if (!user) {
        return (
            <div className={`auth-page ${isDark ? 'dark' : ''}`}>
                <div className="auth-card">
                    <div className="auth-header">
                        <div className="auth-logo">SNIP<span>&</span>DONE</div>
                        <h1>Agent Login</h1>
                        <p>Access your templates</p>
                    </div>

                    <form className="auth-form" onSubmit={handleLogin}>
                        <div className="field">
                            <label><Mail size={14} /> Email Address</label>
                            <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required />
                        </div>

                        <div className="field">
                            <label><Lock size={14} /> Password</label>
                            <div className="password-wrapper">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={authPassword}
                                    onChange={(e) => setAuthPassword(e.target.value)}
                                    required
                                />
                                <button type="button" className="eye-btn" onClick={() => setShowPassword(!showPassword)}>
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="login-submit-btn">Sign In</button>
                    </form>
                </div>

                <style jsx>{`
          .auth-page { min-height: 100vh; display:flex; align-items:center; justify-content:center; background: var(--bg); padding: 40px 20px; box-sizing:border-box; }
          .auth-card { background: var(--side); padding: 50px 40px; border-radius: 32px; width: 100%; max-width: 400px; border: 1px solid var(--border); text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
          .auth-logo { font-size: 28px; font-weight: 900; margin-bottom: 8px; font-style: italic; }
          .auth-logo span { color: #f97316; }
          .auth-form { display:flex; flex-direction:column; gap: 20px; text-align:left; margin-top: 30px; }
          .field label { display:block; font-size: 11px; font-weight: 700; color: #f97316; text-transform: uppercase; margin-bottom: 8px; }
          .field input { width: 100%; padding: 14px; border-radius: 12px; border: 2px solid var(--border); background: var(--in); color: var(--text); outline:none; box-sizing:border-box; }
          .password-wrapper { position: relative; }
          .eye-btn { position: absolute; right: 12px; top: 12px; background: none; border: none; color: var(--dim); cursor: pointer; }
          .login-submit-btn { background:#f97316; color:white; border:none; padding: 16px; border-radius: 14px; font-weight: 700; cursor:pointer; margin-top: 10px; }
        `}</style>
            </div>
        );
    }

    // ---------------- MAIN APP ----------------
    return (
        <div className={`app-wrapper ${isDark ? 'dark' : ''}`}>
            <Head><title>Snip & Done</title></Head>

            <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
                <div className="sidebar-top">
                    <div className="logo-container">
                        <div className="logo">{isSidebarCollapsed ? <span>S</span> : <>SNIP<span>&</span>DONE</>}</div>
                        <button className="collapse-toggle" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
                            {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                        </button>
                    </div>

                    <nav className="nav-group">
                        <button className={`nav-btn ${view === 'notes' ? 'active' : ''}`} onClick={() => setView('notes')}>
                            <div className="nav-icon-box"><LayoutDashboard size={18} /></div>
                            {!isSidebarCollapsed && <span>Library</span>}
                        </button>

                        <button className={`nav-btn ${view === 'pinned' ? 'active' : ''}`} onClick={() => setView('pinned')}>
                            <div className="nav-icon-box"><Bookmark size={18} /></div>
                            {!isSidebarCollapsed && <span>Favorites</span>}
                        </button>

                        <button className={`nav-btn ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>
                            <div className="nav-icon-box"><SettingsIcon size={18} /></div>
                            {!isSidebarCollapsed && <span>Settings</span>}
                        </button>

                        <div className="nav-divider" />

                        <button className="nav-btn" onClick={toggleDarkMode}>
                            <div className="nav-icon-box">{isDark ? <Sun size={18} /> : <Moon size={18} />}</div>
                            {!isSidebarCollapsed && <span>Theme</span>}
                        </button>

                        <button className="nav-btn logout-red" onClick={handleLogout}>
                            <div className="nav-icon-box"><LogOut size={18} /></div>
                            {!isSidebarCollapsed && <span>Sign Out</span>}
                        </button>
                    </nav>
                </div>
            </aside>

            <main className={`main-content ${isSidebarCollapsed ? 'expanded' : ''}`}>
                {view === 'settings' ? (
                    <div className="view-animate">
                        <h1 className="view-title">Settings</h1>

                        <div className="settings-card">
                            <div className="setting-item">
                                <label className="field-label">Universal Signature</label>
                                <textarea
                                    className="sig-textarea"
                                    value={signature}
                                    onChange={(e) => setSignature(e.target.value)}
                                    rows={6}
                                />

                                <button
                                    className="primary-btn"
                                    disabled={isSavingSig}
                                    onClick={async () => {
                                        setIsSavingSig(true);
                                        const { error } = await supabase
                                            .from('signatures')
                                            .upsert({ user_id: user.id, content: signature }, { onConflict: 'user_id' });
                                        setIsSavingSig(false);
                                        if (error) return alert(`Signature save failed: ${error.message}`);
                                        alert('Signature saved!');
                                    }}
                                >
                                    <Save size={18} /> {isSavingSig ? 'Saving...' : 'Save Signature'}
                                </button>
                            </div>

                            <div className="setting-item border-top">
                                <label className="field-label">Backup & Recovery</label>
                                <div className="action-row">
                                    <button className="outline-btn" onClick={exportData}><Download size={18} /> Export JSON</button>
                                    <label className="outline-btn cursor-pointer">
                                        <Upload size={18} /> Import Backup
                                        <input type="file" hidden accept=".json" onChange={importData} />
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="view-animate">
                        <header className="main-header">
                            <h1 className="view-title">{view.toUpperCase()} <span className="orange-text">SNIPPETS</span></h1>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                <button className="outline-btn" onClick={openQuickEmail}>
                                    <Mail size={18} /> Quick Email
                                </button>

                                <button className="primary-btn" onClick={openNewNote}>
                                    <Plus size={20} /> New Template
                                </button>
                            </div>
                        </header>

                        <div className="search-box">
                            <Search className="search-icon" size={20} />
                            <input
                                className="search-input"
                                placeholder="Search title, content, tags..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <div className="notes-grid">
                            {filteredNotes.map(note => (
                                <div key={note.id} className={`note-card ${note.is_pinned ? 'pinned' : ''}`}>
                                    <div className="card-top">
                                        <h3>{note.title}</h3>
                                        <div className="card-actions">
                                            <button onClick={() => togglePin(note)} className={note.is_pinned ? 'orange-text' : ''} title="Toggle favorite">
                                                <Bookmark size={16} />
                                            </button>

                                            <button onClick={() => openEditNote(note)} title="Edit">
                                                <Edit3 size={16} />
                                            </button>

                                            <button onClick={() => deleteNote(note)} className="text-red" title="Delete">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <p className="card-body">{note.content}</p>

                                    <div className="card-bottom">
                                        <div className="tag-list">
                                            {(note.tags ?? []).map(t => <span key={t} className="tag-chip">{t}</span>)}
                                        </div>
                                        <button className="copy-action-btn" onClick={() => handleCopyRequest(note)}>
                                            <Copy size={16} /> Copy
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {/* VARIABLES MODAL */}
            {activeNoteForVars && (
                <div className="overlay" onClick={() => { setActiveNoteForVars(null); setVarValues({}); }}>
                    <div className="variable-modal" onClick={(e) => e.stopPropagation()}>
                        <h2 style={{ marginTop: 0 }}>Complete Variables</h2>
                        {activeNoteForVars.vars.map((v, i) => (
                            <div key={v} className="field">
                                <label>{v}</label>
                                <input
                                    autoFocus={i === 0}
                                    value={varValues[v] ?? ''}
                                    onChange={(e) => setVarValues(prev => ({ ...prev, [v]: e.target.value }))}
                                />
                            </div>
                        ))}
                        <button
                            className="primary-btn wide"
                            onClick={() => finalizeCopy(activeNoteForVars.id, activeNoteForVars.content, activeNoteForVars.usage_count ?? 0)}
                        >
                            Finalize & Copy
                        </button>
                    </div>
                </div>
            )}

            {/* NOTE DRAWER */}
            {isDrawerOpen && (
                <div className="overlay" onClick={closeDrawer}>
                    <div className="variable-modal" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                            <h2 style={{ margin: 0 }}>{editingNote ? 'Edit Template' : 'New Template'}</h2>
                            <button className="icon-btn" onClick={closeDrawer} type="button" title="Close">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveNote} style={{ marginTop: 12 }}>
                            <div className="field">
                                <label>Title</label>
                                <input name="title" defaultValue={editingNote?.title ?? ''} required />
                            </div>

                            <div className="field">
                                <label>Tags (comma separated)</label>
                                <input
                                    name="tags"
                                    defaultValue={(editingNote?.tags ?? []).join(', ')}
                                    placeholder="e.g. onboarding, billing, follow-up"
                                />
                            </div>

                            <div className="field">
                                <label>Content</label>
                                <textarea
                                    name="content"
                                    rows={10}
                                    defaultValue={editingNote?.content ?? ''}
                                    placeholder="Use variables like {{customer_name}}"
                                    required
                                />
                            </div>

                            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                                <button type="button" className="outline-btn" onClick={closeDrawer}>Cancel</button>
                                <button type="submit" className="primary-btn" disabled={isSavingNote}>
                                    <Save size={18} /> {isSavingNote ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* QUICK EMAIL MODAL */}
            {isQuickEmailOpen && (
                <div className="overlay" onClick={closeQuickEmail}>
                    <div className="variable-modal" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                            <h2 style={{ margin: 0 }}>Quick Email</h2>
                            <button className="icon-btn" onClick={closeQuickEmail} type="button" title="Close">
                                <X size={18} />
                            </button>
                        </div>

                        <div style={{ marginTop: 12 }}>
                            <div className="field">
                                <label>Customer Name</label>
                                <input
                                    value={quickCustomerName}
                                    onChange={(e) => setQuickCustomerName(e.target.value)}
                                    placeholder="e.g. John"
                                />
                            </div>

                            <div className="field">
                                <label>Email Body</label>
                                <textarea
                                    rows={10}
                                    value={quickBody}
                                    onChange={(e) => setQuickBody(e.target.value)}
                                    placeholder="Type your email message here..."
                                />
                            </div>

                            <div className="field">
                                <label>Preview</label>
                                <textarea rows={8} value={buildQuickEmailText()} readOnly />
                            </div>

                            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                                <button type="button" className="outline-btn" onClick={closeQuickEmail}>
                                    Cancel
                                </button>

                                <button type="button" className="primary-btn" onClick={copyQuickEmail}>
                                    <Copy size={18} /> Copy Full Email
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* TOAST */}
            {showToast && <div className="toast"><CheckCircle size={16} /> Copied to clipboard! 🍊</div>}

            <style jsx global>{`
        :root { --bg: #fffaf5; --side: #ffffff; --card: #ffffff; --text: #2d3748; --dim: #718096; --border: #edf2f7; --in: #ffffff; }
        .dark { --bg: #0b0e14; --side: #151921; --card: #1c212c; --text: #e2e8f0; --dim: #94a3b8; --border: #2d3748; --in: #0b0e14; }
        body { margin: 0; font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); }

        .sidebar { width: 260px; height: 100vh; position: fixed; background: var(--side); border-right: 1px solid var(--border); padding: 25px; transition: 0.3s; z-index: 100; }
        .sidebar.collapsed { width: 80px; padding: 25px 10px; }

        .logo-container { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom: 40px; }
        .logo { font-weight: 900; font-size: 22px; color: #f97316; font-style: italic; }
        .logo span { color: #111827; }
        .dark .logo span { color: #e2e8f0; }

        .collapse-toggle { border:none; background:transparent; cursor:pointer; color: var(--dim); padding: 8px; border-radius: 10px; }
        .nav-group { display: flex; flex-direction: column; gap: 10px; }
        .nav-divider { height:1px; background: var(--border); margin: 8px 0; }

        .nav-btn { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px; border: none; background: transparent; border-radius: 12px; cursor: pointer; color: var(--dim); font-weight: 700; }
        .nav-btn.active { color: white; background: #f97316; }
        .logout-red { color: #ef4444; margin-top: 20px; }

        .main-content { margin-left: 260px; padding: 60px; transition: 0.3s; }
        .main-content.expanded { margin-left: 80px; }

        .main-header { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom: 18px; }
        .view-title { margin: 0; font-size: 28px; letter-spacing: 0.5px; }
        .orange-text { color:#f97316; }

        .primary-btn { background: #f97316; color: white; border: none; padding: 12px 16px; border-radius: 14px; font-weight: 800; cursor: pointer; display:flex; align-items:center; gap:10px; }
        .primary-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .outline-btn { border: 2px solid var(--border); background: transparent; color: var(--text); padding: 12px 16px; border-radius: 14px; font-weight: 800; cursor: pointer; display:flex; align-items:center; gap:10px; }
        .cursor-pointer { cursor: pointer; }

        .icon-btn { border: 1px solid var(--border); background: transparent; color: var(--text); width: 36px; height: 36px; border-radius: 12px; cursor: pointer; display:flex; align-items:center; justify-content:center; }

        .search-box { position: relative; margin: 18px 0 26px; }
        .search-icon { position:absolute; left: 14px; top: 12px; color: var(--dim); }
        .search-input { width:100%; padding: 12px 14px 12px 44px; border-radius: 14px; border: 2px solid var(--border); background: var(--in); color: var(--text); outline:none; }

        .notes-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 18px; }
        .note-card { background: var(--card); border: 1px solid var(--border); padding: 20px; border-radius: 24px; position: relative; }
        .note-card.pinned { border-top: 5px solid #f97316; }

        .card-top { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
        .card-actions { display:flex; gap: 8px; }
        .card-actions button { border:none; background:transparent; cursor:pointer; color: var(--dim); padding: 6px; border-radius: 10px; }
        .card-actions .text-red { color:#ef4444; }
        .card-actions .orange-text { color:#f97316; }

        .card-body { margin: 12px 0 16px; color: var(--dim); white-space: pre-wrap; overflow:hidden; display:-webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; }
        .card-bottom { display:flex; align-items:center; justify-content:space-between; gap:12px; }

        .tag-list { display:flex; flex-wrap:wrap; gap: 8px; }
        .tag-chip { font-size: 11px; padding: 6px 10px; border-radius: 999px; border: 1px solid var(--border); color: var(--dim); }

        .copy-action-btn { background: #f97316; color: white; border: none; padding: 10px 14px; border-radius: 12px; font-weight: 800; cursor: pointer; display:flex; align-items:center; gap:10px; }

        .toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: #10b981; color: white; padding: 12px 24px; border-radius: 50px; display: flex; align-items: center; gap: 10px; font-weight: 800; animation: slideUp 0.25s; z-index: 2000; }
        @keyframes slideUp { from { opacity: 0; transform: translate(-50%, 18px); } to { opacity: 1; transform: translate(-50%, 0); } }

        .overlay { position:fixed; inset:0; background: rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; z-index: 1500; padding: 20px; }

        .variable-modal { width: 100%; max-width: 520px; background: var(--card); border: 1px solid var(--border); border-radius: 24px; padding: 22px; }
        .variable-modal h2 { margin: 0 0 14px; }
        .field { margin-bottom: 12px; }
        .field label { display:block; font-size: 12px; font-weight: 800; color:#f97316; margin-bottom: 6px; }
        .variable-modal input, .variable-modal textarea {
          width:100%;
          padding: 12px;
          border-radius: 14px;
          border: 2px solid var(--border);
          background: var(--in);
          color: var(--text);
          outline:none;
          box-sizing:border-box;
          font-family: inherit;
        }
        .variable-modal textarea { resize: vertical; }
        .wide { width:100%; justify-content:center; }

        .settings-card { background: var(--card); border: 1px solid var(--border); border-radius: 24px; padding: 18px; max-width: 760px; }
        .setting-item { padding: 14px 6px; }
        .border-top { border-top: 1px solid var(--border); margin-top: 14px; padding-top: 18px; }
        .field-label { display:block; font-size: 12px; font-weight: 900; margin-bottom: 10px; }
        .sig-textarea { width:100%; padding: 12px; border-radius: 14px; border: 2px solid var(--border); background: var(--in); color: var(--text); outline:none; resize: vertical; box-sizing:border-box; }
        .action-row { display:flex; flex-wrap:wrap; gap: 12px; }
      `}</style>
        </div>
    );
}