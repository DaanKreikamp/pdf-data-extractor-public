import React, { useState, useEffect } from 'react';
import client from '../api/client';

const MergePanel = ({ upload, onClose, onApprove }) => {
    const [loading, setLoading] = useState(true);
    const [preview, setPreview] = useState(null);
    const [error, setError] = useState(null);
    const [targetFilename, setTargetFilename] = useState("merged_output.csv");

    useEffect(() => {
        fetchPreview();
    }, [upload]);

    const fetchPreview = async () => {
        setLoading(true);
        setError(null);
        try {
            // Get IDs from the upload group items
            const itemIds = upload.items.map(item => item.result.id);
            const response = await client.post('/merge/preview', { item_ids: itemIds });
            setPreview(response.data);
        } catch (err) {
            console.error("Merge preview failed:", err);
            setError(err.response?.data?.detail || err.message || "Failed to generate merge preview");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveMerge = async () => {
        if (!preview) return;
        setLoading(true);
        try {
            const itemIds = upload.items.map(item => item.result.id);
            const finalMdName = targetFilename.replace('.csv', '.md');

            await client.post('/merge/save', {
                item_ids: itemIds,
                final_csv_name: targetFilename,
                final_md_name: finalMdName
            });

            onApprove(); // Close and refresh
        } catch (err) {
            console.error("Failed to save merge", err);
            alert("Failed to save merged file: " + (err.response?.data?.detail || err.message));
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 w-full max-w-6xl h-[90vh] rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden">

                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-slate-900/50">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Merge Preview</h2>
                        <p className="text-slate-400 text-sm">Review the merged output of {upload.files?.length || upload.items?.length || 0} files</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                            <label className="text-xs text-slate-500 mb-1">Output Filename</label>
                            <input
                                type="text"
                                value={targetFilename}
                                onChange={(e) => setTargetFilename(e.target.value)}
                                className="bg-slate-800 border border-white/10 rounded px-3 py-1 text-sm text-white focus:outline-none focus:border-purple-500 w-64"
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveMerge}
                                disabled={loading || error}
                                className="px-6 py-2 rounded-lg bg-purple-500 text-white font-medium hover:bg-purple-600 transition-colors shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Saving...' : 'Save Merged File'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex">
                    {loading ? (
                        <div className="flex-1 flex items-center justify-center text-purple-400">
                            <div className="animate-pulse flex flex-col items-center gap-4">
                                <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                <p>Generating preview...</p>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="flex-1 flex items-center justify-center text-red-400">
                            <p>{error}</p>
                        </div>
                    ) : (
                        <>
                            {/* CSV Preview */}
                            <div className="flex-1 border-r border-white/10 flex flex-col min-w-0">
                                <div className="p-3 bg-slate-800/50 border-b border-white/5 font-medium text-xs text-slate-400 uppercase tracking-wider">
                                    Merged CSV
                                </div>
                                <div className="flex-1 overflow-auto p-4 bg-slate-950/30">
                                    <pre className="text-xs font-mono text-slate-300 whitespace-pre">{preview?.merged_csv || "No CSV content"}</pre>
                                </div>
                            </div>

                            {/* Markdown Preview */}
                            <div className="flex-1 flex flex-col min-w-0">
                                <div className="p-3 bg-slate-800/50 border-b border-white/5 font-medium text-xs text-slate-400 uppercase tracking-wider">
                                    Merged Markdown
                                </div>
                                <div className="flex-1 overflow-auto p-4 prose prose-invert prose-sm max-w-none">
                                    <pre className="whitespace-pre-wrap font-sans">{preview?.merged_markdown || "No Markdown content"}</pre>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div >
    );
};

export default MergePanel;
