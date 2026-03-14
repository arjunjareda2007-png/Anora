
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Palette, Eye, Search, Layers, Menu, Zap, Volume2, Grid, 
  User as UserIcon, Sparkles, X, LogOut, Settings, Shield, Lock,
  Image as ImageIcon, Plus
} from 'lucide-react';
import { User, Persona, SubscriptionTier, Role } from '../types';

interface NeuralMenuProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onOpenProfile: (section?: string) => void;
  onOpenArtisan: () => void;
  onOpenVision: () => void;
  onOpenSearch: () => void;
  onOpenGallery: () => void;
  onOpenAudio: () => void;
  onOpenWorkspace: () => void;
  onOpenHub: () => void;
  onOpenHubWithTab: (tab: any) => void;
  onOpenCommandCenter: () => void;
  onOpenHistory: () => void;
  onLogout: () => void;
  onNewChat: () => void;
  onToggleColorMode: () => void;
}

export const NeuralMenu: React.FC<NeuralMenuProps> = ({
  isOpen, onClose, user,
  onOpenProfile, onOpenArtisan, onOpenVision, onOpenSearch,
  onOpenGallery, onOpenAudio, onOpenWorkspace, onOpenHub, onOpenHubWithTab,
  onOpenCommandCenter, onOpenHistory, onLogout, onNewChat, onToggleColorMode
}) => {
  const isOwner = user.role === Role.OWNER;
  const isPremium = user.tier !== SubscriptionTier.FREE || isOwner;

  const menuItems = [
    { icon: Palette, label: 'Appearance', sub: user.preferences.colorMode === 'DARK' ? 'Dark Mode' : 'Light Mode', action: onToggleColorMode, color: 'text-indigo-500', premium: false },
    { icon: Volume2, label: 'Audio', sub: 'Voice Synthesis', action: () => onOpenProfile('VOICE'), color: 'text-orange-500', premium: true },
    { icon: Layers, label: 'Gallery', sub: 'Saved Assets', action: onOpenGallery, color: 'text-pink-500', premium: true },
    { icon: Grid, label: 'History', sub: 'Neural Archives', action: onOpenHistory, color: 'text-zinc-500', premium: false },
    { icon: Zap, label: 'Hub', sub: 'Extra Features', action: onOpenHub, color: 'text-zinc-500', premium: false },
    { icon: ImageIcon, label: 'Images', sub: 'AI Art Generator', action: onOpenArtisan, color: 'text-purple-500', premium: true },
    { icon: Plus, label: 'New Chat', sub: 'Start New Link', action: onNewChat, color: 'text-emerald-500', premium: false },
    { icon: Sparkles, label: 'Persona', sub: user.preferences.persona || 'Default', action: () => onOpenProfile('PERSONA'), color: 'text-amber-500', premium: false },
    { icon: UserIcon, label: 'Profile', sub: 'Identity Settings', action: () => onOpenProfile(), color: 'text-blue-500', premium: false },
    { icon: Search, label: 'Search', sub: 'Web Knowledge', action: onOpenSearch, color: 'text-cyan-500', premium: true },
    { icon: Shield, label: 'System', sub: 'Command Center', action: onOpenCommandCenter, color: 'text-yellow-500', premium: true },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[150]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-[320px] bg-white dark:bg-zinc-900 shadow-2xl z-[160] flex flex-col border-l border-zinc-100 dark:border-white/10"
          >
            <div className="p-6 sm:p-8 border-b border-zinc-50 dark:border-white/5 flex items-center justify-between bg-zinc-50/50 dark:bg-black/20">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-black font-black text-base sm:text-lg overflow-hidden shadow-lg">
                  {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : user.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white tracking-tight">{user.name}</h3>
                  <p className="text-[7px] sm:text-[8px] font-black text-zinc-400 uppercase tracking-widest">{user.tier} Tier</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2.5 sm:p-3 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all bg-white dark:bg-white/5 rounded-lg sm:rounded-xl border border-zinc-100 dark:border-white/10 shadow-sm">
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-3 sm:p-4 space-y-1">
              {!isPremium && (
                <button 
                  onClick={() => { onOpenHubWithTab('UPGRADE'); onClose(); }}
                  className="w-full mb-4 p-4 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 flex items-center justify-between group active:scale-95 transition-all"
                >
                  <div className="flex flex-col items-start">
                    <span className="text-[10px] font-black uppercase tracking-widest">Upgrade to Pro</span>
                    <span className="text-[8px] font-bold opacity-70 uppercase tracking-widest">Unlock Neural Potential</span>
                  </div>
                  <Zap className="w-4 h-4 animate-pulse" />
                </button>
              )}

              <div className="px-3 sm:px-4 py-2 mb-1 sm:mb-2">
                <p className="text-[8px] sm:text-[9px] font-black text-zinc-300 dark:text-zinc-600 uppercase tracking-[0.3em]">Neural Protocols</p>
              </div>
              {menuItems.map((item, idx) => {
                const isLocked = item.premium && !isPremium;
                return (
                  <button
                    key={idx}
                    onClick={() => { 
                      if (isLocked) {
                        onOpenHubWithTab('UPGRADE');
                      } else {
                        item.action(); 
                      }
                      onClose(); 
                    }}
                    className={`w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl hover:bg-zinc-50 dark:hover:bg-white/5 transition-all group text-left border border-transparent hover:border-zinc-100 dark:hover:border-white/10 ${isLocked ? 'opacity-50 grayscale' : ''}`}
                  >
                    <div className={`p-2.5 sm:p-3 rounded-lg sm:rounded-xl bg-white dark:bg-zinc-800 shadow-sm border border-zinc-50 dark:border-white/5 group-hover:scale-110 transition-transform ${item.color}`}>
                      {isLocked ? <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400" /> : <item.icon className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] sm:text-[11px] font-black text-zinc-900 dark:text-white uppercase tracking-tight flex items-center justify-between">
                        {item.label}
                        {isLocked && <span className="text-[7px] font-black bg-zinc-100 dark:bg-white/5 px-2 py-0.5 rounded-full text-zinc-400">Locked</span>}
                      </p>
                      <p className="text-[8px] sm:text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">{item.sub}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="p-6 border-t border-zinc-50 dark:border-white/5 bg-zinc-50/30 dark:bg-black/20">
              <button 
                onClick={() => { onLogout(); onClose(); }}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-red-50 dark:bg-red-500/10 text-red-600 font-black uppercase text-[10px] tracking-[0.2em] shadow-sm hover:bg-red-500 hover:text-white transition-all active:scale-95"
              >
                <LogOut className="w-4 h-4" />
                Sign Out Protocol
              </button>
              <div className="mt-6 flex justify-center">
                <p className="text-[7px] font-black text-zinc-300 dark:text-zinc-600 uppercase tracking-[0.5em]">Anora Sovereign v8.5</p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
