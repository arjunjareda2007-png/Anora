
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Message, Role, SubscriptionTier, GroundingSource, Persona } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'motion/react';
import { VerificationTick } from './VerificationTick';
import { AnoraLogo } from './AnoraLogo';
import { 
  Play, 
  Download, 
  ExternalLink, 
  Copy, 
  Brain, 
  Edit3, 
  Trash2, 
  ChevronRight,
  Volume2,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { PremiumBadge } from './PremiumBadge';
import { PERSONA_IMAGES } from '../src/constants/personas';

interface MessageListProps {
  messages: Message[];
  isThinking: boolean;
  isStreaming?: boolean;
  ownerName: string;
  isOwnerView: boolean;
  userTier: SubscriptionTier;
  isVerified?: boolean;
  onVocalize?: (id: string, content: string, affect?: any) => void;
  onEditMessage?: (id: string, newContent: string) => void;
  onDeleteMessage?: (id: string) => void;
  onSaveToMemory?: (content: string) => void;
  onSaveToReminders?: (content: string) => void;
  onRegenerate?: (id: string) => void;
  speakingId?: string | null;
  currentMood?: string;
  persona?: Persona;
  personaAvatars?: Record<string, string>;
  onViewImage?: (url: string) => void;
}

const decode = (base64: string) => {
  try {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  } catch (e) {
    return new Uint8Array(0);
  }
};

const createWavUrl = (base64Pcm: string): string => {
  const pcmData = decode(base64Pcm);
  if (pcmData.length === 0) return "";
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);
  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcmData.length, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, pcmData.length, true);

  const blob = new Blob([wavHeader, pcmData], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
};

const VocalPlayer: React.FC<{ audioUrl: string, msgId: string }> = ({ audioUrl, msgId }) => {
  const wavUrl = useMemo(() => createWavUrl(audioUrl), [audioUrl]);
  
  useEffect(() => {
    return () => { if (wavUrl) URL.revokeObjectURL(wavUrl); };
  }, [wavUrl]);

  if (!wavUrl) return null;

  return (
    <div className="pt-2 animate-in slide-in-from-top-2 fade-in duration-700">
      <div className="flex items-center gap-3 p-3 bg-black/5 rounded-2xl border border-black/5">
        <audio src={wavUrl} controls className="h-8 flex-1" />
        <a 
          href={wavUrl} 
          download={`anora_vocal_${msgId}.wav`}
          className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors"
          title="Download Manifest"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </a>
      </div>
    </div>
  );
};

const GroundingSources: React.FC<{ sources: GroundingSource[] }> = ({ sources }) => {
  if (!sources || sources.length === 0) return null;
  const uniqueSources = sources.filter((v, i, a) => a.findIndex(t => (t.uri === v.uri)) === i);

  return (
    <div className="mt-4 pt-4 border-t border-black/5 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <p className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2">Neural Grounding Sources</p>
      <div className="flex flex-wrap gap-2">
        {uniqueSources.map((source, i) => (
          <a 
            key={i} 
            href={source.uri} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 bg-black/5 border border-black/5 rounded-full text-[9px] font-bold text-zinc-600 hover:bg-black/10 transition-all active:scale-95"
          >
            <svg className="w-3 h-3 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            <span className="max-w-[140px] truncate">{source.title || "Information Source"}</span>
          </a>
        ))}
      </div>
    </div>
  );
};

export const MessageList: React.FC<MessageListProps> = ({ 
  messages,  isThinking, isStreaming, ownerName, isOwnerView, userTier, isVerified, onVocalize, onEditMessage, onDeleteMessage, onSaveToMemory, onSaveToReminders, onRegenerate, speakingId, currentMood, persona, personaAvatars, onViewImage
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const longPressTimer = useRef<any>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking, scrollToBottom]);

  const handleStartEdit = (msg: Message) => {
    setEditingId(msg.id);
    setEditValue(msg.content);
    setContextMenuId(null);
  };

  const handleSaveEdit = () => {
    if (editingId && onEditMessage) onEditMessage(editingId, editValue);
    setEditingId(null);
  };

  const handleTouchStart = (msgId: string) => {
    longPressTimer.current = setTimeout(() => {
      setContextMenuId(msgId);
      if (window.navigator.vibrate) window.navigator.vibrate(50);
    }, 600);
  };

  const handleTouchEnd = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };

  const isPremium = userTier === SubscriptionTier.PRO || userTier === SubscriptionTier.LIFETIME || isOwnerView;

  const uniqueMessages = useMemo(() => {
    return messages.filter((msg, idx, self) => self.findIndex(t => t.id === msg.id) === idx);
  }, [messages]);

  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-3 sm:px-6 pt-4 pb-20 space-y-3.5 max-w-5xl mx-auto w-full scroll-smooth no-scrollbar relative z-10 touch-pan-y">
      {uniqueMessages.map((msg, index) => {
        const isUser = msg.role === 'user';
        const isAnora = msg.role === 'anora';
        const isLastMessage = index === uniqueMessages.length - 1;
        const isSpeaking = speakingId === msg.id;
        const isEditing = editingId === msg.id;
        const isMenuOpen = contextMenuId === msg.id;
        
        // Literal interpretation: "If anora is responding (streaming) then just show three dots"
        // We'll hide the content of Anora's last message if we're currently streaming it.
        const shouldShowDotsInstead = isAnora && isLastMessage && isStreaming;
        
        let bubbleClass = isUser 
          ? (isOwnerView ? "bg-zinc-950 dark:bg-zinc-100/10 text-white border border-amber-500/10 rounded-xl rounded-tr-none" : isPremium ? "bg-zinc-900 dark:bg-white/10 text-white dark:text-zinc-100 rounded-xl rounded-tr-none" : "bg-zinc-800 text-white rounded-xl rounded-tr-none")
          : (isOwnerView 
              ? "bg-zinc-100/50 dark:bg-zinc-900/40 text-zinc-900 dark:text-zinc-100 border border-zinc-200/10 dark:border-white/5 rounded-xl rounded-tl-none" 
              : "bg-zinc-50/70 dark:bg-zinc-900/20 text-zinc-900 dark:text-zinc-100 border border-zinc-100/40 dark:border-white/5 rounded-xl rounded-tl-none");

        // Enhanced fade-in for Anora's responses: speed it up significantly for a snappier feel
        const animationClass = isAnora 
          ? "animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out-expo" 
          : "animate-in fade-in slide-in-from-bottom-1 duration-200";

        return (
          <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} ${animationClass} relative`} style={{ animationDelay: `${isAnora ? 20 : index * 10}ms` }}>
            <div className={`max-w-[92%] sm:max-w-[85%] group relative ${isMenuOpen ? 'z-[150] scale-[1.01]' : 'z-10'} transition-all duration-300`}>
              <div className={`flex items-center gap-3 mb-1 px-2 transition-all opacity-50 group-hover:opacity-100 ${isUser ? 'flex-row-reverse' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${isUser ? (isOwnerView ? 'text-amber-600' : isPremium ? 'text-indigo-600' : 'text-zinc-600') : 'text-zinc-400 dark:text-zinc-500'}`}>
                    {isUser ? (isOwnerView ? 'Sovereign' : ownerName.split(' ')[0]) : (msg.images && msg.images.length > 0 ? 'Synthesis' : 'Anora')}
                  </span>
                  {isUser && (
                    <VerificationTick 
                      role={isOwnerView ? Role.OWNER : Role.USER} 
                      tier={userTier} 
                      isVerified={isVerified}
                      size={12} 
                    />
                  )}
                  {isUser && <PremiumBadge role={isOwnerView ? Role.OWNER : Role.USER} tier={userTier} />}
                </div>
                <span className="text-[8px] text-zinc-300 dark:text-zinc-600 font-bold uppercase tracking-widest">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              
              {msg.images && msg.images.length > 0 && !isEditing && (
                <div className={`grid gap-2 mb-3 animate-in zoom-in-95 duration-500 ${msg.images.length === 4 ? 'grid-cols-2' : 'flex flex-wrap'} ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {msg.images.map((img, i) => (
                    <div key={i} className={`relative group/img overflow-hidden rounded-[1.8rem] sm:rounded-[2.5rem] border shadow-md transition-all hover:border-zinc-400 ${isOwnerView ? 'border-amber-500/20' : 'border-zinc-200 dark:border-white/10'} ${msg.images && msg.images.length === 1 ? 'w-64 h-64 sm:w-80 sm:h-80' : 'w-full aspect-square'}`}>
                      <img src={img} alt="V" className="w-full h-full object-cover transition-transform duration-[2s] group-hover/img:scale-110" />
                      
                      {/* Neural Watermark */}
                      <div className="absolute bottom-4 right-4 pointer-events-none z-10 opacity-60 group-hover/img:opacity-100 transition-opacity">
                        <AnoraLogo size={24} showName={false} />
                      </div>

                      <a href={img} download={`anora_full_res_${Date.now()}.png`} className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-3 bg-white/90 dark:bg-black/90 backdrop-blur-md rounded-2xl text-zinc-900 dark:text-white opacity-0 group-hover/img:opacity-100 transition-all shadow-2xl active:scale-90 z-20"><span className="text-[8px] font-black uppercase tracking-widest">Full Quality</span></a>
                    </div>
                  ))}
                </div>
              )}

              <div onMouseDown={() => handleTouchStart(msg.id)} onMouseUp={handleTouchEnd} onMouseLeave={handleTouchEnd} onTouchStart={() => handleTouchStart(msg.id)} onTouchEnd={handleTouchEnd} className={`rounded-xl sm:rounded-2xl px-3.5 sm:px-4.5 py-1.5 sm:py-2 text-sm sm:text-[14px] font-medium leading-relaxed transition-all duration-500 relative select-none touch-pan-y ${bubbleClass} ${isMenuOpen ? 'ring-2 ring-zinc-900/10' : ''}`}>
                {isEditing ? (
                  <div className="space-y-4 py-1 animate-in fade-in duration-200">
                    <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-full bg-white/40 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl p-3 text-zinc-900 dark:text-white outline-none focus:border-zinc-400 transition-all resize-none min-h-[80px]" autoFocus />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">Abort</button>
                      <button onClick={handleSaveEdit} className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all ${isOwnerView ? 'bg-amber-500 text-black' : 'bg-zinc-900 dark:bg-white dark:text-black text-white'}`}>Sync</button>
                    </div>
                  </div>
                ) : shouldShowDotsInstead ? (
                  <div className="flex gap-1.5 py-1.5">
                    <motion.div animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }} className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
                    <motion.div animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, ease: "easeInOut", delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
                    <motion.div animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, ease: "easeInOut", delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className={`prose prose-zinc dark:prose-invert max-w-none font-medium tracking-tight ${isAnora ? 'animate-in fade-in duration-300' : ''}`}>
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>,
                          code: ({ node, inline, className, children, ...props }: any) => {
                            const match = /language-(\w+)/.exec(className || '');
                            return !inline ? (
                              <div className="relative group/code my-6">
                                <div className="absolute -top-3 left-6 px-3 py-1 bg-zinc-900 text-[8px] font-black text-white uppercase tracking-widest rounded-full z-10 shadow-xl border border-white/10">{match ? match[1] : 'code'}</div>
                                <pre className="bg-zinc-950 text-zinc-300 p-8 rounded-[2rem] overflow-x-auto text-xs font-mono border border-white/5 shadow-2xl">
                                  <code className={className} {...props}>{children}</code>
                                </pre>
                                <button 
                                  onClick={() => navigator.clipboard.writeText(String(children))}
                                  className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl opacity-0 group-hover/code:opacity-100 transition-all backdrop-blur-md"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <code className="bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded-md font-mono text-[0.9em]" {...props}>{children}</code>
                            );
                          },
                          ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-2">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-2">{children}</ol>,
                          li: ({ children }) => <li className="pl-1">{children}</li>,
                          h1: ({ children }) => <h1 className="text-xl font-black uppercase tracking-widest mb-4 mt-6">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-lg font-black uppercase tracking-widest mb-3 mt-5">{children}</h2>,
                          blockquote: ({ children }) => <blockquote className="border-l-4 border-zinc-300 dark:border-zinc-700 pl-6 italic my-6 text-zinc-500 dark:text-zinc-400">{children}</blockquote>,
                          table: ({ children }) => <div className="overflow-x-auto my-6"><table className="w-full border-collapse border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden">{children}</table></div>,
                          th: ({ children }) => <th className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 p-3 text-[10px] font-black uppercase tracking-widest text-zinc-900 dark:text-white">{children}</th>,
                          td: ({ children }) => <td className="border border-zinc-200 dark:border-white/10 p-3 text-xs font-bold text-zinc-600 dark:text-zinc-400">{children}</td>,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                    {msg.audioUrl && <VocalPlayer audioUrl={msg.audioUrl} msgId={msg.id} />}
                    {isAnora && msg.sources && <GroundingSources sources={msg.sources} />}
                    
                    {/* Mood Indicator in Message */}
                    {currentMood && (
                      <div className="absolute bottom-4 right-6 flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                        <div className={`w-1 h-1 rounded-full ${
                          currentMood === 'HAPPY' ? 'bg-emerald-500' :
                          currentMood === 'SAD' ? 'bg-blue-500' :
                          currentMood === 'ANGRY' ? 'bg-red-500' :
                          currentMood === 'MOTIVATED' ? 'bg-amber-500' :
                          currentMood === 'STRESSED' ? 'bg-orange-500' :
                          'bg-zinc-400'
                        }`}></div>
                        <span className="text-[6px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">{currentMood}</span>
                      </div>
                    )}
                  </div>
                )}

                {isAnora && !isEditing && (
                    <div className="flex items-center gap-2 mt-3 px-4">
                      {onRegenerate && (
                        <motion.button 
                          whileHover={{ scale: 1.1, rotate: 180 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => onRegenerate(msg.id)}
                          className="flex items-center justify-center gap-2 px-3 h-10 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-all shadow-sm group/reg"
                          title="Regenerate Response"
                        >
                          {persona && (
                            <div 
                              className="w-6 h-6 rounded-full overflow-hidden border border-white/20 shadow-sm cursor-zoom-in active:scale-90 transition-transform"
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
                          <RefreshCw className="w-4 h-4 transition-transform duration-700" />
                        </motion.button>
                      )}
                      {onVocalize && isPremium && (
                        <motion.button 
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => onVocalize(msg.id, msg.content, msg.affect)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all text-[10px] font-black uppercase tracking-widest shadow-md ${isSpeaking ? 'bg-indigo-500 text-white border-indigo-400' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white'}`}
                        >
                          <Volume2 className={`w-3.5 h-3.5 ${isSpeaking ? 'animate-pulse' : ''}`} />
                          {isSpeaking ? 'Speaking...' : 'Vocalize'}
                        </motion.button>
                      )}
                    </div>
                )}

                <AnimatePresence>
                  {isMenuOpen && (
                    <div className="absolute z-[150] inset-0 flex items-center justify-center pointer-events-none">
                        <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl border border-zinc-100 dark:border-white/10 rounded-[1.5rem] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.2)] flex flex-col p-1.5 min-w-[180px] pointer-events-auto"
                      >
                        <div className="px-4 py-2 border-b border-zinc-50 dark:border-white/5 mb-1">
                          <p className="text-[7px] font-black text-zinc-400 uppercase tracking-[0.2em]">Neural Actions</p>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          <button onClick={() => { navigator.clipboard.writeText(msg.content); setContextMenuId(null); }} className="flex flex-col items-center justify-center gap-2 p-3 hover:bg-zinc-50 dark:hover:bg-white/5 rounded-xl transition-colors group/item">
                            <Copy className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white" />
                            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Copy</span>
                          </button>
                          {onSaveToMemory && (
                            <button onClick={() => { onSaveToMemory(msg.content); setContextMenuId(null); }} className="flex flex-col items-center justify-center gap-2 p-3 hover:bg-zinc-50 dark:hover:bg-white/5 rounded-xl transition-colors group/item">
                              <Brain className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white" />
                              <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Memory</span>
                            </button>
                          )}
                          {onSaveToReminders && (
                            <button onClick={() => { onSaveToReminders(msg.content); setContextMenuId(null); }} className="flex flex-col items-center justify-center gap-2 p-3 hover:bg-zinc-50 dark:hover:bg-white/5 rounded-xl transition-colors group/item">
                              <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white" />
                              <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Remind</span>
                            </button>
                          )}
                          {isUser && onEditMessage && (
                            <button onClick={() => handleStartEdit(msg)} className="flex flex-col items-center justify-center gap-2 p-3 hover:bg-zinc-50 dark:hover:bg-white/5 rounded-xl transition-colors group/item">
                              <Edit3 className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white" />
                              <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Edit</span>
                            </button>
                          )}
                          <button onClick={() => { if (navigator.share) { navigator.share({ text: msg.content }).catch(err => console.log('Share dismissed', err)); } else { navigator.clipboard.writeText(msg.content); } setContextMenuId(null); }} className="flex flex-col items-center justify-center gap-2 p-3 hover:bg-zinc-50 dark:hover:bg-white/5 rounded-xl transition-colors group/item">
                            <ExternalLink className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white" />
                            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Share</span>
                          </button>
                          <button onClick={() => { if (onDeleteMessage) onDeleteMessage(msg.id); setContextMenuId(null); }} className="flex flex-col items-center justify-center gap-2 p-3 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors group/item">
                            <Trash2 className="w-3.5 h-3.5 text-red-400 group-hover:text-red-500" />
                            <span className="text-[8px] font-black uppercase tracking-widest text-red-500">Purge</span>
                          </button>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        );
      })}
      {isThinking && !isStreaming && (
        <div className="flex justify-start px-4">
          <div className="flex items-center gap-3">
             <div className="flex gap-1.5 bg-black/5 dark:bg-white/5 rounded-2xl px-4 py-3 border border-black/5 dark:border-white/10 backdrop-blur-md">
                 <motion.div animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }} className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                 <motion.div animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, ease: "easeInOut", delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                 <motion.div animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, ease: "easeInOut", delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600" />
             </div>
          </div>
        </div>
      )}
      {contextMenuId && <div onClick={() => setContextMenuId(null)} className="fixed inset-0 z-[140] bg-black/20 backdrop-blur-sm animate-in fade-in duration-300"></div>}
      
      <div ref={bottomRef} className="h-10" />
      <style>{`
        .ease-out-expo {
          transition-timing-function: cubic-bezier(0.19, 1, 0.22, 1);
        }
      `}</style>
    </div>
  );
};
