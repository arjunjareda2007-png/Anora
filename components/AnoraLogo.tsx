
import React from 'react';

export const AnoraLogo: React.FC<{ size?: number, color?: string, showName?: boolean }> = ({ size = 48, color = '#fff', showName = true }) => {
  return (
    <div className="flex items-center gap-3 group select-none">
      <div className="relative" style={{ width: size, height: size }}>
        <div className="absolute inset-0 bg-white/5 blur-xl group-hover:bg-blue-500/20 transition-all duration-700 rounded-full"></div>
        <svg 
          viewBox="0 0 100 100" 
          className="relative z-10 drop-shadow-[0_0_10px_rgba(255,255,255,0.1)] transition-transform duration-500 group-hover:scale-105"
          style={{ fill: 'none' }}
        >
          <defs>
            <linearGradient id="anoraGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: color, stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#000', stopOpacity: 1 }} />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2.5" result="blur"/>
              <feComposite in="SourceGraphic" in2="blur" operator="over"/>
            </filter>
          </defs>
          
          {/* Animated Background Ring */}
          <circle cx="50" cy="50" r="46" stroke={color} strokeWidth="0.75" strokeDasharray="3 5" className="animate-[spin_30s_linear_infinite]" opacity="0.2" />
          
          {/* Neural Connectivity Lines */}
          <path d="M50 15 L85 85 M50 15 L15 85 M15 85 L85 85" stroke={color} strokeWidth="0.5" opacity="0.3" />
          
          {/* Main Logo Geometry */}
          <path 
            d="M50 20 L80 80 H20 L50 20 Z" 
            stroke={color} 
            strokeWidth="3.5" 
            strokeLinejoin="round" 
            filter="url(#glow)"
          />
          <path d="M38 62 H62" stroke={color} strokeWidth="3.5" strokeLinecap="round" opacity="0.9" />
          
          {/* Pulsing Core */}
          <circle cx="50" cy="45" r="5" fill={color} className="animate-pulse shadow-inner">
            <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>
      
      {showName && (
        <div className="flex flex-col">
          <span className="text-xl font-bold font-outfit tracking-[0.25em] text-white leading-none">ANORA</span>
          <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-zinc-800 to-transparent mt-1 group-hover:via-white/30 transition-all duration-500"></div>
        </div>
      )}
    </div>
  );
};
