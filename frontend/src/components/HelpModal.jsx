import React from 'react';

const HelpModal = ({ onClose }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-gray-900 z-10">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-blue-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                        </svg>
                        PDF Data Extractor Guide
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-8 space-y-10 text-gray-300">

                    <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                                <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">1</span>
                                Dashboard Overview
                            </h3>
                            <ul className="space-y-3">
                                <li className="flex gap-2">
                                    <strong className="text-white min-w-[120px]">Upload Panel:</strong>
                                    <span>Drag & drop PDFs here. Choose between extraction modes.</span>
                                </li>
                                <li className="flex gap-2">
                                    <strong className="text-white min-w-[120px]">Folders:</strong>
                                    <span>Browse local directories to add existing images to the queue.</span>
                                </li>
                                <li className="flex gap-2">
                                    <strong className="text-white min-w-[120px]">Proposed:</strong>
                                    <span>Processable images extracted from PDFs appear here.</span>
                                </li>
                                <li className="flex gap-2">
                                    <strong className="text-white min-w-[120px]">Approved Stash:</strong>
                                    <span>Your final, processed library of images and data.</span>
                                </li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                                <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">2</span>
                                PDF Processing Modes
                            </h3>
                            <div className="space-y-3 bg-gray-800 p-4 rounded-lg border border-gray-700">
                                <div>
                                    <strong className="text-blue-400 block mb-1">Full Content</strong>
                                    <p className="text-sm">Extracts text AND automatically cuts out all tables/figures as individual images.</p>
                                </div>
                                <div className="border-t border-gray-700 pt-2">
                                    <strong className="text-purple-400 block mb-1">Context Only</strong>
                                    <p className="text-sm">Analyzes text for "Global Context" but skips image extraction. Use "Extract Images" later if needed.</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <hr className="border-gray-800" />

                    <section>
                        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">3</span>
                            Workflow: Grouping & Review
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-gray-800/50 p-4 rounded-lg">
                                <strong className="text-white block mb-2">Step 1: Organize</strong>
                                <p className="text-sm mb-2">
                                    Combine related images (e.g., a chart and its legend) into a single group using <strong>Merge Group</strong>.
                                </p>
                                <p className="text-sm text-gray-400">Use <strong>Auto Group</strong> to let AI attempt this for you.</p>
                            </div>
                            <div className="bg-gray-800/50 p-4 rounded-lg">
                                <strong className="text-white block mb-2">Step 2: AI Analysis</strong>
                                <p className="text-sm">
                                    Click <strong>Review</strong> on an item. The AI (Gemini) will analyze the image(s) using the PDF's global context to generate a title, description, and source.
                                </p>
                            </div>
                            <div className="bg-gray-800/50 p-4 rounded-lg">
                                <strong className="text-white block mb-2">Step 3: Approval</strong>
                                <p className="text-sm">
                                    Edit the generated metadata if needed. Click <strong>Approve & Save</strong> to finalize.
                                </p>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">4</span>
                            Advanced Features
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <h4 className="font-bold text-white mb-2">Global Context & Editing</h4>
                                <p className="mb-2">There is a floating button in the bottom-left corner.</p>
                                <p className="text-sm">Clicking this opens the <strong className="text-white">Context Panel</strong>. This is the "brain" of the extraction—the text the AI reads to understand the images. You can manually edit this text to fix OCR errors or add specific context hints.</p>
                            </div>
                            <div>
                                <h4 className="font-bold text-white mb-2">AI Models</h4>
                                <p className="text-sm mb-2">Go to <strong className="text-white">Settings</strong> to switch models.</p>
                                <ul className="text-sm space-y-1">
                                    <li><span className="text-green-400">●</span> <strong>Gemini 2.5 Pro:</strong> Best implementation. Fast & accurate.</li>
                                    <li><span className="text-gray-500">○</span> <strong>GPT-4o / Claude 3:</strong> Supported via adapters (requires API key).</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">5</span>
                            Output Data
                        </h3>
                        <p className="mb-3">When you approve an image, the system generates:</p>
                        <ul className="list-disc pl-6 space-y-2 text-sm text-gray-300">
                            <li><strong className="text-white">Image File:</strong> The original high-res crop (saved to <code>data/approved</code>).</li>
                            <li><strong className="text-white">CSV Entry:</strong> Structured data including filename, caption, source page, and tags.</li>
                            <li><strong className="text-white">Markdown File:</strong> A document-ready formatted block including the image and its description.</li>
                        </ul>
                    </section>

                </div>

                <div className="p-6 border-t border-gray-700 bg-gray-800/50 text-center text-gray-500 text-sm flex justify-between items-center">
                    <span>PDF Data Extractor v2.2</span>
                    <span>Built for IenW Data Analysis</span>
                </div>
            </div>
        </div>
    );
};

export default HelpModal;
