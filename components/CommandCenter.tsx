
import React, { useState, useEffect } from 'react';
import { Role, User, ImageAspectRatio, SubscriptionTier } from '../types';
import { anoraService } from '../services/geminiService';

interface CommandCenterProps {
  user: User;
  isOpen: boolean;
  onDeductToken: (type: 'image' | 'video', amount: number) => boolean;
  onClose: () => void;
  isSection?: boolean;
}

const VIDEO_STATUS_MESSAGES = [
  "Initializing quantum render buffers...",
  "Seeding neural motion vectors...",
  "Synthesizing temporal frames...",
  "Compiling high-fidelity physics...",
  "Optimizing cinematic sovereign lighting...",
  "Finalizing high-bandwidth video asset...",
  "Stabilizing neural bridge for delivery...",
];

export const CommandCenter: React.FC<CommandCenterProps> = ({ user, isOpen, onDeductToken, onClose, isSection = false }) => {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'IMAGE' | 'VIDEO'>('IMAGE');
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>('1:1');
  const [statusIdx, setStatusIdx] = useState(0);
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    if (isOpen || isSection) {
      checkApiKey();
    }
  }, [isOpen, isSection, mode]);

  useEffect(() => {
    let interval: any;
    if (loading && mode === 'VIDEO') {
      interval = setInterval(() => {
        setStatusIdx(prev => (prev + 1) % VIDEO_STATUS_MESSAGES.length);
      }, 12000);
    } else {
      setStatusIdx(0);
    }
    return () => clearInterval(interval);
  }, [loading, mode]);

  const checkApiKey = async () => {
    if (mode === 'VIDEO') {
      const selected = await (window as any).aistudio.hasSelectedApiKey();
      setHasApiKey(selected);
    } else {
      setHasApiKey(true);
    }
  };

  const handleOpenKeyDialog = async () => {
    await (window as any).aistudio.openSelectKey();
    checkApiKey();
  };

  if (!isOpen && !isSection) return null;

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    if (!onDeductToken(mode.toLowerCase() as 'image' | 'video', 1)) return;

    setLoading(true);
    setResult(null);

    try {
      if (mode === 'IMAGE') {
        const base64 = await anoraService.generateImage(prompt, aspectRatio);
        setResult(`data:image/png;base64,${base64}`);
      } else {
        const videoUrl = await anoraService.generateVideo(prompt, aspectRatio as '16:9' | '9:16');
        setResult(videoUrl);
      }
    } catch (err: any) {
      if (err.message?.includes("Requested entity was not found")) {
        setHasApiKey(false);
        alert("Neural Key mismatch. Please re-authenticate your API key.");
      } else {
        alert(err.message || "Synthesis disrupted by unknown anomaly.");
      }
    } finally {
      setLoading(false);
    }
  };

  const isOwner = user.role === Role.OWNER;
  const isPremium = user.tier !== SubscriptionTier.FREE || isOwner;

  const content = (
    <div className={`flex flex-col ${isSection ? 'w-full h-full' : 'w-full max-w-6xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-none sm:rounded-[4rem] lg:rounded-[5rem] shadow-2xl h-full sm:h-auto sm:max-h-[92vh] overflow-hidden'}`}>
      
      {!isSection && (
        <div className="shrink-0 p-8 sm:p-12 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between bg-white dark:bg-zinc-900">
          <div>
            <h2 className={`text-2xl sm:text-3xl font-bold font-outfit ${isOwner ? 'text-amber-600' : 'text-zinc-900 dark:text-white'}`}>Visual Synthesis</h2>
            <p className="text-[10px] sm:text-xs text-zinc-400 uppercase tracking-[0.4em] font-bold mt-2">Unrestricted Sovereign Core</p>
          </div>
          <button onClick={onClose} className="p-5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all bg-zinc-50 dark:bg-white/5 rounded-3xl group active:scale-90 shadow-sm border border-zinc-100 dark:border-white/10">
            <svg className="w-8 h-8 group-hover:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto no-scrollbar scroll-smooth ${isSection ? 'p-0' : 'p-8 sm:p-12'} space-y-12`}>
        <div className={`flex bg-zinc-100/50 dark:bg-black/20 p-2 rounded-3xl border border-zinc-200 dark:border-white/10 ${isSection ? 'mt-0' : 'mt-0'}`}>
          <button onClick={() => { setMode('IMAGE'); setAspectRatio('1:1'); setResult(null); }} className={`flex-1 py-4 sm:py-5 text-[10px] sm:text-xs font-bold uppercase tracking-[0.3em] rounded-2xl transition-all ${mode === 'IMAGE' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400'}`}>Image Engine</button>
          {isPremium && <button onClick={() => { setMode('VIDEO'); setAspectRatio('16:9'); setResult(null); }} className={`flex-1 py-4 sm:py-5 text-[10px] sm:text-xs font-bold uppercase tracking-[0.3em] rounded-2xl transition-all ${mode === 'VIDEO' ? (loading ? 'bg-amber-50 text-amber-600' : (isOwner ? 'bg-amber-500 text-white' : 'bg-zinc-900 dark:bg-zinc-700 text-white') + ' shadow-sm') : 'text-zinc-400'}`}>Sovereign Video</button>}
        </div>

        <div className="flex flex-col gap-4">
           <label className="text-[10px] font-bold text-zinc-300 dark:text-zinc-600 uppercase tracking-[0.4em] ml-2">Temporal Format (Aspect Ratio)</label>
           <div className="flex flex-wrap gap-2">
              {(mode === 'IMAGE' ? (['1:1', '4:3', '3:4', '16:9', '9:16'] as ImageAspectRatio[]) : (['16:9', '9:16'] as ImageAspectRatio[])).map(ratio => (
                <button 
                  key={ratio} 
                  onClick={() => setAspectRatio(ratio)}
                  className={`px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${aspectRatio === ratio ? (isOwner ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-zinc-900 dark:bg-white text-white dark:text-black border-zinc-900 dark:border-white') : 'bg-white dark:bg-white/5 text-zinc-400 border-zinc-100 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20'}`}
                >
                  {ratio}
                </button>
              ))}
           </div>
        </div>

        {mode === 'VIDEO' && !hasApiKey ? (
          <div className="py-20 flex flex-col items-center text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
             <div className="w-20 h-20 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 flex items-center justify-center text-amber-500 shadow-sm">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
             </div>
             <div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Neural Key Required</h3>
                <p className="text-zinc-400 dark:text-zinc-500 text-xs uppercase tracking-widest leading-relaxed max-w-sm">Veo Video Synthesis requires a personalized API key for processing high-compute temporal assets.</p>
             </div>
             <div className="flex flex-col gap-4">
               <button onClick={handleOpenKeyDialog} className="px-10 py-5 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-full font-bold uppercase text-[10px] tracking-[0.3em] hover:bg-black dark:hover:bg-zinc-200 transition-all active:scale-95 shadow-lg">Establish API Key</button>
               <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-[9px] font-bold text-amber-600 uppercase tracking-widest hover:underline">Reference Billing Protocols</a>
             </div>
          </div>
        ) : (
          <div className="space-y-6">
             <label className="text-[10px] sm:text-xs font-bold text-zinc-300 dark:text-zinc-600 uppercase tracking-widest block px-4">Direct Intent Command</label>
             <textarea 
               value={prompt} 
               disabled={loading}
               onChange={(e) => setPrompt(e.target.value)} 
               className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-[3rem] p-8 sm:p-10 text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-300 dark:focus:border-white/20 min-h-[160px] sm:min-h-[200px] lg:min-h-[250px] resize-none text-base sm:text-lg lg:text-xl placeholder:text-zinc-200 dark:placeholder:text-zinc-800 transition-opacity disabled:opacity-50 shadow-sm" 
               placeholder={mode === 'VIDEO' ? "Establish a cinematic prompt for Veo synthesis..." : "Describe the image to synthesize..."} 
             />
             <button onClick={handleGenerate} disabled={loading || !prompt.trim()} className={`w-full font-bold py-6 sm:py-8 rounded-[3rem] transition-all shadow-xl active:scale-95 text-xs sm:text-sm tracking-[0.5em] uppercase border ${isOwner ? (loading ? 'bg-amber-50 border-amber-100 text-amber-600 cursor-wait' : 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600') : (loading ? 'bg-zinc-50 dark:bg-white/5 text-zinc-400' : 'bg-zinc-900 dark:bg-white text-white dark:text-black border-zinc-900 dark:border-white hover:bg-black dark:hover:bg-zinc-200')} disabled:opacity-20`}>
               {loading ? (mode === 'VIDEO' ? VIDEO_STATUS_MESSAGES[statusIdx] : 'SYNTESIZING FROM VOID...') : `EXECUTE ${mode} RENDER`}
             </button>
          </div>
        )}

        {result && (
          <div className="pt-12 border-t border-zinc-100 dark:border-white/5 animate-in zoom-in-95 duration-700">
             <div className={`rounded-[4rem] overflow-hidden border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-xl relative group mx-auto`} style={{ maxWidth: aspectRatio === '16:9' ? '100%' : aspectRatio === '9:16' ? '350px' : '600px' }}>
                {mode === 'IMAGE' ? <img src={result} alt="G" className="w-full h-auto object-contain" referrerPolicy="no-referrer" /> : <video src={result} controls autoPlay className="w-full h-auto" />}
                <div className="absolute inset-0 bg-white/60 dark:bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-10 pointer-events-none text-center">
                   <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.6em] text-zinc-900 dark:text-white">Neural Output Optimized</p>
                   <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mt-2">Format: {aspectRatio}</p>
                </div>
             </div>
             <div className="mt-10 flex flex-wrap justify-center gap-6">
                <a href={result} download={`anora_${mode.toLowerCase()}_${Date.now()}`} className="px-10 py-4 bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-full text-[10px] font-bold text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-900 dark:hover:border-white transition-all uppercase tracking-[0.3em] flex items-center gap-4 shadow-sm">
                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                   Extract High-Resolution Asset
                </a>
             </div>
          </div>
        )}
        <div className="h-12" />
      </div>
    </div>
  );

  if (isSection) return content;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-0 sm:p-8 lg:p-12 xl:p-24 bg-white/95 dark:bg-black/95 backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-500">
      {content}
    </div>
  );
};
