import React, { useState, useEffect } from 'react';
import { Role, User, ImageAspectRatio, SubscriptionTier } from '../types';
import { anoraService } from '../services/geminiService';
import { AnoraLogo } from './AnoraLogo';
import { X, Sparkles, Image as ImageIcon, Video, Cpu, Activity, Shield, Key } from 'lucide-react';

interface CommandCenterProps {
  user: User;
  isOpen: boolean;
  onDeductToken: (type: 'image' | 'video', amount: number) => boolean;
  onClose: () => void;
  isSection?: boolean;
  initialMode?: 'IMAGE' | 'VIDEO';
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

export const CommandCenter: React.FC<CommandCenterProps> = ({ 
  user, isOpen, onDeductToken, onClose, isSection = false, initialMode 
}) => {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'IMAGE' | 'VIDEO'>('IMAGE');
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>('1:1');
  const [statusIdx, setStatusIdx] = useState(0);

  // Sync mode if initialMode is provided or changes
  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
      setAspectRatio(initialMode === 'VIDEO' ? '16:9' : '1:1');
    }
  }, [initialMode, isOpen]);

  useEffect(() => {
    let interval: any;
    if (loading && mode === 'VIDEO') {
      interval = setInterval(() => {
        setStatusIdx(prev => (prev + 1) % VIDEO_STATUS_MESSAGES.length);
      }, 3500);
    } else {
      setStatusIdx(0);
    }
    return () => clearInterval(interval);
  }, [loading, mode]);

  if (!isOpen && !isSection) return null;

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    if (!onDeductToken(mode.toLowerCase() as 'image' | 'video', 1)) return;

    setLoading(true);
    setResult(null);

    try {
      if (mode === 'IMAGE') {
        const base64 = await anoraService.generateImage(prompt, aspectRatio);
        const imageUrl = `data:image/png;base64,${base64}`;
        setResult(imageUrl);
        // Save to local neural gallery
        anoraService.saveToGallery(imageUrl);
      } else {
        const videoUrl = await anoraService.generateVideo(prompt, aspectRatio as '16:9' | '9:16');
        setResult(videoUrl);
        // Save to local neural gallery
        anoraService.saveToGallery(videoUrl);
      }
    } catch (err: any) {
      alert(err.message || "Synthesis disrupted by unknown anomaly.");
    } finally {
      setLoading(false);
    }
  };

  const isOwner = user.role === Role.OWNER;
  const isPremium = user.tier !== SubscriptionTier.FREE || isOwner;

  const content = (
    <div className={`flex flex-col h-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 ${isSection ? 'w-full' : 'w-full max-w-4xl border border-zinc-200 dark:border-white/10 rounded-3xl sm:rounded-[3rem] shadow-2xl overflow-hidden'}`}>
      
      {!isSection && (
        <div className="shrink-0 p-6 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between bg-zinc-50/20 dark:bg-black/20">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${isOwner ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black'}`}>
              <Cpu className="w-4 h-4 text-inherit" />
            </div>
            <div>
              <h2 className="text-md font-black tracking-tight uppercase">Sovereign System Console</h2>
              <p className="text-[7px] text-zinc-400 font-extrabold uppercase tracking-widest mt-0.5">High-Fidelity Rendering & Controls</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-xl transition-all">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6">
        {/* Toggle Mode */}
        <div className="flex bg-zinc-50 dark:bg-white/5 p-1 rounded-2xl border border-zinc-100 dark:border-white/5">
          <button 
            type="button" 
            onClick={() => { setMode('IMAGE'); setAspectRatio('1:1'); setResult(null); }} 
            className={`flex-1 py-3 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 ${mode === 'IMAGE' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400'}`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Image Engine
          </button>
          
          {isPremium && (
            <button 
              type="button" 
              onClick={() => { setMode('VIDEO'); setAspectRatio('16:9'); setResult(null); }} 
              className={`flex-1 py-3 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 ${mode === 'VIDEO' ? 'bg-zinc-900 dark:bg-white text-white dark:text-black shadow-sm' : 'text-zinc-400'}`}
            >
              <Video className="w-3.5 h-3.5" />
              Sovereign Video
            </button>
          )}
        </div>

        {/* Aspect Ratio */}
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Temporal Aspect Format</span>
            <span className="text-[7px] font-bold text-zinc-400">Selected: {aspectRatio}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(mode === 'IMAGE' ? (['1:1', '4:3', '3:4', '16:9', '9:16'] as ImageAspectRatio[]) : (['16:9', '9:16'] as ImageAspectRatio[])).map(ratio => (
              <button 
                type="button"
                key={ratio} 
                onClick={() => setAspectRatio(ratio)}
                className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                  aspectRatio === ratio 
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-black border-transparent shadow-sm' 
                    : 'bg-white dark:bg-white/5 text-zinc-400 border-zinc-100 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/10'
                }`}
              >
                {ratio}
              </button>
            ))}
          </div>
        </div>

        {/* Command Prompter */}
        <div className="space-y-3">
          <label className="text-[8px] font-black uppercase tracking-widest text-zinc-400 ml-1">Direct Intent Command</label>
          <textarea 
            value={prompt} 
            disabled={loading}
            onChange={(e) => setPrompt(e.target.value)} 
            className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-2xl p-5 text-sm font-bold text-zinc-800 dark:text-white outline-none focus:border-zinc-300 dark:focus:border-white/20 transition-all h-28 resize-none placeholder-zinc-300 dark:placeholder-zinc-700" 
            placeholder={mode === 'VIDEO' ? "Establish cinematic instructions for Sovereign Video synthesis..." : "Synthesise physical form from absolute void..."} 
          />
          <button 
            type="button"
            onClick={handleGenerate} 
            disabled={loading || !prompt.trim()} 
            className={`w-full h-14 font-black text-[10px] tracking-wider uppercase rounded-2xl transition-all shadow-lg active:scale-98 flex items-center justify-center gap-3 ${
              loading 
                ? 'bg-zinc-100 dark:bg-white/10 text-zinc-400 cursor-wait' 
                : 'bg-zinc-900 hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-white'
            }`}
          >
            {loading ? <Activity className="w-4 h-4 animate-spin text-zinc-400" /> : <Sparkles className="w-4 h-4 text-inherit" />}
            {loading ? VIDEO_STATUS_MESSAGES[statusIdx] : `EXECUTE ${mode} SYNTHESIS`}
          </button>
        </div>

        {/* Results Screen */}
        {result && (
          <div className="pt-4 border-t border-zinc-100 dark:border-white/5 animate-in zoom-in-95 duration-500 space-y-4">
            <div className="flex justify-between items-center px-1">
              <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Synthesis Outcome</span>
              <span className="text-[7px] font-extrabold uppercase tracking-widest text-emerald-500">Asset generated & stored</span>
            </div>
            <div className="aspect-square bg-zinc-50 dark:bg-black/30 border border-zinc-100 dark:border-white/5 rounded-3xl overflow-hidden relative group shadow-inner">
              {mode === 'IMAGE' ? (
                <img src={result} alt="Outcome" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              ) : (
                <video src={result} controls autoPlay muted loop className="w-full h-full object-contain" />
              )}
              
              <div className="absolute bottom-4 right-4 pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity">
                <AnoraLogo size={20} showName={false} />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <a 
                href={result} 
                download={`anora_${mode.toLowerCase()}_${Date.now()}`} 
                className="px-5 py-3 bg-zinc-50 hover:bg-zinc-100 dark:bg-white/5 dark:hover:bg-white/10 border border-zinc-100 dark:border-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-all flex items-center gap-2 shadow-sm"
              >
                Download Asset
              </a>
            </div>
          </div>
        )}
      </div>

      {!isSection && (
        <div className="shrink-0 p-4 border-t border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-black/20 flex justify-center">
          <p className="text-[7px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.3em]">Quantum Visual Core v5 // Sovereign Intelligence</p>
        </div>
      )}
    </div>
  );

  if (isSection) return content;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/40 backdrop-blur-3xl animate-in fade-in duration-300">
      {content}
    </div>
  );
};
