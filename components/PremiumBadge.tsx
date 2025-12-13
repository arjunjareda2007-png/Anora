
import React from 'react';
import { Role, SubscriptionTier } from '../types';

interface PremiumBadgeProps {
  role: Role;
  tier: SubscriptionTier;
}

export const PremiumBadge: React.FC<PremiumBadgeProps> = ({ role, tier }) => {
  if (role === Role.OWNER) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded text-[9px] font-bold text-amber-500 uppercase tracking-tighter">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        Owner
      </div>
    );
  }

  if (tier !== SubscriptionTier.FREE) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/30 rounded text-[9px] font-bold text-indigo-400 uppercase tracking-tighter">
        Premium
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">
      Free
    </div>
  );
};
