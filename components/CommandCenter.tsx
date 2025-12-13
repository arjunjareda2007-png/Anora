
import React, { useState } from 'react';
import { Role, User } from '../types';
import { anoraService } from '../services/geminiService';

interface CommandCenterProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
}

export const CommandCenter: React.FC<CommandCenterProps> = ({ user, isOpen, onClose }) => {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'IMAGE' | 'VIDEO'>('IMAGE');

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      if (mode === 'IMAGE') {
        const base64 = await anoraService.generateImage(prompt);
        setResult(`data:image/png;base64,${base64}`);
      } else {
        const videoUrl = await anoraService.generateVideo(prompt);
        setResult(videoUrl);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isOwner = user.role === Role.OWNER;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-0 sm:p-8 lg:p-12 xl:p-24 bg-black/95 backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-500">
      <div className="w-full max-w-6xl bg-[#080808] border sm:border-zinc-800 rounded-none sm:rounded-[4rem] lg:rounded-[5rem] shadow-[0_0_150px_rgba(0,0,0,1)] overflow-hidden flex flex-col h-full sm:h-auto sm:max-h-[92vh] transition-all">
        
        {/* Responsive Header */}
        <div className="shrink-0 p-8 sm:p-12 border-b border-zinc-900 flex items-center justify-between">
          <div>
            <h2 className={`text-2xl sm:text-3xl font-bold font-outfit ${isOwner ? 'text-amber-500' : 'text-white'}`}>Visual Synthesis</h2>
            <p className="text-[10px] sm:text-xs text-zinc-600 uppercase tracking-[0.4em] font-bold mt-2">Unrestricted Sovereign Core</p>
          </div>
          <button onClick={onClose} className="p-5 text-zinc-500 hover:text-white transition-all bg-white/5 rounded-3xl group active:scale-90">
            <svg className="w-8 h-8 group-hover:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Dynamic Mode Switcher */}
        <div className="flex bg-black/60 p-2 mx-8 sm:mx-12 mt-8 rounded-3xl border border-zinc-900">
          <button onClick={() => { setMode('IMAGE'); setResult(null); }} className={`flex-1 py-4 sm:py-5 text-[10px] sm:text-xs font-bold uppercase tracking-[0.3em] rounded-2xl transition-all ${mode === 'IMAGE' ? 'bg-zinc-800 text-white shadow-xl' : 'text-zinc-500'}`}>Image Engine</button>
          {isOwner && <button onClick={() => { setMode('VIDEO'); setResult(null); }} className={`flex-1 py-4 sm:py-5 text-[10px] sm:text-xs font-bold uppercase tracking-[0.3em] rounded-2xl transition-all ${mode === 'VIDEO' ? 'bg-amber-500 text-black shadow-xl' : 'text-zinc-500'}`}>Sovereign Video</button>}
        </div>

        <div className="flex-1 overflow-y-auto p-8 sm:p-12 space-y-12 no-scrollbar scroll-smooth">
           <div className="space-y-6">
              <label className="text-[10px] sm:text-xs font-bold text-zinc-700 uppercase tracking-widest block px-4">Direct Intent Command</label>
              <textarea 
                value={prompt} 
                onChange={(e) => setPrompt(e.target.value)} 
                className="w-full bg-zinc-900/20 border border-zinc-800/50 rounded-[3rem] p-8 sm:p-10 text-white focus:outline-none focus:border-zinc-500 min-h-[160px] sm:min-h-[200px] lg:min-h-[250px] resize-none text-base sm:text-lg lg:text-xl placeholder:text-zinc-900" 
                placeholder={`Arjun, describe the ${mode.toLowerCase()} to synthesize...`} 
              />
              <button onClick={handleGenerate} disabled={loading || !prompt.trim()} className={`w-full font-bold py-6 sm:py-8 rounded-[3rem] transition-all shadow-2xl active:scale-95 text-xs sm:text-sm tracking-[0.5em] uppercase border ${isOwner ? 'bg-amber-500 text-black border-amber-500 hover:bg-amber-400' : 'bg-white text-black hover:bg-zinc-100'} disabled:opacity-20`}>
                {loading ? 'SYNTESIZING FROM VOID...' : `EXECUTE ${mode} RENDER`}
              </button>
           </div>

           {result && (
             <div className="pt-12 border-t border-zinc-900 animate-in zoom-in-95 duration-700">
                <div className="rounded-[4rem] overflow-hidden border border-zinc-800 bg-black shadow-[0_0_80px_rgba(0,0,0,0.5)] relative group">
                   {mode === 'IMAGE' ? <img src={result} alt="G" className="w-full h-auto max-h-[70vh] object-contain" /> : <video src={result} controls autoPlay className="w-full h-auto max-h-[70vh]" />}
                   <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-10 pointer-events-none">
                      <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.6em] text-white">Neural Output Optimized</p>
                   </div>
                </div>
                <div className="mt-10 flex flex-wrap justify-center gap-6">
                   <a href={result} download={`anora_${mode.toLowerCase()}_${Date.now()}`} className="px-10 py-4 bg-zinc-900 border border-zinc-800 rounded-full text-[10px] font-bold text-zinc-500 hover:text-white hover:border-white transition-all uppercase tracking-[0.3em] flex items-center gap-4">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Extract High-Resolution Assets
                   </a>
                </div>
             </div>
           )}
           <div className="h-12" />
        </div>
      </div>
    </div>
  );
};
