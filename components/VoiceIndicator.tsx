
import React from 'react';

interface VoiceIndicatorProps {
  active: boolean;
}

export const VoiceIndicator: React.FC<VoiceIndicatorProps> = ({ active }) => {
  if (!active) return null;

  return (
    <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full">
      <div className="flex gap-1 items-center">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="w-1 bg-blue-400 rounded-full animate-pulse"
            style={{
              height: `${Math.random() * 12 + 4}px`,
              animationDelay: `${i * 0.1}s`,
              animationDuration: '0.6s'
            }}
          />
        ))}
      </div>
      <span className="text-xs font-medium text-blue-400 font-outfit uppercase tracking-wider">Listening</span>
    </div>
  );
};
