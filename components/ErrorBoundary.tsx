import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AnoraLogo } from './AnoraLogo';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Anora Neural Boundary] Caught unexpected error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-black text-white flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full"></div>
            <AnoraLogo size={80} showName={false} animate={false} />
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 text-[10px] font-mono uppercase tracking-widest mb-4">
            <AlertTriangle className="w-3.5 h-3.5" />
            Neural Synapse Interruption
          </div>

          <h1 className="text-2xl sm:text-3xl font-black font-outfit uppercase tracking-tight text-white mb-2">
            Temporary Link Anomaly
          </h1>
          
          <p className="text-xs text-zinc-400 max-w-md mb-8 leading-relaxed">
            Anora encountered a localized exception in the neural matrix. Your session data and identity records remain intact.
          </p>

          {this.state.error?.message && (
            <div className="max-w-md w-full bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 mb-8 text-left overflow-hidden">
              <p className="text-[10px] font-mono text-zinc-400 truncate">
                <span className="text-red-400 font-bold">Diagnostic: </span>
                {this.state.error.message}
              </p>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-6 py-3 bg-white text-black hover:bg-zinc-200 rounded-2xl text-xs font-bold uppercase tracking-widest shadow-xl active:scale-95 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Re-establish Link
            </button>
          </div>

          <p className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest mt-12">
            Anora Protocol v13.05.2007 // Sovereign Core
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
