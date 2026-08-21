import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppTheme, ColorMode, User, AppFont } from '../types';
import { THEMES, ACCENT_COLORS } from '../constants';
import { X, Palette, Sun, Moon, Sparkles, Monitor, Type, Check, Zap, Eye, Contrast } from 'lucide-react';

interface AppearanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUpdate: (updatedUser: User) => void;
}

const COLOR_MODES: { id: ColorMode; label: string; icon: any; desc: string; classes: string }[] = [
  { id: 'WHITE', label: 'Classic Light', icon: Sun, desc: 'Clean, radiant high-luminance theme', classes: 'bg-white border-zinc-200' },
  { id: 'DARK', label: 'Deep Twilight', icon: Moon, desc: 'Calibrated for eye comfort', classes: 'bg-zinc-900 border-zinc-850' },
  { id: 'BRIGHT', label: 'Vivid Mode', icon: Zap, desc: 'Maximum contrast elements', classes: 'bg-zinc-50 border-zinc-300' },
  { id: 'COLOURFUL', label: 'Vibrant Flow', icon: Sparkles, desc: 'Chromatic gradient aesthetics', classes: 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 border-transparent' },
  { id: 'DIM', label: 'Neutral Dim', icon: Eye, desc: 'Warm grey strain reducer', classes: 'bg-zinc-200 border-zinc-350' },
  { id: 'AMOLED', label: 'Pure AMOLED', icon: Contrast, desc: 'True absolute black energy Saver', classes: 'bg-black border-zinc-900' },
  { id: 'RAINBOW', label: 'Prismatic Glow', icon: Sparkles, desc: 'Interactive color shifting wave', classes: 'bg-gradient-to-tr from-red-500 via-yellow-500 to-blue-500' }
];

export const AppearanceModal: React.FC<AppearanceModalProps> = ({ isOpen, onClose, user, onUpdate }) => {
  if (!isOpen) return null;

  const handleUpdate = (updates: Partial<User['preferences']>) => {
    onUpdate({
      ...user,
      preferences: {
        ...user.preferences,
        ...updates
      }
    });
  };

  const isRainbow = user.preferences.colorMode === 'RAINBOW';

  return (
    <AnimatePresence>
      <div className={`fixed inset-0 z-[200] flex items-center justify-center p-4 ${isRainbow ? 'rainbow-mode' : ''}`}>
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/40 backdrop-blur-md"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className={`relative w-full max-w-xl max-h-[85vh] bg-white dark:bg-zinc-950 rounded-3xl border shadow-2xl flex flex-col overflow-hidden ${
            isRainbow ? 'rainbow-box border-transparent' : 'border-zinc-200 dark:border-white/10'
          }`}
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl">
                <Palette className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-tight">Appearance settings</h2>
                <p className="text-[7px] text-zinc-400 font-extrabold uppercase tracking-widest mt-0.5">Adjust interface colors and spacing</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-lg">
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6">
            {/* Color Modes */}
            <div className="space-y-3">
              <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Surface modes</span>
              <div className="grid grid-cols-2 gap-2">
                {COLOR_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => handleUpdate({ colorMode: mode.id })}
                    className={`relative flex items-center gap-3 p-3 rounded-xl border text-left transition-all hover:scale-[1.01] ${
                      user.preferences.colorMode === mode.id 
                        ? 'border-zinc-900 dark:border-white bg-zinc-50 dark:bg-white/5 shadow-sm' 
                        : 'border-zinc-100 dark:border-white/5'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${mode.classes}`}>
                      <mode.icon className={`w-3.5 h-3.5 ${mode.id === 'WHITE' ? 'text-zinc-900' : 'text-white'}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-tight text-zinc-800 dark:text-zinc-200 truncate">{mode.label}</p>
                    </div>
                    {user.preferences.colorMode === mode.id && (
                      <div className="ml-auto w-3.5 h-3.5 rounded-full bg-zinc-900 dark:bg-white flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white dark:text-black" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Neural Themes */}
            <div className="space-y-3">
              <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Neural textures</span>
              <div className="grid grid-cols-3 gap-1.5">
                {THEMES.map((themeName) => (
                  <button
                    key={themeName}
                    onClick={() => handleUpdate({ theme: themeName })}
                    className={`py-2 px-3 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all ${
                      user.preferences.theme === themeName 
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-black border-transparent shadow' 
                        : 'bg-zinc-50 dark:bg-white/5 border-zinc-100 dark:border-white/5 text-zinc-400 hover:border-zinc-300'
                    }`}
                  >
                    {themeName.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Typography */}
            <div className="space-y-3">
              <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Font pairing</span>
              <div className="flex gap-2">
                {(['INTER', 'OUTFIT'] as AppFont[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => handleUpdate({ font: f })}
                    className={`flex-1 py-2.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${
                      user.preferences.font === f 
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-black border-transparent shadow' 
                        : 'bg-zinc-50 dark:bg-white/5 border-zinc-100 dark:border-white/10 text-zinc-400'
                    } ${f === 'OUTFIT' ? 'font-outfit' : 'font-inter'}`}
                  >
                    {f} Font family
                  </button>
                ))}
              </div>
            </div>

            {/* Accent Highlight */}
            <div className="space-y-3">
              <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Color Highlights</span>
              <div className="flex flex-wrap gap-2">
                {ACCENT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => handleUpdate({ accentColor: c.value })}
                    className="w-7 h-7 rounded-full border border-white dark:border-zinc-800 shadow-sm transition-transform active:scale-90 hover:scale-110 relative shrink-0"
                    style={{ backgroundColor: c.value }}
                  >
                    {user.preferences.accentColor === c.value && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white drop-shadow-md" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-zinc-100 dark:border-white/5 bg-zinc-50/20 dark:bg-black/20 flex justify-center">
            <span className="text-[7px] font-black text-zinc-400 dark:text-zinc-650 uppercase tracking-[0.3em]">Cohesive Theme Renderer Online</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
