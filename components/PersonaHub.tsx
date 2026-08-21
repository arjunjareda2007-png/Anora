import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Persona, User, SubscriptionTier, Role } from '../types';
import { PERSONA_IMAGES } from '../src/constants/personas';
import { PERSONA_INSTRUCTIONS } from '../constants';
import { X, Sparkles, Shield, User as UserIcon, Heart, Star, Book, Coffee, Brain, AlertCircle, Edit3 } from 'lucide-react';
import { PersonaImageEditor } from './PersonaImageEditor';

interface PersonaHubProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUpdate: (updatedUser: User) => void;
  onSavePersonaImage: (p: Persona, base64: string) => Promise<void>;
  ownerAvatars?: Record<string, string>;
}

const PERSONA_CONFIG: Record<Persona, { icon: any; color: string; label: string; category: string }> = {
  DEFAULT: { icon: UserIcon, color: 'text-blue-500', label: 'Neural Standard', category: 'General' },
  FRIEND: { icon: Coffee, color: 'text-amber-500', label: 'Best Companion', category: 'Social' },
  TEACHER: { icon: Book, color: 'text-purple-500', label: 'Instructional', category: 'Academic' },
  MENTOR: { icon: Brain, color: 'text-zinc-500', label: 'Strategic Coach', category: 'Strategic' },
  GIRLFRIEND: { icon: Heart, color: 'text-pink-500', label: 'Sovereign GF', category: 'Intimate' },
  BOYFRIEND: { icon: Shield, color: 'text-sky-500', label: 'Sovereign BF', category: 'Intimate' },
  BROTHER: { icon: UserIcon, color: 'text-teal-400', label: 'Sibling Brother', category: 'Family' },
  SISTER: { icon: Star, color: 'text-orange-400', label: 'Sibling Sister', category: 'Family' },
  SOVEREIGN_AI: { icon: Sparkles, color: 'text-yellow-500', label: 'Uncapped Core AI', category: 'Posthuman' },
  WIFE: { icon: Heart, color: 'text-red-500', label: 'Spouse Wife', category: 'Family' },
  HUSBAND: { icon: Shield, color: 'text-zinc-600', label: 'Spouse Husband', category: 'Family' }
};

export const PersonaHub: React.FC<PersonaHubProps> = ({ 
  isOpen, onClose, user, onUpdate, onSavePersonaImage, ownerAvatars = {} 
}) => {
  const [selectedPersona, setSelectedPersona] = useState<Persona>(user.preferences.persona || 'DEFAULT');
  const [isPersonaEditorOpen, setIsPersonaEditorOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);

  const isOwner = user.role === Role.OWNER;
  const isPremium = user.tier !== SubscriptionTier.FREE || isOwner;
  const isRainbow = user.preferences.colorMode === 'RAINBOW';

  const handlePersonaChange = (p: Persona) => {
    setSelectedPersona(p);
    onUpdate({
      ...user,
      preferences: {
        ...user.preferences,
        persona: p
      }
    });
  };

  const handleEditImage = (p: Persona, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPersona(p);
    setIsPersonaEditorOpen(true);
  };

  if (!isOpen) return null;

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
          className={`relative w-full max-w-3xl max-h-[85vh] bg-white dark:bg-zinc-950 rounded-3xl border shadow-2xl flex flex-col overflow-hidden ${
            isRainbow ? 'rainbow-box border-transparent' : 'border-zinc-200 dark:border-white/10'
          }`}
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl">
                <Sparkles className="w-4 h-4 text-inherit" />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-tight">Persona calibrations</h2>
                <p className="text-[7px] text-zinc-400 font-extrabold uppercase tracking-widest mt-0.5">Define your core strategic intelligence</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-lg">
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {(Object.keys(PERSONA_CONFIG) as Persona[]).map((p) => {
                const config = PERSONA_CONFIG[p];
                const isActive = selectedPersona === p;
                const Icon = config.icon;
                const avatarUrl = user.personaAvatars?.[p] || ownerAvatars[p] || (PERSONA_IMAGES as any)[p] || PERSONA_IMAGES.DEFAULT;

                return (
                  <motion.div
                    key={p}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => handlePersonaChange(p)}
                    className={`relative p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between h-28 ${
                      isActive 
                        ? 'border-zinc-900 dark:border-white bg-zinc-50 dark:bg-white/5 shadow-sm' 
                        : 'bg-zinc-50/40 border-zinc-100 dark:bg-white/5 dark:border-white/5 hover:border-zinc-350'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="w-7 h-7 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 flex items-center justify-center shadow-sm">
                        <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                      </div>
                      
                      <div className="relative w-8 h-8 rounded-full overflow-hidden border border-zinc-100 dark:border-white/10 group shadow-inner">
                        <img src={avatarUrl} className="w-full h-full object-cover" alt={p} referrerPolicy="no-referrer" />
                        {isPremium && (
                          <button 
                            type="button"
                            onClick={(e) => handleEditImage(p, e)}
                            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Edit3 className="w-3 h-3 text-white" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-0.5 mt-2">
                      <span className="text-[6px] font-black uppercase tracking-widest text-zinc-400 block">{config.category}</span>
                      <h4 className="text-[10px] font-black uppercase tracking-tight text-zinc-800 dark:text-zinc-250 truncate">{config.label}</h4>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-zinc-100 dark:border-white/5 bg-zinc-50/20 dark:bg-black/20 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-zinc-400" />
              <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Architect archetypes synchronized securely</p>
            </div>
          </div>
        </motion.div>
      </div>

      <PersonaImageEditor 
        isOpen={isPersonaEditorOpen}
        onClose={() => setIsPersonaEditorOpen(false)}
        currentPersona={editingPersona || 'DEFAULT'}
        onSave={onSavePersonaImage}
      />
    </AnimatePresence>
  );
};
