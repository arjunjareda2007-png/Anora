import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AnoraLogo } from './AnoraLogo';
import { RefreshCw, AlertTriangle, Key, ExternalLink, Trash2 } from 'lucide-react';

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

  private handleClearClerkKey = () => {
    try {
      localStorage.removeItem('clerk_publishable_key');
      fetch('/api/save-clerk-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: '' }),
      }).catch(() => {});
    } catch (e) {}
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const errMsg = this.state.error?.message || '';
      const isClerkDomainError =
        errMsg.includes('Production Keys are only allowed for domain') ||
        errMsg.includes('Request HTTP Origin header must be equal to or a subdomain') ||
        (errMsg.includes('Clerk') && errMsg.includes('domain'));

      if (isClerkDomainError) {
        return (
          <div className="min-h-screen w-full bg-zinc-950 text-white flex flex-col items-center justify-center p-6 text-center select-none font-outfit">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-amber-500/20 blur-3xl rounded-full"></div>
              <AnoraLogo size={80} showName={false} animate={false} />
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-[10px] font-mono uppercase tracking-widest mb-4">
              <Key className="w-3.5 h-3.5" />
              Clerk Production Key Domain Restriction
            </div>

            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white mb-2">
              Development Key Required on Preview
            </h1>

            <p className="text-xs text-zinc-400 max-w-lg mb-6 leading-relaxed">
              Clerk strictly restricts Production Keys (<code className="text-amber-400 font-mono">pk_live_...</code>) to your production domain (<span className="text-white font-bold font-mono">ai.foldedpage.in</span>).
              <br /><br />
              In this preview environment (<span className="text-white font-bold font-mono">{typeof window !== 'undefined' ? window.location.hostname : 'preview'}</span>), you must use your Clerk <span className="text-emerald-400 font-bold">Development Key</span> (<code className="text-emerald-400 font-mono">pk_test_...</code>).
            </p>

            <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-6 text-left overflow-hidden">
              <p className="text-[10px] font-mono text-zinc-400 break-words">
                <span className="text-amber-400 font-bold">Clerk Diagnostic: </span>
                {errMsg}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleClearClerkKey}
                className="flex items-center justify-center gap-2 px-6 py-3.5 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs font-bold uppercase tracking-widest shadow-xl active:scale-95 transition-all"
              >
                <Trash2 className="w-4 h-4" />
                Clear Stored Key & Use Development Key (pk_test_...)
              </button>

              <a
                href="https://dashboard.clerk.com/apps/app_3KhC3bNg53VjiMecfQOfp2LfXoB/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-5 py-3.5 bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-widest active:scale-95 transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                Get pk_test Key from Dashboard
              </a>
            </div>

            <p className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest mt-12">
              Anora Protocol // Sovereign Identity System
            </p>
          </div>
        );
      }

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
