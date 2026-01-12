import React, { useState, useEffect } from 'react';
import { getProposedScreenshots, extractImages, getPdfStatus } from '../api/client';
import ImageCard from './ImageCard';
import ImagePreviewModal from './ImagePreviewModal';

const ReportTab = ({
    pdfFilename,
    onAccept,
    onAddToGroup,
    groups = [],
    onCreateGroup,
    onImport
}) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [extractionLoading, setExtractionLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagesExtracted, setImagesExtracted] = useState(true);

    // Fetch items when pdfFilename changes
    useEffect(() => {
        if (pdfFilename) {
            fetchItems(pdfFilename);
        } else {
            setItems([]);
        }
    }, [pdfFilename]);

    const fetchItems = async (filename) => {
        setLoading(true);
        setError(null);
        try {
            // First check status/info to see if images were extracted
            const status = await getPdfStatus(filename);
            // We can infer context-only mode if we have a summary/done but no images in proposed
            // But let's check the new field if available, or just check items length

            const data = await getProposedScreenshots(filename);
            setItems(data || []);

            // If we have items, obviously extracted. If not, and status is done, chance it is context only.
            // Ideally backend returns this explicitly. For now we assume if 0 items and done, maybe context only.
            // Actually, let's rely on the user clicking "Extract Images" if they see 0.

            // Refinement: if no images, set imagesExtracted to false so we show the button
            if (!data || data.length === 0) {
                setImagesExtracted(false);
            } else {
                setImagesExtracted(true);
            }

        } catch (err) {
            console.error("Failed to fetch proposed screenshots", err);
            setError("Failed to load proposed screenshots.");
        } finally {
            setLoading(false);
        }
    };

    const handleExtractImages = async () => {
        setExtractionLoading(true);
        try {
            await extractImages(pdfFilename);
            // Poll for status or just wait a bit and reload? 
            // In a real app we'd subscribe to socket or poll. 
            // For now, let's just show a message or rely on global polling if implemented.
            // We'll set a local "processing" state.
            alert("Image extraction started! It may take a few minutes. Check back soon.");
        } catch (err) {
            alert("Failed to start extraction: " + err.message);
        } finally {
            setExtractionLoading(false);
        }
    };

    const [acceptingId, setAcceptingId] = useState(null);

    const handleAccept = (item) => {
        // Notify parent to add to queue - Matching SuggestionsManager logic
        if (onAccept) {
            onAccept({
                ...item,
                title: item.label || item.filename,
                pdf_name: pdfFilename,
                id: `${pdfFilename}-${item.filename}`,
                user_prompt: ""
            });
        }
    };

    const filteredItems = items.filter(item =>
        (item.label?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (item.type?.toLowerCase() || "").includes(searchTerm.toLowerCase())
    );

    const [selectedIds, setSelectedIds] = useState(new Set());

    const handleToggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleImportSelected = () => {
        // We need to construct the full item state being passed to SuggestionsManager
        // which usually expects: { id, filename, label, pdf_name, ... }
        // The display logic in ReportTab creates a 'stableId' on the fly in onAddToGroup, 
        // we should match that.
        const selectedItems = items.filter(item => selectedIds.has(item.filename)).map(item => { // Using filename as ID key here since map uses idx? No, let's check render.
            // Render uses idx as key but passes item to ImageCard.
            // Let's use item.filename as the unique ID for selection since it's unique per PDF.
            const stableId = `${pdfFilename}-${item.filename}`;
            return { ...item, pdf_name: pdfFilename, id: stableId };
        });

        if (onImport) onImport(selectedItems);
        setSelectedIds(new Set());
    };

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex-shrink-0 flex items-center justify-between bg-slate-900/50 p-2 rounded-lg border border-white/5">
                <div className="flex items-center gap-4">
                    <h3 className="text-sm font-medium text-slate-200">
                        Extracted Content: <span className="text-blue-400">{pdfFilename}</span>
                    </h3>
                    {/* ... search ... */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Filter..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-slate-800 text-white text-xs rounded-lg pl-7 pr-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none border border-white/10 w-32 focus:w-48 transition-all"
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                        </svg>
                    </div>
                </div>

                {/* Selection Action Bar (Inline) */}
                {selectedIds.size > 0 && (
                    <button
                        onClick={handleImportSelected}
                        className="ml-4 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition-colors whitespace-nowrap"
                    >
                        Add {selectedIds.size} to Suggestions
                    </button>
                )}

                <div className="flex items-center gap-2">
                    {/* ... actions ... */}
                    {/* Extract Images Button (if 0 items found or strictly context mode) */}
                    {!loading && items.length === 0 && (
                        <button
                            onClick={handleExtractImages}
                            disabled={extractionLoading}
                            className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded-md shadow-lg shadow-purple-500/20 transition-all flex items-center gap-2"
                        >
                            {extractionLoading ? (
                                <>
                                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Starting...
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                                    </svg>
                                    Extract Images
                                </>
                            )}
                        </button>
                    )}

                    <span className="text-xs text-slate-500">
                        {items.length} items found
                    </span>
                    <button
                        onClick={() => fetchItems(pdfFilename)}
                        className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                        title="Refresh"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-0">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                ) : error ? (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
                        {error}
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm border-2 border-dashed border-slate-800 rounded-xl m-4">
                        <p className="mb-2">No images detected.</p>
                        <p className="max-w-xs text-center leading-relaxed opacity-75">
                            This report might have been processed in "Context Only" mode, or simply has no recognizable tables/figures.
                        </p>
                        {!extractionLoading && (
                            <p className="text-xs text-blue-400 mt-4">
                                Click "Extract Images" above to force a deep scan.
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-10">
                        {filteredItems.map((item, idx) => (
                            <ImageCard
                                key={idx}
                                item={item}
                                previewUrl={`http://localhost:8000/static/proposed/${pdfFilename}/${item.filename}`}
                                groups={groups}
                                onPreview={() => setSelectedImage({ ...item, pdf_name: pdfFilename })}
                                onAddToGroup={(itm, gid) => {
                                    // Ensure stable ID
                                    const stableId = `${pdfFilename}-${itm.filename}`;
                                    onAddToGroup({ ...itm, pdf_name: pdfFilename, id: stableId }, gid);
                                }}
                                onCreateGroup={(title, items) => {
                                    if (onCreateGroup) {
                                        const stableId = `${pdfFilename}-${items[0].filename}`;
                                        const newItem = { ...items[0], pdf_name: pdfFilename, id: stableId };
                                        onCreateGroup(title, [newItem]);
                                    }
                                }}
                                onAddToQueue={(itm) => handleAccept(itm)}
                                showSelection={true}
                                isSelected={selectedIds.has(item.filename)}
                                onSelect={() => handleToggleSelect(item.filename)}
                            />
                        ))}
                    </div >
                )}
            </div>

            {/* Image Modal */}
            {selectedImage && (
                <ImagePreviewModal
                    item={selectedImage}
                    onClose={() => setSelectedImage(null)}
                    onAddToReview={(item, prompt) => {
                        handleAccept({ ...item, user_prompt: prompt });
                        setSelectedImage(null);
                    }}
                />
            )}
        </div>
    );
};

export default ReportTab;
