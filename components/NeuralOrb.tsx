
import React from 'react';
import { NeuralAffect } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface NeuralOrbProps {
  active: boolean;
  speaking: boolean;
  listening: boolean;
  color: string;
  intent?: 'ENGINEERING' | 'CREATIVE' | 'GENERAL' | 'SOVEREIGN';
  affect?: NeuralAffect;
}

export const NeuralOrb: React.FC<NeuralOrbProps> = ({ 
  active, 
  speaking, 
  listening, 
  color, 
  intent = 'GENERAL',
  affect = 'SOVEREIGN'
}) => {
  const getAffectiveStyles = () => {
    if (listening && !active && !speaking) return { color: '#3b82f6', speed: 2 }; // Deep Blue for Listening
    
    const affectMap: Record<NeuralAffect, { color: string, speed: number }> = {
      SOVEREIGN: { color: color, speed: 3 },
      RADIANT: { color: '#fbbf24', speed: 1.5 },
      MELANCHOLY: { color: '#60a5fa', speed: 6 },
      CRIMSON: { color: '#ef4444', speed: 0.8 },
      VALIANT: { color: '#10b981', speed: 4 },
      EXCITED: { color: '#ec4899', speed: 1 },
    };

    const style = affectMap[affect] || affectMap.SOVEREIGN;

    if (active) {
       switch (intent) {
         case 'ENGINEERING': return { color: '#3b82f6', speed: 2 };
         case 'CREATIVE': return { color: '#a855f7', speed: 2 };
         default: return style;
       }
    }
    return style;
  };

  const { color: orbColor, speed } = getAffectiveStyles();

  return (
    <div className="fixed bottom-36 left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none z-[110]">
      <div className="relative w-32 h-32 flex items-center justify-center">
        
        {/* Core Glow */}
        <motion.div 
          animate={{
            scale: active || speaking || listening ? [1, 1.2, 1] : 0.8,
            opacity: active || speaking || listening ? [0.4, 0.8, 0.4] : 0.2,
          }}
          transition={{
            duration: speed,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute w-20 h-20 rounded-full blur-2xl"
          style={{ backgroundColor: orbColor }}
        />

        {/* Inner Core */}
        <motion.div 
          animate={{
            scale: active || speaking || listening ? [1, 1.1, 1] : 0.9,
          }}
          transition={{
            duration: speed * 0.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute w-12 h-12 rounded-full border border-white/20 shadow-inner"
          style={{ 
            backgroundColor: orbColor,
            boxShadow: `0 0 40px ${orbColor}80`
          }}
        />

        {/* Orbiting Rings */}
        <AnimatePresence>
          {(active || listening || speaking) && (
            <>
              <motion.div 
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 0.3, scale: 1.5, rotate: 360 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: speed * 2, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border border-dashed rounded-full"
                style={{ borderColor: orbColor }}
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 0.2, scale: 1.8, rotate: -360 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: speed * 3, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border border-dotted rounded-full"
                style={{ borderColor: orbColor }}
              />
            </>
          )}
        </AnimatePresence>

        <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 whitespace-nowrap text-center">
          <motion.span 
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
            className={`text-[9px] font-black uppercase tracking-[0.6em] transition-colors duration-700 ${listening && !active && !speaking ? 'text-blue-500' : 'text-zinc-500 dark:text-zinc-400'}`}
          >
            {active ? `${affect} SYNTHESIS` : speaking ? 'VOCALIZING' : ''}
          </motion.span>
          {active && (
            <div className="mt-3 h-0.5 bg-zinc-100 dark:bg-white/10 w-32 mx-auto rounded-full overflow-hidden">
              <motion.div 
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className="h-full w-1/2 bg-zinc-900 dark:bg-white"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
