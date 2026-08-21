
import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { motion, AnimatePresence } from 'motion/react';
import { X, Upload, Check, Image as ImageIcon, Loader2, ExternalLink } from 'lucide-react';
import { Persona } from '../types';

interface PersonaImageEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (persona: Persona, base64Image: string) => Promise<void>;
  currentPersona: Persona;
}

export const PersonaImageEditor: React.FC<PersonaImageEditorProps> = ({ isOpen, onClose, onSave, currentPersona }) => {
  const [image, setImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => setImage(reader.result as string));
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<string> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return '';

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return canvas.toDataURL('image/jpeg', 0.7);
  };

  const handleSave = async () => {
    if (!image || !croppedAreaPixels) return;
    setIsSaving(true);
    try {
      const croppedImage = await getCroppedImg(image, croppedAreaPixels);
      await onSave(currentPersona, croppedImage);
      onClose();
      setImage(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[2rem] overflow-hidden shadow-2xl border border-zinc-100 dark:border-white/10"
          >
            <div className="p-6 border-b border-zinc-50 dark:border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-900 dark:text-white">Persona Sync</h3>
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Calibrating Visual Identity: {currentPersona}</p>
              </div>
              <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {!image ? (
                <div className="space-y-4">
                  <label className="flex flex-col items-center justify-center w-full aspect-[2/1] rounded-[2rem] border-2 border-dashed border-zinc-200 dark:border-white/10 hover:border-indigo-500 transition-all cursor-pointer group">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 rounded-full bg-zinc-50 dark:bg-white/5 group-hover:bg-indigo-500/10 transition-colors">
                        <Upload className="w-6 h-6 text-zinc-400 group-hover:text-indigo-500" />
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-900 dark:text-white">Upload Local Data</p>
                      </div>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </label>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                      <ExternalLink className="w-4 h-4 text-zinc-400" />
                    </div>
                    <input 
                      type="text"
                      placeholder="Or paste visual asset URL..."
                      className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-2xl py-4 pl-12 pr-4 text-[10px] text-zinc-900 dark:text-white outline-none focus:border-indigo-500 transition-all"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = (e.target as HTMLInputElement).value;
                          if (val.startsWith('http')) setImage(val);
                        }
                      }}
                      onBlur={(e) => {
                        const val = e.target.value;
                        if (val.startsWith('http')) setImage(val);
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="relative w-full aspect-square rounded-[2rem] overflow-hidden bg-zinc-100 dark:bg-black/20">
                    <Cropper
                      image={image}
                      crop={crop}
                      zoom={zoom}
                      aspect={1}
                      onCropChange={setCrop}
                      onCropComplete={onCropComplete}
                      onZoomChange={setZoom}
                      cropShape="round"
                      showGrid={false}
                    />
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Zoom Level</p>
                      <input 
                        type="range" 
                        value={zoom} 
                        min={1} 
                        max={3} 
                        step={0.1} 
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="flex-1 h-1 bg-zinc-100 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-indigo-500"
                      />
                    </div>
                    
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setImage(null)}
                        className="flex-1 py-4 rounded-2xl border border-zinc-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all"
                      >
                        Reset Data
                      </button>
                      <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 py-4 rounded-2xl bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        {isSaving ? 'Synchronizing...' : 'Finalize Sync'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
