
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Grid, Image as ImageIcon, Download, Trash2, X, Maximize2, ExternalLink, Search } from 'lucide-react';

interface NeuralGalleryProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  isSection?: boolean;
}

export const NeuralGallery: React.FC<NeuralGalleryProps> = ({ user, isOpen, onClose, isSection = false }) => {
  const [images, setImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (isOpen || isSection) {
      const historyKey = `anora_history_${user.email}`;
      const savedHistory = JSON.parse(localStorage.getItem(historyKey) || "[]");
      const allImages: string[] = [];
      savedHistory.forEach((m: any) => {
        if (m.images) allImages.push(...m.images);
      });
      setImages([...new Set(allImages)]); // Unique images
    }
  }, [isOpen, isSection, user.email]);

  const downloadImage = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `anora-gallery-${Date.now()}.png`;
    link.click();
  };

  if (!isOpen && !isSection) return null;

  const content = (
    <div className={`flex flex-col ${isSection ? 'w-full h-full' : 'w-full max-w-6xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-none sm:rounded-[4rem] shadow-2xl h-full sm:h-auto sm:max-h-[90vh] overflow-hidden'}`}>
      
      {!isSection && (
        <div className="shrink-0 p-8 sm:p-10 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-zinc-900 dark:bg-white rounded-2xl shadow-lg">
                <Grid className="w-5 h-5 text-white dark:text-black" />
             </div>
             <div>
                <h2 className="text-xl font-black font-outfit text-zinc-900 dark:text-white tracking-tight">Neural Gallery</h2>
                <p className="text-[9px] text-zinc-400 font-black uppercase tracking-[0.4em] mt-1">Visual Asset Repository</p>
             </div>
          </div>
          <button onClick={onClose} className="p-4 text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-all bg-zinc-50 dark:bg-white/5 rounded-3xl border border-zinc-100 dark:border-white/10">
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto no-scrollbar ${isSection ? 'p-0' : 'p-8 sm:p-10'} space-y-8`}>
         {images.length > 0 ? (
           <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
              {images.map((img, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="aspect-square rounded-[2rem] overflow-hidden border border-zinc-100 dark:border-white/10 relative group shadow-sm hover:shadow-xl hover:border-zinc-300 dark:hover:border-white/20 transition-all cursor-pointer"
                  onClick={() => setSelectedImage(img)}
                >
                   <img src={img} className="w-full h-full object-cover" alt={`Manifestation ${i}`} referrerPolicy="no-referrer" />
                   <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button 
                        onClick={(e) => { e.stopPropagation(); downloadImage(img); }}
                        className="p-3 bg-white rounded-full text-zinc-900 shadow-lg active:scale-90 transition-all"
                      >
                         <Download className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedImage(img); }}
                        className="p-3 bg-white rounded-full text-zinc-900 shadow-lg active:scale-90 transition-all"
                      >
                         <Maximize2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if (window.confirm("Purge this visual asset from neural records?")) {
                            const historyKey = `anora_history_${user.email}`;
                            const savedHistory = JSON.parse(localStorage.getItem(historyKey) || "[]");
                            const updatedHistory = savedHistory.map((m: any) => {
                              if (m.images) {
                                return { ...m, images: m.images.filter((url: string) => url !== img) };
                              }
                              return m;
                            });
                            localStorage.setItem(historyKey, JSON.stringify(updatedHistory));
                            setImages(prev => prev.filter(url => url !== img));
                          }
                        }}
                        className="p-3 bg-white rounded-full text-red-500 shadow-lg active:scale-90 transition-all"
                      >
                         <Trash2 className="w-4 h-4" />
                      </button>
                   </div>
                </motion.div>
              ))}
           </div>
         ) : (
           <div className="py-40 text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 flex items-center justify-center mx-auto">
                 <ImageIcon className="w-8 h-8 text-zinc-200 dark:text-zinc-700" />
              </div>
              <p className="text-[10px] font-black text-zinc-300 dark:text-zinc-600 uppercase tracking-[0.6em]">Gallery Empty // Awaiting Manifestations</p>
           </div>
         )}
      </div>

      {!isSection && (
        <div className="shrink-0 p-8 border-t border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-black/20 flex justify-center">
           <p className="text-[8px] font-black text-zinc-300 dark:text-zinc-600 uppercase tracking-[0.4em]">Neural Repository v1.0 // Sovereign Core</p>
        </div>
      )}
    </div>
  );

  if (isSection) return content;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-0 sm:p-8 bg-black/20 backdrop-blur-3xl animate-in fade-in duration-500">
      {content}
      <AnimatePresence>
        {selectedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[700] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 sm:p-20"
            onClick={() => setSelectedImage(null)}
          >
             <button className="absolute top-10 right-10 p-4 text-white/40 hover:text-white transition-colors">
                <X className="w-8 h-8" />
             </button>
             <motion.img 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                src={selectedImage} 
                className="max-w-full max-h-full rounded-3xl shadow-2xl object-contain"
                onClick={e => e.stopPropagation()}
                referrerPolicy="no-referrer"
             />
             <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-4">
                <button 
                  onClick={() => downloadImage(selectedImage)}
                  className="px-8 py-4 bg-white text-zinc-900 rounded-full font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-3"
                >
                   <Download className="w-4 h-4" />
                   Download Asset
                </button>
                <button 
                  onClick={() => {
                    if (window.confirm("Purge this visual asset from neural records?")) {
                      const historyKey = `anora_history_${user.email}`;
                      const savedHistory = JSON.parse(localStorage.getItem(historyKey) || "[]");
                      const updatedHistory = savedHistory.map((m: any) => {
                        if (m.images) {
                          return { ...m, images: m.images.filter((url: string) => url !== selectedImage) };
                        }
                        return m;
                      });
                      localStorage.setItem(historyKey, JSON.stringify(updatedHistory));
                      setImages(prev => prev.filter(url => url !== selectedImage));
                      setSelectedImage(null);
                    }
                  }}
                  className="px-8 py-4 bg-red-500 text-white rounded-full font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-3"
                >
                   <Trash2 className="w-4 h-4" />
                   Purge Asset
                </button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
