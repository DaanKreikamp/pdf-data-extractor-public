import React, { useState, useEffect, useMemo } from 'react';
import SuggestionsManager from './SuggestionsManager';
import UploadedImagesPanel from './UploadedImagesPanel';
import ReportTab from './ReportTab';
import FileUpload from './FileUpload';
import FolderTab from './FolderTab';
import ImagePreviewModal from './ImagePreviewModal';

class InlineErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("InlineErrorBoundary caused error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-4 bg-red-900/50 border border-red-500 rounded text-red-200 overflow-auto h-full">
                    <h3 className="font-bold mb-2">Component Error</h3>
                    <pre className="text-xs whitespace-pre-wrap">{this.state.error && this.state.error.toString()}</pre>
                </div>
            );
        }
        return this.props.children;
    }
}

const UnifiedImagePanel = ({ pdfFiles, uploads, onAddToQueue, onUpload, groups, setGroups, contentHeight = 600 }) => {
    // ---- State ----
    const [activeTab, setActiveTab] = useState('suggestions'); // 'suggestions', 'uploads', 'folder', or 'pdf-{filename}'
    // groups lifted to props
    const [folderPath, setFolderPath] = useState(''); // For Folder Tab
    const [folderImages, setFolderImages] = useState([]); // Lifted state for Folder Tab images
    const [pinnedFolders, setPinnedFolders] = useState([]); // Array of { id, path, images }

    // NEW: Imported items from Folder/Report tabs that should appear in SuggestionsManager
    const [importedItems, setImportedItems] = useState([]);

    // Search Feature State
    const [availableItems, setAvailableItems] = useState([]); // Pool of items for manual add
    const [groupSearchTerms, setGroupSearchTerms] = useState({}); // { groupId: term }

    const handleAvailableItemsChange = (items) => {
        // Merge incoming items (from SuggestionsManager) with existing uploads/imported
        // We want to ensure we have the latest "unorganized" items from SuggestionsManager
        // But we also want to keep uploads available.
        // Simple approach: Update state. Using a Ref might be better for performance if list is huge, but state is fine for now.
        setAvailableItems(prev => {
            const currentIds = new Set(items.map(i => i.id));
            // Keep items that are NOT in the new list ONLY if they are uploads/imported (to avoid deleting valid stuff)
            // Actually, simpler: just set availableItems to (uploads + imported + items) deduplicated.
            const all = [...uploads, ...importedItems, ...items];
            const unique = [];
            const seen = new Set();
            all.forEach(i => {
                if (!seen.has(i.id)) {
                    seen.add(i.id);
                    unique.push(i);
                }
            });
            return unique;
        });
    };

    // Update available items when uploads/imported change
    useEffect(() => {
        setAvailableItems(prev => {
            const all = [...prev, ...uploads, ...importedItems];
            const unique = [];
            const seen = new Set();
            all.forEach(i => {
                if (!seen.has(i.id)) {
                    seen.add(i.id);
                    unique.push(i);
                }
            });
            return unique;
        });
    }, [uploads, importedItems]);

    // Derived state for available PDF tabs
    const availablePdfs = useMemo(() => {
        return pdfFiles.filter(f =>
            f.status === 'done' || f.status === 'processing' || f.loading || !f.status
        );
    }, [pdfFiles]);

    // ---- Handlers ----

    // Handle "Add to Review Queue" (Global Wrapper)
    const handleAddToQueue = (item) => {
        onAddToQueue(item);
    };

    const handlePinFolder = (path, images) => {
        const id = Math.random().toString(36).substr(2, 9);
        const name = path.split(/[\\/]/).pop() || path;
        const newPinned = { id, path, images, name };
        setPinnedFolders(prev => [...prev, newPinned]);
        // Optional: switch to new tab? User said "keep page open [pinned] and then opening a new folder".
        // Let's stay on current Main Folder View to allow browsing to next.
    };

    const handleUnpinFolder = (e, id) => {
        e.stopPropagation();
        setPinnedFolders(prev => prev.filter(f => f.id !== id));
        if (activeTab === `pinned-${id}`) {
            setActiveTab('folder');
        }
    };

    const updatePinnedFolder = (id, updates) => {
        setPinnedFolders(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    // Handle importing items to Suggestions Manager
    const handleImportImages = (items) => {
        setImportedItems(prev => {
            // Avoid duplicates
            const currentIds = new Set(prev.map(i => i.id));
            const newItems = items.filter(i => !currentIds.has(i.id));
            if (newItems.length === 0) return prev;

            alert(`Added ${newItems.length} images to Suggestions Manager.`);
            // Switch to Suggestions tab automatically to show result? 
            // User might want to stay in folder. Let's just notify for now.
            return [...prev, ...newItems];
        });
    };

    // Handle "Add to Group" (Global Wrapper)
    const handleAddToGroup = (item, groupId) => {
        setGroups(prev => prev.map(g => {
            if (g.id === groupId) {
                // Avoid duplicates
                if (g.items.some(i => i.id === item.id)) return g;
                // Add item to group
                return { ...g, items: [...g.items, item] };
            }
            return g;
        }));
    };

    const handleCreateGroup = (title, items = []) => {
        const newGroup = {
            id: Math.random().toString(36),
            title: title,
            reason: "Manually created",
            items: items
        };
        setGroups(prev => [...prev, newGroup]);
        return newGroup.id;
    };

    const handleUngroup = (groupId) => {
        setGroups(prev => prev.filter(g => g.id !== groupId));
    };

    const handleRemoveFromGroup = (groupId, itemId) => {
        setGroups(prev => prev.map(g => {
            if (g.id === groupId) {
                return { ...g, items: g.items.filter(i => i.id !== itemId) };
            }
            return g;
        })); // Remove empty groups? No, allow empty groups for UnifiedPanel manual creation
    };

    // ---- Layout Helpers ----
    const [previewItem, setPreviewItem] = useState(null);

    // Paste handler
    const handlePasteFromClipboard = async () => {
        try {
            const clipboardItems = await navigator.clipboard.read();
            const files = [];
            for (const item of clipboardItems) {
                // If it's an image
                const imageType = item.types.find(type => type.startsWith('image/'));
                if (imageType) {
                    const blob = await item.getType(imageType);
                    // Create a File from Blob
                    const file = new File([blob], "pasted-image.png", { type: imageType });
                    files.push(file);
                }
            }
            if (files.length > 0) {
                onUpload(files);
            } else {
                alert("No images found in clipboard.");
            }
        } catch (err) {
            console.error("Failed to read clipboard:", err);
            // Fallback for Firefox or if read() is not supported/denied
            alert("Could not read clipboard. Please ensure you granted permission.");
        }
    };

    // State for creating group in this panel
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [newGroupTitle, setNewGroupTitle] = useState("");

    // Drag and Drop Helpers
    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e, targetGroupId) => {
        e.preventDefault();
        const data = e.dataTransfer.getData("application/json");
        if (!data) return;

        try {
            const { item, sourceGroupId } = JSON.parse(data);
            if (sourceGroupId === targetGroupId) return;

            setGroups(prev => prev.map(g => {
                if (g.id === targetGroupId) {
                    // Check for duplicates
                    if (g.items.some(i => i.id === item.id)) return g;
                    return { ...g, items: [...g.items, item] };
                }
                return g;
            }));

            // Note: We don't remove from source here because the source might be a read-only Folder or proper Uploads list.
            // If dragging from SuggestionsManager (which passes sourceGroupId), that component handles self-removal via effect or we don't handle it here?
            // Actually, SuggestionManager handles its own "drop" internally, but if we drop HERE in UnifiedPanel, 
            // the source component doesn't know it happened unless we tell it.
            // But usually D&D removals happen if the source specifically listens for "end" or if we use a shared state update.
            // Since `groups` IS shared state, if we move from one Group to another, we should verify removal.
            // But if moving from "Unorganized" (no group), it stays unorganized?
            // User requirement: "add images from folders... to these groups". Copying is fine/preferred for Folders.
            // For Suggestions, we ideally want to "Move". 
            // If we want to support "Move" from Suggestions, we need to handle removal from source group if applicable.

            if (sourceGroupId) {
                setGroups(prev => prev.map(g => {
                    if (g.id === sourceGroupId) {
                        return { ...g, items: g.items.filter(i => i.id !== item.id) };
                    }
                    return g;
                }));
            }

        } catch (err) {
            console.error("Drop failed:", err);
        }
    };

    const renderGroupsPanel = () => (
        <div className="bg-slate-900 border-b border-white/10 p-4">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
                <span>Active Groups ({groups.length})</span>
                <div className="flex items-center gap-2">
                    {isCreatingGroup ? (
                        <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded border border-white/10">
                            <input
                                autoFocus
                                type="text"
                                placeholder="Group Name"
                                value={newGroupTitle}
                                onChange={(e) => setNewGroupTitle(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        if (newGroupTitle.trim()) {
                                            handleCreateGroup(newGroupTitle);
                                            setNewGroupTitle("");
                                            setIsCreatingGroup(false);
                                        }
                                    }
                                }}
                                className="bg-transparent text-xs text-white px-2 py-1 outline-none w-24 md:w-32"
                            />
                            <button
                                onClick={() => {
                                    if (newGroupTitle.trim()) {
                                        handleCreateGroup(newGroupTitle);
                                        setNewGroupTitle("");
                                        setIsCreatingGroup(false);
                                    }
                                }}
                                className="p-1 rounded hover:bg-green-500/20 text-green-400"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                </svg>
                            </button>
                            <button
                                onClick={() => setIsCreatingGroup(false)}
                                className="p-1 rounded hover:bg-red-500/20 text-red-400"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                </svg>
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsCreatingGroup(true)}
                            className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded border border-white/5 transition-colors flex items-center gap-1"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                            </svg>
                            New Group
                        </button>
                    )}
                </div>
            </h3>

            {groups.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-slate-800 rounded-lg text-slate-500 text-xs">
                    No active groups. Click "New Group" above to start manually.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                    {groups.map(group => (
                        <div
                            key={group.id}
                            className="bg-slate-800/50 rounded-lg border border-white/10 p-3 flex flex-col gap-3 group/panel transition-all hover:border-blue-500/30"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, group.id)}
                        >
                            {/* Group Header */}
                            <div className="flex items-start justify-between">
                                <div className="min-w-0 flex-1 mr-2">
                                    <div className="font-medium text-indigo-300 text-base truncate" title={group.title}>{group.title}</div>
                                    {group.reason && (
                                        <div className="text-xs text-slate-400 mt-1 line-clamp-2 break-words" title={group.reason}>
                                            {group.reason}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleUngroup(group.id)}
                                        className="p-1.5 text-red-400 hover:bg-red-500/10 rounded"
                                        title="Delete Group"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Manual Add Search */}
                            <div className="relative mt-2">
                                <div className="flex items-center gap-1 bg-slate-900/50 border border-white/10 rounded px-2 py-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-slate-500">
                                        <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                                    </svg>
                                    <input
                                        type="text"
                                        placeholder="Search to add..."
                                        className="w-full bg-transparent text-xs text-white placeholder-slate-600 outline-none"
                                        value={groupSearchTerms[group.id] || ""}
                                        onChange={(e) => setGroupSearchTerms(prev => ({ ...prev, [group.id]: e.target.value }))}
                                        onFocus={() => {
                                            // Maybe fetch?
                                        }}
                                    />
                                    {groupSearchTerms[group.id] && (
                                        <button
                                            onClick={() => setGroupSearchTerms(prev => ({ ...prev, [group.id]: "" }))}
                                            className="text-slate-500 hover:text-white"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                            </svg>
                                        </button>
                                    )}
                                </div>

                                {/* Autocomplete Results */}
                                {groupSearchTerms[group.id] && (
                                    <div className="absolute top-full left-0 w-full mt-1 bg-slate-800 border border-white/20 rounded shadow-xl z-50 max-h-40 overflow-y-auto custom-scrollbar">
                                        {availableItems.filter(i =>
                                            (i.label?.toLowerCase() || "").includes(groupSearchTerms[group.id].toLowerCase()) ||
                                            (i.filename?.toLowerCase() || "").includes(groupSearchTerms[group.id].toLowerCase()) ||
                                            (i.title?.toLowerCase() || "").includes(groupSearchTerms[group.id].toLowerCase())
                                        ).slice(0, 10).map(item => (
                                            <div
                                                key={item.id}
                                                className="flex items-center gap-2 p-2 hover:bg-slate-700 cursor-pointer border-b border-white/5 last:border-0"
                                                onClick={() => {
                                                    handleAddToGroup(item, group.id);
                                                    setGroupSearchTerms(prev => ({ ...prev, [group.id]: "" }));
                                                }}
                                            >
                                                <div className="w-6 h-6 bg-black/30 rounded overflow-hidden flex-shrink-0">
                                                    <img
                                                        src={
                                                            item.file ? URL.createObjectURL(item.file) :
                                                                item.preview_url ? (item.preview_url.startsWith('http') || item.preview_url.startsWith('blob:') ? item.preview_url : `http://localhost:8000${item.preview_url}`) :
                                                                    `http://localhost:8000/static/proposed/${item.pdf_name}/${item.filename}`
                                                        }
                                                        className="w-full h-full object-cover"
                                                        alt=""
                                                    />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-xs text-white truncate" title={item.title || item.filename}>{item.title || item.filename}</div>
                                                    <div className="text-[10px] text-slate-400 truncate">{item.pdf_name || "Upload"}</div>
                                                </div>
                                                <button className="text-green-400 hover:text-green-300">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                                        <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ))}
                                        {availableItems.filter(i =>
                                            (i.label?.toLowerCase() || "").includes(groupSearchTerms[group.id].toLowerCase()) ||
                                            (i.filename?.toLowerCase() || "").includes(groupSearchTerms[group.id].toLowerCase()) ||
                                            (i.title?.toLowerCase() || "").includes(groupSearchTerms[group.id].toLowerCase())
                                        ).length === 0 && (
                                                <div className="p-2 text-xs text-slate-500 text-center">No matches found</div>
                                            )}
                                    </div>
                                )}
                            </div>

                            {/* Prompt Input */}
                            <div className="mt-2">
                                <input
                                    type="text"
                                    placeholder="Add custom instructions..."
                                    className="w-full bg-slate-900/50 border border-white/10 rounded px-2 py-1 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
                                    value={group.customPrompt || ""}
                                    onChange={(e) => {
                                        setGroups(prev => prev.map(g => g.id === group.id ? { ...g, customPrompt: e.target.value } : g));
                                    }}
                                />
                            </div>

                            <button
                                onClick={() => {
                                    onAddToQueue({
                                        type: 'group',
                                        id: group.id,
                                        title: group.title,
                                        items: group.items,
                                        status: 'ready',
                                        user_prompt: group.customPrompt // Pass as user_prompt for backend
                                    });
                                    handleUngroup(group.id);
                                }}
                                className="w-full mt-2 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 rounded text-xs font-medium border border-indigo-500/30 transition-colors"
                            >
                                Add to Queue
                            </button>

                            {/* Group Items Preview (Larger) */}
                            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar min-h-[60px] relative">
                                {group.items.length === 0 && (
                                    <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-600 border border-dashed border-white/10 rounded">
                                        Drag & drop images here
                                    </div>
                                )}
                                {group.items.map(item => (
                                    <div
                                        key={item.id}
                                        className="relative flex-shrink-0 w-16 h-16 bg-black/40 rounded border border-white/5 overflow-hidden cursor-pointer group/item"
                                        onClick={() => setPreviewItem(item)}
                                        title={item.file?.path || item.path || 'No path available'} // Fallback raw title
                                    >
                                        <img
                                            src={
                                                item.file ? URL.createObjectURL(item.file) : // Uploaded
                                                    item.preview_url ? ((item.preview_url.startsWith('http') || item.preview_url.startsWith('blob:')) ? item.preview_url : `http://localhost:8000${item.preview_url}`) : // Folder/Processed
                                                        `http://localhost:8000/static/proposed/${item.pdf_name}/${item.filename}` // Server proposed
                                            }
                                            className="w-full h-full object-cover"
                                            alt=""
                                        />
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveFromGroup(group.id, item.id);
                                            }}
                                            className="absolute top-1 right-1 p-1 rounded-full bg-red-500/80 text-white opacity-0 group-hover/item:opacity-100 transition-opacity hover:bg-red-600 z-10"
                                            title="Remove from Group"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                            </svg>
                                        </button>

                                        {/* Path Indicator on Hover */}
                                        <div className="absolute bottom-0 left-0 w-full bg-black/70 text-[8px] text-white truncate px-1 opacity-0 group-hover/item:opacity-100 pointer-events-none">
                                            {item.file?.path?.split('\\').pop() || item.path?.split(/[\\/]/).pop() || item.filename}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <div className="flex flex-col h-full w-full bg-slate-950 rounded-xl border border-white/10 overflow-hidden shadow-xl">
            {/* 1. Groups Sub-Panel (Always Visible) */}
            {renderGroupsPanel()}

            {/* 2. Tabs Navigation */}
            <div className="flex items-center gap-1 p-2 bg-slate-900 border-b border-white/10 overflow-x-auto custom-scrollbar">
                <button
                    onClick={() => setActiveTab('suggestions')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2
                        ${activeTab === 'suggestions'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M10 2a.75.75 0 01.75.75v5.59l2.68-2.68a.75.75 0 111.06 1.06l-4 4a.75.75 0 01-1.06 0l-4-4a.75.75 0 011.06-1.06l2.68 2.68V2.75A.75.75 0 0110 2z" />
                    </svg>
                    Suggestions / All
                </button>

                <button
                    onClick={() => setActiveTab('uploads')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2
                        ${activeTab === 'uploads'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M13.791 2.316a.75.75 0 0 1 1.066.02l2.828 2.829a.75.75 0 0 1 0 1.06l-6.903 6.904a.75.75 0 0 1-1.06-1.06l6.903-6.904a.75.75 0 0 1 .02-1.066Z" />
                        <path d="M12.97 6.002a.75.75 0 0 1-.223 1.038L7.387 10.37a.75.75 0 0 1-1.038-.223l-3.374-5.64a.75.75 0 0 1 .223-1.038l5.36-3.329a.75.75 0 0 1 1.038.223l3.374 5.64Z" />
                        <path fillRule="evenodd" d="M1.323 15.53a.75.75 0 0 1 .797-.872l15.757 1.139a.75.75 0 0 1 .697.803l-.322 4.453a.75.75 0 0 1-.803.697L1.692 20.61a.75.75 0 0 1-.803-.697l.434-4.384Z" clipRule="evenodd" />
                    </svg>
                    Manual Uploads
                </button>

                <button
                    onClick={() => setActiveTab('folder')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2
                        ${activeTab === 'folder'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M1 5.25A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25v9.5A2.25 2.25 0 0 1 16.75 17H3.25A2.25 2.25 0 0 1 1 14.75v-9.5Z" />
                    </svg>
                    Explorer
                </button>

                <div className="w-px h-6 bg-white/10 mx-2"></div>

                {/* Pinned Folders */}
                {pinnedFolders.map(folder => (
                    <div key={folder.id} className="relative group/tab">
                        <button
                            onClick={() => setActiveTab(`pinned-${folder.id}`)}
                            className={`px-3 py-2 pr-7 rounded-lg text-sm font-medium transition-all whitespace-nowrap border border-transparent flex items-center gap-2
                                ${activeTab === `pinned-${folder.id}`
                                    ? 'bg-slate-800 text-yellow-400 border-yellow-500/30 shadow-lg shadow-yellow-500/10'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                            title={folder.path}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 01.75.75V5h-16v-.25zm16 2.5V16a.75.75 0 01-.75.75H2.75A.75.75 0 012 16V7.25h16z" clipRule="evenodd" />
                            </svg>
                            {folder.name}
                        </button>
                        <button
                            onClick={(e) => handleUnpinFolder(e, folder.id)}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-slate-500 hover:text-red-400 opacity-0 group-hover/tab:opacity-100 transition-opacity"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                            </svg>
                        </button>
                    </div>
                ))}

                {/* PDF Tabs */}
                {availablePdfs.map(pdf => (
                    <button
                        key={pdf.filename}
                        onClick={() => setActiveTab(`pdf-${pdf.filename}`)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap border border-transparent
                            ${activeTab === `pdf-${pdf.filename}`
                                ? 'bg-slate-800 text-blue-400 border-blue-500/30'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                    >
                        {pdf.filename}
                    </button>
                ))}
            </div>

            {/* 3. Main Content Area */}
            <div
                className="overflow-hidden bg-slate-950 p-4 relative transition-all duration-300 flex-1 min-h-0"
            >
                {activeTab === 'suggestions' && (
                    <InlineErrorBoundary>
                        <SuggestionsManager
                            pdfFiles={pdfFiles}
                            isInline={true}
                            groups={groups}
                            setGroups={setGroups}
                            onAddToQueue={onAddToQueue}
                            isUnifiedView={true} // New prop to alter internal rendering
                            onCreateGroup={handleCreateGroup}
                            uploads={uploads}
                            importedItems={importedItems} // PASS IMPORTED ITEMS
                            onAvailableItemsChange={handleAvailableItemsChange}
                        />
                    </InlineErrorBoundary>
                )}

                {activeTab === 'uploads' && (
                    <InlineErrorBoundary>
                        <div className="flex flex-col h-full gap-2">
                            <div className="flex-shrink-0 flex flex-col gap-2">
                                <button
                                    onClick={handlePasteFromClipboard}
                                    className="self-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors shadow-lg shadow-blue-500/20 flex items-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                        <path fillRule="evenodd" d="M15.988 3.012A2.25 2.25 0 0 1 18 5.25v6.5A2.25 2.25 0 0 1 15.75 14H13.5V7A2.5 2.5 0 0 0 11 4.5H8.128a2.252 2.252 0 0 1 1.884-1.488A2.25 2.25 0 0 1 12.25 1h1.5a2.25 2.25 0 0 1 2.238 2.012ZM11 7a.5.5 0 0 0-.5.5v2.987h2.986a.5.5 0 0 0 .5-.5V7.5a.5.5 0 0 0-.5-.5H11ZM9.502 6.502a.5.5 0 0 0-.5.5v3h-3a.5.5 0 0 0 0 1h3v3.003a.5.5 0 0 0 1 0v-3.003h2.999a.5.5 0 0 0 0-1h-2.999v-3a.5.5 0 0 0-.5-.5Z" />
                                        <path fillRule="evenodd" d="M2.25 18a.75.75 0 0 1 .75-.75h14a.75.75 0 0 1 0 1.5H3a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
                                    </svg>
                                    Paste from Clipboard
                                </button>
                                <FileUpload onUpload={onUpload} label="Drop images here or Paste (Ctrl+V)" accept="image/*" multiple={true} />
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <UploadedImagesPanel
                                    images={uploads}
                                    onAddToQueue={onAddToQueue}
                                    groups={groups}
                                    setGroups={setGroups}
                                    onUpload={onUpload}
                                    onPreview={setPreviewItem}
                                />
                            </div>
                        </div>
                    </InlineErrorBoundary>
                )}

                {activeTab === 'folder' && (
                    <FolderTab
                        onAddToQueue={onAddToQueue}
                        onAddToGroup={handleAddToGroup}
                        groups={groups}
                        activeTab={activeTab}
                        currentPath={folderPath}
                        setFolderPath={setFolderPath}
                        currentImages={folderImages}
                        setFolderImages={setFolderImages}
                        onCreateGroup={handleCreateGroup}
                        onPreview={setPreviewItem}
                        onPin={handlePinFolder}
                        onImport={handleImportImages}
                    />
                )}

                {activeTab.startsWith('pinned-') && (
                    <FolderTab
                        onAddToQueue={onAddToQueue}
                        onAddToGroup={handleAddToGroup}
                        groups={groups}
                        activeTab={activeTab}
                        currentPath={pinnedFolders.find(f => `pinned-${f.id}` === activeTab)?.path || ''}
                        setFolderPath={(path) => updatePinnedFolder(activeTab.replace('pinned-', ''), { path })}
                        currentImages={pinnedFolders.find(f => `pinned-${f.id}` === activeTab)?.images || []}
                        setFolderImages={(images) => updatePinnedFolder(activeTab.replace('pinned-', ''), { images })}
                        onCreateGroup={handleCreateGroup}
                        onPreview={setPreviewItem}
                        // Pinned folders can't be pinned again (or we could allowing cloning, but cleaner not to)
                        onPin={null}
                        onImport={handleImportImages}
                    />
                )}

                {activeTab.startsWith('pdf-') && (
                    <ReportTab
                        pdfFilename={activeTab.replace('pdf-', '')}
                        onAccept={onAddToQueue}
                        onAddToGroup={handleAddToGroup}
                        groups={groups}
                        onCreateGroup={handleCreateGroup}
                        onImport={handleImportImages} // Usually redundant as proposed items are auto-fetched, but user requested explicit control
                    />
                )}
            </div>
            {/* Preview Modal for Group Items */}
            {previewItem && (
                <ImagePreviewModal
                    item={previewItem}
                    onClose={() => setPreviewItem(null)}
                    onAddToReview={(item, prompt) => {
                        // Add to queue logic (needs to support different item types)
                        if (item.type === 'group') {
                            // If previewing a group item (wait, previewItem is single image?)
                            // GroupsPanel renders group items. If we click one, we get a single item.
                            // We construct a queue item for it.
                            onAddToQueue({
                                type: 'single', // Or keep original type if useful
                                id: item.id,
                                ...item,
                                user_prompt: prompt,
                                status: 'ready'
                            });
                        } else {
                            // Folder/Uploads item
                            onAddToQueue({
                                type: 'single',
                                ...item,
                                user_prompt: prompt,
                                status: 'ready'
                            });
                        }
                        setPreviewItem(null);
                    }}
                />
            )}
        </div>
    );
};

export default UnifiedImagePanel;
