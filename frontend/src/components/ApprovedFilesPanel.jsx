
import React from 'react';

const ApprovedFilesPanel = ({
    approvedItems,
    savingAll,
    onSaveAll,
    onClearStash,
    onEdit,
    onSave,
    onDelete
}) => {
    const [activeTab, setActiveTab] = React.useState('csv'); // 'csv' or 'md'

    const csvFiles = approvedItems.map(item => ({
        ...item,
        displayText: item.final_csv_name,
        type: 'CSV'
    }));

    const mdFiles = approvedItems.map(item => ({
        ...item,
        displayText: item.final_md_name,
        type: 'Markdown'
    }));

    return (
        <>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Approved Stash</h2>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onSaveAll}
                        disabled={savingAll || approvedItems.length === 0}
                        className="px-4 py-2 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors shadow-lg shadow-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {savingAll ? 'Saving...' : 'Save All...'}
                    </button>
                    <button
                        onClick={onClearStash}
                        disabled={approvedItems.length === 0}
                        className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Clear Stash"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 mb-3 bg-slate-900/50 p-1 rounded-lg border border-white/5">
                <button
                    onClick={() => setActiveTab('csv')}
                    className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'csv'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'text-slate-500 hover:text-slate-300'
                        }`}
                >
                    CSV Files ({approvedItems.length})
                </button>
                <button
                    onClick={() => setActiveTab('md')}
                    className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'md'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'text-slate-500 hover:text-slate-300'
                        }`}
                >
                    Markdown Files ({approvedItems.length})
                </button>
            </div>

            {approvedItems.length === 0 ? (
                <div className="p-4 text-center border border-dashed border-slate-700 rounded-lg text-slate-500 text-sm">
                    <p>No approved items yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {(activeTab === 'csv' ? csvFiles : mdFiles).map((item, index) => (
                        <div key={`${index}-${activeTab}`} className="p-2 rounded bg-slate-800/50 border border-white/5 flex items-center justify-between gap-3 group hover:bg-slate-800 transition-colors">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${activeTab === 'csv' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                    </svg>
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-sm text-slate-200 truncate" title={item.displayText}>{item.displayText}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] text-slate-500">{item.original_filename}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => onSave(item)}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded bg-green-500/10 text-green-400 hover:text-white hover:bg-green-500 transition-all"
                                    title="Save File"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => onDelete(item.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded bg-red-500/10 text-red-400 hover:text-white hover:bg-red-500 transition-all"
                                    title="Delete File"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
};

export default ApprovedFilesPanel;
