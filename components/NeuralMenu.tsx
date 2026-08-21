import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Palette, Eye, Search, Layers, Menu, Zap, Volume2, Grid, 
  User as UserIcon, Sparkles, X, LogOut, Settings, Shield, Lock,
  Image as ImageIcon
} from 'lucide-react';
import { User, SubscriptionTier, Role } from '../types';
import { VerificationTick } from './VerificationTick';
import { AnoraLogo } from './AnoraLogo';
import { ANORA_VERSION } from '../constants';

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
  onOpenAppearance: () => void;
  onOpenPersonaHub: () => void;
}

export const NeuralMenu: React.FC<NeuralMenuProps> = ({
  isOpen, onClose, user,
  onOpenProfile, onOpenArtisan, onOpenVision, onOpenSearch,
  onOpenGallery, onOpenAudio, onOpenWorkspace, onOpenHub, onOpenHubWithTab,
  onOpenCommandCenter, onOpenHistory, onLogout, onNewChat, onOpenAppearance, onOpenPersonaHub
}) => {
  const isOwner = user.role === Role.OWNER;
  const isPremium = user.tier !== SubscriptionTier.FREE || isOwner;
  const colorMode = user.preferences?.colorMode;

  const menuItems = [
    { icon: UserIcon, label: 'Profile', sub: 'Neural Identity', action: onOpenProfile, color: 'text-blue-500', premium: false },
    { icon: Sparkles, label: 'Persona', sub: 'Intelligence Hub', action: onOpenPersonaHub, color: 'text-amber-500', premium: false },
    { icon: Palette, label: 'Appearance', sub: 'Visual Engine', action: onOpenAppearance, color: 'text-indigo-500', premium: false },
    { icon: Layers, label: 'Gallery', sub: 'Saved Assets', action: onOpenGallery, color: 'text-pink-500', premium: true },
    { icon: Grid, label: 'History', sub: 'Synaptic Records', action: onOpenHistory, color: 'text-zinc-400', premium: false },
    { icon: Volume2, label: 'Audio', sub: 'Voice Synthesis', action: onOpenAudio, color: 'text-orange-500', premium: true },
    { icon: ImageIcon, label: 'Artisan', sub: 'Creative Engine', action: onOpenArtisan, color: 'text-purple-500', premium: true },
    { icon: Search, label: 'Search', sub: 'Web Knowledge', action: onOpenSearch, color: 'text-cyan-500', premium: true },
    { icon: Shield, label: 'System', sub: 'Sovereign Controls', action: onOpenCommandCenter, color: 'text-yellow-500', premium: true },
    { icon: Zap, label: 'Extra Hub', sub: 'Neural Modules', action: onOpenHub, color: 'text-emerald-500', premium: false },
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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[150]"
          />
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 32, stiffness: 350 }}
            className={`fixed top-0 right-0 h-full w-full max-w-[310px] sm:max-w-[330px] bg-zinc-950 text-white shadow-[0_0_60px_rgba(0,0,0,0.6)] z-[160] flex flex-col border-l border-white/10 ${colorMode === 'RAINBOW' ? 'rainbow-mode' : ''}`}
          >
            {/* Minimal Header */}
            <div className="p-5 border-b border-white/10 flex flex-col gap-4 bg-zinc-900/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AnoraLogo size={24} showName={false} />
                  <span className="text-[11px] font-black tracking-[0.25em] uppercase text-zinc-300">Anora Control</span>
                </div>
                <button 
                  onClick={onClose} 
                  aria-label="Close Menu"
                  className="p-2 text-zinc-400 hover:text-white transition-all bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 active:scale-95"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Minimal User Bar */}
              <div 
                onClick={() => { onOpenProfile(); onClose(); }}
                className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center font-black text-sm overflow-hidden shrink-0 shadow-md">
                  {user.avatar ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" /> : user.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-bold text-white truncate tracking-tight">{user.name}</h3>
                    <VerificationTick 
                      role={user.role} 
                      tier={user.tier} 
                      isVerified={user.isVerified}
                      size={12} 
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] font-medium text-zinc-400 uppercase tracking-wider">{user.tier} NODE</span>
                    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Menu Grid - Minimalist */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-2">
              {!isPremium && (
                <button 
                  onClick={() => { onOpenHubWithTab('UPGRADE'); onClose(); }}
                  className="w-full mb-3 p-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg flex items-center justify-between group active:scale-95 transition-all"
                >
                  <div className="flex flex-col items-start">
                    <span className="text-[9px] font-black uppercase tracking-[0.15em]">Upgrade Tier</span>
                    <span className="text-[8px] opacity-80 uppercase tracking-wider">Unlock all neural models</span>
                  </div>
                  <Zap className="w-4 h-4 animate-pulse text-amber-300" />
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
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
                      className={`flex items-center gap-2.5 p-3 rounded-xl transition-all group text-left border border-white/5 active:scale-95 ${
                        isLocked 
                          ? 'opacity-40 bg-white/[0.02]' 
                          : 'bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/15'
                      }`}
                    >
                      <div className={`p-2 rounded-lg bg-black/40 border border-white/10 shrink-0 group-hover:scale-105 transition-transform ${item.color}`}>
                        {isLocked ? <Lock className="w-3.5 h-3.5 text-zinc-500" /> : <item.icon className="w-3.5 h-3.5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold text-zinc-200 group-hover:text-white truncate tracking-wide flex items-center gap-1">
                          {item.label}
                          {isLocked && <Shield className="w-2 h-2 text-zinc-500" />}
                        </p>
                        <p className="text-[7.5px] text-zinc-500 truncate tracking-tight">{item.sub}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Minimal Footer */}
            <div className="p-4 border-t border-white/10 bg-zinc-900/50 space-y-3">
              <button 
                onClick={() => { onLogout(); onClose(); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 font-bold uppercase text-[9px] tracking-[0.2em] transition-all active:scale-95 group"
              >
                <LogOut className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                Terminate Link
              </button>
              
              <div className="flex flex-col items-center gap-0.5 text-center">
                <p className="text-[7.5px] font-medium text-zinc-500 uppercase tracking-[0.2em]">
                  Anora v{ANORA_VERSION} // Sovereign AI
                </p>
                <p className="text-[6.5px] text-zinc-600 uppercase tracking-widest">
                  Neural Ledger ID-AN0R4-13052007
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
