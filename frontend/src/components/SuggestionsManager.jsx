import React, { useState, useEffect, useMemo, useRef } from 'react';
import { suggestImageMerges, executeMergeGroup, getProposedScreenshots } from '../api/client';
import ImageCard from './ImageCard';
import ImagePreviewModal from './ImagePreviewModal';

const SuggestionsManager = ({
    pdfFiles,
    onClose,
    onAddToQueue,
    isInline = false,
    groups,
    setGroups,
    isUnifiedView = false,
    onCreateGroup,
    uploads = [], // Uploaded images
    importedItems = [], // Imported from Folder/Report
    onAvailableItemsChange, // NEW: Callback for parent to know about unorganized items
}) => {
    // Flatten all items
    const [allItems, setAllItems] = useState([]);
    // Remove local groups state, use props
    const [loading, setLoading] = useState(false);
    const [processingIds, setProcessingIds] = useState(new Set());
    const [deletedIds, setDeletedIds] = useState(new Set());
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedImage, setSelectedImage] = useState(null);
    const [isHeaderCreatingGroup, setIsHeaderCreatingGroup] = useState(false);
    const [isBatchCreatingGroup, setIsBatchCreatingGroup] = useState(false);
    const [newGroupTitle, setNewGroupTitle] = useState("");
    const [groupSearchTerms, setGroupSearchTerms] = useState({}); // { groupId: term }
    const [groupPrompts, setGroupPrompts] = useState({}); // { groupId: prompt }
    const [selectedImagePrompt, setSelectedImagePrompt] = useState(""); // Prompt for modal

    // Use a ref to track pdfFiles without triggering re-renders in the polling effect
    const pdfFilesRef = useRef(pdfFiles);
    const initializedRef = useRef(false);

    useEffect(() => {
        pdfFilesRef.current = pdfFiles;
    }, [pdfFiles]);

    const fetchAll = React.useCallback(async () => {
        // Only show loading on very first load or explicit refresh
        if (!initializedRef.current && allItems.length === 0 && (!groups || groups.length === 0)) {
            setLoading(true);
        }

        const currentFiles = pdfFilesRef.current;
        const items = [];



        for (const pdf of currentFiles) {
            // Check status case-insensitively and ensure progress exists
            const status = pdf.progress?.status?.toLowerCase();
            // Also allow if we have no status but known filename (e.g. from history load)
            const shouldFetch = status === 'done' || status === 'processing' || status === 'analyzing_text' || (!status && pdf.filename);

            if (shouldFetch) {
                try {
                    const pdfItems = await getProposedScreenshots(pdf.filename);
                    if (pdfItems && pdfItems.length > 0) {
                        items.push(...pdfItems.map(i => ({
                            ...i,
                            pdf_name: pdf.filename,
                            id: `${pdf.filename}-${i.filename}` // Stable ID
                        })));
                    }
                } catch (e) {
                    console.error(`Error fetching screenshots for ${pdf.filename}:`, e);
                }
            }
        }

        setAllItems(items);
        if (!initializedRef.current) {
            setLoading(false);
            initializedRef.current = true;
        }
    }, [groups]); // Add groups dependency? No, harmless.

    useEffect(() => {
        // Initial fetch
        if (pdfFilesRef.current.length > 0) {
            fetchAll();
        }

        // Poll every 5 seconds (less aggressive)
        const interval = setInterval(fetchAll, 5000);
        return () => clearInterval(interval);
    }, [fetchAll]);

    // Derived state for unorganized items

    // Merged Display Items
    const displayItems = useMemo(() => {
        // Tag items with source for easier handling if needed
        const taggedProposed = allItems.map(i => ({ ...i, _source: 'proposed', id: i.id || `${i.pdf_name}-${i.filename}` }));

        const taggedUploads = uploads.map(i => {
            let preview = null;
            try {
                if (i.file instanceof Blob || i.file instanceof File) {
                    preview = URL.createObjectURL(i.file);
                }
            } catch (e) {
                console.warn("Failed to create object URL for upload:", i);
            }

            return {
                ...i,
                _source: 'upload',
                title: i.file?.name || "Untitled",
                preview_url: preview,
                type: 'Upload',
                path: i.file?.name // Use filename as path fallback for uploads
            };
        });

        const taggedImported = importedItems.map(i => {
            // Fix preview URL if relative
            let preview = i.preview_url;
            if (preview && preview.startsWith('/')) {
                preview = `http://localhost:8000${preview}`;
            }
            return {
                ...i,
                _source: 'imported',
                type: 'Imported',
                preview_url: preview,
                // Ensure title fallback
                title: i.title || i.filename || i.name || "Imported Image",
                path: i.path // Ensure path is passed
            };
        });

        return [...taggedProposed, ...taggedUploads, ...taggedImported];
    }, [allItems, uploads, importedItems]);

    const unorganizedItems = useMemo(() => {
        const groupedItemIds = new Set();
        if (groups) {
            groups.forEach(g => {
                g.items.forEach(i => groupedItemIds.add(i.id));
            });
        }

        return displayItems.filter(i =>
            !groupedItemIds.has(i.id) &&
            !deletedIds.has(i.id) &&
            (
                (i.label?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
                (i.filename?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
                (i.title?.toLowerCase() || "").includes(searchTerm.toLowerCase())
            )
        );
    }, [displayItems, groups, deletedIds, searchTerm]);

    // Notify parent of available items for global search (e.g. in Group Cards)
    useEffect(() => {
        if (onAvailableItemsChange) {
            onAvailableItemsChange(unorganizedItems);
        }
    }, [unorganizedItems, onAvailableItemsChange]);

    const handleAutoGroup = async () => {
        setLoading(true);
        try {
            // Only consider currently unorganized items for auto-grouping

            const suggestions = await suggestImageMerges(unorganizedItems);

            // suggestions is list of groups: { title, reason, items: [{filename, pdf}] }

            const newGroups = suggestions.map(g => {
                // Match items by both filename AND pdf_name to avoid collisions
                const groupItems = unorganizedItems.filter(item =>
                    g.items && g.items.some(suggestedItem => {
                        const match = suggestedItem.filename === item.filename &&
                            suggestedItem.pdf === item.pdf_name;
                        return match;
                    })
                );

                if (groupItems.length === 0) {
                    console.warn("Auto-Group: Group has no matching items:", g);
                    return null;
                }
                return {
                    id: Math.random().toString(36),
                    title: g.title,
                    reason: g.reason,
                    items: groupItems
                };
            }).filter(Boolean);



            if (newGroups.length === 0) {
                alert("No new groups found based on current items.");
            } else {
                setGroups(prev => [...prev, ...newGroups]);
            }

        } catch (err) {
            console.error(err);
            alert("Failed to generate suggestions");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateHeaderGroup = () => {
        // Should use prop if available, else local (but we removed local)
        // This function is for the HEADER button. If prop `onCreateGroup` is passed (from UnifiedPanel), call it.
        // But wait, `handleCreateGroup` logic here was local.
        // We should use `onCreateGroup` prop if we want to add to central state without implementing logic here?
        // Let's implement logic using setGroups prop.
        if (!newGroupTitle.trim()) return;
        const newGroup = {
            id: Math.random().toString(36),
            title: newGroupTitle,
            reason: "Manually created group",
            items: []
        };
        setGroups(prev => [newGroup, ...prev]);
        setNewGroupTitle("");
        setIsHeaderCreatingGroup(false);
    };


    const handleProcessSingle = async (item, prompt = "") => {
        // Pass the raw item to the queue for processing
        onAddToQueue({
            ...item,
            title: item.label || item.filename,
            user_prompt: prompt
        });

        // Mark as deleted/processed
        setDeletedIds(prev => new Set(prev).add(item.id));
    };

    const handleDeleteItem = (itemId) => {
        // Remove from unorganized -> hide permanently (for this session)
        setDeletedIds(prev => new Set(prev).add(itemId));
    };

    const [selectedIds, setSelectedIds] = useState(new Set());

    // Selection Handlers
    const handleToggleSelect = (id) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleBatchCreateGroup = () => {
        if (!newGroupTitle.trim() || selectedIds.size === 0) return;

        const selectedItems = unorganizedItems.filter(i => selectedIds.has(i.id));

        if (onCreateGroup) {
            onCreateGroup(newGroupTitle, selectedItems);
        } else {
            const newGroup = {
                id: Math.random().toString(36),
                title: newGroupTitle,
                reason: "Manually created group",
                items: selectedItems
            };
            setGroups(prev => [...prev, newGroup]);
        }

        setNewGroupTitle("");
        setSelectedIds(new Set());
        setIsBatchCreatingGroup(false);
    };

    const handleBatchAddToQueue = () => {
        const selectedItems = unorganizedItems.filter(i => selectedIds.has(i.id));
        selectedItems.forEach(item => {
            // Pass with minimal prompt or allow user to prompt? For batch, maybe just direct add.
            onAddToQueue({
                ...item,
                title: item.label || item.filename,
                user_prompt: "" // Or could add a batch prompt feature later
            });
        });

        // Mark all as processed/deleted
        setDeletedIds(prev => {
            const newSet = new Set(prev);
            selectedItems.forEach(i => newSet.add(i.id));
            return newSet;
        });
        setSelectedIds(new Set());
    };

    const handleMoveToGroup = (item, targetGroupId) => {
        setGroups(prev => prev.map(g => {
            if (g.id === targetGroupId) {
                // Check if item already exists in group
                if (g.items.some(i => i.id === item.id)) return g;
                return { ...g, items: [...g.items, item] };
            }
            return g;
        }));
    };

    // Helper for ImageCard
    const handleAddToGroup = (item, groupId) => handleMoveToGroup(item, groupId);

    // Drag and Drop Handlers (Simplified for now - can re-add if needed, but ImageCard doesn't native support outgoing drag easily without wrapper)
    const handleDragStart = (e, item) => {
        e.dataTransfer.setData("application/json", JSON.stringify({ item }));
        e.dataTransfer.effectAllowed = "move";
    };

    const containerClasses = isInline
        ? "w-full bg-slate-900/50 rounded-xl border border-white/10 flex flex-col overflow-hidden"
        : "fixed inset-0 z-50 bg-slate-950 flex flex-col";

    return (
        <div className={containerClasses}>
            {/* Header */}
            <div className={`p-4 border-b border-white/10 flex items-center justify-between flex-wrap gap-2 ${isInline ? 'bg-slate-900/80' : 'bg-slate-900'}`}>
                <div>
                    <h2 className={`${isInline ? 'text-lg' : 'text-2xl'} font-bold text-white`}>Suggestions Manager</h2>
                    {!isInline && <p className="text-slate-400">Organize and merge extracted tables/figures before processing.</p>}
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search images..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-slate-800 text-white text-sm rounded-lg pl-8 pr-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none border border-white/10"
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-slate-400 absolute left-2.5 top-2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                        </svg>
                    </div>

                    {/* Batch Actions */}
                    {selectedIds.size > 0 && (
                        <div className="flex items-center gap-1 bg-slate-800 rounded p-1">
                            {isBatchCreatingGroup ? (
                                <div className="flex items-center gap-1">
                                    <input
                                        type="text"
                                        placeholder="Group Title"
                                        value={newGroupTitle}
                                        onChange={e => setNewGroupTitle(e.target.value)}
                                        className="bg-slate-900 text-white text-xs px-2 py-0.5 rounded outline-none w-24"
                                        autoFocus
                                        onKeyDown={e => e.key === 'Enter' && handleBatchCreateGroup()}
                                    />
                                    <button onClick={handleBatchCreateGroup} className="text-green-400 hover:text-green-300">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => {
                                        setIsBatchCreatingGroup(true);
                                        setIsHeaderCreatingGroup(false);
                                        setNewGroupTitle("");
                                    }}
                                    className="px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-500"
                                >
                                    Group ({selectedIds.size})
                                </button>
                            )}
                            <button onClick={handleBatchAddToQueue} className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500" title="Add to Queue">
                                Queue
                            </button>
                        </div>
                    )}

                    {/* Create Group Button */}
                    {isHeaderCreatingGroup ? (
                        <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-white/10">
                            <input
                                type="text"
                                placeholder="Group Title"
                                value={newGroupTitle}
                                onChange={(e) => setNewGroupTitle(e.target.value)}
                                className="bg-transparent text-white text-sm px-2 py-0.5 outline-none w-32"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateHeaderGroup()}
                            />
                            <button onClick={handleCreateHeaderGroup} className="p-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-white">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                </svg>
                            </button>
                            <button onClick={() => setIsHeaderCreatingGroup(false)} className="p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                </svg>
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => {
                                setIsHeaderCreatingGroup(true);
                                setIsBatchCreatingGroup(false);
                                setNewGroupTitle("");
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                            </svg>
                            New Group
                        </button>
                    )}

                    <button
                        onClick={handleAutoGroup}
                        disabled={loading}
                        className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Analyzing...
                            </>
                        ) : (
                            <>✨ Auto-Group</>
                        )}
                    </button>
                    {/* Refresh Button */}
                    <button
                        onClick={fetchAll}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                        title="Refresh Images"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                    </button>

                    {!isInline && (
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className={isInline ? "flex flex-col gap-4 p-4" : "flex-1 overflow-hidden flex"}>

                {/* Unorganized Section (Full width if Unified View) */}
                <div className={isInline ? "w-full bg-slate-900/30 rounded-lg p-4" : "w-1/3 p-6 overflow-y-auto bg-slate-900/50"}>
                    <h3 className="text-sm font-medium text-slate-200 mb-2">Unorganized Images ({unorganizedItems.length})</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {unorganizedItems.map(item => (
                            <div key={item.id} draggable onDragStart={(e) => handleDragStart(e, item)}>
                                <ImageCard
                                    item={{
                                        ...item,
                                        title: item.title || item.label || item.filename,
                                        preview_url: item.preview_url || `/static/proposed/${item.pdf_name}/${item.filename}`, // Fallback for proposed
                                        file: item.file || null,
                                        type: item.type || `Proposed (${item.type})`
                                    }}
                                    previewUrl={item.preview_url || `http://localhost:8000/static/proposed/${item.pdf_name}/${item.filename}`} // Handle different sources
                                    groups={groups}
                                    onAddToQueue={() => handleProcessSingle(item)}
                                    onDelete={() => handleDeleteItem(item.id)}
                                    onAddToGroup={handleAddToGroup}
                                    onCreateGroup={(title) => {
                                        if (onCreateGroup) onCreateGroup(title, [item]);
                                        else {
                                            const newGroup = {
                                                id: Math.random().toString(36),
                                                title: title,
                                                reason: "Manually created",
                                                items: [item]
                                            };
                                            setGroups(prev => [...prev, newGroup]);
                                        }
                                    }}
                                    onPreview={() => setSelectedImage(item)}
                                    showSelection={true}
                                    isSelected={selectedIds.has(item.id)}
                                    onSelect={() => handleToggleSelect(item.id)}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Image Modal */}
            {selectedImage && (
                <ImagePreviewModal
                    item={selectedImage}
                    onClose={() => setSelectedImage(null)}
                    onAddToReview={handleProcessSingle}
                />
            )}
        </div>
    );
};

export default SuggestionsManager;
