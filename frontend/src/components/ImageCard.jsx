import React, { useState } from 'react';

const ImageCard = ({
    item,
    previewUrl,
    groups = [],
    isSelected = false,
    onSelect,
    onPreview,
    onAddToGroup,
    onCreateGroup,
    onAddToQueue,
    onDelete, // If provided, shows delete button (e.g., for Suggestions)
    showSelection = true, // toggle selection checkbox
}) => {
    // Determine title and subtitle
    const title = item.label || item.title || item.filename || "Untitled";
    const subtitle = item.type || (item.file ? "Upload" : "Image");
    const pageInfo = item.page ? `Page ${item.page}` : null;

    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Close menu when clicking outside (handled by simple toggle for now, click-away handling is complex without a hook but this is better than hover)
    // Actually, handling click-away is better. But let's start with toggle.
    // To properly handle click-away, we can use a transparent fixed overlay.

    return (
        <div
            className={`group/card relative rounded-xl bg-slate-900 border transition-all duration-200
                ${isSelected ? 'border-blue-500 shadow-lg shadow-blue-500/10' : 'border-white/10 hover:border-blue-400/50'}
            `}
        >
            {/* Image Area */}
            <div
                className="aspect-video bg-slate-950 relative cursor-pointer rounded-t-xl overflow-hidden"
                onClick={onPreview}
            >
                <img
                    src={previewUrl}
                    alt={title}
                    className="w-full h-full object-contain"
                />

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/20 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover/card:opacity-100 text-white text-xs font-medium bg-black/50 px-2 py-1 rounded backdrop-blur-sm pointer-events-none">
                        Click to Enlarge
                    </span>
                </div>

                {/* Top Right: Page Info or Delete */}
                <div className="absolute top-2 right-2 flex gap-1">
                    {pageInfo && (
                        <div className="px-2 py-1 rounded bg-black/60 text-white text-[10px] font-medium backdrop-blur-sm">
                            {pageInfo}
                        </div>
                    )}
                    {onDelete && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(item.id);
                            }}
                            className="p-1 rounded-full bg-red-500/80 text-white opacity-0 group-hover/card:opacity-100 hover:bg-red-600 transition-all"
                            title="Delete / Hide"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Top Left: Selection Checkbox */}
                {showSelection && onSelect && (
                    <div className="absolute top-2 left-2" onClick={e => e.stopPropagation()}>
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={onSelect}
                            className="w-4 h-4 rounded border-gray-500 text-blue-600 focus:ring-blue-500 bg-black/50"
                        />
                    </div>
                )}
            </div>

            {/* Info & Actions Area */}
            <div className="p-3 bg-slate-900 border-t border-white/5 rounded-b-xl">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-200 truncate" title={title}>
                            {title}
                        </p>
                        <p className="text-[10px] text-slate-500 capitalize truncate">
                            {subtitle}
                        </p>
                    </div>
                </div>

                {/* Action Buttons Row */}
                <div className="flex gap-2 items-center mt-2 opacity-60 group-hover/card:opacity-100 transition-opacity">
                    {/* Add to Queue Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onAddToQueue) onAddToQueue(item);
                        }}
                        className="flex-1 py-1.5 rounded bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-600 hover:text-white transition-all border border-blue-500/20 hover:border-blue-500"
                    >
                        Add to Queue
                    </button>

                    {/* Group Dropdown */}
                    {(onAddToGroup || onCreateGroup) && (
                        <div className="relative">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsMenuOpen(!isMenuOpen);
                                }}
                                className={`p-1.5 rounded text-slate-400 hover:text-white border hover:bg-slate-700 transition-colors ${isMenuOpen ? 'bg-slate-700 text-white border-whitespace/10' : 'bg-slate-800 border-white/5'
                                    }`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                    <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                                </svg>
                            </button>

                            {/* Dropdown Menu Overlay for Close */}
                            {isMenuOpen && (
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsMenuOpen(false);
                                    }}
                                />
                            )}

                            {/* Dropdown Menu */}
                            {isMenuOpen && (
                                <div className="absolute bottom-full right-0 mb-1 w-40 bg-slate-800 rounded-lg shadow-xl border border-white/10 z-20 max-h-48 overflow-y-auto">
                                    <div className="p-1 space-y-0.5">
                                        {/* Create New Option */}
                                        {onCreateGroup && (
                                            <>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // Close menu first to avoid stuck state
                                                        setIsMenuOpen(false);
                                                        // Use timeout to allow UI to update before blocking with prompt
                                                        setTimeout(() => {
                                                            const title = window.prompt("Enter new group name:");
                                                            if (title && title.trim()) {
                                                                try {
                                                                    onCreateGroup(title, [item]);
                                                                } catch (err) {
                                                                    console.error("Create group failed", err);
                                                                    alert("Failed to create group: " + err.message);
                                                                }
                                                            }
                                                        }, 50);
                                                    }}
                                                    className="w-full text-left px-2 py-1.5 text-xs text-blue-400 hover:bg-slate-700 rounded flex items-center gap-2"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                                        <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                                                    </svg>
                                                    Create New
                                                </button>
                                                {(groups && groups.length > 0) && <div className="h-px bg-white/10 my-1 font-medium" />}
                                            </>
                                        )}

                                        {(groups && groups.length > 0) && (
                                            <p className="px-2 py-1 text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Groups</p>
                                        )}

                                        {groups && groups.map(g => (
                                            <button
                                                key={g.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsMenuOpen(false);
                                                    if (onAddToGroup) onAddToGroup(item, g.id);
                                                }}
                                                className="w-full text-left px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white rounded truncate transition-colors"
                                                title={g.title}
                                            >
                                                {g.title}
                                            </button>
                                        ))}

                                        {(!groups || groups.length === 0) && !onCreateGroup && (
                                            <p className="px-2 py-1 text-xs text-slate-500 italic">No actions available</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImageCard;
