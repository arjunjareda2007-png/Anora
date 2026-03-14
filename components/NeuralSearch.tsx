
import React, { useState } from 'react';
import { User, GroundingSource } from '../types';
import { anoraService } from '../services/geminiService';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Globe, MapPin, ExternalLink, Loader2, X, Sparkles } from 'lucide-react';

interface NeuralSearchProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  isSection?: boolean;
}

export const NeuralSearch: React.FC<NeuralSearchProps> = ({ user, isOpen, onClose, isSection }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ text: string; sources: GroundingSource[] } | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResults(null);
    try {
      // We use the existing sendMessageWithVision but with a search-focused prompt
      const response = await anoraService.sendMessageWithVision(`SEARCH PROTOCOL: ${query}. Provide a detailed report with sources.`, []);
      setResults({ text: response.text, sources: response.sources || [] });
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen && !isSection) return null;

  const Content = (
    <div className={`w-full max-w-4xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-none sm:rounded-[4rem] shadow-2xl flex flex-col ${isSection ? 'h-auto border-0 shadow-none rounded-none' : 'h-full sm:h-auto sm:max-h-[85vh] overflow-hidden'}`}>
      
      {!isSection && (
        <div className="shrink-0 p-8 sm:p-10 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-zinc-900 dark:bg-white rounded-2xl shadow-lg">
                <Globe className="w-5 h-5 text-white dark:text-black" />
             </div>
             <div>
                <h2 className="text-xl font-black font-outfit text-zinc-900 dark:text-white tracking-tight">Neural Search</h2>
                <p className="text-[9px] text-zinc-400 font-black uppercase tracking-[0.4em] mt-1">Real-time Grounding Protocol</p>
             </div>
          </div>
          <button onClick={onClose} className="p-4 text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-all bg-zinc-50 dark:bg-white/5 rounded-3xl border border-zinc-100 dark:border-white/10">
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto p-8 sm:p-10 space-y-8 no-scrollbar ${isSection ? 'overflow-visible' : ''}`}>
         <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-300 group-focus-within:text-zinc-900 dark:group-focus-within:text-white transition-colors" />
            <input 
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Query the global neural network..." 
              className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-100 dark:border-white/10 rounded-[2.5rem] pl-16 pr-8 py-6 text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-zinc-300 transition-all shadow-sm"
            />
            <button 
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-4 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-full shadow-lg active:scale-90 transition-all disabled:opacity-20"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            </button>
         </div>

         <AnimatePresence mode="wait">
            {loading ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-20 flex flex-col items-center text-center space-y-6"
              >
                 <div className="relative">
                    <div className="w-20 h-20 rounded-full border-4 border-zinc-100 dark:border-white/10 border-t-zinc-900 dark:border-t-white animate-spin"></div>
                    <Globe className="absolute inset-0 m-auto w-8 h-8 text-zinc-900 dark:text-white animate-pulse" />
                 </div>
                 <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.5em] animate-pulse">Synchronizing with Global Nodes...</p>
              </motion.div>
            ) : results ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                 <div className="p-8 bg-zinc-50 dark:bg-black/20 border border-zinc-100 dark:border-white/10 rounded-[3rem] shadow-sm">
                    <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium whitespace-pre-wrap">{results.text}</p>
                 </div>

                 {results.sources.length > 0 && (
                   <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-widest ml-4">Verified Sources</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                         {results.sources.map((source, i) => (
                           <a 
                             key={i} 
                             href={source.uri} 
                             target="_blank" 
                             rel="noopener noreferrer"
                             className="p-5 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-white/10 rounded-[2rem] flex items-center justify-between group hover:border-zinc-900 dark:hover:border-white transition-all shadow-sm"
                           >
                              <div className="flex items-center gap-4 overflow-hidden">
                                 <div className="p-2 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/10">
                                    {source.uri?.includes('maps') ? <MapPin className="w-3 h-3 text-zinc-400" /> : <Globe className="w-3 h-3 text-zinc-400" />}
                                 </div>
                                 <span className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-widest truncate">{source.title || "Information Node"}</span>
                              </div>
                              <ExternalLink className="w-4 h-4 text-zinc-200 dark:text-zinc-700 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors shrink-0" />
                           </a>
                         ))}
                      </div>
                   </div>
                 )}
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-20 text-center space-y-4"
              >
                 <p className="text-[10px] font-black text-zinc-200 dark:text-zinc-800 uppercase tracking-[0.8em]">Awaiting Query Input</p>
              </motion.div>
            )}
         </AnimatePresence>
      </div>

      {!isSection && (
        <div className="shrink-0 p-8 border-t border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-black/20 flex justify-center">
           <p className="text-[8px] font-black text-zinc-300 dark:text-zinc-600 uppercase tracking-[0.4em]">Neural Grounding Engine v2.0 // Sovereign Core</p>
        </div>
      )}
    </div>
  );

  if (isSection) return Content;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-0 sm:p-8 bg-black/5 backdrop-blur-3xl animate-in fade-in duration-500">
      {Content}
    </div>
  );
};
