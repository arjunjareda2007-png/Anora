
import React, { useState, useRef } from 'react';
import { User } from '../types';
import { anoraService } from '../services/geminiService';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Upload, Loader2, X, Sparkles, Eye, FileText, Zap } from 'lucide-react';

interface NeuralVisionProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
}

export const NeuralVision: React.FC<NeuralVisionProps> = ({ user, isOpen, onClose }) => {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!image) return;
    setLoading(true);
    setAnalysis(null);
    try {
      const response = await anoraService.sendMessageWithVision("NEURAL VISION PROTOCOL: Analyze this visual asset in extreme detail. Provide a technical report, aesthetic evaluation, and semantic breakdown.", [image]);
      setAnalysis(response.text);
    } catch (err) {
      console.error("Vision analysis failed", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[450] flex items-center justify-center p-0 sm:p-8 bg-black/5 backdrop-blur-3xl animate-in fade-in duration-500">
      <div className="w-full max-w-5xl bg-white border border-zinc-200 rounded-none sm:rounded-[4rem] shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[90vh] overflow-hidden">
        
        <div className="shrink-0 p-8 sm:p-10 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-zinc-900 rounded-2xl shadow-lg">
                <Eye className="w-5 h-5 text-white" />
             </div>
             <div>
                <h2 className="text-xl font-black font-outfit text-zinc-900 tracking-tight">Neural Vision</h2>
                <p className="text-[9px] text-zinc-400 font-black uppercase tracking-[0.4em] mt-1">Advanced Visual Analytics Protocol</p>
             </div>
          </div>
          <button onClick={onClose} className="p-4 text-zinc-300 hover:text-zinc-900 transition-all bg-zinc-50 rounded-3xl border border-zinc-100">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 sm:p-10 space-y-10 no-scrollbar">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* Left Side: Image Selection */}
              <div className="space-y-6">
                 <div 
                    onClick={() => !loading && fileInputRef.current?.click()}
                    className={`aspect-square rounded-[3rem] border-2 border-dashed flex flex-col items-center justify-center transition-all cursor-pointer overflow-hidden relative group ${image ? 'border-zinc-900' : 'border-zinc-100 hover:border-zinc-300 bg-zinc-50/50'}`}
                 >
                    {image ? (
                      <>
                        <img src={image} className="w-full h-full object-cover" alt="Source" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                           <Upload className="w-8 h-8 text-white" />
                        </div>
                      </>
                    ) : (
                      <div className="text-center space-y-4 p-10">
                         <div className="w-16 h-16 rounded-full bg-white border border-zinc-100 flex items-center justify-center mx-auto shadow-sm">
                            <Camera className="w-6 h-6 text-zinc-300" />
                         </div>
                         <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Manifest Visual Asset</p>
                      </div>
                    )}
                    <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileSelect} />
                 </div>
                 <button 
                    onClick={handleAnalyze}
                    disabled={loading || !image}
                    className="w-full py-6 bg-zinc-900 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.4em] shadow-xl active:scale-95 transition-all disabled:opacity-20 flex items-center justify-center gap-4"
                 >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                    {loading ? 'Analyzing Synapse...' : 'Execute Vision Scan'}
                 </button>
              </div>

              {/* Right Side: Analysis Output */}
              <div className="space-y-6">
                 <div className="flex items-center gap-3 px-4">
                    <FileText className="w-4 h-4 text-zinc-900" />
                    <h4 className="text-[10px] font-black text-zinc-900 uppercase tracking-widest">Analysis Report</h4>
                 </div>
                 <div className="min-h-[400px] bg-zinc-50 border border-zinc-100 rounded-[3rem] p-8 sm:p-10 shadow-inner relative">
                    <AnimatePresence mode="wait">
                       {loading ? (
                         <motion.div 
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 flex flex-col items-center justify-center space-y-4"
                         >
                            <div className="w-12 h-1 bg-zinc-200 rounded-full overflow-hidden">
                               <motion.div 
                                  animate={{ x: ["-100%", "100%"] }}
                                  transition={{ duration: 1, repeat: Infinity }}
                                  className="h-full w-1/2 bg-zinc-900"
                               />
                            </div>
                            <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Processing Neural Layers...</p>
                         </motion.div>
                       ) : analysis ? (
                         <motion.div 
                            key="analysis"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="prose prose-zinc max-w-none"
                         >
                            <p className="text-sm text-zinc-800 leading-relaxed font-medium whitespace-pre-wrap">{analysis}</p>
                         </motion.div>
                       ) : (
                         <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-10">
                            <p className="text-[9px] font-black text-zinc-200 uppercase tracking-[0.5em]">Awaiting Visual Input for Scan</p>
                         </div>
                       )}
                    </AnimatePresence>
                 </div>
              </div>
           </div>
        </div>

        <div className="shrink-0 p-8 border-t border-zinc-100 bg-zinc-50/50 flex justify-center">
           <p className="text-[8px] font-black text-zinc-300 uppercase tracking-[0.4em]">Neural Vision Engine v4.0 // Sovereign Core</p>
        </div>
      </div>
    </div>
  );
};
