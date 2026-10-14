import React, { useState, useEffect } from 'react';
import { AnoraLogo } from './AnoraLogo';
import { SignIn, SignUp } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';
import { Key, ShieldCheck, ExternalLink, ArrowRight, CheckCircle2, AlertCircle, AlertTriangle, Trash2 } from 'lucide-react';

interface AuthScreenProps {
  hasPublishableKey: boolean;
  domainMismatchKey?: string;
  onKeyConfigured?: (key: string) => void;
  isDark?: boolean;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  hasPublishableKey,
  domainMismatchKey,
  onKeyConfigured,
  isDark = true,
}) => {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [inputKey, setInputKey] = useState('');
  const [callbackInput, setCallbackInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [oauthUrl, setOauthUrl] = useState<string | null>(null);

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
  const isPreviewOrDev =
    currentHost !== 'ai.foldedpage.in' && !currentHost.endsWith('.ai.foldedpage.in');

  useEffect(() => {
    fetch('/api/clerk-oauth-url')
      .then(res => res.json())
      .then(data => {
        if (data.oauthUrl) {
          setOauthUrl(data.oauthUrl);
        }
      })
      .catch(() => {});
  }, []);

  const handleClearKey = async () => {
    setIsSubmitting(true);
    try {
      localStorage.removeItem('clerk_publishable_key');
      await fetch('/api/save-clerk-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: '' }),
      }).catch(() => {});
      setSuccessMsg('Stored key cleared. Please enter your Development Key (pk_test_...).');
      if (onKeyConfigured) onKeyConfigured('');
      setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to clear key');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) {
      setErrorMsg('Please enter a valid Clerk Publishable Key');
      return;
    }
    const cleanKey = inputKey.trim();
    if (!cleanKey.startsWith('pk_test_') && !cleanKey.startsWith('pk_live_')) {
      setErrorMsg('Clerk publishable keys typically start with pk_test_ or pk_live_');
      return;
    }

    if (cleanKey.startsWith('pk_live_') && isPreviewOrDev) {
      setErrorMsg(
        'Clerk Production Keys (pk_live_...) are domain-locked to ai.foldedpage.in. In this preview environment (' +
          currentHost +
          '), you must use your Development Key (pk_test_...).'
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      localStorage.setItem('clerk_publishable_key', cleanKey);
      await fetch('/api/save-clerk-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: cleanKey }),
      });
      setSuccessMsg('Clerk Publishable Key configured successfully!');
      if (onKeyConfigured) {
        onKeyConfigured(cleanKey);
      }
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save Clerk key');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCallbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!callbackInput.trim()) {
      setErrorMsg('Please paste the redirect callback URL');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/clerk-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callbackUrl: callbackInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete Clerk OAuth');
      }
      setSuccessMsg('Clerk authentication linked and keys synchronized!');
      if (data.key) {
        localStorage.setItem('clerk_publishable_key', data.key);
        if (onKeyConfigured) onKeyConfigured(data.key);
      }
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to link Clerk OAuth');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden font-outfit text-zinc-900 dark:text-white">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#f4f4f5_0%,_#ffffff_100%)] dark:bg-[radial-gradient(circle_at_center,_#121215_0%,_#09090b_100%)]"></div>
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-500/10 dark:bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-lg relative z-10 transition-all duration-700">
        {/* Branding header */}
        <div className="text-center mb-6 sm:mb-8 space-y-2 animate-in fade-in slide-in-from-top-6 duration-700">
          <div className="flex justify-center transform hover:scale-105 transition-all duration-500">
            <AnoraLogo size={46} color="#000" showName={false} animate={true} />
          </div>
          <div className="space-y-0.5">
            <h1 className="text-2xl sm:text-4xl font-black tracking-[0.35em] text-transparent bg-clip-text bg-gradient-to-r from-zinc-900 via-zinc-700 to-zinc-900 dark:from-white dark:via-zinc-300 dark:to-white">
              ANORA
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.5em] flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
              Sovereign Authentication via Clerk
            </p>
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-zinc-200 dark:border-white/10 p-5 sm:p-8 rounded-[2rem] shadow-2xl shadow-black/10 dark:shadow-black/50 relative">
          
          {hasPublishableKey ? (
            /* Mode when valid Clerk Publishable Key is available: Full Clerk UI */
            <div className="space-y-6">
              {/* Tab Selector */}
              <div className="flex bg-zinc-100 dark:bg-white/5 p-1 rounded-xl border border-zinc-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setAuthMode('signin')}
                  className={`flex-1 py-2 text-[10px] font-black uppercase tracking-[0.2em] rounded-lg transition-all duration-300 ${
                    authMode === 'signin'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-md'
                      : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                  }`}
                >
                  Access (Sign In)
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className={`flex-1 py-2 text-[10px] font-black uppercase tracking-[0.2em] rounded-lg transition-all duration-300 ${
                    authMode === 'signup'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-md'
                      : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                  }`}
                >
                  Link (Sign Up)
                </button>
              </div>

              {/* Clerk Sign In / Sign Up Component */}
              <div className="flex justify-center w-full clerk-container">
                {authMode === 'signin' ? (
                  <SignIn
                    routing="hash"
                    appearance={{
                      baseTheme: isDark ? dark : undefined,
                      variables: {
                        colorPrimary: '#3b82f6',
                        colorBackground: isDark ? '#141417' : '#ffffff',
                        colorText: isDark ? '#f4f4f5' : '#18181b',
                      },
                      elements: {
                        card: 'shadow-none border border-zinc-200 dark:border-white/10 rounded-2xl w-full bg-transparent',
                        formButtonPrimary:
                          'bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 font-black py-3 rounded-xl uppercase tracking-widest text-[11px] transition-all',
                        footerActionLink: 'text-blue-500 hover:text-blue-400 font-bold',
                        headerTitle: 'font-black tracking-widest uppercase text-base text-zinc-900 dark:text-white',
                        headerSubtitle: 'text-zinc-500 text-xs tracking-wider uppercase',
                      },
                    }}
                  />
                ) : (
                  <SignUp
                    routing="hash"
                    appearance={{
                      baseTheme: isDark ? dark : undefined,
                      variables: {
                        colorPrimary: '#3b82f6',
                        colorBackground: isDark ? '#141417' : '#ffffff',
                        colorText: isDark ? '#f4f4f5' : '#18181b',
                      },
                      elements: {
                        card: 'shadow-none border border-zinc-200 dark:border-white/10 rounded-2xl w-full bg-transparent',
                        formButtonPrimary:
                          'bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 font-black py-3 rounded-xl uppercase tracking-widest text-[11px] transition-all',
                        footerActionLink: 'text-blue-500 hover:text-blue-400 font-bold',
                        headerTitle: 'font-black tracking-widest uppercase text-base text-zinc-900 dark:text-white',
                        headerSubtitle: 'text-zinc-500 text-xs tracking-wider uppercase',
                      },
                    }}
                  />
                )}
              </div>

              {/* Quick direct buttons */}
              <div className="pt-2 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between text-[9px] text-zinc-400 font-mono">
                <span>Application: app_3KhC3bNg53VjiMecfQOfp2LfXoB</span>
                <button
                  type="button"
                  onClick={handleClearKey}
                  className="text-zinc-400 hover:text-red-400 transition-colors underline"
                >
                  Change Key
                </button>
              </div>
            </div>
          ) : (
            /* Setup mode when Publishable Key is missing or needs development key */
            <div className="space-y-6">
              <div className="text-center space-y-1.5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 text-[10px] font-black uppercase tracking-widest">
                  <Key className="w-3.5 h-3.5" />
                  Clerk Protocol Setup
                </div>
                <h2 className="text-lg font-black tracking-wider uppercase">Connect Clerk Instance</h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs">
                  Target App: <span className="font-mono text-zinc-800 dark:text-zinc-200 font-bold">app_3KhC3bNg53VjiMecfQOfp2LfXoB</span>
                </p>
              </div>

              {/* Domain Mismatch Alert */}
              {domainMismatchKey && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl space-y-2 text-left">
                  <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Production Key Domain Restriction</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    The currently saved key (<code className="text-amber-400 font-mono text-[10px]">{domainMismatchKey.substring(0, 16)}...</code>) is a <strong className="text-zinc-200">Production Key</strong> locked by Clerk to <code className="text-zinc-200">ai.foldedpage.in</code>.
                    <br />
                    In this preview environment (<span className="text-white font-mono">{currentHost}</span>), Clerk requires a <span className="text-emerald-400 font-bold">Development Key</span> (<code className="text-emerald-400 font-mono">pk_test_...</code>).
                  </p>
                  <div className="pt-1 flex gap-2">
                    <button
                      type="button"
                      onClick={handleClearKey}
                      disabled={isSubmitting}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-lg text-[10px] uppercase tracking-wider transition-all flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear Stored Key</span>
                    </button>
                    <a
                      href="https://dashboard.clerk.com/apps/app_3KhC3bNg53VjiMecfQOfp2LfXoB/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg text-[10px] uppercase tracking-wider transition-all flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Copy pk_test Key</span>
                    </a>
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-500 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-500 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Option A: Enter Development Publishable Key */}
              <form onSubmit={handleSaveKey} className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-400">
                    Enter Development Key (<code className="text-emerald-400 font-mono">pk_test_...</code>)
                  </label>
                  <a
                    href="https://dashboard.clerk.com/apps/app_3KhC3bNg53VjiMecfQOfp2LfXoB/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-bold"
                  >
                    <span>Clerk Dashboard</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    placeholder="pk_test_..."
                    className="flex-1 bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-3 bg-zinc-900 dark:bg-white text-white dark:text-black font-black rounded-xl text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                  >
                    <span>Activate</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-200 dark:border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-[8px] font-black uppercase tracking-widest">
                  <span className="bg-white dark:bg-zinc-900 px-3 text-zinc-400">Or Link With Browser CLI OAuth</span>
                </div>
              </div>

              {/* Option B: CLI Browser Auth / Callback link */}
              <div className="space-y-3">
                {oauthUrl ? (
                  <a
                    href={oauthUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Authorize in Clerk Browser</span>
                  </a>
                ) : (
                  <a
                    href="https://dashboard.clerk.com/apps/app_3KhC3bNg53VjiMecfQOfp2LfXoB/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-700 dark:text-zinc-200 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Copy Key from Clerk Dashboard</span>
                  </a>
                )}

                <form onSubmit={handleCallbackSubmit} className="space-y-2">
                  <label className="block text-[8px] font-black uppercase tracking-widest text-zinc-400">
                    Paste Redirect URL (if browser redirected to <code className="text-zinc-300">http://127.0.0.1:...</code>)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={callbackInput}
                      onChange={(e) => setCallbackInput(e.target.value)}
                      placeholder="http://127.0.0.1:.../callback?code=..."
                      className="flex-1 bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none font-mono"
                    />
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2.5 bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/20 text-zinc-800 dark:text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                    >
                      Sync
                    </button>
                  </div>
                </form>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};
