
import React, { useState } from 'react';
import { User, ImageAspectRatio } from '../types';
import { anoraService } from '../services/geminiService';
import { motion, AnimatePresence } from 'motion/react';
import { Palette, Download, Loader2, X, Sparkles, Image as ImageIcon, Maximize2, Layers, Wand2 } from 'lucide-react';

interface NeuralArtisanProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  isSection?: boolean;
}

export const NeuralArtisan: React.FC<NeuralArtisanProps> = ({ user, isOpen, onClose, isSection }) => {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>('1:1');
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const bytes = await anoraService.generateImage(prompt, aspectRatio);
      const imageUrl = `data:image/png;base64,${bytes}`;
      setGeneratedImage(imageUrl);
      setHistory(prev => [imageUrl, ...prev].slice(0, 10));
    } catch (err) {
      console.error("Synthesis failed", err);
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `anora-manifest-${Date.now()}.png`;
    link.click();
  };

  if (!isOpen && !isSection) return null;

  const Content = (
    <div className={`w-full max-w-6xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-none sm:rounded-[4rem] shadow-2xl flex flex-col ${isSection ? 'h-auto border-0 shadow-none rounded-none' : 'h-full sm:h-auto sm:max-h-[90vh] overflow-hidden'}`}>
      
      {!isSection && (
        <div className="shrink-0 p-8 sm:p-10 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-zinc-900 dark:bg-white rounded-2xl shadow-lg">
                <Palette className="w-5 h-5 text-white dark:text-black" />
             </div>
             <div>
                <h2 className="text-xl font-black font-outfit text-zinc-900 dark:text-white tracking-tight">Neural Artisan</h2>
                <p className="text-[9px] text-zinc-400 font-black uppercase tracking-[0.4em] mt-1">High-Fidelity Manifestation Protocol</p>
             </div>
          </div>
          <button onClick={onClose} className="p-4 text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-all bg-zinc-50 dark:bg-white/5 rounded-3xl border border-zinc-100 dark:border-white/10">
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto p-8 sm:p-10 space-y-10 no-scrollbar ${isSection ? 'overflow-visible' : ''}`}>
         <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Left Side: Controls */}
            <div className="lg:col-span-5 space-y-8">
               <div className="space-y-4">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-4">Manifestation Command</label>
                  <div className="relative">
                     <textarea 
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        placeholder="Describe the visual essence to manifest..." 
                        className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-100 dark:border-white/10 rounded-[2.5rem] p-8 text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-zinc-300 transition-all shadow-sm min-h-[180px] resize-none"
                     />
                     <div className="absolute bottom-6 right-6 flex gap-2">
                        <button onClick={() => setPrompt('')} className="p-3 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-white/10 rounded-full text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-all shadow-sm">
                           <X className="w-4 h-4" />
                        </button>
                     </div>
                  </div>
               </div>

               <div className="space-y-4">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-4">Temporal Format (Aspect Ratio)</label>
                  <div className="grid grid-cols-3 gap-3">
                     {(['1:1', '4:3', '3:4', '16:9', '9:16'] as ImageAspectRatio[]).map(ratio => (
                       <button 
                          key={ratio}
                          onClick={() => setAspectRatio(ratio)}
                          className={`py-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${aspectRatio === ratio ? 'bg-zinc-900 dark:bg-white text-white dark:text-black border-zinc-900 dark:border-white shadow-lg scale-105' : 'bg-white dark:bg-zinc-800 border-zinc-100 dark:border-white/10 text-zinc-400 hover:border-zinc-300 dark:hover:border-white/20'}`}
                       >
                          {ratio}
                       </button>
                     ))}
                  </div>
               </div>

               <button 
                  onClick={handleGenerate}
                  disabled={loading || !prompt.trim()}
                  className="w-full py-7 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-[2.5rem] font-black uppercase text-xs tracking-[0.5em] shadow-2xl active:scale-95 transition-all disabled:opacity-20 flex items-center justify-center gap-4"
               >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                  {loading ? 'Synthesizing Neural Layers...' : 'Execute Manifestation'}
               </button>
            </div>

            {/* Right Side: Manifestation Output */}
            <div className="lg:col-span-7 space-y-6">
               <div className="flex items-center justify-between px-4">
                  <div className="flex items-center gap-3">
                     <ImageIcon className="w-4 h-4 text-zinc-900 dark:text-white" />
                     <h4 className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-widest">Neural Output</h4>
                  </div>
                  {generatedImage && (
                    <button onClick={downloadImage} className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                       <Download className="w-4 h-4" />
                       Store in Vault
                    </button>
                  )}
               </div>

               <div className="aspect-square bg-zinc-50 dark:bg-black/20 border border-zinc-100 dark:border-white/10 rounded-[3rem] overflow-hidden relative group shadow-inner">
                  <AnimatePresence mode="wait">
                     {loading ? (
                       <motion.div 
                          key="loading"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 flex flex-col items-center justify-center space-y-6"
                       >
                          <div className="relative">
                             <div className="w-24 h-24 rounded-full border-4 border-zinc-100 dark:border-white/10 border-t-zinc-900 dark:border-t-white animate-spin" />
                             <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-zinc-900 dark:text-white animate-pulse" />
                          </div>
                          <div className="text-center space-y-2">
                             <p className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-[0.4em]">Synthesizing Reality</p>
                             <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Neural Synapse Active</p>
                          </div>
                       </motion.div>
                     ) : generatedImage ? (
                       <motion.div 
                          key="output"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="w-full h-full"
                       >
                          <img src={generatedImage} className="w-full h-full object-contain" alt="Manifestation" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                             <button onClick={downloadImage} className="p-6 bg-white dark:bg-zinc-800 rounded-full shadow-2xl active:scale-90 transition-all">
                                <Download className="w-6 h-6 text-zinc-900 dark:text-white" />
                             </button>
                          </div>
                       </motion.div>
                     ) : (
                       <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-10 space-y-6">
                          <div className="w-20 h-20 rounded-full bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-white/10 flex items-center justify-center shadow-sm">
                             <Palette className="w-8 h-8 text-zinc-200 dark:text-zinc-700" />
                          </div>
                          <p className="text-[10px] font-black text-zinc-200 dark:text-zinc-700 uppercase tracking-[0.6em]">Awaiting Manifestation Protocol</p>
                       </div>
                     )}
                  </AnimatePresence>
               </div>

               {/* History Strip */}
               {history.length > 0 && (
                 <div className="space-y-4 pt-4">
                    <div className="flex items-center gap-3 px-4">
                       <Layers className="w-4 h-4 text-zinc-400" />
                       <h4 className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Previous Manifestations</h4>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                       {history.map((img, i) => (
                         <button 
                            key={i} 
                            onClick={() => setGeneratedImage(img)}
                            className="w-24 h-24 rounded-2xl border border-zinc-100 dark:border-white/10 overflow-hidden shrink-0 hover:border-zinc-900 dark:hover:border-white transition-all shadow-sm"
                         >
                            <img src={img} className="w-full h-full object-cover" alt="History" referrerPolicy="no-referrer" />
                         </button>
                       ))}
                    </div>
                 </div>
               )}
            </div>
         </div>
      </div>

      {!isSection && (
        <div className="shrink-0 p-8 border-t border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-black/20 flex justify-center">
           <p className="text-[8px] font-black text-zinc-300 dark:text-zinc-600 uppercase tracking-[0.4em]">Neural Artisan Engine v5.0 // Sovereign Core</p>
        </div>
      )}
    </div>
  );

  if (isSection) return Content;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-0 sm:p-8 bg-black/10 backdrop-blur-3xl animate-in fade-in duration-500">
      {Content}
    </div>
  );
};
