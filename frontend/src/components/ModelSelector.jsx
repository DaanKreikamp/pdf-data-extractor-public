import React, { useState, useEffect } from 'react';

const ModelSelector = () => {
    const [models, setModels] = useState([]);
    const [activeModelId, setActiveModelId] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchModels();
    }, []);

    const fetchModels = async () => {
        try {
            console.log("Fetching models from /api/models/");
            const res = await fetch('http://localhost:8000/api/models/');
            if (res.ok) {
                const data = await res.json();
                console.log("Models data:", data);
                if (Array.isArray(data)) {
                    setModels(data);
                    const active = data.find(m => m.is_active);
                    if (active) setActiveModelId(active.id);
                } else {
                    console.error("Models data is not an array:", data);
                }
            } else {
                console.error("Failed to fetch models, status:", res.status);
            }
        } catch (err) {
            console.error("Failed to fetch models", err);
        }
    };

    const handleModelChange = async (e) => {
        const newModelId = e.target.value;
        setLoading(true);
        try {
            const res = await fetch('http://localhost:8000/api/models/active', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model_id: newModelId })
            });
            if (res.ok) {
                setActiveModelId(newModelId);
                // Optionally update list if availability changes dynamically, but typically not needed immediately
            } else {
                alert("Failed to switch model");
            }
        } catch (err) {
            console.error("Error switching model", err);
            alert("Error switching model");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center gap-2 mr-4">
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Model:</span>
            {models.length === 0 ? (
                <button
                    onClick={fetchModels}
                    className="text-xs text-red-400 hover:text-red-300 underline"
                    title="No models found. Click to retry."
                >
                    Retry Loading
                </button>
            ) : (
                <div className="relative">
                    <select
                        value={activeModelId}
                        onChange={handleModelChange}
                        disabled={loading}
                        className="appearance-none bg-slate-800 text-slate-200 text-sm rounded-md px-3 py-1 pr-8 border border-white/10 hover:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer"
                    >
                        {models.map(model => (
                            <option key={model.id} value={model.id} disabled={!model.is_available && model.id !== activeModelId}>
                                {model.name} {!model.is_available ? "(N/A)" : ""}
                            </option>
                        ))}
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ModelSelector;
