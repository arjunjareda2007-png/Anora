
import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { SubscriptionTier, Role } from '../types';

interface VerificationTickProps {
  tier?: SubscriptionTier;
  role?: Role;
  isVerified?: boolean;
  className?: string;
  size?: number;
}

export const VerificationTick: React.FC<VerificationTickProps> = ({ tier, role, isVerified, className = "w-4 h-4", size = 16 }) => {
  const isOwner = role === Role.OWNER || tier === SubscriptionTier.OWNER;
  
  if (isOwner) {
    return (
      <CheckCircle2 
        size={size}
        className={`${className} text-amber-500 fill-amber-500/20`} 
        strokeWidth={2.5}
      />
    );
  }

  if (tier === SubscriptionTier.DIAMOND) {
    return (
      <CheckCircle2 
        size={size}
        className={`${className} text-cyan-400 fill-cyan-400/20`} 
        strokeWidth={2.5}
      />
    );
  }

  if (tier === SubscriptionTier.PLATINUM) {
    return (
      <CheckCircle2 
        size={size}
        className={`${className} text-zinc-400 fill-zinc-400/20`} 
        strokeWidth={2.5}
      />
    );
  }

  if (tier === SubscriptionTier.PRO) {
    return (
      <CheckCircle2 
        size={size}
        className={`${className} text-indigo-500 fill-indigo-500/20`} 
        strokeWidth={2.5}
      />
    );
  }

  if (tier === SubscriptionTier.LIFETIME) {
    return (
      <CheckCircle2 
        size={size}
        className={`${className} text-emerald-500 fill-emerald-500/20`} 
        strokeWidth={2.5}
      />
    );
  }

  if (isVerified) {
    return (
      <CheckCircle2 
        size={size}
        className={`${className} text-indigo-500 fill-indigo-500/20`} 
        strokeWidth={2.5}
      />
    );
  }

  return null;
};
