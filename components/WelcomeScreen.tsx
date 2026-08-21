
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AnoraLogo } from './AnoraLogo';
import { User, Role } from '../types';

interface WelcomeScreenProps {
  user: User;
  onComplete: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ user, onComplete }) => {
  const [step, setStep] = useState(0);
  const isOwner = user.role === Role.OWNER;

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 800),
      setTimeout(() => setStep(2), 2000),
      setTimeout(() => setStep(3), 3500),
      setTimeout(() => onComplete(), 5000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[1000] bg-white dark:bg-zinc-950 flex flex-col items-center justify-center overflow-hidden">
      {/* Background Aura Removed */}

      <div className="relative z-10 flex flex-col items-center space-y-12">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
        >
          <AnoraLogo size={120} color={user.preferences.accentColor} showName={false} animate={true} />
        </motion.div>

        <div className="text-center space-y-4">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-2"
              >
                <h1 className="text-2xl sm:text-4xl font-black font-outfit tracking-tighter text-zinc-900 dark:text-white uppercase">
                  Neural Link Established
                </h1>
                <p className="text-[10px] sm:text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.5em]">
                  Synchronizing Synapses
                </p>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-2"
              >
                <h1 className="text-2xl sm:text-4xl font-black font-outfit tracking-tighter text-zinc-900 dark:text-white uppercase">
                  Welcome, {isOwner ? 'Sovereign' : user.name.split(' ')[0]}
                </h1>
                <p className="text-[10px] sm:text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.5em]">
                  {isOwner ? 'Your creation awaits your command' : 'Anora is ready for your sync'}
                </p>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-2"
              >
                <h1 className="text-2xl sm:text-4xl font-black font-outfit tracking-tighter text-zinc-900 dark:text-white uppercase">
                  Anora Sovereign AI
                </h1>
                <p className="text-[10px] sm:text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.5em]">
                  v13.05.2007 Core // Ready to Manifest
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Loading Bar */}
        <div className="w-48 h-1 bg-zinc-100 dark:bg-white/5 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 4.5, ease: "easeInOut" }}
            className="h-full"
            style={{ backgroundColor: user.preferences.accentColor }}
          />
        </div>
      </div>
    </div>
  );
};
