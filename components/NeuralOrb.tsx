
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
    <div className="fixed bottom-24 right-8 flex items-center justify-center pointer-events-none z-[110]">
      <div className="relative w-24 h-24 flex items-center justify-center">
        
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
          className="absolute w-16 h-16 rounded-full blur-2xl"
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
          className="absolute w-8 h-8 rounded-full border border-white/20 shadow-inner"
          style={{ 
            backgroundColor: orbColor,
            boxShadow: `0 0 30px ${orbColor}80`
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
            </>
          )}
        </AnimatePresence>

        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap text-center">
          <motion.span 
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
            className={`text-[7px] font-black uppercase tracking-[0.4em] transition-colors duration-700 ${listening && !active && !speaking ? 'text-blue-500' : 'text-zinc-500 dark:text-zinc-400'}`}
          >
            {active ? `${affect}` : speaking ? 'VOCAL' : ''}
          </motion.span>
        </div>
      </div>
    </div>
  );
};
