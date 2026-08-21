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
      const response = await anoraService.sendMessageWithVision(`SEARCH PROTOCOL: ${query}. Provide a detailed report with sources.`, []);
      setResults({ text: response.text, sources: response.sources || [] });
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setLoading(false);
    }
  };

  const isRainbow = user.preferences.colorMode === 'RAINBOW';

  if (!isOpen && !isSection) return null;

  const content = (
    <div className={`flex flex-col h-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 ${isSection ? 'w-full' : 'w-full max-w-2xl border border-zinc-200 dark:border-white/10 rounded-3xl sm:rounded-[3rem] shadow-2xl overflow-hidden'}`}>
      
      {!isSection && (
        <div className="shrink-0 p-6 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-2xl">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-md font-black tracking-tight uppercase">Neural Search</h2>
              <p className="text-[7px] text-zinc-400 font-extrabold uppercase tracking-widest mt-0.5">Grounding knowledge engine</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-xl transition-all">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6">
        {/* Sleek query input */}
        <div className="relative flex items-center bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-2xl px-4 py-3 group">
          <Search className="w-4 h-4 text-zinc-450 group-focus-within:text-zinc-900 dark:group-focus-within:text-white transition-colors" />
          <input 
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search details on web, weather, news, places..." 
            className="flex-1 bg-transparent px-3 py-1 text-sm font-semibold outline-none text-zinc-900 dark:text-white"
          />
          <button 
            type="button"
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="p-2 bg-zinc-900 hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-100 rounded-xl disabled:opacity-20 transition-all flex items-center justify-center shrink-0"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-inherit" />}
          </button>
        </div>

        {/* Results layout */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-16 flex flex-col items-center text-center space-y-4"
            >
              <div className="relative flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-2 border-zinc-100 dark:border-white/10 border-t-zinc-900 dark:border-t-white animate-spin"></div>
                <Globe className="absolute w-4 h-4 text-zinc-500 animate-pulse" />
              </div>
              <p className="text-[8px] font-black uppercase tracking-[0.4em] text-zinc-400">Broadcasting network trace...</p>
            </motion.div>
          ) : results ? (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="p-5 bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5 rounded-2xl">
                <p className="text-[12px] text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium whitespace-pre-wrap">{results.text}</p>
              </div>

              {results.sources.length > 0 && (
                <div className="space-y-3">
                  <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400 block px-1">Retrieved references</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {results.sources.map((source, i) => (
                      <a 
                        key={i} 
                        href={source.uri} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-3.5 bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-white/5 rounded-xl flex items-center justify-between group hover:border-zinc-300 dark:hover:border-white/10 transition-all"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="p-1.5 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-50 dark:border-white/10">
                            {source.uri?.includes('maps') ? <MapPin className="w-3 h-3 text-zinc-400" /> : <Globe className="w-3 h-3 text-zinc-400" />}
                          </div>
                          <span className="text-[8px] font-black uppercase tracking-widest truncate text-zinc-700 dark:text-zinc-300">{source.title || "Reference node"}</span>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-700 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors ml-2" />
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
              className="py-24 text-center"
            >
              <p className="text-[8px] font-black text-zinc-300 dark:text-zinc-800 uppercase tracking-[0.5em]">No queries initiated</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!isSection && (
        <div className="shrink-0 p-4 border-t border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-black/20 flex justify-center">
          <p className="text-[7px] font-black text-zinc-400 dark:text-zinc-650 uppercase tracking-[0.3em]">Neural grounding engine // active link</p>
        </div>
      )}
    </div>
  );

  if (isSection) return content;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/40 backdrop-blur-3xl animate-in fade-in duration-300">
      {content}
    </div>
  );
};
