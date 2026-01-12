import React, { useState, useRef, useEffect } from 'react';

const FileUpload = ({ onUpload, accept = ".pdf", label = "Upload File", multiple = false }) => {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            if (multiple) {
                onUpload(Array.from(files));
            } else {
                onUpload(files[0]);
            }
        }
    };

    const handleFileSelect = (e) => {
        if (e.target.files.length > 0) {
            if (multiple) {
                onUpload(Array.from(e.target.files));
            } else {
                onUpload(e.target.files[0]);
            }
        }
    };

    // Handle paste events
    useEffect(() => {
        const handlePaste = (e) => {
            const items = e.clipboardData.items;
            const pastedFiles = [];
            for (let i = 0; i < items.length; i++) {
                if (items[i].kind === 'file') {
                    const file = items[i].getAsFile();
                    pastedFiles.push(file);
                }
            }
            if (pastedFiles.length > 0) {
                if (multiple) {
                    onUpload(pastedFiles);
                } else {
                    onUpload(pastedFiles[0]);
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [onUpload, multiple]);

    return (
        <div
            className={`relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 ease-out
        ${isDragging
                    ? 'border-blue-500 bg-blue-500/10 scale-[1.02]'
                    : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10'
                }
        backdrop-blur-md p-12 text-center cursor-pointer group`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
        >
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept={accept}
                multiple={multiple}
                onChange={handleFileSelect}
            />

            <div className="relative z-10 flex flex-col items-center gap-4">
                <div className={`p-4 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 shadow-lg shadow-blue-500/30 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3`}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-white">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                </div>

                <div className="space-y-1">
                    <p className="text-lg font-medium text-white">
                        {label}
                    </p>
                    <p className="text-sm text-gray-400">
                        Drag & drop or click to browse
                    </p>
                </div>
            </div>

            {/* Decorative gradient blob */}
            <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-blue-500/20 blur-[100px] rounded-full pointer-events-none" />
        </div>
    );
};

export default FileUpload;
