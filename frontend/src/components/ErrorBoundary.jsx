import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({
            error: error,
            errorInfo: errorInfo
        });
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-8 text-white">
                    <div className="max-w-4xl w-full bg-slate-900 border border-red-500 rounded-xl p-8 overflow-auto max-h-full">
                        <h1 className="text-2xl font-bold text-red-500 mb-4">Something went wrong.</h1>
                        <div className="mb-4">
                            <h2 className="text-xl font-semibold mb-2">Error:</h2>
                            <pre className="bg-black/50 p-4 rounded text-red-300 whitespace-pre-wrap">
                                {this.state.error && this.state.error.toString()}
                            </pre>
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold mb-2">Component Stack:</h2>
                            <pre className="bg-black/50 p-4 rounded text-slate-400 text-sm whitespace-pre-wrap">
                                {this.state.errorInfo && this.state.errorInfo.componentStack}
                            </pre>
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
