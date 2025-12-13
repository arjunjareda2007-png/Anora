
import React, { useEffect, useRef } from 'react';
import { Message, Role } from '../types';

interface MessageListProps {
  messages: Message[];
  isThinking: boolean;
  ownerName: string;
  isOwnerView: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, isThinking, ownerName, isOwnerView }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  return (
    <div className="flex-1 overflow-y-auto px-8 py-16 space-y-16 max-w-5xl mx-auto w-full scroll-smooth no-scrollbar relative z-10">
      {messages.map((msg, index) => {
        const isUser = msg.role === 'user';
        return (
          <div
            key={msg.id}
            className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-1000 fill-mode-both`}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className={`max-w-[95%] md:max-w-[85%] group relative`}>
              {/* Metadata Header */}
              <div className={`flex items-center gap-4 mb-3.5 px-4 transition-all duration-500 opacity-40 group-hover:opacity-100 ${isUser ? 'flex-row-reverse' : ''}`}>
                <span className={`text-[10px] font-bold uppercase tracking-[0.4em] ${isUser ? (isOwnerView ? 'text-amber-500' : 'text-zinc-400') : 'text-zinc-500'}`}>
                  {isUser ? (isOwnerView ? 'Sovereign' : ownerName.split(' ')[0]) : 'Anora OS'}
                </span>
                <div className="w-1 h-1 rounded-full bg-zinc-800"></div>
                <span className="text-[9px] text-zinc-700 font-bold uppercase tracking-widest">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              
              {/* Vision Content */}
              {msg.images && msg.images.length > 0 && (
                <div className={`flex flex-wrap gap-4 mb-5 animate-in zoom-in-95 duration-700 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {msg.images.map((img, i) => (
                    <div key={i} className="relative group/img overflow-hidden rounded-[3rem] border border-zinc-800/50 shadow-2xl transition-all hover:border-zinc-600">
                      <img src={img} alt="V" className="w-64 h-64 object-cover transition-transform duration-[2s] group-hover/img:scale-110" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                         <span className="text-[9px] text-white font-bold uppercase tracking-[0.5em] bg-white/10 px-6 py-3 rounded-full border border-white/20">NEURAL ASSET</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Message Bubble */}
              <div
                className={`rounded-[3.5rem] px-12 py-10 text-[16px] leading-[1.8] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] transition-all duration-700 relative ring-1 ring-white/5
                  ${isUser 
                    ? `${isOwnerView ? 'bg-zinc-900 border-amber-500/10 text-white' : 'bg-zinc-800/80 text-zinc-100 border-zinc-700/50'} rounded-tr-none` 
                    : 'bg-zinc-900/30 text-zinc-200 border border-zinc-800/50 rounded-tl-none backdrop-blur-3xl'}`}
              >
                {isUser && isOwnerView && <div className="absolute -top-2 -right-2 w-5 h-5 bg-amber-500 rounded-full border-[3px] border-zinc-950 shadow-[0_0_15px_rgba(245,158,11,0.4)]"></div>}

                <div className="prose prose-invert max-w-none whitespace-pre-wrap font-medium tracking-tight">
                  {msg.content}
                </div>

                {/* Grounding Data */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-12 pt-10 border-t border-zinc-800/50 animate-in fade-in duration-1000">
                    <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.5em] mb-6 flex items-center gap-3">
                       <span className="w-6 h-px bg-zinc-800"></span> 
                       NEURAL GROUNDING SOURCE 
                       <span className="w-6 h-px bg-zinc-800"></span>
                    </p>
                    <div className="flex flex-wrap gap-4">
                      {msg.sources.map((source, idx) => (
                        <a
                          key={idx}
                          href={source.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-4 px-6 py-4 bg-black/50 border border-zinc-800/50 rounded-[2rem] text-[10px] text-zinc-400 hover:text-white hover:border-zinc-500 hover:bg-zinc-900 transition-all shadow-xl group/source"
                        >
                          <svg className="w-4 h-4 group-hover/source:rotate-12 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          <span className="max-w-[200px] truncate font-bold tracking-wider">{source.title || 'Verified Intel'}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
      
      {isThinking && (
        <div className="flex justify-start animate-in fade-in slide-in-from-left-6 duration-1000">
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-[2.5rem] rounded-tl-none px-10 py-7 shadow-2xl backdrop-blur-3xl ring-1 ring-white/5">
            <div className="flex gap-3">
              <div className="w-2.5 h-2.5 bg-zinc-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2.5 h-2.5 bg-zinc-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2.5 h-2.5 bg-zinc-600 rounded-full animate-bounce"></div>
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} className="h-24" />
    </div>
  );
};
