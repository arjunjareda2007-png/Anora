
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Persona, AppTheme } from '../types';
import { AnoraLogo } from './AnoraLogo';
import { Sparkles, Zap, Shield, Eye, Palette, ChevronRight, Check } from 'lucide-react';

interface OnboardingModalProps {
  user: User;
  onComplete: (updatedUser: User) => void;
}

const STEPS = [
  {
    title: "Welcome to Anora",
    description: "Your Sovereign Neural Intelligence is ready to initialize. Let's calibrate your link for optimal performance.",
    icon: <AnoraLogo size={80} animate={true} showName={false} />
  },
  {
    title: "Neural Capabilities",
    description: "Anora is more than a chat. It's a multi-modal core capable of vision analysis, image synthesis, and deep reasoning.",
    features: [
      { icon: <Zap className="w-4 h-4 text-amber-500" />, label: "Neural Link", desc: "Real-time streaming intelligence" },
      { icon: <Palette className="w-4 h-4 text-purple-500" />, label: "Artisan", desc: "High-fidelity image synthesis" },
      { icon: <Eye className="w-4 h-4 text-emerald-500" />, label: "Vision", desc: "Advanced visual perception" }
    ]
  },
  {
    title: "Calibrate Persona",
    description: "How should Anora interact with you? Choose a behavioral archetype that fits your workflow.",
    type: "PERSONA"
  },
  {
    title: "Visual Core",
    description: "Select a visual interface that resonates with your aesthetic preferences.",
    type: "THEME"
  }
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ user, onComplete }) => {
  const [step, setStep] = useState(0);
  const [persona, setPersona] = useState<Persona>(user.preferences.persona || 'DEFAULT');
  const [theme, setTheme] = useState<AppTheme>(user.preferences.theme || 'OBSIDIAN');
  const [colorMode, setColorMode] = useState<'WHITE' | 'DARK'>(user.preferences.colorMode || 'WHITE');

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      const updatedUser: User = {
        ...user,
        preferences: {
          ...user.preferences,
          persona,
          theme,
          colorMode,
          onboardingComplete: true
        }
      };
      onComplete(updatedUser);
    }
  };

  const currentStep = STEPS[step];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-8 bg-black/40 backdrop-blur-2xl font-outfit">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-[3rem] border border-zinc-100 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-zinc-100 dark:bg-white/5">
          <motion.div 
            className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"
            initial={{ width: "0%" }}
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-8 sm:p-12 space-y-8 no-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-4">
                <div className="flex justify-center mb-6">
                  {currentStep.icon || (
                    <div className="w-20 h-20 rounded-3xl bg-zinc-50 dark:bg-white/5 flex items-center justify-center border border-zinc-100 dark:border-white/10 shadow-inner">
                      {step === 1 ? <Shield className="w-10 h-10 text-blue-500" /> : <Sparkles className="w-10 h-10 text-amber-500" />}
                    </div>
                  )}
                </div>
                <h2 className="text-3xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">{currentStep.title}</h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed max-w-md mx-auto">{currentStep.description}</p>
              </div>

              {currentStep.features && (
                <div className="grid grid-cols-1 gap-4">
                  {currentStep.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-4 p-5 bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-2xl">
                      <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center shadow-sm">
                        {f.icon}
                      </div>
                      <div>
                        <h4 className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-widest">{f.label}</h4>
                        <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {currentStep.type === "PERSONA" && (
                <div className="grid grid-cols-2 gap-3">
                  {['DEFAULT', 'FRIEND', 'MENTOR', 'SOVEREIGN_AI'].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPersona(p as Persona)}
                      className={`p-4 rounded-2xl border text-left transition-all ${persona === p ? 'bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white text-white dark:text-black shadow-lg scale-[1.02]' : 'bg-zinc-50 dark:bg-white/5 border-zinc-100 dark:border-white/10 text-zinc-400 hover:border-zinc-200'}`}
                    >
                      <span className="text-[9px] font-black uppercase tracking-widest">{p.replace('_', ' ')}</span>
                    </button>
                  ))}
                </div>
              )}

              {currentStep.type === "THEME" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-3">
                    {['WHITE', 'DARK'].map((m) => (
                      <button
                        key={m}
                        onClick={() => setColorMode(m as any)}
                        className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${colorMode === m ? 'bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white text-white dark:text-black shadow-lg scale-[1.02]' : 'bg-zinc-50 dark:bg-white/5 border-zinc-100 dark:border-white/10 text-zinc-400 hover:border-zinc-200'}`}
                      >
                        <span className="text-[9px] font-black uppercase tracking-widest">{m} MODE</span>
                        {colorMode === m && <Check className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {['OBSIDIAN', 'MINIMAL'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setTheme(t as AppTheme)}
                        className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${theme === t ? 'bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white text-white dark:text-black shadow-lg scale-[1.02]' : 'bg-zinc-50 dark:bg-white/5 border-zinc-100 dark:border-white/10 text-zinc-400 hover:border-zinc-200'}`}
                      >
                        <span className="text-[9px] font-black uppercase tracking-widest">{t}</span>
                        {theme === t && <Check className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="p-8 border-t border-zinc-50 dark:border-white/5 flex justify-between items-center bg-zinc-50/50 dark:bg-black/20">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1 rounded-full transition-all duration-500 ${i === step ? 'w-6 bg-zinc-900 dark:bg-white' : 'w-2 bg-zinc-200 dark:bg-white/10'}`} />
            ))}
          </div>
          <button 
            onClick={handleNext}
            className="px-8 py-4 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-xl"
          >
            {step === STEPS.length - 1 ? "Initialize Link" : "Next Protocol"}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
