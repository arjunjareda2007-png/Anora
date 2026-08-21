import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export const AnoraLogo: React.FC<{ size?: number, color?: string, showName?: boolean, className?: string, animate?: boolean }> = ({ size = 48, color = '#fff', showName = true, className = "", animate = false }) => {
  const [isLongPressed, setIsLongPressed] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleStart = () => {
    timerRef.current = setTimeout(() => {
      setIsLongPressed(true);
    }, 800); // 800ms for long press
  };

  const handleEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    let autoCloseTimeout: NodeJS.Timeout;
    if (isLongPressed) {
      autoCloseTimeout = setTimeout(() => {
        setIsLongPressed(false);
      }, 6000); // Auto-close after 6 seconds (animation is ~1.5s + some display time)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (autoCloseTimeout) clearTimeout(autoCloseTimeout);
    };
  }, [isLongPressed]);

  return (
    <>
      <div 
        className={`flex items-center gap-3 group select-none cursor-pointer ${className}`}
        onMouseDown={handleStart}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchEnd={handleEnd}
      >
      <style>{`
        @keyframes rainbow-stroke {
          0% { stroke: #ff0000; }
          17% { stroke: #ff8800; }
          33% { stroke: #ffff00; }
          50% { stroke: #00ff00; }
          67% { stroke: #0000ff; }
          83% { stroke: #8800ff; }
          100% { stroke: #ff0000; }
        }
        @keyframes rainbow-fill {
          0% { fill: #ff0000; }
          17% { fill: #ff8800; }
          33% { fill: #ffff00; }
          50% { fill: #00ff00; }
          67% { fill: #0000ff; }
          83% { fill: #8800ff; }
          100% { fill: #ff0000; }
        }
        .animate-rainbow-stroke {
          animation: rainbow-stroke 8s linear infinite;
        }
        .animate-rainbow-fill {
          animation: rainbow-fill 8s linear infinite;
        }
        .logo-glow {
          filter: drop-shadow(0 0 8px currentColor);
        }
      `}</style>
      <div className="relative" style={{ width: size, height: size }}>
        <div className="absolute inset-0 bg-blue-500/5 blur-2xl group-hover:bg-blue-500/20 transition-all duration-1000 rounded-full"></div>
        <svg 
          viewBox="0 0 100 100" 
          className={`relative z-10 transition-all duration-700 group-hover:scale-110 ${animate ? 'animate-bounce' : ''}`}
          style={{ fill: 'none' }}
        >
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="blur"/>
              <feComposite in="SourceGraphic" in2="blur" operator="over"/>
            </filter>
          </defs>
          
          {/* Animated Background Ring */}
          <circle 
            cx="50" cy="50" r="46" 
            stroke={color} 
            strokeWidth="0.5" 
            strokeDasharray="4 6" 
            className="animate-[spin_20s_linear_infinite] animate-rainbow-stroke" 
            opacity="0.4" 
          />
          
          {/* Neural Connectivity Lines */}
          <path d="M50 15 L85 85 M50 15 L15 85 M15 85 L85 85" stroke={color} strokeWidth="0.3" className="animate-rainbow-stroke" opacity="0.2" />
          
          {/* Main Logo Geometry */}
          <path 
            d="M50 20 L80 80 H20 L50 20 Z" 
            stroke={color} 
            strokeWidth="4" 
            strokeLinejoin="round" 
            className="animate-rainbow-stroke logo-glow"
            filter="url(#glow)"
          />
          <path d="M38 62 H62" stroke={color} strokeWidth="4" strokeLinecap="round" className="animate-rainbow-stroke" opacity="1" />
          
          {/* Pulsing Core */}
          <circle cx="50" cy="45" r="6" fill={color} className="animate-pulse animate-rainbow-fill shadow-inner">
            <animate attributeName="opacity" values="0.5;1;0.5" dur="1.5s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>
      
      {showName && (
        <div className="flex flex-col">
          <span className={`text-xl font-black font-outfit tracking-[0.3em] leading-none transition-all duration-500
            text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600
            dark:text-white dark:bg-none dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]
          `}>
            ANORA
          </span>
          <span className="text-[9px] font-black text-zinc-400 dark:text-zinc-500 tracking-[0.2em] uppercase mt-1 ml-0.5">Sovereign AI</span>
          <div className="h-[1.5px] w-full bg-gradient-to-r from-transparent via-zinc-200 dark:via-white/20 to-transparent mt-2 group-hover:via-blue-500 transition-all duration-700"></div>
        </div>
      )}
      </div>
      
      <AnimatePresence>
        {isLongPressed && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black flex items-center justify-center overflow-hidden"
            onClick={() => setIsLongPressed(false)}
          >
            <motion.div
              initial={{ scale: 0.5, rotate: -180, opacity: 0 }}
              animate={{ 
                scale: [0.5, 1.2, 1],
                rotate: [ -180, 10, 0 ],
                opacity: 1
              }}
              transition={{ 
                duration: 1.5,
                ease: "easeOut",
                times: [0, 0.7, 1]
              }}
              className="relative"
            >
              {/* Background Glow */}
              <motion.div 
                animate={{ 
                  scale: [1, 1.5, 1],
                  opacity: [0.3, 0.6, 0.3]
                }}
                transition={{ duration: 4, repeat: Infinity }}
                className="absolute inset-0 bg-blue-500/30 blur-[100px] rounded-full"
              />
              
              <AnoraLogo size={300} showName={false} animate={true} className="relative z-10" />
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
                className="absolute -bottom-20 left-1/2 -translate-x-1/2 text-center"
              >
                <h2 className="text-4xl font-black font-outfit tracking-[0.5em] text-white mb-2">ANORA</h2>
                <p className="text-xs font-bold text-zinc-500 tracking-[0.3em] uppercase">Neural Core Synchronized</p>
              </motion.div>
            </motion.div>

            {/* Particle effects or extra flair */}
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ 
                    x: "50%", 
                    y: "50%", 
                    opacity: 1,
                    scale: 0
                  }}
                  animate={{ 
                    x: `${Math.random() * 100}%`,
                    y: `${Math.random() * 100}%`,
                    opacity: 0,
                    scale: Math.random() * 2
                  }}
                  transition={{ 
                    duration: 2 + Math.random() * 2,
                    repeat: Infinity,
                    delay: Math.random() * 2
                  }}
                  className="absolute w-1 h-1 bg-white rounded-full"
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
