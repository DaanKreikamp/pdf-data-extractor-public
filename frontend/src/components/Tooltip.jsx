import React from 'react';

const Tooltip = ({ text, children }) => {
    return (
        <div className="group relative flex items-center justify-center">
            {children}
            <div className="absolute bottom-full mb-2 hidden group-hover:block w-max px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                {text}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
            </div>
        </div>
    );
};

export default Tooltip;
