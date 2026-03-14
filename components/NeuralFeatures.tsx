
import React, { useState, useEffect, useRef } from 'react';
import { User, Role, SubscriptionTier, ImageAspectRatio, GroundingSource } from '../types';
import { AssistantFeatures } from './AssistantFeatures';
import { NeuralArtisan } from './NeuralArtisan';
import { NeuralSearch } from './NeuralSearch';
import { NeuralAudio } from './NeuralAudio';
import { NeuralGallery } from './NeuralGallery';
import { CommandCenter } from './CommandCenter';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NeuralFeaturesProps {
  user: User;
  onUpdate: (user: User) => void;
  onClearHistory: () => void;
  messagesCount: number;
  isOpen: boolean;
  onClose: () => void;
  initialFeature?: string;
  onDeductToken: (type: any, amount: number) => boolean;
}

export const NeuralFeatures: React.FC<NeuralFeaturesProps> = ({
  user, onUpdate, onClearHistory, messagesCount, isOpen, onClose, initialFeature, onDeductToken
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (isOpen && initialFeature) {
      setTimeout(() => {
        sectionsRef.current[initialFeature]?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [isOpen, initialFeature]);

  if (!isOpen) return null;

  const FeatureSection = ({ id, title, children }: { id: string, title: string, children: React.ReactNode }) => (
    <div 
      ref={el => { sectionsRef.current[id] = el; }}
      className="min-h-[80vh] py-12 border-b border-zinc-100 dark:border-white/5 last:border-0"
    >
      <div className="px-8 mb-8">
        <h2 className="text-2xl font-black font-outfit text-zinc-900 dark:text-white uppercase tracking-tighter">{title}</h2>
        <div className="h-1 w-12 bg-zinc-900 dark:bg-white mt-2 rounded-full"></div>
      </div>
      {children}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/10 dark:bg-black/40 backdrop-blur-3xl animate-in fade-in duration-500">
      <div className="w-full max-w-6xl h-full sm:h-[90vh] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-none sm:rounded-[4rem] shadow-2xl flex flex-col overflow-hidden">
        
        <div className="shrink-0 p-8 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-zinc-900 dark:bg-white rounded-2xl shadow-lg">
                <svg className="w-5 h-5 text-white dark:text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
             </div>
             <div>
                <h2 className="text-xl font-black font-outfit text-zinc-900 dark:text-white tracking-tight">Neural Features</h2>
                <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-black uppercase tracking-[0.4em] mt-1">Integrated Protocol Suite</p>
             </div>
          </div>
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-2 bg-zinc-50 dark:bg-white/5 p-1.5 rounded-2xl border border-zinc-100 dark:border-white/10">
              {['HUB', 'IMAGES', 'SEARCH', 'AUDIO', 'GALLERY', 'SYSTEM'].map(f => (
                <button 
                  key={f}
                  onClick={() => {
                    const el = sectionsRef.current[f];
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className="px-4 py-2 text-[8px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  {f}
                </button>
              ))}
            </nav>
            <button onClick={onClose} className="p-4 text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-all bg-zinc-50 dark:bg-white/5 rounded-3xl border border-zinc-100 dark:border-white/10">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
          <FeatureSection id="HUB" title="Neural Hub">
            <AssistantFeatures 
              user={user} 
              onUpdate={onUpdate} 
              onClearHistory={onClearHistory} 
              messagesCount={messagesCount} 
              isOpen={true} 
              onClose={() => {}} 
              isSection={true}
            />
          </FeatureSection>

          <FeatureSection id="IMAGES" title="Neural Artisan">
            <NeuralArtisan user={user} isOpen={true} onClose={() => {}} isSection={true} />
          </FeatureSection>

          <FeatureSection id="SEARCH" title="Neural Search">
            <NeuralSearch user={user} isOpen={true} onClose={() => {}} isSection={true} />
          </FeatureSection>

          <FeatureSection id="AUDIO" title="Neural Audio">
            <NeuralAudio user={user} isOpen={true} onClose={() => {}} isSection={true} />
          </FeatureSection>

          <FeatureSection id="GALLERY" title="Neural Gallery">
            <NeuralGallery user={user} isOpen={true} onClose={() => {}} isSection={true} />
          </FeatureSection>

          <FeatureSection id="SYSTEM" title="Command Center">
            <CommandCenter user={user} isOpen={true} onClose={() => {}} onDeductToken={onDeductToken} isSection={true} />
          </FeatureSection>
        </div>

        <div className="shrink-0 p-6 border-t border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-white/5 flex justify-center">
           <p className="text-[8px] font-black text-zinc-300 dark:text-zinc-600 uppercase tracking-[0.4em]">Integrated Neural Suite v1.0 // Sovereign Core</p>
        </div>
      </div>
    </div>
  );
};
