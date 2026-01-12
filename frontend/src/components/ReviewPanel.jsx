import React, { useState, useEffect } from 'react';
import { updateStaging, approveItem, checkMerge, executeMerge, getApprovedContent, updateApprovedItem, redoImage } from '../api/client';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ReviewPanel Error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-red-500 rounded-2xl p-8 max-w-lg w-full">
                        <h2 className="text-xl font-bold text-red-400 mb-4">Something went wrong</h2>
                        <div className="bg-black/50 p-4 rounded mb-6 overflow-auto max-h-64">
                            <pre className="text-xs text-red-200 font-mono whitespace-pre-wrap">
                                {this.state.error?.toString()}
                            </pre>
                        </div>
                        <div className="flex justify-end gap-4">
                            <button
                                onClick={() => window.location.reload()}
                                className="px-4 py-2 bg-slate-800 rounded hover:bg-slate-700 text-white"
                            >
                                Reload Page
                            </button>
                            {this.props.onClose && (
                                <button
                                    onClick={this.props.onClose}
                                    className="px-4 py-2 bg-red-600 rounded hover:bg-red-700 text-white"
                                >
                                    Close Panel
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

const ReviewPanelContent = ({ upload, onClose, onApprove, onUpdate, onRemove, onSaveDraft, onRedo }) => {
    // Determine the active upload from props
    // const upload = queue && queue.length > 0 ? queue[0] : null; // REMOVED

    // Hooks must be called unconditionally
    const [csv, setCsv] = useState('');
    const [markdown, setMarkdown] = useState('');
    const [csvFilename, setCsvFilename] = useState('');
    const [mdFilename, setMdFilename] = useState('');
    const [saving, setSaving] = useState(false);

    const [mergeCandidates, setMergeCandidates] = useState([]);
    const [checkingMerge, setCheckingMerge] = useState(false);
    const [selectedMerge, setSelectedMerge] = useState(null);
    const [loadingContent, setLoadingContent] = useState(false);

    const [showFeedback, setShowFeedback] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [redoing, setRedoing] = useState(false);
    const [imageUrl, setImageUrl] = useState(null);
    const [sourceImages, setSourceImages] = useState([]);
    const [activeImageIndex, setActiveImageIndex] = useState(0);

    // Layout State
    const [layoutMode, setLayoutMode] = useState('default');
    const [verticalSplit, setVerticalSplit] = useState(50);
    const [horizontalSplit, setHorizontalSplit] = useState(50);
    const isDraggingVertical = React.useRef(false);

    // Initialize state when 'upload' changes
    useEffect(() => {
        if (!upload || !upload.result) {
            setCsv('');
            setMarkdown('');
            return;
        }

        if (upload.isApproved) {
            // Fetch content for approved item
            fetchApprovedContent(upload);
            setCsvFilename(upload.result.final_csv_name || '');
            setMdFilename(upload.result.final_md_name || '');
        } else {
            // Staging item logic
            setCsv(upload.result.csv || '');
            setMarkdown(upload.result.markdown || '');

            if (upload.result.suggested_csv_name) {
                setCsvFilename(String(upload.result.suggested_csv_name));
            } else {
                const baseName = (upload.file?.name || "Untitled").replace(/\.[^/.]+$/, "") || "Untitled";
                setCsvFilename(`${baseName}.csv`);
            }

            if (upload.result.suggested_md_name) {
                setMdFilename(String(upload.result.suggested_md_name));
            } else {
                const baseName = (upload.file?.name || "Untitled").replace(/\.[^/.]+$/, "") || "Untitled";
                setMdFilename(`${baseName}.md`);
            }

            // Set Image URL for staging
            if (upload.result.stored_filename) {
                setImageUrl(`http://localhost:8000/static/input/${upload.result.stored_filename}`);
            } else {
                setImageUrl(null);
            }

            if (upload.result.source_images && Array.isArray(upload.result.source_images) && upload.result.source_images.length > 0) {
                setSourceImages(upload.result.source_images.map(img => `http://localhost:8000/static/input/${img}`));
            } else {
                setSourceImages([]);
            }

            // Auto-check for merges only for staging items
            if (upload.result.id) {
                checkMergeCandidates(upload.result.id);
            }
        }
        // Reset feedback state
        setShowFeedback(false);
        setFeedback('');
    }, [upload]);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isDraggingVertical.current) {
                const newSplit = (e.clientX / window.innerWidth) * 100;
                setVerticalSplit(Math.min(80, Math.max(20, newSplit)));
            }
        };

        const handleMouseUp = () => {
            isDraggingVertical.current = false;
            document.body.style.cursor = 'default';
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    // --- Helper Functions ---

    const fetchApprovedContent = async (currentUpload) => {
        setLoadingContent(true);
        try {
            const content = await getApprovedContent(currentUpload.result.id);
            setCsv(content.csv);
            setMarkdown(content.markdown);
            if (content.image_ext) {
                setImageUrl(`http://localhost:8000/static/approved/${content.id}_input${content.image_ext}`);
            }
            if (content.source_images && content.source_images.length > 0) {
                setSourceImages(content.source_images.map(img => `http://localhost:8000/static/input/${img}`));
            } else {
                setSourceImages([]);
            }
        } catch (err) {
            console.error("Failed to fetch approved content", err);
        } finally {
            setLoadingContent(false);
        }
    };

    const checkMergeCandidates = async (id) => {
        setCheckingMerge(true);
        try {
            const data = await checkMerge(id);
            setMergeCandidates(data.candidates || []);
        } catch (err) {
            console.error("Failed to check merge", err);
        } finally {
            setCheckingMerge(false);
        }
    };

    const startVerticalResize = (e) => {
        e.preventDefault();
        isDraggingVertical.current = true;
        document.body.style.cursor = 'col-resize';
    };

    const toggleMaximize = (mode) => {
        setLayoutMode(prev => prev === mode ? 'default' : mode);
    };

    const handleSave = async () => {
        if (!upload) return;
        setSaving(true);
        try {
            if (upload.isApproved) {
                await updateApprovedItem(upload.result.id, csv, markdown, csvFilename, mdFilename);
                alert("File updated successfully!");
                if (onApprove) onApprove(upload, { csv, markdown, csv_filename: csvFilename, md_filename: mdFilename });
            } else {
                if (onSaveDraft) {
                    await onSaveDraft(upload.result.id, {
                        csv,
                        markdown,
                        csv_filename: csvFilename,
                        md_filename: mdFilename
                    });
                    alert("Draft saved successfully!");
                }
            }
        } catch (err) {
            console.error("Failed to save", err);
            alert("Failed to save: " + (err.response?.data?.detail || err.message));
        } finally {
            setSaving(false);
        }
    };

    const handleApproveAction = async () => {
        if (!upload) return;
        if (upload.isApproved) {
            await handleSave();
            return;
        }

        setSaving(true);
        try {
            const finalCsv = String(csvFilename || "output.csv");
            const finalMd = String(mdFilename || "output.md");

            if (onApprove) {
                await onApprove(upload, {
                    csv_filename: finalCsv,
                    md_filename: finalMd,
                    csv,
                    markdown
                });
            }
        } catch (err) {
            console.error("Failed to approve", err);
            alert("Failed to approve.");
        } finally {
            setSaving(false);
        }
    };

    const handleRedoAction = async () => {
        if (!feedback.trim()) {
            alert("Please provide feedback for the redo.");
            return;
        }

        // Fire and forget (let parent handle async)
        if (onRedo) {
            onRedo(upload.id, feedback);
        }

        // Close immediately (do NOT remove from queue)
        if (onClose) {
            onClose();
        }
    };

    if (!upload) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 bg-slate-900 border border-white/10 rounded-xl m-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mb-4 opacity-50">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
                <p>Select an item from the queue to review</p>
            </div>
        );
    }

    // Processing State
    if (upload.status === 'processing' || upload.status === 'pending') {
        return (
            <div className="h-full flex flex-col items-center justify-center text-blue-400 bg-slate-900 border border-white/10 rounded-xl m-2">
                <div className="mb-4 relative">
                    <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-blue-500">
                            <path d="M10 2a.75.75 0 01.75.75v5.59l2.68-2.68a.75.75 0 111.06 1.06l-4 4a.75.75 0 01-1.06 0l-4-4a.75.75 0 011.06-1.06l2.68 2.68V2.75A.75.75 0 0110 2z" />
                        </svg>
                    </div>
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">AI Processing</h3>
                <p className="text-sm text-slate-400 max-w-[200px] text-center">Generating description and data analysis...</p>
                {upload.type === 'group' && <p className="text-xs text-slate-500 mt-2">Merging {upload.items?.length || 0} images</p>}
            </div>
        );
    }

    const isImageVisible = layoutMode === 'default' || layoutMode === 'image-only';
    const isDataVisible = layoutMode === 'default' || layoutMode === 'csv-only' || layoutMode === 'md-only';
    const imageWidth = layoutMode === 'image-only' ? '100%' : layoutMode === 'default' ? `${verticalSplit}%` : '0%';
    const dataWidth = layoutMode === 'default' ? `${100 - verticalSplit}%` : (layoutMode === 'csv-only' || layoutMode === 'md-only') ? '100%' : '0%';

    return (
        <div className="flex flex-col h-full bg-slate-900 overflow-hidden rounded-xl border border-white/10 m-2">

            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-900/50">
                <div className="flex-1 min-w-0 pr-4">
                    <h2 className="text-lg font-semibold text-white truncate">{upload.file?.name}</h2>
                    <p className="text-xs text-slate-400">Review & Approve</p>
                </div>
                <div className="flex bg-slate-800 rounded-lg p-1 border border-white/5 shrink-0">
                    {['default', 'image-only', 'csv-only', 'md-only'].map(mode => (
                        <button
                            key={mode}
                            onClick={() => toggleMaximize(mode)}
                            className={`px-3 py-1 text-xs font-medium rounded transition-all capitalize ${layoutMode === mode ? 'bg-blue-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                            {mode.replace('-only', '')}
                        </button>
                    ))}
                </div>
                {onClose && (
                    <button onClick={onClose} className="ml-4 text-slate-400 hover:text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-hidden flex relative" onMouseUp={() => isDraggingVertical.current = false}>
                {isImageVisible && (
                    <div style={{ width: imageWidth }} className="flex flex-col border-r border-white/10 relative overflow-hidden bg-black/50">
                        <div className="flex-1 flex items-center justify-center p-4 relative group">
                            <img
                                src={sourceImages[activeImageIndex] || imageUrl}
                                className="max-w-full max-h-full object-contain"
                                alt={`Review Content ${activeImageIndex + 1}`}
                                onError={(e) => { e.target.style.display = 'none'; e.target.onerror = null; }}
                            />

                            {/* Carousel Navigation */}
                            {sourceImages.length > 1 && (
                                <>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setActiveImageIndex(prev => Math.max(0, prev - 1)); }}
                                        disabled={activeImageIndex === 0}
                                        className="absolute left-2 p-2 bg-black/50 hover:bg-black/80 rounded-full text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setActiveImageIndex(prev => Math.min(sourceImages.length - 1, prev + 1)); }}
                                        disabled={activeImageIndex === sourceImages.length - 1}
                                        className="absolute right-2 p-2 bg-black/50 hover:bg-black/80 rounded-full text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                        </svg>
                                    </button>
                                    {/* Counter */}
                                    <div className="absolute bottom-4 bg-black/60 px-3 py-1 rounded-full text-xs text-white backdrop-blur-sm">
                                        {activeImageIndex + 1} / {sourceImages.length}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {layoutMode === 'default' && (
                    <div className="w-1 bg-slate-800 hover:bg-blue-500 cursor-col-resize z-10 flex items-center justify-center" onMouseDown={startVerticalResize}>
                        <div className="w-0.5 h-8 bg-slate-600 rounded-full" />
                    </div>
                )}

                {isDataVisible && (
                    <div style={{ width: dataWidth }} className="flex flex-col h-full bg-slate-950">
                        {(layoutMode === 'default' || layoutMode === 'csv-only') && (
                            <div className="flex-1 flex flex-col border-b border-white/10 min-h-0">
                                <div className="p-2 border-b border-white/5 flex gap-2">
                                    <span className="text-blue-400 text-xs font-bold px-2 py-0.5 bg-blue-400/10 rounded">CSV</span>
                                    <input value={csvFilename} onChange={e => setCsvFilename(e.target.value)} className="bg-transparent text-white text-xs border border-white/10 rounded px-1 flex-1 focus:border-blue-500 outline-none" placeholder="Filename" />
                                </div>
                                <textarea value={csv} onChange={e => setCsv(e.target.value)} className="flex-1 bg-slate-950 p-3 text-xs font-mono text-slate-300 resize-none outline-none focus:bg-slate-900/50 transition-colors" spellCheck="false" />
                            </div>
                        )}
                        {(layoutMode === 'default' || layoutMode === 'md-only') && (
                            <div className="flex-1 flex flex-col min-h-0">
                                <div className="p-2 border-b border-white/5 flex gap-2">
                                    <span className="text-purple-400 text-xs font-bold px-2 py-0.5 bg-purple-400/10 rounded">MD</span>
                                    <input value={mdFilename} onChange={e => setMdFilename(e.target.value)} className="bg-transparent text-white text-xs border border-white/10 rounded px-1 flex-1 focus:border-purple-500 outline-none" placeholder="Filename" />
                                </div>
                                <textarea value={markdown} onChange={e => setMarkdown(e.target.value)} className="flex-1 bg-slate-950 p-3 text-xs font-mono text-slate-300 resize-none outline-none focus:bg-slate-900/50 transition-colors" spellCheck="false" />
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="p-3 border-t border-white/10 flex justify-between bg-slate-900/50 items-center">
                <div className="flex gap-2 items-center">
                    {!showFeedback && <button onClick={() => setShowFeedback(true)} className="px-3 py-1.5 rounded text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors">Decline & Redo</button>}
                    {showFeedback && (
                        <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-left-5 p-2 bg-slate-800 rounded border border-white/10 absolute bottom-12 left-4 shadow-xl z-50 w-72">
                            <h4 className="text-xs font-semibold text-slate-300">Decline & Redo</h4>
                            <textarea
                                value={feedback}
                                onChange={e => setFeedback(e.target.value)}
                                placeholder="Describe changes needed..."
                                className="bg-slate-900 border border-white/10 rounded p-2 text-xs text-white w-full h-24 focus:border-red-500 outline-none resize-none"
                                autoFocus
                            />
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setShowFeedback(false)} className="px-2 py-1 text-slate-400 text-xs hover:text-white">Cancel</button>
                                <button
                                    onClick={handleRedoAction}
                                    className="px-3 py-1 rounded bg-red-500 text-white text-xs hover:bg-red-600 transition-colors"
                                >
                                    Submit Redo
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex gap-2">
                    <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 rounded text-xs font-medium text-slate-300 hover:bg-white/5 border border-transparent hover:border-white/5 transition-colors">Save Draft</button>
                    <button onClick={handleApproveAction} disabled={saving} className="px-4 py-1.5 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all flex items-center gap-2">
                        {saving && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        Approve & Save
                    </button>
                </div>
            </div>

        </div>
    );
};

const ReviewPanel = (props) => (
    <ErrorBoundary onClose={props.onClose}>
        <ReviewPanelContent {...props} />
    </ErrorBoundary>
);

export default ReviewPanel;
