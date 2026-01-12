import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import axios from 'axios';

const SaveOptionsModal = ({ isOpen, onClose, onSave, defaultPath }) => {
    const [isSingleFolder, setIsSingleFolder] = useState(true);
    const [csvPath, setCsvPath] = useState('');
    const [mdPath, setMdPath] = useState('');

    useEffect(() => {
        if (isOpen && defaultPath) {
            setCsvPath(defaultPath);
            setMdPath(defaultPath);
        }
    }, [isOpen, defaultPath]);

    const handleBrowse = async (type) => {
        try {
            const response = await axios.get('http://localhost:8000/api/utils/browse-folder');
            const path = response.data.path;
            if (path) {
                if (type === 'csv') setCsvPath(path);
                if (type === 'md') setMdPath(path);
                if (isSingleFolder) {
                    setCsvPath(path);
                    setMdPath(path);
                }
            }
        } catch (error) {
            console.error("Error browsing folder:", error);
        }
    };

    const handleSave = () => {
        if (isSingleFolder) {
            onSave(csvPath, csvPath); // Use CSV path for both
        } else {
            onSave(csvPath, mdPath);
        }
        onClose();
    };

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="mx-auto max-w-lg w-full rounded-xl bg-slate-800 p-6 border border-slate-700 shadow-xl">
                    <Dialog.Title className="text-lg font-medium text-white mb-4">Save Approved Files</Dialog.Title>

                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="singleFolder"
                                checked={isSingleFolder}
                                onChange={(e) => setIsSingleFolder(e.target.checked)}
                                className="rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500"
                            />
                            <label htmlFor="singleFolder" className="text-sm text-slate-300">Save everything to the same folder</label>
                        </div>

                        {/* CSV Folder Input */}
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">
                                {isSingleFolder ? 'Output Folder' : 'CSV Output Folder'}
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={csvPath}
                                    onChange={(e) => {
                                        setCsvPath(e.target.value);
                                        if (isSingleFolder) setMdPath(e.target.value);
                                    }}
                                    className="flex-1 rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                    placeholder="Select folder..."
                                />
                                <button
                                    onClick={() => handleBrowse('csv')}
                                    className="px-3 py-2 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white text-sm"
                                >
                                    Browse
                                </button>
                            </div>
                        </div>

                        {/* Markdown Folder Input (Conditional) */}
                        {!isSingleFolder && (
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Markdown Output Folder</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={mdPath}
                                        onChange={(e) => setMdPath(e.target.value)}
                                        className="flex-1 rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                        placeholder="Select folder..."
                                    />
                                    <button
                                        onClick={() => handleBrowse('md')}
                                        className="px-3 py-2 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white text-sm"
                                    >
                                        Browse
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 text-sm font-medium"
                        >
                            Save All
                        </button>
                    </div>
                </Dialog.Panel>
            </div>
        </Dialog>
    );
};

export default SaveOptionsModal;
