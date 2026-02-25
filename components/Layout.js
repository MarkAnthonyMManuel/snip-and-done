import React from 'react';
import { LayoutDashboard, Settings, Bookmark, Folder } from 'lucide-react';

export default function Layout({ children, currentView, setView }) {
    const menuItems = [
        { id: 'notes', label: 'All Notes', icon: <LayoutDashboard size={20} /> },
        { id: 'pinned', label: 'Pinned', icon: <Bookmark size={20} /> },
        { id: 'folders', label: 'Folders', icon: <Folder size={20} /> },
        { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
    ];

    return (
        <div className="flex min-h-screen bg-orange-50/50">
            {/* SIDEBAR */}
            <aside className="w-64 bg-white border-r border-orange-100 hidden md:flex flex-col sticky top-0 h-screen">
                <div className="p-8">
                    <h1 className="text-2xl font-black text-orange-600 tracking-tighter italic">SNIP&DONE</h1>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setView(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${currentView === item.id
                                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-200'
                                    : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600'
                                }`}
                        >
                            {item.icon}
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="p-6 border-t border-orange-50">
                    <div className="bg-orange-100 rounded-2xl p-4">
                        <p className="text-[10px] font-black uppercase text-orange-600 mb-1">Status</p>
                        <p className="text-xs font-bold text-orange-900 flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> Cloud Synced
                        </p>
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 flex flex-col">
                {children}
            </main>
        </div>
    );
}