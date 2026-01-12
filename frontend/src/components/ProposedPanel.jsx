import React, { useState, useEffect } from 'react';
import { getProposedScreenshots } from '../api/client';

const ProposedPanel = ({ pdfFiles = [], onAccept }) => {
    const [activePdf, setActivePdf] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [processingId, setProcessingId] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedImage, setSelectedImage] = useState(null);

    // Filter PDFs that are done or have potential screenshots

    const availablePdfs = pdfFiles.filter(f => {
        // Show if explicitly done/processing/loading OR if status is undefined (likely from history)
        const isAvailable = f.status === 'done' || f.status === 'processing' || f.loading || !f.status;

        return isAvailable;
    });


    // Set initial active PDF
    useEffect(() => {
        if (!activePdf && availablePdfs.length > 0) {
            setActivePdf(availablePdfs[0].filename);
        }
    }, [availablePdfs, activePdf]);

    // Fetch items when active PDF changes
    useEffect(() => {
        if (activePdf) {
            fetchItems(activePdf);
        } else {
            setItems([]);
        }
    }, [activePdf]);

    const fetchItems = async (filename) => {
        setLoading(true);
        setError(null);
        try {
            const data = await getProposedScreenshots(filename);
            setItems(data);
        } catch (err) {
            console.error("Failed to fetch proposed screenshots", err);
            setError("Failed to load proposed screenshots.");
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = (item) => {
        // Notify parent to add to queue
        if (onAccept) {
            onAccept({
                type: 'single',
                id: Date.now() + Math.random(),
                file: { name: item.label || item.filename },
                result: { ...item, pdf_name: activePdf },
                status: 'ready'
            });
        }
    };

    const filteredItems = items.filter(item =>
        item.label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.type?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (availablePdfs.length === 0) {
        return null;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h3 className="text-lg font-medium text-slate-200">
                        Proposed Screenshots
                    </h3>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-slate-900 text-white text-xs rounded-lg pl-7 pr-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none border border-white/10 w-32 focus:w-48 transition-all"
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                        </svg>
                    </div>
                </div>
                <span className="text-xs text-slate-500">
                    Detected by Gemini Vision
                </span>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 border-b border-white/5 custom-scrollbar">
                {availablePdfs.map(pdf => (
                    <button
                        key={pdf.filename}
                        onClick={() => setActivePdf(pdf.filename)}
                        className={`px-3 py-1.5 rounded-t-lg text-xs font-medium transition-colors whitespace-nowrap
                            ${activePdf === pdf.filename
                                ? 'bg-slate-800 text-blue-400 border-b-2 border-blue-500'
                                : 'bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                            }`}
                    >
                        {pdf.filename}
                    </button>
                ))}
            </div>

            {/* Content */}
            {loading ? (
                <div className="p-8 text-center text-slate-500 animate-pulse">
                    Loading proposed screenshots...
                </div>
            ) : error ? (
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
                    {error}
                </div>
            ) : items.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-800 rounded-xl text-slate-500">
                    <p>No tables or figures detected automatically for this report.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {filteredItems.map((item, idx) => (
                        <div key={idx} className="group relative rounded-xl bg-slate-900 border border-white/10 overflow-hidden hover:border-blue-500/50 transition-all">
                            <div
                                className="aspect-video bg-slate-950 relative cursor-pointer"
                                onClick={() => setSelectedImage(item)}
                            >
                                <img
                                    src={`http://localhost:8000/static/proposed/${activePdf}/${item.filename}`}
                                    alt={item.label}
                                    className="w-full h-full object-contain"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                    <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-medium bg-black/50 px-2 py-1 rounded backdrop-blur-sm">
                                        Click to Enlarge
                                    </span>
                                </div>
                                <div className="absolute top-2 right-2 px-2 py-1 rounded bg-black/70 text-white text-xs font-medium backdrop-blur-sm">
                                    Page {item.page}
                                </div>
                            </div>

                            <div className="p-3">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div>
                                        <p className="text-sm font-medium text-slate-200 truncate" title={item.label}>
                                            {item.label || "Untitled"}
                                        </p>
                                        <p className="text-xs text-slate-500 capitalize">
                                            {item.type}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleAccept(item)}
                                    disabled={processingId === item.filename}
                                    className="w-full py-2 rounded-lg bg-blue-500/10 text-blue-400 text-sm font-medium hover:bg-blue-500 hover:text-white transition-all disabled:opacity-50"
                                >
                                    {processingId === item.filename ? 'Adding...' : 'Add to Review'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Image Modal */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-8"
                    onClick={() => setSelectedImage(null)}
                >
                    <div className="relative max-w-5xl max-h-full bg-slate-900 rounded-2xl overflow-hidden border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <button
                            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                            onClick={() => setSelectedImage(null)}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <div className="flex items-center justify-center bg-black/50 p-4">
                            <img
                                src={`http://localhost:8000/static/proposed/${activePdf}/${selectedImage.filename}`}
                                alt={selectedImage.label}
                                className="max-w-full max-h-[75vh] object-contain"
                            />
                        </div>
                        <div className="p-4 bg-slate-900 border-t border-white/10 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-medium text-white">{selectedImage.label}</h3>
                                <p className="text-sm text-slate-400 capitalize">{selectedImage.type} • Page {selectedImage.page}</p>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleAccept(selectedImage);
                                    setSelectedImage(null);
                                }}
                                className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
                            >
                                Add to Review
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProposedPanel;
