
import React, { useState, useRef } from 'react';
import { User } from '../types';
import { anoraService } from '../services/geminiService';
import { motion, AnimatePresence } from 'motion/react';
import { Music, Play, Download, Loader2, X, Volume2, Mic2, Save, Trash2 } from 'lucide-react';

interface NeuralAudioProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  isSection?: boolean;
}

export const NeuralAudio: React.FC<NeuralAudioProps> = ({ user, isOpen, onClose, isSection = false }) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<{id: string, text: string, url: string}[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleSynthesize = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const base64 = await anoraService.speak(text, user.preferences.voiceName || 'Kore');
      const url = `data:audio/mp3;base64,${base64}`;
      setAudioUrl(url);
      setHistory(prev => [{id: Date.now().toString(), text: text.slice(0, 30) + '...', url}, ...prev].slice(0, 5));
    } catch (err) {
      console.error("Vocal synthesis failed", err);
    } finally {
      setLoading(false);
    }
  };

  const downloadAudio = () => {
    if (!audioUrl) return;
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = `anora-vocal-${Date.now()}.mp3`;
    link.click();
  };

  if (!isOpen && !isSection) return null;

  const content = (
    <div className={`flex flex-col ${isSection ? 'w-full h-full' : 'w-full max-w-4xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-none sm:rounded-[4rem] shadow-2xl h-full sm:h-auto sm:max-h-[85vh] overflow-hidden'}`}>
      
      {!isSection && (
        <div className="shrink-0 p-8 sm:p-10 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-zinc-900 dark:bg-white rounded-2xl shadow-lg">
                <Volume2 className="w-5 h-5 text-white dark:text-black" />
             </div>
             <div>
                <h2 className="text-xl font-black font-outfit text-zinc-900 dark:text-white tracking-tight">Neural Audio</h2>
                <p className="text-[9px] text-zinc-400 font-black uppercase tracking-[0.4em] mt-1">Vocal Manifestation Protocol</p>
             </div>
          </div>
          <button onClick={onClose} className="p-4 text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-all bg-zinc-50 dark:bg-white/5 rounded-3xl border border-zinc-100 dark:border-white/10">
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto no-scrollbar ${isSection ? 'p-0' : 'p-8 sm:p-10'} space-y-10`}>
         <div className="space-y-6">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-4">Vocal Input</label>
            <textarea 
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Enter text to manifest as vocal output..." 
              className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-[2.5rem] p-8 text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-zinc-300 dark:focus:border-white/20 transition-all shadow-sm min-h-[150px] resize-none"
            />
            <button 
              onClick={handleSynthesize}
              disabled={loading || !text.trim()}
              className="w-full py-6 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-[2rem] font-black uppercase text-xs tracking-[0.5em] shadow-xl active:scale-95 transition-all disabled:opacity-20 flex items-center justify-center gap-4"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic2 className="w-5 h-5" />}
              {loading ? 'Synthesizing Vocal Frequencies...' : 'Execute Vocalization'}
            </button>
         </div>

         <AnimatePresence mode="wait">
            {audioUrl && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-[3rem] shadow-sm space-y-6"
              >
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-full bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-white/10 flex items-center justify-center shadow-sm">
                          <Play className="w-5 h-5 text-zinc-900 dark:text-white" />
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-widest">Neural Vocal Output</p>
                          <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Ready for Manifestation</p>
                       </div>
                    </div>
                    <button onClick={downloadAudio} className="p-4 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-white/10 rounded-2xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all shadow-sm">
                       <Download className="w-5 h-5" />
                    </button>
                 </div>
                 <audio ref={audioRef} src={audioUrl} controls className="w-full accent-zinc-900 dark:accent-white" />
              </motion.div>
            )}
         </AnimatePresence>

         {history.length > 0 && (
           <div className="space-y-4">
              <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-4">Recent Vocalizations</h4>
              <div className="space-y-3">
                 {history.map(item => (
                   <div key={item.id} className="p-5 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-white/10 rounded-[2rem] flex items-center justify-between group hover:border-zinc-900 dark:hover:border-white transition-all shadow-sm">
                      <div className="flex items-center gap-4 overflow-hidden">
                         <button onClick={() => setAudioUrl(item.url)} className="p-2 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/10 group-hover:bg-zinc-900 dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-black transition-all">
                            <Play className="w-3 h-3" />
                         </button>
                         <span className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-widest truncate">{item.text}</span>
                      </div>
                      <button onClick={() => setHistory(prev => prev.filter(h => h.id !== item.id))} className="p-2 text-zinc-200 dark:text-zinc-700 hover:text-red-500 transition-colors">
                         <Trash2 className="w-4 h-4" />
                      </button>
                   </div>
                 ))}
              </div>
           </div>
         )}
      </div>

      {!isSection && (
        <div className="shrink-0 p-8 border-t border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-black/20 flex justify-center">
           <p className="text-[8px] font-black text-zinc-300 dark:text-zinc-600 uppercase tracking-[0.4em]">Neural Audio Engine v3.0 // Sovereign Core</p>
        </div>
      )}
    </div>
  );

  if (isSection) return content;

  return (
    <div className="fixed inset-0 z-[550] flex items-center justify-center p-0 sm:p-8 bg-black/10 backdrop-blur-3xl animate-in fade-in duration-500">
      {content}
    </div>
  );
};
