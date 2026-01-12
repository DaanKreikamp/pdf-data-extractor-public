import React, { useState, useEffect, useRef } from 'react';
import { uploadPDF, updateStaging, approveItem, checkMerge, executeMerge, getMergeSuggestions, suggestImageMerges, executeMergeGroup, uploadImage, getApprovedItems, saveAllApproved, updateApprovedItem, deleteApprovedItem, clearApprovedStash, redoImage, processLocalImage, resetGlobalContext, extractImages, browseFolder, saveApprovedItem } from '../api/client';
import UnifiedImagePanel from '../components/UnifiedImagePanel';
import ReviewPanel from '../components/ReviewPanel';
import ApprovedFilesPanel from '../components/ApprovedFilesPanel';
import SettingsModal from '../components/SettingsModal';
// import HelpModal from '../components/HelpModal';
import ContextPanel from '../components/ContextPanel';
import PDFUploadSection from '../components/PDFUploadSection';
import ReviewQueueList from '../components/ReviewQueueList';
import ModelSelector from '../components/ModelSelector';
import SaveOptionsModal from '../components/SaveOptionsModal';

const Dashboard = () => {
    // ---- State for Data ----
    const [pdfFiles, setPdfFiles] = useState([]);
    const [uploads, setUploads] = useState([]); // Array of uploaded/processed image items
    const [groups, setGroups] = useState([]); // Lifted state for Groups
    const [reviewQueue, setReviewQueue] = useState([]);
    const [approvedItems, setApprovedItems] = useState([]);

    // Active item being reviewed in the full-screen modal
    const [activeReviewItem, setActiveReviewItem] = useState(null);

    // Layout State
    const [isReviewSidebarOpen, setIsReviewSidebarOpen] = useState(false);

    // Poll interval for PDF progress
    useEffect(() => {
        const interval = setInterval(async () => {
            // Check status of processing PDFs
            // Also include 'analyzing_text' as a processing state
            const processingPdfs = pdfFiles.filter(f => f.status === 'processing' || f.status === 'analyzing_text');
            if (processingPdfs.length > 0) {
                const updatedPdfs = await Promise.all(processingPdfs.map(async (pdf) => {
                    try {
                        const response = await fetch(`http://localhost:8000/api/pdf/status/${pdf.filename}`);
                        const data = await response.json();
                        return { ...pdf, ...data };
                    } catch (e) {
                        return pdf;
                    }
                }));

                setPdfFiles(prev => prev.map(p => {
                    const updated = updatedPdfs.find(u => u.filename === p.filename);
                    return updated || p;
                }));
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [pdfFiles]);

    // Initial load of approved items and RESET CONTEXT
    useEffect(() => {
        loadApprovedItems();
        // Clear global context for a fresh session
        resetGlobalContext().catch(err => console.error("Failed to reset context", err));
    }, []);

    // Auto-open sidebar when items added to queue
    useEffect(() => {
        if (reviewQueue.length > 0 && !isReviewSidebarOpen) {
            setIsReviewSidebarOpen(true);
        }
    }, [reviewQueue.length]);

    const loadApprovedItems = async () => {
        try {
            const items = await getApprovedItems();
            setApprovedItems(items);
        } catch (error) {
            console.error("Failed to load approved items", error);
        }
    };

    // ---- Handlers ----

    const handlePdfUpload = async (file, mode = 'content') => {
        // Optimistic UI update
        const newPdf = { filename: file.name, status: 'processing', progress: 0, mode: mode };
        setPdfFiles(prev => [...prev, newPdf]);

        try {
            await uploadPDF(file, mode);
        } catch (error) {
            console.error("PDF upload failed", error);
            setPdfFiles(prev => prev.map(p => p.filename === file.name ? { ...p, status: 'error' } : p));
            alert("PDF upload failed.");
        }
    };

    const handleExtractImages = async (filename) => {
        // Optimistic update
        setPdfFiles(prev => prev.map(p => p.filename === filename ? { ...p, status: 'processing', mode: 'content' } : p));
        try {
            await extractImages(filename);
        } catch (error) {
            console.error("Extraction trigger failed", error);
            alert("Failed to start image extraction.");
        }
    };

    const handleImageUpload = async (fileOrFiles) => {
        const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];

        for (const file of files) {
            // Optimistic
            const tempId = Math.random().toString(36);
            const newItem = {
                id: tempId,
                file: file,
                status: 'processing',
                preview_url: null
            };
            setUploads(prev => [...prev, newItem]);

            try {
                // Upload and process
                const response = await uploadImage(file, true); // Process immediately
                const result = response.result;

                // Replace temp item with result
                setUploads(prev => prev.map(item => item.id === tempId ? {
                    ...result,
                    id: result.id || tempId, // Use staging ID if available
                    file: file, // Keep file for local preview if needed
                    status: 'done'
                } : item));

            } catch (error) {
                console.error("Image upload failed", error);
                setUploads(prev => prev.map(item => item.id === tempId ? { ...item, status: 'error' } : item));
            }
        }
    };

    // Consolidated Upload Handler for UnifiedImagePanel
    const handleUniversalUpload = async (fileOrFiles, mode = 'content') => {
        const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
        // Group by type to batch or handle individually
        for (const file of files) {
            const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
            if (isPdf) {
                await handlePdfUpload(file, mode);
            } else {
                // Assume image for now
                await handleImageUpload(file);
            }
        }
    };

    // --- Processing Logic for Queue Items ---
    const processQueueItem = async (item) => {
        // Create optimistic item with status 'processing'
        const processingItem = {
            ...item,
            status: 'processing',
            result: null // Clear result until processed
        };

        // Update queue to show processing state
        setReviewQueue(prev => prev.map(i => i.id === item.id ? processingItem : i));

        try {
            let result;
            if (item.type === 'group') {
                // Group processing: executeMergeGroup(items, prompt)
                // item.items is the array of images
                result = await executeMergeGroup(item.items, item.user_prompt);
            } else if (item.type === 'approved_edit') {
                // Already has data, just set ready
                result = item.result;
            } else if (item.result && item.status === 'review_ready') {
                // Already processed, do nothing
                return;
            } else {
                // Single image processing: uploadImage if file exists, or executeMergeGroup if it's a single proposed item
                // If it's a file object:
                if (item.file) {
                    // Upload Image (client.js uploadImage only takes file, process boolean)
                    // We ignore user_prompt for direct single image uploads as backend doesn't support it in this route yet?
                    // Or we could try to pass it if backend supports it. For now, assume uploadImage works for raw files.
                    const response = await uploadImage(item.file, true);
                    result = response.result; // Unwrap to get the actual staging item
                } else {
                    // It's a proposed item (from backend suggestions). Treat as size-1 group.
                    result = await executeMergeGroup([item], item.user_prompt);
                }
            }

            // Update queue with result and set ready
            setReviewQueue(prev => prev.map(i => i.id === item.id ? {
                ...i,
                status: 'review_ready',
                result: result
            } : i));

        } catch (err) {
            console.error("Processing failed for item", item.id, err);
            setReviewQueue(prev => prev.map(i => i.id === item.id ? {
                ...i,
                status: 'error',
                error: err.message || "Processing failed"
            } : i));
        }
    };


    // Add item to review queue AND TRIGGER PROCESSING
    const handleAddToQueue = (item) => {
        // Avoid duplicates
        setReviewQueue(prev => {
            if (prev.some(i => i.id === item.id)) return prev;
            return [...prev, { ...item, status: 'pending' }]; // Add as pending
        });

        // Trigger processing immediately
        processQueueItem(item);
    };

    const handleRemoveFromQueue = (id) => {
        setReviewQueue(prev => prev.filter(i => i.id !== id));
        if (activeReviewItem?.id === id) {
            setActiveReviewItem(null);
        }
    };

    const handleApprove = async (item, finalData) => {
        // finalData contains csv, markdown, filenames
        try {
            if (item.type === 'approved_edit') {
                await updateApprovedItem(item.id, finalData.csv, finalData.markdown, finalData.csv_filename, finalData.md_filename);
            } else {
                await approveItem(item.result?.id || item.id, finalData.csv_filename, finalData.md_filename);
            }

            // Remove from queue
            handleRemoveFromQueue(item.id);
            // Refresh approved list
            loadApprovedItems();
            // Close modal
            setActiveReviewItem(null);
        } catch (error) {
            console.error("Approval failed", error);
            alert("Failed to approve item: " + (error.response?.data?.detail || error.message));
        }
    };

    const handleSaveStaging = async (id, data) => {
        try {
            await updateStaging(id, data.csv, data.markdown, data.csv_filename, data.md_filename);

            // Update local state so changes persist if re-opened
            setReviewQueue(prev => prev.map(i => {
                if (i.id === id || i.result?.id === id) { // Check both top ID and result ID
                    return {
                        ...i,
                        result: {
                            ...i.result,
                            csv: data.csv,
                            markdown: data.markdown,
                            suggested_csv_name: data.csv_filename,
                            suggested_md_name: data.md_filename
                        }
                    };
                }
                return i;
            }));

            // Also update active item if open
            if (activeReviewItem?.id === id || activeReviewItem?.result?.id === id) {
                setActiveReviewItem(prev => ({
                    ...prev,
                    result: {
                        ...prev.result,
                        csv: data.csv,
                        markdown: data.markdown,
                        suggested_csv_name: data.csv_filename,
                        suggested_md_name: data.md_filename
                    }
                }));
            }

        } catch (error) {
            console.error("Save draft failed", error);
            alert("Failed to save draft locally: " + error.message);
        }
    }

    const handleSaveSingle = async (item) => {
        try {
            // 1. Select directory
            const result = await browseFolder();
            if (!result || !result.path) return;

            const targetDir = result.path;

            // 2. Save
            const saveResult = await saveApprovedItem(item.id, targetDir, targetDir);
            alert(`Saved file to ${saveResult.directory}`);

            // 3. Refresh list (item should disappear as it moves to history)
            loadApprovedItems();
        } catch (error) {
            console.error("Save single failed", error);
            alert("Failed to save file: " + error.message);
        }
    };

    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

    const handleSaveAllClick = () => {
        setIsSaveModalOpen(true);
    };

    const handleSaveConfirm = async (csvDir, mdDir) => {
        try {
            setIsSaveModalOpen(false);
            const result = await saveAllApproved(csvDir, mdDir);
            alert(`Saved ${result.count} files to ${result.directory}`);
            loadApprovedItems(); // Refresh the list (should be empty now)
        } catch (error) {
            console.error("Save all failed", error);
            alert("Failed to save files: " + (error.response?.data?.detail || error.message));
        }
    };

    const handleEditApproved = (item) => {
        // Add to review queue with a special flag
        const queueItem = {
            ...item,
            type: 'approved_edit', // Mark as editing an approved item
            result: {
                id: item.id, // Important for backend updates
                csv: item.csv,
                markdown: item.markdown,
                title: item.filename, // Display usage
                suggested_csv_name: item.filename, // Pre-fill
                suggested_md_name: item.markdown_filename,
                image_path: item.original_image_path // Needs to be passed if we want to show image
            }
        };
        handleAddToQueue(queueItem);
    };

    const handleDeleteApproved = async (id) => {
        if (window.confirm("Are you sure you want to delete this item?")) {
            try {
                await deleteApprovedItem(id);
                loadApprovedItems();
            } catch (error) {
                console.error("Delete failed", error);
            }
        }
    };

    const handleRedo = async (id, feedback) => {

        const item = reviewQueue.find(i => i.id === id);
        if (!item) {
            console.error("Item not found");
            return;
        }

        // 1. Update status to processing immediately
        setReviewQueue(prev => prev.map(i => i.id === id ? { ...i, status: 'processing', type: 'redo' } : i));

        // 2. Perform the API call asynchronously (don't await here if we want immediate UI return,
        //    but we probably want to await in the background function)
        //    Since we aren't awaiting in ReviewPanel (plan), we can just run this.

        try {
            const response = await redoImage(item.result?.id || id, feedback);

            const newItem = {
                ...item,
                status: 'review_ready',
                result: response.result,
                type: 'group'
            };

            setReviewQueue(prev => prev.map(i => i.id === id ? newItem : i));

            // User requested NOT to auto-open. Just update queue.
            // if (activeReviewItem?.id === id) {
            //    setActiveReviewItem(newItem);
            // }

        } catch (error) {
            console.error("Redo failed", error);
            // Revert
            setReviewQueue(prev => prev.map(i => i.id === id ? { ...i, status: 'review_ready' } : i));
        }
    };

    const handleClearStash = async () => {
        if (window.confirm("Clear all approved items? This cannot be undone.")) {
            try {
                await clearApprovedStash();
                loadApprovedItems();
            } catch (error) {
                console.error("Clear stash failed", error);
            }
        }
    };

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);

    return (
        <div className="flex flex-col min-h-screen w-full bg-black text-white font-sans overflow-y-auto">
            {/* REMOVED h-screen overflow-hidden to allow vertical scroll */}

            {/* 1. TOP BAR: Header, PDF Upload, and Approved Files */}
            <div className="flex-shrink-0 bg-[#0a0a0a] border-b-2 border-white/20 z-30 shadow-md flex flex-col sticky top-0">
                {/* Sticky top for navigation */}

                {/* A. Global Header Row */}

                <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-slate-900/50">
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                        PDF Data Extractor
                    </h1>
                    <div className="flex items-center gap-2">
                        {/* Model Selector */}
                        <ModelSelector />

                        {/* <button
                            onClick={() => setIsHelpOpen(true)}
                            className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors text-blue-400"
                            title="Help & Guide"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                            </svg>
                        </button> */}
                        <button onClick={() => setIsSettingsOpen(true)} className="p-1.5 bg-slate-800 rounded-lg hover:bg-slate-700">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </button>
                    </div>
                </div>

                {/* B. Action Row: Upload (Left) + Approved (Right) */}
                <div className="flex flex-col md:flex-row border-b border-white/10 bg-[#0d0d0d]">
                    {/* Left: PDF Upload Button & Horizontal List */}
                    <div className="flex-1 p-3 border-r border-white/10 min-w-0">
                        <PDFUploadSection
                            pdfFiles={pdfFiles}
                            onUpload={handleUniversalUpload}
                            onExtractImages={handleExtractImages}
                        />
                    </div>

                    {/* Right: Approved Files Stash (Compact Mode) */}
                    <div className="flex-1 p-3 max-h-[250px] overflow-y-auto">
                        <ApprovedFilesPanel
                            approvedItems={approvedItems}
                            savingAll={false}
                            onSaveAll={handleSaveAllClick}
                            onSave={handleSaveSingle}
                            onEdit={handleEditApproved}
                            onDelete={handleDeleteApproved}
                            onClearStash={handleClearStash}
                        />
                    </div>
                </div>
            </div>

            {/* 2. MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col relative w-full min-h-[600px]">
                {/* Removed overflow-hidden, so page grows. UnifiedImagePanel also needs to not force strict height but allow internal scroll */}

                {/* Unified Image Panel (Takes ALL space, Sidebar overlays) */}
                <div className="flex-1 flex flex-col min-w-0 w-full h-[80vh]">
                    {/* Forced height for internal scrolling consistency, but page can scroll if this is tall */}
                    <UnifiedImagePanel
                        pdfFiles={pdfFiles}
                        uploads={uploads}
                        groups={groups}
                        setGroups={setGroups}
                        onAddToQueue={handleAddToQueue}
                        onUpload={handleUniversalUpload}
                        contentHeight="100%"
                    />
                </div>

                {/* Right Sidebar: Review Queue (OVERLAY) */}
                <div
                    className={`fixed inset-y-0 right-0 w-[450px] z-[50] transition-transform duration-300 transform ${isReviewSidebarOpen ? 'translate-x-0' : 'translate-x-full'
                        }`}
                >
                    {/* The Sidebar Itself */}
                    <div className="h-full w-full bg-[#0d0d0d] border-l border-white/10 shadow-2xl flex flex-col">
                        <div className="flex items-center justify-between p-3 border-b border-white/10 bg-slate-900/80">
                            <span className="font-bold text-slate-200">Review Queue</span>
                            <button onClick={() => setIsReviewSidebarOpen(false)} className="text-slate-400 hover:text-white">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <ReviewQueueList
                                queue={reviewQueue}
                                onReview={setActiveReviewItem}
                                onRemove={handleRemoveFromQueue}
                            />
                        </div>
                    </div>
                </div>

                {/* Overlay backdrop when sidebar is open */}
                {isReviewSidebarOpen && (
                    <div
                        className="fixed inset-0 z-[40] bg-black/50 backdrop-blur-sm"
                        onClick={() => setIsReviewSidebarOpen(false)}
                    ></div>
                )}

                {/* 3. FULL SCREEN REVIEW MODAL */}
                {activeReviewItem && (
                    <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col">
                            <ReviewPanel
                                upload={activeReviewItem}
                                onApprove={handleApprove}
                                onRemove={handleRemoveFromQueue}
                                onSaveDraft={handleSaveStaging}
                                onRedo={handleRedo}
                                onClose={() => setActiveReviewItem(null)}
                            />
                        </div>
                    </div>
                )}

            </div>

            {/* Modals & Overlays */}
            {isSaveModalOpen && (
                <SaveOptionsModal
                    isOpen={true}
                    onClose={() => setIsSaveModalOpen(false)}
                    onSave={handleSaveConfirm}
                    approvedCount={approvedItems.length}
                />
            )}
            {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
            {isHelpOpen && <HelpModal onClose={() => setIsHelpOpen(false)} />}

            {/* Context Panel (Bottom Left Floating) */}
            <ContextPanel />

            {/* Persistent Review Queue Toggle Button */}
            <button
                onClick={() => setIsReviewSidebarOpen(!isReviewSidebarOpen)}
                className={`fixed top-1/2 -translate-y-1/2 z-[55] py-4 px-1 rounded-l-lg shadow-[0_0_15px_rgba(0,0,0,0.5)] border-y border-l border-white/20 transition-all duration-300 flex flex-col items-center gap-2 ${isReviewSidebarOpen
                    ? 'right-[450px] bg-[#0d0d0d] text-slate-400 hover:text-white'
                    : 'right-0 bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                title={isReviewSidebarOpen ? "Close Review Queue" : "Open Review Queue"}
            >
                {/* Badge if closed and has items */}
                {!isReviewSidebarOpen && reviewQueue.length > 0 && (
                    <span className="absolute -left-2 -top-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-md border border-white/20">
                        {reviewQueue.length}
                    </span>
                )}

                {isReviewSidebarOpen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                )}

                <span className="text-[10px] uppercase font-bold tracking-widest [writing-mode:vertical-rl] rotate-180 opacity-80 mt-1">
                    {isReviewSidebarOpen ? "" : "Queue"}
                </span>
            </button>
        </div>
    );
};

export default Dashboard;
