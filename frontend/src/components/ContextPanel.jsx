import React, { useState, useEffect } from 'react';
import { getGlobalContext, updateGlobalContext } from '../api/client';

const ContextPanel = () => {
    const [context, setContext] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const fetchContext = async () => {
        setIsLoading(true);
        try {
            const data = await getGlobalContext();
            console.log("Fetched context data:", data);

            // Handle if context is string or object/list
            let contextStr = data.context || '';
            if (typeof contextStr === 'object') {
                contextStr = JSON.stringify(contextStr, null, 2);
            }
            setContext(contextStr);
        } catch (error) {
            console.error("Failed to fetch context:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateGlobalContext(context);
        } catch (error) {
            console.error("Failed to update context:", error);
        } finally {
            setIsSaving(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchContext();
        }
    }, [isOpen]);

    return (
        <div className="fixed bottom-4 left-4 z-40">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-gray-800 text-white p-3 rounded-full shadow-lg hover:bg-gray-700 transition-colors border border-gray-600"
                title="Global Context"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute bottom-16 left-0 w-[500px] h-[400px] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl bg-opacity-95">
                    <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/50">
                        <h3 className="text-white font-medium flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-blue-400">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                            Global Context
                        </h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleSave}
                                disabled={isSaving || isLoading}
                                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${isSaving
                                    ? 'bg-green-600/50 cursor-wait text-white'
                                    : 'bg-green-600 hover:bg-green-500 text-white'
                                    }`}
                            >
                                {isSaving ? 'Saving...' : 'Save Context'}
                            </button>
                            <button
                                onClick={fetchContext}
                                className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                                title="Refresh"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 relative bg-gray-950">
                        {isLoading ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="text-blue-400">Loading context...</div>
                            </div>
                        ) : (
                            <textarea
                                value={context}
                                onChange={(e) => setContext(e.target.value)}
                                className="w-full h-full p-4 bg-transparent text-gray-300 font-mono text-xs resize-none focus:outline-none"
                                placeholder="Global context extracted from PDF..."
                            />
                        )}
                    </div>
                    <div className="bg-gray-800/50 p-2 text-[10px] text-gray-500 text-center border-t border-gray-700">
                        This context is sent with every image processing request. Be careful with manual edits.
                    </div>
                </div>
            )}
        </div>
    );
};

export default ContextPanel;
