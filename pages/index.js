import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { supabase } from '../lib/supabase';
import {
    Search, Plus, Copy, Tag, Settings as SettingsIcon,
    LayoutDashboard, Bookmark, Trash2, X, Save, Edit3, Clock, Sun, Moon, RotateCcw, Download, Upload
} from 'lucide-react';

export default function CannedNotesApp() {
    // --- STATE MANAGEMENT ---
    const [mounted, setMounted] = useState(false);
    const [view, setView] = useState('notes');
    const [notes, setNotes] = useState([]);
    const [frequentNotes, setFrequentNotes] = useState([]);
    const [search, setSearch] = useState('');
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingNote, setEditingNote] = useState(null);
    const [activeNoteForVars, setActiveNoteForVars] = useState(null);
    const [varValues, setVarValues] = useState({});
    const [signature, setSignature] = useState('');
    const [isDark, setIsDark] = useState(false);

    // --- INITIALIZATION ---
    useEffect(() => {
        setMounted(true);
        const localDark = localStorage.getItem('dark_mode') === 'true';
        setIsDark(localDark);
        fetchData();
    }, []);

    const fetchData = async () => {
        const { data: allNotes } = await supabase.from('notes').select('*').order('is_pinned', { ascending: false });
        const { data: sigData } = await supabase.from('signatures').select('content').single();
        if (allNotes) {
            setNotes(allNotes);
            const topPicks = [...allNotes]
                .filter(n => (n.usage_count || 0) > 0)
                .sort((a, b) => b.usage_count - a.usage_count)
                .slice(0, 3);
            setFrequentNotes(topPicks);
        }
        if (sigData) setSignature(sigData.content);
    };

    // --- BACKUP LOGIC ---
    const exportData = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(notes));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `snip_done_backup_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const importData = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const importedNotes = JSON.parse(event.target.result);
                const cleanNotes = importedNotes.map(({ id, created_at, ...rest }) => rest);
                await supabase.from('notes').insert(cleanNotes);
                fetchData();
                alert("Backup restored! 🍊");
            } catch (err) {
                alert("Invalid JSON file.");
            }
        };
        reader.readAsText(file);
    };

    // --- ACTIONS ---
    const toggleDarkMode = () => {
        const newDark = !isDark;
        setIsDark(newDark);
        localStorage.setItem('dark_mode', newDark);
    };

    const handleCopyRequest = (note) => {
        const vars = note.content.match(/{{(.*?)}}/g)?.map(v => v.replace(/{{|}}/g, '')) || [];
        if (vars.length > 0) {
            setActiveNoteForVars({ ...note, vars });
        } else {
            finalizeCopy(note.id, note.content, note.usage_count);
        }
    };

    const finalizeCopy = async (noteId, text, currentCount) => {
        await supabase.from('notes').update({ usage_count: (currentCount || 0) + 1 }).eq('id', noteId);
        let processed = text;
        Object.entries(varValues).forEach(([k, v]) => {
            processed = processed.replaceAll(`{{${k}}}`, v || `[${k}]`);
        });
        navigator.clipboard.writeText(`${processed}\n\n${signature}`);
        setActiveNoteForVars(null);
        setVarValues({});
        fetchData();
        alert("Copied to clipboard! 🍊");
    };

    const handleSaveNote = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const noteData = {
            title: formData.get('title'),
            content: formData.get('content'),
            tags: formData.get('tags').split(',').map(t => t.trim()).filter(t => t !== ""),
        };

        if (editingNote) {
            await supabase.from('notes').update(noteData).eq('id', editingNote.id);
        } else {
            await supabase.from('notes').insert([{ ...noteData, is_pinned: false, usage_count: 0 }]);
        }
        setEditingNote(null);
        setIsDrawerOpen(false);
        fetchData();
    };

    // --- HYDRATION GUARD ---
    if (!mounted) return null;

    const displayNotes = notes.filter(n => {
        const matchesSearch = n.title.toLowerCase().includes(search.toLowerCase()) ||
            n.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()));
        if (view === 'pinned') return n.is_pinned && matchesSearch;
        return matchesSearch;
    });

    return (
        <div className={`app-wrapper ${isDark ? 'dark' : ''}`}>
            <Head><title>Snip & Done</title></Head>

            <div className="app-container">
                {/* SIDEBAR */}
// ... inside your return statement ...

                <aside className="sidebar">
                    <div className="sidebar-top">
                        <div className="logo">SNIP&DONE</div>
                        <nav className="nav-group">
                            <button className={`nav-btn ${view === 'notes' ? 'active' : ''}`} onClick={() => setView('notes')}>
                                <LayoutDashboard size={18} /> Library
                            </button>
                            <button className={`nav-btn ${view === 'pinned' ? 'active' : ''}`} onClick={() => setView('pinned')}>
                                <Bookmark size={18} /> Favorites
                            </button>
                            <button className={`nav-btn ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>
                                <SettingsIcon size={18} /> Settings
                            </button>
                        </nav>
                    </div>

                    <div className="sidebar-bottom">
                        <button className="theme-toggle" onClick={toggleDarkMode}>
                            {isDark ? <Sun size={18} /> : <Moon size={18} />}
                            <span>{isDark ? 'Light' : 'Dark'} Mode</span>
                        </button>
                    </div>
                </aside>
                {/* MAIN CONTENT */}
                <main className="main-content">
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
                                        rows="6"
                                        placeholder="Best Regards, Mark..."
                                    />
                                    <button className="primary-btn" onClick={async () => {
                                        await supabase.from('signatures').upsert({ id: 1, content: signature });
                                        alert("Signature saved!");
                                    }}><Save size={18} /> Save Signature</button>
                                </div>

                                <div className="setting-item border-top">
                                    <label className="field-label">Backup & Recovery</label>
                                    <p className="dim-text">Keep a local copy of your snippets or restore them from a file.</p>
                                    <div className="action-row">
                                        <button className="outline-btn" onClick={exportData}>
                                            <Download size={18} /> Export JSON
                                        </button>
                                        <label className="outline-btn cursor-pointer">
                                            <Upload size={18} /> Import Backup
                                            <input type="file" hidden accept=".json" onChange={importData} />
                                        </label>
                                    </div>
                                </div>

                                <div className="setting-item border-top">
                                    <label className="field-label">Danger Zone</label>
                                    <button className="outline-btn danger" onClick={async () => {
                                        if (confirm("Reset usage stats?")) {
                                            await supabase.from('notes').update({ usage_count: 0 }).neq('id', 0);
                                            fetchData();
                                        }
                                    }}><RotateCcw size={18} /> Reset All Statistics</button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="view-animate">
                            <header className="main-header">
                                <h1 className="view-title">{view.toUpperCase()} <span className="orange-text">SNIPPETS</span></h1>
                                <button className="primary-btn" onClick={() => { setEditingNote(null); setIsDrawerOpen(true); }}><Plus size={20} /> New Template</button>
                            </header>

                            {view === 'notes' && frequentNotes.length > 0 && !search && (
                                <div className="frequent-container">
                                    <div className="label-row"><Clock size={14} /> Frequently Used</div>
                                    <div className="frequent-grid">
                                        {frequentNotes.map(n => (
                                            <div key={n.id} className="mini-card" onClick={() => handleCopyRequest(n)}>
                                                <span className="mini-title">{n.title}</span>
                                                <span className="mini-badge">{n.usage_count}x</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="search-box">
                                <Search className="search-icon" size={20} />
                                <input className="search-input" placeholder="Search by name or keyword..." onChange={(e) => setSearch(e.target.value)} />
                            </div>

                            <div className="notes-grid">
                                {displayNotes.map(note => (
                                    <div key={note.id} className={`note-card ${note.is_pinned ? 'pinned' : ''}`}>
                                        <div className="card-top">
                                            <div>
                                                <h3>{note.title}</h3>
                                                <span className="card-date">Modified {new Date(note.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <div className="card-actions">
                                                <button onClick={async () => {
                                                    await supabase.from('notes').update({ is_pinned: !note.is_pinned }).eq('id', note.id);
                                                    fetchData();
                                                }} className={note.is_pinned ? 'orange-text' : ''}><Bookmark size={16} /></button>
                                                <button onClick={() => { setEditingNote(note); setIsDrawerOpen(true); }}><Edit3 size={16} /></button>
                                                <button onClick={async () => { if (confirm("Delete?")) { await supabase.from('notes').delete().eq('id', note.id); fetchData(); } }} className="text-red"><Trash2 size={16} /></button>
                                            </div>
                                        </div>
                                        <p className="card-body">{note.content}</p>
                                        <div className="card-bottom">
                                            <div className="tag-list">{note.tags?.map(t => <span key={t} className="tag-chip">{t}</span>)}</div>
                                            <button className="copy-action-btn" onClick={() => handleCopyRequest(note)}><Copy size={16} /> Copy</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* MODALS */}
            {isDrawerOpen && (
                <div className="overlay" onClick={() => setIsDrawerOpen(false)}>
                    <div className="drawer" onClick={e => e.stopPropagation()}>
                        <div className="drawer-header">
                            <h2>{editingNote ? 'Modify Template' : 'New Template'}</h2>
                            <button onClick={() => setIsDrawerOpen(false)}><X /></button>
                        </div>
                        <form onSubmit={handleSaveNote} className="drawer-form">
                            <div className="field">
                                <label>Template Title</label>
                                <input name="title" defaultValue={editingNote?.title} required placeholder="e.g. Greeting" />
                            </div>
                            <div className="field">
                                <label>Content (Use {"{{variable}}"} )</label>
                                <textarea name="content" defaultValue={editingNote?.content} rows="10" required />
                            </div>
                            <div className="field">
                                <label>Tags (commas)</label>
                                <input name="tags" defaultValue={editingNote?.tags?.join(', ')} />
                            </div>
                            <button type="submit" className="primary-btn wide">{editingNote ? 'Save Changes' : 'Create Template'}</button>
                        </form>
                    </div>
                </div>
            )}

            {activeNoteForVars && (
                <div className="overlay">
                    <div className="variable-modal">
                        <h2>Complete Snippet</h2>
                        {activeNoteForVars.vars.map(v => (
                            <div key={v} className="field">
                                <label>{v}</label>
                                <input autoFocus onChange={(e) => setVarValues({ ...varValues, [v]: e.target.value })} />
                            </div>
                        ))}
                        <button className="primary-btn wide" onClick={() => finalizeCopy(activeNoteForVars.id, activeNoteForVars.content, activeNoteForVars.usage_count)}>Finalize & Copy</button>
                        <button className="cancel-btn" onClick={() => setActiveNoteForVars(null)}>Cancel</button>
                    </div>
                </div>
            )}

            <style jsx global>{`
        :root { --bg: #fffaf5; --side: #ffffff; --card: #ffffff; --text: #2d3748; --dim: #718096; --border: #edf2f7; --in: #ffffff; }
        .dark { --bg: #0b0e14; --side: #151921; --card: #1c212c; --text: #e2e8f0; --dim: #94a3b8; --border: #2d3748; --in: #0b0e14; }

        body { margin: 0; font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); }
        .app-container { display: flex; min-height: 100vh; }
        
        /* Sidebar */
        .sidebar { width: 280px; background: var(--side); border-right: 1px solid var(--border); padding: 30px; display: flex; flex-direction: column; position: fixed; height: 100vh; z-index: 100; }
        .logo { font-size: 28px; font-weight: 900; color: #f97316; margin-bottom: 50px; font-style: italic; }
        .nav-btn { display: flex; align-items: center; gap: 12px; width: 100%; padding: 14px 18px; border: none; background: none; font-weight: 700; color: var(--dim); cursor: pointer; border-radius: 14px; margin-bottom: 10px; }
        .nav-btn.active { background: #f97316; color: white; box-shadow: 0 10px 20px -5px rgba(249, 115, 22, 0.4); }
        .theme-toggle { margin-top: auto; border: 1px solid var(--border); background: var(--in); color: var(--text); padding: 12px; border-radius: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 10px; }

        /* Content Area */
        .main-content { flex: 1; margin-left: 280px; padding: 60px; max-width: 1200px; }
        .view-title { font-size: 32px; font-weight: 900; margin: 0; }
        .orange-text { color: #f97316; }
        .main-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }

        /* Frequent */
        .frequent-container { margin-bottom: 40px; }
        .label-row { font-size: 11px; font-weight: 900; color: #f97316; text-transform: uppercase; margin-bottom: 15px; display: flex; align-items: center; gap: 6px; }
        .frequent-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
        .mini-card { background: var(--card); border: 1px solid var(--border); padding: 16px; border-radius: 16px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
        .mini-badge { background: rgba(249, 115, 22, 0.1); color: #f97316; font-size: 10px; padding: 3px 8px; border-radius: 8px; font-weight: 900; }

        /* Search & Grid */
        .search-box { position: relative; margin-bottom: 40px; }
        .search-input { width: 100%; padding: 18px 20px 18px 55px; border-radius: 20px; border: 2px solid var(--border); background: var(--card); color: var(--text); outline: none; }
        .search-icon { position: absolute; left: 20px; top: 20px; color: #f97316; }

        .notes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 25px; }
        .note-card { background: var(--card); border: 1px solid var(--border); padding: 25px; border-radius: 28px; display: flex; flex-direction: column; transition: 0.2s; }
        .note-card:hover { border-color: #f97316; transform: translateY(-4px); }
        .note-card.pinned { border-top: 6px solid #f97316; }
        .card-body { color: var(--dim); font-size: 14px; line-height: 1.6; margin: 15px 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        .card-bottom { margin-top: auto; padding-top: 20px; display: flex; justify-content: space-between; align-items: center; }
        .tag-chip { background: var(--bg); color: #f97316; font-size: 10px; font-weight: 900; padding: 4px 10px; border-radius: 8px; margin-right: 5px; text-transform: uppercase; }
        .copy-action-btn { background: #f97316; color: white; border: none; padding: 10px 20px; border-radius: 12px; font-weight: 800; cursor: pointer; }

        /* Settings */
        .settings-card { background: var(--card); border: 1px solid var(--border); border-radius: 28px; padding: 40px; }
        .field-label { display: block; font-weight: 900; color: #f97316; text-transform: uppercase; font-size: 12px; margin-bottom: 15px; }
        .sig-textarea { width: 100%; background: var(--in); color: var(--text); border: 2px solid var(--border); border-radius: 16px; padding: 20px; font-family: 'Courier New', monospace; font-size: 14px; margin-bottom: 20px; outline: none; box-sizing: border-box; }
        .action-row { display: flex; gap: 15px; }
        .border-top { border-top: 1px solid var(--border); padding-top: 30px; margin-top: 30px; }

        /* Buttons & Modals */
        .primary-btn { background: #f97316; color: white; border: none; padding: 12px 24px; border-radius: 16px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 8px; }
        .primary-btn.wide { width: 100%; justify-content: center; }
        .outline-btn { background: none; border: 1px solid var(--border); color: var(--text); padding: 12px 20px; border-radius: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; }
        .outline-btn.danger:hover { color: #ef4444; border-color: #ef4444; }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(5px); z-index: 1000; display: flex; align-items: center; justify-content: center; }
        .drawer { position: absolute; right: 0; height: 100vh; background: var(--side); width: 480px; padding: 40px; box-shadow: -20px 0 50px rgba(0,0,0,0.2); }
        .variable-modal { background: var(--card); padding: 40px; border-radius: 32px; width: 450px; border-top: 10px solid #f97316; }
        .field label { display: block; font-size: 12px; font-weight: 900; color: #f97316; text-transform: uppercase; margin-bottom: 8px; }
        .field input, .field textarea { width: 100%; padding: 14px; background: var(--in); border: 2px solid var(--border); border-radius: 12px; color: var(--text); outline: none; }
        .cancel-btn { background: none; border: none; color: var(--dim); width: 100%; margin-top: 15px; cursor: pointer; }
        .cursor-pointer { cursor: pointer; }
        .text-red { color: #ef4444; }

        .view-animate { animation: slideUp 0.3s ease-out; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
        </div>
    );
}