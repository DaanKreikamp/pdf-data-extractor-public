import React, { useState } from 'react';
import FileUpload from './FileUpload';

const PDFUploadSection = ({ pdfFiles, onUpload, onExtractImages }) => {
    // Filter PDFs that are relevant to show
    const activePdfs = pdfFiles.filter(f => f.status && f.status !== 'idle');
    const processingPdfs = activePdfs.filter(f => f.status === 'processing');
    const donePdfs = activePdfs.filter(f => f.status === 'done');
    const errorPdfs = activePdfs.filter(f => f.status === 'error');

    const [mode, setMode] = useState('content'); // 'content' or 'context'

    return (
        <div className="flex w-full items-start gap-4">
            {/* Left: Upload Button - Compact */}
            <div className="flex-shrink-0 w-64 flex flex-col gap-2">
                <FileUpload
                    onUpload={(files) => onUpload(files, mode)}
                    label={mode === 'content' ? "Upload PDF (Full)" : "Upload PDF (Context)"}
                    accept=".pdf"
                    multiple={true}
                    compact={true}
                />

                {/* Mode Toggler */}
                <div className="flex bg-slate-800 p-1 rounded-lg border border-white/10">
                    <button
                        onClick={() => setMode('content')}
                        className={`flex-1 text-[10px] uppercase font-bold py-1 px-2 rounded-md transition-all ${mode === 'content'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        title="Extract text AND images"
                    >
                        Full Content
                    </button>
                    <button
                        onClick={() => setMode('context')}
                        className={`flex-1 text-[10px] uppercase font-bold py-1 px-2 rounded-md transition-all ${mode === 'context'
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        title="Extract text only (no images)"
                    >
                        Context Only
                    </button>
                </div>
            </div>

            {/* Right: Horizontal Scrollable List of PDFs */}
            <div className="flex-1 min-w-0 flex flex-col gap-2">
                {/* Status Summary */}
                {activePdfs.length > 0 && (
                    <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
                        <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${processingPdfs.length > 0 ? 'bg-blue-500 animate-pulse' : 'bg-slate-600'}`}></span>
                            <span>{processingPdfs.length} Processing</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            <span>{donePdfs.length} Done</span>
                        </div>
                        {errorPdfs.length > 0 && (
                            <div className="flex items-center gap-2 text-red-400">
                                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                <span>{errorPdfs.length} Error</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Scrollable list content -> Now Wrapped */}
                <div className="flex flex-wrap gap-2 items-start py-1">
                    {activePdfs.map((pdf, idx) => (
                        <div key={`${pdf.filename}-${idx}`} className="flex-shrink-0 w-48 bg-slate-800/80 border border-white/10 rounded-lg p-2 text-xs flex flex-col gap-1 relative group">
                            <div className="flex justify-between items-center w-full">
                                <span className="font-medium text-slate-200 truncate flex-1 pr-2" title={pdf.filename}>{pdf.filename}</span>
                                <span className={`uppercase font-bold text-[9px] ${pdf.status === 'done' ? 'text-green-400' :
                                    pdf.status === 'error' ? 'text-red-400' : 'text-blue-400'
                                    }`}>{pdf.status === 'processing' && pdf.total ? `${pdf.progress}/${pdf.total}` : pdf.status}</span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-1 overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-300 ${pdf.status === 'done' ? 'bg-green-500' :
                                        pdf.status === 'error' ? 'bg-red-500' : 'bg-blue-500'
                                        }`}
                                    style={{ width: `${pdf.status === 'done' ? 100 : Math.round(((pdf.progress || 0) / (pdf.total || 1)) * 100)}%` }}
                                ></div>
                            </div>

                            {/* Load Images Button for Context Only Mode */}
                            {pdf.mode === 'context' && pdf.status === 'done' && (
                                <button
                                    onClick={() => onExtractImages && onExtractImages(pdf.filename)}
                                    className="mt-1 w-full py-1 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white rounded border border-purple-500/30 transition-colors text-[10px] items-center justify-center flex gap-1"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                                    </svg>
                                    Load Images
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PDFUploadSection;
