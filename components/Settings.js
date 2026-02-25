import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Save, FileJson, ShieldCheck, ArrowLeft } from 'lucide-react';

export default function Settings({ onBack, notes }) {
    const [signature, setSignature] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchSignature();
    }, []);

    const fetchSignature = async () => {
        const { data } = await supabase.from('signatures').select('content').single();
        if (data) setSignature(data.content);
    };

    const saveSignature = async () => {
        setLoading(true);
        const { error } = await supabase
            .from('signatures')
            .upsert({ id: 1, content: signature }); // simplified ID for single-user
        setLoading(false);
        if (!error) alert("Signature updated!");
    };

    return (
        <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl shadow-xl border border-orange-100 mt-10">
            <button onClick={onBack} className="flex items-center gap-2 text-orange-600 font-bold mb-6 hover:underline">
                <ArrowLeft size={18} /> Back to Snippets
            </button>

            <h2 className="text-3xl font-black text-gray-900 mb-8 text-orange-500">Settings</h2>

            {/* Signature Section */}
            <section className="mb-10">
                <label className="block text-sm font-black uppercase tracking-widest text-gray-400 mb-3">Universal Signature</label>
                <textarea
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder="Best regards, Your Name"
                    rows="4"
                    className="w-full p-4 border-2 border-orange-50 rounded-2xl focus:border-orange-500 outline-none transition-all"
                />
                <button
                    onClick={saveSignature}
                    className="mt-4 bg-orange-500 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-orange-600"
                >
                    <Save size={18} /> {loading ? 'Saving...' : 'Save Signature'}
                </button>
            </section>

            {/* Backup Section */}
            <section className="border-t border-orange-50 pt-8">
                <label className="block text-sm font-black uppercase tracking-widest text-gray-400 mb-4">Data Management</label>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-orange-50 rounded-2xl">
                        <h4 className="font-bold mb-2 flex items-center gap-2"><FileJson size={16} className="text-orange-500" /> Export Data</h4>
                        <p className="text-xs text-gray-500 mb-4">Download all your snippets as a JSON file.</p>
                        <button
                            onClick={() => {
                                const blob = new Blob([JSON.stringify(notes)], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url; a.download = 'snippets-backup.json'; a.click();
                            }}
                            className="text-xs font-bold text-orange-600 hover:text-orange-700 underline"
                        >
                            DOWNLOAD BACKUP
                        </button>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-2xl">
                        <h4 className="font-bold mb-2 flex items-center gap-2"><ShieldCheck size={16} className="text-green-600" /> Cloud Sync</h4>
                        <p className="text-xs text-gray-500 mb-4">Your data is currently syncing with Supabase.</p>
                        <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded uppercase">Active</span>
                    </div>
                </div>
            </section>
        </div>
    );
}