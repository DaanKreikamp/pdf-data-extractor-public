import React, { useState, useEffect, useRef } from 'react';
import { uploadPDF, updateStaging, approveItem, checkMerge, executeMerge, getMergeSuggestions, suggestImageMerges, executeMergeGroup, uploadImage, getApprovedItems, saveAllApproved, updateApprovedItem, deleteApprovedItem, clearApprovedStash, redoImage, processLocalImage, saveApprovedItem, browseFolder } from '../api/client';
import UnifiedImagePanel from '../components/UnifiedImagePanel';
import ReviewPanel from '../components/ReviewPanel';
import ApprovedFilesPanel from '../components/ApprovedFilesPanel';
import SettingsModal from '../components/SettingsModal';
// import HelpModal from '../components/HelpModal';
import ContextPanel from '../components/ContextPanel';

const Dashboard = () => {
    // ---- State for Data ----
    const [pdfFiles, setPdfFiles] = useState([]);
    const [uploads, setUploads] = useState([]); // Array of uploaded/processed image items
    const [reviewQueue, setReviewQueue] = useState([]);
    const [approvedItems, setApprovedItems] = useState([]);

    // Poll interval for PDF progress
    useEffect(() => {
        const interval = setInterval(async () => {
            // Check status of processing PDFs
            const processingPdfs = pdfFiles.filter(f => f.status === 'processing');
            if (processingPdfs.length > 0) {
                const updatedPdfs = await Promise.all(processingPdfs.map(async (pdf) => {
                    try {
                        const response = await fetch(`http://localhost:8000/api/pdf/status/${pdf.filename}`);
                        const data = await response.json();

                        // If status changed to done, we might want to refresh specific things or just update status
                        if (data.status === 'done' && pdf.status !== 'done') {
                            // Automatically switch tab or notify?
                        }

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

    // Initial load of approved items and history
    useEffect(() => {
        loadApprovedItems();
        loadHistory();
    }, []);

    const loadApprovedItems = async () => {
        try {
            const items = await getApprovedItems();
            setApprovedItems(items);
        } catch (error) {
            console.error("Failed to load approved items", error);
        }
    };

    const loadHistory = async () => {
        try {
            const response = await fetch('http://localhost:8000/api/pdf/history');
            const history = await response.json();
            // Map history to pdfFiles format, preventing duplicates
            setPdfFiles(prev => {
                const newFiles = history.map(h => ({
                    filename: h.filename,
                    status: 'done', // History items are done by definition unless re-loaded
                    progress: 100,
                    summary: h.summary,
                    images_extracted: h.images_extracted // New field
                }));
                // Merge, preferring current state if exists
                const combined = [...prev];
                newFiles.forEach(f => {
                    if (!combined.some(c => c.filename === f.filename)) {
                        combined.push(f);
                    }
                });
                return combined;
            });
        } catch (error) {
            console.error("Failed to load history", error);
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
                const result = await uploadImage(file, true); // Process immediately

                // Replace temp item with result
                setUploads(prev => prev.map(item => item.id === tempId ? {
                    ...result,
                    file: file, // Keep file for local preview if needed
                    status: 'done'
                } : item));

            } catch (error) {
                console.error("Image upload failed", error);
                setUploads(prev => prev.map(item => item.id === tempId ? { ...item, status: 'error' } : item));
            }
        }
    };

    // Add item to review queue
    const handleAddToQueue = (item) => {
        // Avoid duplicates
        setReviewQueue(prev => {
            if (prev.some(i => i.id === item.id)) return prev;

            // If it's a report item, we need to process it
            if (item.origin === 'report') {
                const processingItem = { ...item, status: 'processing' };
                processReportItem(item);
                return [...prev, processingItem];
            }

            return [...prev, item];
        });
    };

    const processReportItem = async (item) => {
        try {
            const { acceptProposedScreenshot } = await import('../api/client');
            const response = await acceptProposedScreenshot(item.pdf_name, item.filename);
            const resultData = response.result;

            setReviewQueue(prev => prev.map(qItem => {
                if (qItem.id === item.id) {
                    return {
                        ...qItem,
                        ...resultData,
                        id: resultData.id, // Swap temp ID for real staging ID
                        status: 'ready'
                    };
                }
                return qItem;
            }));
        } catch (error) {
            console.error("Failed to process report item", error);
            setReviewQueue(prev => prev.map(qItem => {
                if (qItem.id === item.id) {
                    return { ...qItem, status: 'error', error: error.message };
                }
                return qItem;
            }));
        }
    };

    const handleRemoveFromQueue = (id) => {
        setReviewQueue(prev => prev.filter(i => i.id !== id));
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
        } catch (error) {
            console.error("Approval failed", error);
            alert("Failed to approve item: " + (error.response?.data?.detail || error.message));
        }
    };

    const handleSaveStaging = async (id, data) => {
        try {
            await updateStaging(id, data.csv, data.markdown, data.csv_filename, data.md_filename);
        } catch (error) {
            console.error("Save draft failed", error);
        }
    }

    const handleSaveAll = async () => {
        try {
            const result = await saveAllApproved();
            alert(`Saved ${result.count} files to ${result.directory}`);
            loadApprovedItems(); // Refresh to remove saved items from view if that's the desired behavior (usually save-all moves to history)
        } catch (error) {
            console.error("Save all failed", error);
            alert("Failed to save files.");
        }
    };

    const handleSaveSingle = async (item) => {
        console.log("handleSaveSingle called for", item.id);
        try {
            // 1. Select directory
            console.log("Requesting folder selection...");

            const result = await browseFolder();
            console.log("Folder selection result:", result);

            if (!result || !result.path) {
                console.log("Folder selection cancelled or failed.");
                return;
            }

            const targetDir = result.path;
            console.log("Saving to:", targetDir);

            // 2. Save
            const saveResult = await saveApprovedItem(item.id, targetDir, targetDir);
            console.log("Save result:", saveResult);
            alert(`Saved file to ${saveResult.directory}`);

            // 3. Refresh list (item should disappear as it moves to history)
            loadApprovedItems();
        } catch (error) {
            console.error("Save single failed", error);
            alert("Failed to save file: " + error.message);
        }
    };

    /*
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
    */

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
        <div className="flex h-screen w-screen bg-black text-white overflow-hidden font-sans">
            {/* Left Column: Input & Processing */}
            <div className="w-1/2 h-full p-4 flex flex-col gap-4 border-r border-white/10 bg-[#0a0a0a]">

                {/* Header */}
                <div className="flex items-center justify-between flex-shrink-0 mb-2">
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                        PDF Data Extractor
                    </h1>
                    <div className="flex items-center gap-2">
                        {/* <button
                            onClick={() => setIsHelpOpen(true)}
                            className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors text-blue-400"
                            title="Help & Guide"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                            </svg>
                        </button> */}
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
                            title="Settings"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.355.133.75.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* PDF Upload Area */}
                <UnifiedImagePanel
                    pdfFiles={pdfFiles}
                    uploads={uploads}
                    onAddToQueue={handleAddToQueue}
                    onUpload={handlePdfUpload} // Handles both PDF and Image(via tab)
                    contentHeight="calc(100vh - 120px)"
                />
            </div>

            {/* Right Column: Review & Stash */}
            <div className="w-1/2 h-full p-4 flex flex-col gap-4 bg-gray-900/50">
                {/* 1. Stash Panel (Top) */}
                <div className="flex-shrink-0 max-h-[40vh] overflow-hidden flex flex-col">
                    <ApprovedFilesPanel
                        approvedItems={approvedItems}
                        savingAll={false}
                        onSaveAll={handleSaveAll}
                        onSave={handleSaveSingle}
                        onDelete={handleDeleteApproved}
                        onClearStash={handleClearStash}
                    />
                </div>

                {/* 2. Review Panel (Bottom, takes remaining space) */}
                <div className="flex-1 min-h-0 border border-white/10 rounded-xl overflow-hidden bg-[#0d0d0d] shadow-2xl relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-50"></div>
                    <ReviewPanel
                        queue={reviewQueue}
                        onApprove={handleApprove}
                        onRemove={handleRemoveFromQueue}
                        onSaveDraft={handleSaveStaging}
                        onRedo={redoImage}
                    />
                </div>
            </div>

            {/* Modals & Overlays */}
            {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
            {/* {isHelpOpen && <HelpModal onClose={() => setIsHelpOpen(false)} />} */}

            {/* Context Panel (Bottom Left Floating) */}
            <ContextPanel />
        </div>
    );
};

export default Dashboard;
