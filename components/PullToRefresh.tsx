
import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, useAnimation } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import { Persona } from '../types';
import { PERSONA_IMAGES } from '../src/constants/personas';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
  persona?: Persona;
  personaAvatars?: Record<string, string>;
  onViewImage?: (url: string) => void;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children, className = "", persona, personaAvatars, onViewImage }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const controls = useAnimation();
  
  // Transform pull distance to rotation and opacity for the icon
  const rotate = useTransform(y, [0, 100], [0, 360]);
  const opacity = useTransform(y, [0, 50, 100], [0, 0.5, 1]);
  const scale = useTransform(y, [0, 100], [0.5, 1.2]);

  const PULL_THRESHOLD = 80;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isRefreshing) return;
    // Only allow pull to refresh if we are at the top of the container
    const container = containerRef.current;
    if (container && container.scrollTop > 0) return;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isRefreshing) return;
    const container = containerRef.current;
    if (container && container.scrollTop > 0) return;

    // This is a bit simplified, ideally we'd track the start Y
    // But for now let's use the touch movements
  };

  // Using a more robust approach with native events for better control
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let startY = 0;
    let currentY = 0;
    let pulling = false;

    const onTouchStart = (e: TouchEvent) => {
      // Find the scrollable child (MessageList)
      const scrollableChild = container.querySelector('.overflow-y-auto');
      if (scrollableChild && scrollableChild.scrollTop <= 0) {
        startY = e.touches[0].pageY;
        pulling = true;
      } else if (!scrollableChild && container.scrollTop <= 0) {
        startY = e.touches[0].pageY;
        pulling = true;
      } else {
        pulling = false;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling || isRefreshing) return;
      
      const scrollableChild = container.querySelector('.overflow-y-auto');
      if (scrollableChild && scrollableChild.scrollTop > 0) {
        pulling = false;
        y.set(0);
        setPullDistance(0);
        return;
      }
      
      currentY = e.touches[0].pageY;
      const diff = currentY - startY;

      if (diff > 0) {
        // High-fidelity natural damping formula (asymptotic limit of 150px)
        const pull = (diff * 150) / (diff + 150);
        y.set(pull);
        setPullDistance(pull);
        
        // Prevent default scrolling when pulling down at the top
        if (e.cancelable) e.preventDefault();
      } else {
        pulling = false;
        y.set(0);
        setPullDistance(0);
      }
    };

    const onTouchEnd = async () => {
      if (!pulling || isRefreshing) return;
      
      if (y.get() >= PULL_THRESHOLD) {
        setIsRefreshing(true);
        // Animate to refreshing position with smooth professional spring
        await controls.start({ 
          y: 60,
          transition: { type: "spring", stiffness: 280, damping: 26 }
        });
        
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          // Animate back smoothly
          await controls.start({ 
            y: 0,
            transition: { type: "spring", stiffness: 300, damping: 28 }
          });
          y.set(0);
          setPullDistance(0);
        }
      } else {
        // Animate back smoothly
        await controls.start({ 
          y: 0,
          transition: { type: "spring", stiffness: 320, damping: 24 }
        });
        y.set(0);
        setPullDistance(0);
      }
      pulling = false;
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
    };
  }, [isRefreshing, onRefresh, y, controls]);

  return (
    <div ref={containerRef} className={`relative h-full w-full overflow-hidden ${className}`}>
      {/* Pull Indicator */}
      <motion.div 
        style={{ 
          y: isRefreshing ? 60 : y,
          opacity: isRefreshing ? 1 : opacity,
          scale: isRefreshing ? 1 : scale,
          rotate: isRefreshing ? 0 : rotate
        }}
        className="absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in zoom-in duration-200"
      >
        <div className="bg-white dark:bg-zinc-800 p-2 rounded-full shadow-xl border border-zinc-100 dark:border-white/10 flex items-center justify-center gap-2">
          {persona && (
            <div 
              className="w-6 h-6 rounded-full overflow-hidden border border-indigo-500/30 cursor-zoom-in active:scale-90 transition-transform"
              onClick={(e) => {
                e.stopPropagation();
                const url = personaAvatars?.[persona] || (PERSONA_IMAGES as any)[persona] || PERSONA_IMAGES.DEFAULT;
                onViewImage?.(url);
              }}
            >
              <img 
                src={personaAvatars?.[persona] || (PERSONA_IMAGES as any)[persona] || PERSONA_IMAGES.DEFAULT} 
                alt={persona} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
          <RefreshCw 
            className={`w-5 h-5 text-indigo-500 ${isRefreshing ? 'animate-spin' : ''}`} 
          />
        </div>
      </motion.div>

      {/* Content */}
      <motion.div 
        animate={controls}
        style={{ y: isRefreshing ? 50 : y }}
        className="h-full w-full flex flex-col"
      >
        {children}
      </motion.div>
    </div>
  );
};
