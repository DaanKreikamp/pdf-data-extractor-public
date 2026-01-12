import React, { useState, useMemo } from 'react';
import ImageCard from './ImageCard';

const UploadedImagesPanel = ({ images, onAddToQueue, groups, setGroups, onPreview }) => {
    // Shared groups state passed from parent
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [newGroupTitle, setNewGroupTitle] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    // Filter images that are not in any group
    const unorganizedImages = useMemo(() => {
        const groupedImageIds = new Set();
        if (groups) {
            groups.forEach(g => {
                g.items.forEach(i => groupedImageIds.add(i.id));
            });
        }

        return images.filter(i =>
            !groupedImageIds.has(i.id) &&
            (i.file.name.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [images, groups, searchTerm]);

    const handleCreateGroup = (title = newGroupTitle) => {
        if (!title.trim()) return;

        const selectedImages = unorganizedImages.filter(i => selectedIds.has(i.id));
        // If no images selected, but we are creating from single item context (ImageCard), handled separately?
        // Actually ImageCard's onCreateGroup passes specific items.
        // This function handles the HEADER button which uses selectedIds.

        if (selectedImages.length === 0) return;

        const newGroup = {
            id: Math.random().toString(36),
            title: title,
            items: selectedImages,
            type: 'manual_group',
            reason: 'Manually created from uploaded images'
        };

        setGroups(prev => [newGroup, ...prev]);
        setNewGroupTitle("");
        setIsCreatingGroup(false);
        setSelectedIds(new Set());
    };

    // Wrapper for ImageCard to create group from single item
    const handleCreateGroupFromItem = (title, items) => {
        const newGroup = {
            id: Math.random().toString(36),
            title: title,
            items: items,
            type: 'manual_group',
            reason: 'Manually created from uploaded images'
        };
        setGroups(prev => [newGroup, ...prev]);
    };

    const handleAddToGroup = (item, groupId) => {
        setGroups(prev => prev.map(g => {
            if (g.id === groupId) {
                if (g.items.some(i => i.id === item.id)) return g;
                return { ...g, items: [...g.items, item] };
            }
            return g;
        }));
    };

    const handleToggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleProcessSingle = (image) => {
        // Add single image to queue
        onAddToQueue({
            type: 'single',
            id: image.id,
            file: image.file,
            result: image.result, // Contains stored_filename
            status: 'ready'
        });
    };

    // Drag support
    const handleDragStart = (e, image) => {
        const item = {
            type: 'uploaded',
            id: image.id,
            file: image.file,
            result: image.result,
            label: image.file.name
        };
        e.dataTransfer.setData("application/json", JSON.stringify({ item }));
        e.dataTransfer.effectAllowed = "move";
    };

    return (
        <div className="flex flex-col h-full bg-slate-900/50 rounded-xl border border-white/10 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-900/80">
                <div>
                    <h2 className="text-lg font-bold text-white">Uploaded Images</h2>
                    <p className="text-slate-400 text-xs">Organize manual uploads before processing.</p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Search */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-slate-800 text-white text-xs rounded-lg pl-7 pr-2 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none border border-white/10 w-32"
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                        </svg>
                    </div>

                    {/* Create Group Controls */}
                    {isCreatingGroup ? (
                        <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-white/10">
                            <input
                                type="text"
                                placeholder="Group Title"
                                value={newGroupTitle}
                                onChange={(e) => setNewGroupTitle(e.target.value)}
                                className="bg-transparent text-white text-xs px-2 py-0.5 outline-none w-24"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
                            />
                            <button
                                onClick={() => handleCreateGroup()}
                                disabled={selectedIds.size === 0}
                                className="p-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-white disabled:opacity-50"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                </svg>
                            </button>
                            <button onClick={() => setIsCreatingGroup(false)} className="p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                </svg>
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsCreatingGroup(true)}
                            disabled={selectedIds.size === 0}
                            className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:bg-slate-800 disabled:text-slate-500"
                        >
                            Group Selected ({selectedIds.size})
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Unorganized Images */}
                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Unorganized ({unorganizedImages.length})</h3>
                    {unorganizedImages.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-sm border-2 border-dashed border-slate-800 rounded-xl">
                            No images uploaded. Drag & Drop them here.
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {unorganizedImages.map(image => (
                                <div
                                    key={image.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, image)}
                                >
                                    <ImageCard
                                        item={{
                                            ...image,
                                            title: image.file.name,
                                            preview_url: null, // we pass previewUrl explicitly
                                            type: 'Upload'
                                        }}
                                        previewUrl={image.file ? URL.createObjectURL(image.file) : null}
                                        groups={groups}
                                        isSelected={selectedIds.has(image.id)}
                                        onSelect={() => handleToggleSelect(image.id)}
                                        onPreview={() => onPreview && onPreview(image)}
                                        onAddToGroup={handleAddToGroup}
                                        onCreateGroup={(title) => handleCreateGroupFromItem(title, [image])}
                                        onAddToQueue={() => handleProcessSingle(image)}
                                        showSelection={true}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UploadedImagesPanel;
