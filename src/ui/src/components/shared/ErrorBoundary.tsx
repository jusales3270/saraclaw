import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] text-white p-4">
                    <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl max-w-md w-full">
                        <h1 className="text-xl font-bold text-red-400 mb-2">Something went wrong</h1>
                        <p className="text-white/60 text-sm mb-4">
                            Sara ran into an unexpected issue. Please refresh the page.
                        </p>
                        <div className="bg-black/40 p-3 rounded-lg overflow-x-auto mb-4">
                            <code className="text-xs text-red-300 font-mono">
                                {this.state.error?.message}
                            </code>
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
                        >
                            Refresh Application
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
