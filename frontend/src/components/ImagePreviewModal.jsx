import React, { useState } from 'react';

const ImagePreviewModal = ({ item, onClose, onAddToReview }) => {
    const [prompt, setPrompt] = useState("");

    if (!item) return null;

    // Helper to resolve image source
    const getImageSrc = (img) => {
        if (img.file) {
            return URL.createObjectURL(img.file);
        }
        if (img.preview_url) {
            if (img.preview_url.startsWith('http') || img.preview_url.startsWith('blob:')) {
                return img.preview_url;
            }
            return `http://localhost:8000${img.preview_url}`;
        }
        // Fallback for proposed items
        if (img.pdf_name && img.filename) {
            return `http://localhost:8000/static/proposed/${img.pdf_name}/${img.filename}`;
        }
        return "";
    };

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-8"
            onClick={onClose}
        >
            <div className="relative max-w-5xl max-h-full bg-slate-900 rounded-2xl overflow-hidden border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
                {/* Close Button */}
                <button
                    className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors cursor-pointer border border-white/10"
                    onClick={onClose}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Wrapper to ensure flex centering and scrolling if needed */}
                <div className="flex flex-col max-h-[90vh]">
                    {/* Image Area */}
                    <div className="flex-1 flex items-center justify-center bg-black/50 p-4 min-h-[400px] overflow-hidden">
                        <img
                            src={getImageSrc(item)}
                            alt={item.label || item.filename}
                            className="max-w-full max-h-[70vh] object-contain"
                        />
                    </div>

                    {/* Controls Footer */}
                    <div className="p-4 bg-slate-900 border-t border-white/10 flex justify-between items-center gap-4 flex-wrap">
                        <div className="min-w-0 flex-1">
                            <h3 className="text-lg font-medium text-white truncate" title={item.label || item.filename || item.title}>
                                {item.label || item.filename || item.title}
                            </h3>
                            <p className="text-sm text-slate-400 capitalize truncate">
                                {item.type || "Image"}
                                {item.page ? ` • Page ${item.page}` : ""}
                                {item.pdf_name ? ` • ${item.pdf_name}` : ""}
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <input
                                type="text"
                                placeholder="Add optional notes..."
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                className="bg-slate-800 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-64"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        onAddToReview(item, prompt);
                                        onClose();
                                    }
                                }}
                            />
                            <button
                                onClick={() => {
                                    onAddToReview(item, prompt);
                                    onClose();
                                }}
                                className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors whitespace-nowrap shadow-lg shadow-blue-500/20"
                            >
                                Add to Review
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImagePreviewModal;
