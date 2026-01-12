
import React, { useState } from 'react';

const CollapsibleSection = ({ title, children, defaultOpen = true, icon, className = "", rightContent = null }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className={`p-6 rounded-xl bg-slate-900/30 border border-white/5 space-y-4 transition-all duration-300 ${className} ${!isOpen ? 'h-auto' : ''}`}>
            <div
                className="flex items-center justify-between cursor-pointer select-none group"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2">
                    <button
                        className={`p-1 rounded hover:bg-white/10 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-90' : 'rotate-0'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                        </svg>
                    </button>
                    <h2 className="text-xl font-semibold text-slate-200 flex items-center gap-2">
                        {icon && <span className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm">{icon}</span>}
                        {title}
                    </h2>
                </div>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    {rightContent}
                </div>
            </div>

            <div className={`transition-all duration-300 overflow-hidden ${isOpen ? 'opacity-100 max-h-[2000px]' : 'opacity-0 max-h-0'}`}>
                {children}
            </div>
        </div>
    );
};

export default CollapsibleSection;
