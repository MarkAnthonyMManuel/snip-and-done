import React, { useState } from 'react';

export default function VariableModal({ isOpen, variables, onConfirm, onCancel }) {
    const [values, setValues] = useState({});

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border-t-8 border-orange-500">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Fill Placeholders</h2>
                <div className="space-y-4">
                    {variables.map((v) => (
                        <div key={v}>
                            <label className="block text-sm font-medium text-gray-600 mb-1">{v}</label>
                            <input
                                className="w-full p-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                placeholder={`Enter ${v}...`}
                                onChange={(e) => setValues({ ...values, [v]: e.target.value })}
                            />
                        </div>
                    ))}
                </div>
                <div className="mt-6 flex gap-3">
                    <button onClick={() => onConfirm(values)} className="flex-1 bg-orange-500 text-white py-2 rounded-xl font-bold hover:bg-orange-600">Copy to Clipboard</button>
                    <button onClick={onCancel} className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-xl">Cancel</button>
                </div>
            </div>
        </div>
    );
}