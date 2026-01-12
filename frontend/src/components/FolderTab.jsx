// In FolderTab.jsx
import React, { useState, useEffect } from 'react';
import { browseFolder, listImages } from '../api/client';
import ImageCard from './ImageCard';

const FolderTab = ({
    onAddToQueue,
    onAddToGroup,
    onCreateGroup,
    groups = [],
    activeTab,
    currentPath,
    setFolderPath,
    currentImages,
    setFolderImages,
    onPreview,
    onPin,
    onImport
}) => {
    // ... (keep state and handlers but remove getGroupItem if internal logic moves to onAddToGroup)

    // Helper to format item for group
    const getGroupItem = (image) => ({
        id: image.path,
        filename: image.name,
        preview_url: image.preview_url,
        full_path: image.path,
        pdf_name: 'Local Folder',
        file: null // Explicitly null to prevent UnifiedImagePanel from trying URL.createObjectURL
    });

    // ... (keep logic)

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedIds, setSelectedIds] = useState(new Set());

    const handleBrowse = async () => {
        try {
            const result = await browseFolder();
            if (result && result.path) {
                setFolderPath(result.path);
                loadImages(result.path);
            }
        } catch (err) {
            console.error("Browse failed", err);
            setError("Failed to open browse dialog");
        }
    };

    const loadImages = async (folderPath) => {
        if (!folderPath) return;
        setLoading(true);
        setError(null);
        try {
            const data = await listImages(folderPath);
            if (data.error) {
                setError(data.error);
                setFolderImages([]);
            } else {
                setFolderImages(data.images || []);
            }
        } catch (err) {
            console.error(err);
            setError("Failed to list images");
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            loadImages(currentPath);
        }
    };

    const handleToggleSelect = (path) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
    };

    const handleImportSelected = () => {
        const selectedItems = currentImages.filter(img => selectedIds.has(img.path)).map(img => getGroupItem(img));
        if (onImport) onImport(selectedItems);
        setSelectedIds(new Set());
    };

    const handleDragStart = (e, img) => {
        const item = getGroupItem(img);
        e.dataTransfer.setData("application/json", JSON.stringify({ item }));
        e.dataTransfer.effectAllowed = "move"; // or copy
    };

    return (
        <div className="flex flex-col h-full bg-slate-900/50">
            {/* Header / Nav */}
            <div className="flex items-center gap-2 p-4 bg-slate-900 border-b border-white/10">
                <div className="flex-1 flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2 border border-white/10">
                    <span className="text-slate-400 text-xs">Path:</span>
                    <input
                        type="text"
                        value={currentPath}
                        onChange={(e) => setFolderPath(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="bg-transparent text-sm text-white focus:outline-none flex-1 font-mono"
                        placeholder="C:\Users\..."
                    />
                </div>
                <button onClick={handleBrowse} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors">Browse</button>
                <button onClick={() => loadImages(currentPath)} className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">Load</button>
                {onPin && (
                    <button
                        onClick={() => onPin(currentPath, currentImages)}
                        className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                        title="Pin this folder"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M10 2c-1.716 0-3.408.106-5.07.31C3.806 2.45 2.995 3.47 2.995 4.673V7c0 1.204.811 2.223 1.935 2.364.717.09 1.458.156 2.213.197.644.036.758 1.05.156 1.343-1.613.784-2.8 2.21-2.8 4.133v1.365c0 1.45 1.487 2.657 3.013 2.193.184-.056.332-.202.385-.386a32.067 32.067 0 011.05-2.73 3 3 0 00-.73-3.664c-.394-.395-.447-1.026.155-1.328A13.882 13.882 0 0010 10a13.882 13.882 0 001.625.489c.602.302.55.933.155 1.328a3 3 0 00-.73 3.664c.266.96.618 1.874 1.05 2.73.053.184.2.33.385.386 1.526.464 3.013-.743 3.013-2.193v-1.365c0-1.923-1.187-3.349-2.8-4.133-.602-.293-.488-1.307.156-1.343.755-.041 1.496-.107 2.213-.197 1.124-.14 1.935-1.16 1.935-2.364V4.673c0-1.204-.811-2.223-1.935-2.364A47.11 47.11 0 0010 2z" clipRule="evenodd" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Selection ActionBar */}
            {selectedIds.size > 0 && (
                <div className="bg-indigo-900/30 border-b border-indigo-500/30 p-2 flex items-center justify-between px-4">
                    <span className="text-sm text-indigo-200">{selectedIds.size} selected</span>
                    <button
                        onClick={handleImportSelected}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition-colors"
                    >
                        Add to Suggestions Manager
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm mb-4">{error}</div>}

                {loading ? (
                    <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>
                ) : currentImages.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 text-sm">{currentPath ? "No images found." : "Select a folder."}</div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {currentImages.map(img => (
                            <div key={img.path} draggable onDragStart={(e) => handleDragStart(e, img)}>
                                <ImageCard
                                    item={{ ...img, title: img.name }} // Map name to title for display
                                    previewUrl={`http://localhost:8000${img.preview_url}`}
                                    groups={groups}
                                    onPreview={() => onPreview && onPreview(img)}
                                    // ...
                                    onAddToGroup={(itm, gid) => onAddToGroup(getGroupItem(itm), gid)}
                                    onCreateGroup={(title, items) => {
                                        if (onCreateGroup) {
                                            const groupItems = items.map(getGroupItem);
                                            onCreateGroup(title, groupItems);
                                        }
                                    }}
                                    onAddToQueue={(itm) => {
                                        // Logic from handleProcess
                                        onAddToQueue({
                                            type: 'single',
                                            id: itm.path,
                                            file: null, // Set to null to skip auto-upload in Dashboard, handled by backend via full_path
                                            title: itm.name,
                                            filename: itm.name, // Required by backend ImageItem schema
                                            full_path: itm.path, // Pass absolute path
                                            pdf_name: "Local Folder",
                                            result: {
                                                filename: itm.name,
                                                folder_path: currentPath,
                                                full_path: itm.path,
                                                stored_filename: null,
                                                preview_url: itm.preview_url
                                            },
                                            preview_url: itm.preview_url,
                                            status: 'ready'
                                        });
                                    }}
                                    showSelection={true}
                                    isSelected={selectedIds.has(img.path)}
                                    onSelect={() => handleToggleSelect(img.path)}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
export default FolderTab;
