import React, { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../api/client';

const SettingsModal = ({ onClose }) => {
    const [outputFolder, setOutputFolder] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const settings = await getSettings();
            setOutputFolder(settings.output_folder || '');
        } catch (err) {
            console.error("Failed to load settings", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateSettings({ output_folder: outputFolder });
            onClose();
        } catch (err) {
            console.error("Failed to save settings", err);
            alert("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-white">Settings</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Output Folder Path</label>
                        <input
                            type="text"
                            value={outputFolder}
                            onChange={(e) => setOutputFolder(e.target.value)}
                            className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                            placeholder="C:\Path\To\Output"
                        />
                        <p className="text-xs text-slate-500">
                            Approved files will be saved to this folder when you click "Save All".
                        </p>
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
