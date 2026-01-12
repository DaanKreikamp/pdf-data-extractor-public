import React from 'react';

const ReviewQueueList = ({ queue, onReview, onRemove }) => {
    if (!queue || queue.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                <p className="text-sm">Queue is empty.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2 p-2 overflow-y-auto h-full">
            {queue.map(item => (
                <div key={item.id} className="bg-slate-800/50 rounded-lg p-3 border border-white/5 flex flex-col gap-2">
                    <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1 mr-2">
                            <h4 className="text-sm font-medium text-slate-200 truncate" title={item.title || item.file?.name}>
                                {item.title || item.file?.name || "Untitled Item"}
                            </h4>
                            <p className="text-[10px] text-slate-500 capitalize">{item.type} • {item.status?.replace('_', ' ')}</p>
                        </div>
                        <button
                            onClick={() => onRemove(item.id)}
                            className="text-slate-500 hover:text-red-400 p-1"
                            title="Remove from queue"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                            </svg>
                        </button>
                    </div>

                    {/* Status Indicator / Actions */}
                    <div className="flex items-center justify-between mt-1">
                        {item.status === 'processing' || item.status === 'pending' ? (
                            <div className="flex items-center gap-2 text-xs text-blue-400">
                                <div className="w-3 h-3 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                                <span>Processing...</span>
                            </div>
                        ) : item.status === 'error' ? (
                            <div className="flex items-center gap-2 text-xs text-red-400">
                                <span>Error: {item.error || "Failed"}</span>
                            </div>
                        ) : (
                            <div className="w-full">
                                <button
                                    onClick={() => onReview(item)}
                                    className="w-full py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors shadow-lg shadow-blue-900/20"
                                >
                                    Review & Approve
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ReviewQueueList;
