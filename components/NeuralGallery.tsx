import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Grid, Image as ImageIcon, Download, Trash2, X, Maximize2, ExternalLink } from 'lucide-react';
import { AnoraLogo } from './AnoraLogo';

interface NeuralGalleryProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  isSection?: boolean;
}

export const NeuralGallery: React.FC<NeuralGalleryProps> = ({ user, isOpen, onClose, isSection = false }) => {
  const [images, setImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen || isSection) {
      const galleryKey = `anora_gallery_${user.email}`;
      const savedGallery = JSON.parse(localStorage.getItem(galleryKey) || "[]");
      const urls = savedGallery.map((item: any) => item.url);
      setImages([...new Set(urls as string[])]); // Unique items
    }
  }, [isOpen, isSection, user.email]);

  const isVideo = (url: string) => url?.includes('video') || url?.includes('.mp4') || url?.includes('veo');

  const downloadImage = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `anora_asset_${Date.now()}.${isVideo(url) ? 'mp4' : 'png'}`;
    link.click();
  };

  const handlePurge = (img: string) => {
    if (window.confirm("Purge this visual asset from records?")) {
      const galleryKey = `anora_gallery_${user.email}`;
      const savedGallery = JSON.parse(localStorage.getItem(galleryKey) || "[]");
      const updatedGallery = savedGallery.filter((item: any) => item.url !== img);
      localStorage.setItem(galleryKey, JSON.stringify(updatedGallery));
      setImages(prev => prev.filter(url => url !== img));
      if (selectedImage === img) setSelectedImage(null);
    }
  };

  if (!isOpen && !isSection) return null;

  const content = (
    <div className={`flex flex-col h-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 ${isSection ? 'w-full' : 'w-full max-w-4xl border border-zinc-200 dark:border-white/10 rounded-3xl sm:rounded-[3rem] shadow-2xl overflow-hidden'}`}>
      
      {!isSection && (
        <div className="shrink-0 p-6 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between ">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-2xl">
              <Grid className="w-4 h-4 text-inherit" />
            </div>
            <div>
              <h2 className="text-md font-black tracking-tight uppercase">Sovereign Vault</h2>
              <p className="text-[7px] text-zinc-400 font-extrabold uppercase tracking-widest mt-0.5">Physical visual records</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-xl transition-all">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar p-6">
        {images.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {images.map((img, i) => (
              <motion.div 
                key={`${img}-${i}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-2xl overflow-hidden border border-zinc-100 dark:border-white/5 flex flex-col bg-zinc-50 dark:bg-white/5 relative group cursor-pointer hover:border-zinc-300 dark:hover:border-white/10 shadow-sm transition-all"
              >
                <div className="aspect-square relative w-full overflow-hidden" onClick={() => setSelectedImage(img)}>
                  {isVideo(img) ? (
                    <video src={img} className="w-full h-full object-cover" muted loop onMouseEnter={e => e.currentTarget.play()} onMouseLeave={e => e.currentTarget.pause()} />
                  ) : (
                    <img src={img} className="w-full h-full object-cover" alt={`Asset ${i}`} referrerPolicy="no-referrer" />
                  )}
                  
                  {/* Micro Watermark */}
                  <div className="absolute bottom-2.5 right-2.5 pointer-events-none z-10 opacity-30">
                    <AnoraLogo size={12} showName={false} />
                  </div>
                </div>

                {/* Visible horizontal action buttons bar */}
                <div className="flex border-t border-zinc-100 dark:border-white/5 p-1.5 px-2 justify-between items-center bg-white dark:bg-zinc-950/60 shrink-0">
                  <button 
                    type="button" 
                    onClick={() => setSelectedImage(img)}
                    className="p-1 px-1.5 hover:bg-zinc-150 dark:hover:bg-white/10 rounded-lg text-[8px] font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-widest transition-colors"
                  >
                    View
                  </button>
                  <div className="flex items-center gap-1.5">
                    <button 
                      type="button" 
                      onClick={(e) => { e.stopPropagation(); downloadImage(img); }}
                      className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                      title="Download Asset"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      type="button" 
                      onClick={(e) => { e.stopPropagation(); handlePurge(img); }}
                      className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                      title="Purge Asset"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="py-32 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 flex items-center justify-center mx-auto">
              <ImageIcon className="w-6 h-6 text-zinc-350 dark:text-zinc-600" />
            </div>
            <p className="text-[8px] font-black text-zinc-300 dark:text-zinc-700 uppercase tracking-[0.5em]">Quantum repository empty</p>
          </div>
        )}
      </div>

      {!isSection && (
        <div className="shrink-0 p-4 border-t border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-black/20 flex justify-center">
          <p className="text-[7px] font-black text-zinc-400 dark:text-zinc-650 uppercase tracking-[0.3em]">Neural Gallery Engine Active</p>
        </div>
      )}
    </div>
  );

  if (isSection) return content;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/40 backdrop-blur-3xl animate-in duration-300">
      {content}
      <AnimatePresence>
        {selectedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[700] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <button className="absolute top-6 right-6 p-2 text-white/50 hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>
            {isVideo(selectedImage) ? (
              <motion.video 
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                src={selectedImage} 
                controls 
                autoPlay
                className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl"
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <motion.img 
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                src={selectedImage} 
                className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl object-contain"
                onClick={e => e.stopPropagation()}
                referrerPolicy="no-referrer"
              />
            )}

            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-3">
              <button 
                type="button"
                onClick={() => downloadImage(selectedImage)}
                className="px-6 py-3 bg-white text-zinc-900 rounded-xl font-black uppercase text-[8px] tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                Download Asset
              </button>
              <button 
                type="button"
                onClick={() => handlePurge(selectedImage)}
                className="px-6 py-3 bg-red-600 text-white rounded-xl font-black uppercase text-[8px] tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Purge Asset
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
