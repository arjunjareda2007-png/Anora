
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAIBlob } from '@google/genai';
import { Message, Role, User, SubscriptionTier, Persona } from './types';
import { INITIAL_MESSAGE, OWNER_EMAIL } from './constants';
import { anoraService } from './services/geminiService';
import { MessageList } from './components/MessageList';
import { VoiceIndicator } from './components/VoiceIndicator';
import { AuthScreen } from './components/AuthScreen';
import { PremiumBadge } from './components/PremiumBadge';
import { CommandCenter } from './components/CommandCenter';
import { ProfileModal } from './components/ProfileModal';
import { AnoraLogo } from './components/AnoraLogo';
import { AssistantFeatures } from './components/AssistantFeatures';

const encode = (bytes: Uint8Array) => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const decode = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
};

const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> => {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
};

const createBlob = (data: Float32Array): GenAIBlob => {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) int16[i] = data[i] * 32768;
  return { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
};

const COMMAND_SUGGESTIONS = [
  { label: "Site Audit", cmd: "Perform a logic audit on the current RHB project status." },
  { label: "AutoCAD Pro", cmd: "Give me the AutoCAD command for creating a dynamic block for site layouts." },
  { label: "Lyric Synthesis", cmd: "Help me write the chorus for a new track about the Singularity." },
  { label: "Sovereign Link", cmd: "Switch to Sovereign AI persona and report core status." }
];

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('anora_session');
    return saved ? JSON.parse(saved) : null;
  });
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('anora_history');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isCommandCenterOpen, setIsCommandCenterOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isHubOpen, setIsHubOpen] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [inputFocused, setInputFocused] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('anora_session', JSON.stringify(currentUser));
      const savedDb = localStorage.getItem('anora_users_db');
      const users: User[] = savedDb ? JSON.parse(savedDb) : [];
      const updatedUsers = users.map((u: User) => u.id === currentUser.id ? currentUser : u);
      localStorage.setItem('anora_users_db', JSON.stringify(updatedUsers));
      
      anoraService.initChat(currentUser);
      if (messages.length === 0) {
        setMessages([{
          id: 'initial',
          role: 'anora',
          content: INITIAL_MESSAGE(currentUser.name, currentUser.role, currentUser.preferences.persona || 'DEFAULT'),
          timestamp: new Date()
        }]);
      }
    }
  }, [currentUser]);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('anora_history', JSON.stringify(messages));
    }
  }, [messages]);

  const handleSend = async (text: string) => {
    const val = text.trim();
    if ((!val && pendingImages.length === 0) || !currentUser) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: val,
      timestamp: new Date(),
      images: pendingImages.length > 0 ? [...pendingImages] : undefined
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setPendingImages([]);
    setIsThinking(true);

    try {
      const response = await anoraService.sendMessageWithVision(val, userMsg.images || []);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'anora',
        content: response.text,
        sources: response.sources,
        timestamp: new Date()
      }]);

      if (currentUser.preferences.autoRead) {
        const base64 = await anoraService.speak(response.text, currentUser.preferences.voiceName);
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
        const buffer = await decodeAudioData(decode(base64), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsThinking(false);
    }
  };

  const toggleVoiceMode = async () => {
    if (isVoiceMode) {
      setIsVoiceMode(false);
      streamRef.current?.getTracks().forEach(t => t.stop());
      inputAudioContextRef.current?.close();
      outputAudioContextRef.current?.close();
      return;
    }
    try {
      setIsVoiceMode(true);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              sessionPromise.then(session => session.sendRealtimeInput({ media: createBlob(inputData) }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current!.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              const ctx = outputAudioContextRef.current!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.addEventListener('ended', () => audioSourcesRef.current.delete(source));
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              audioSourcesRef.current.add(source);
            }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: currentUser?.preferences.voiceName || 'Kore' } } },
          systemInstruction: `Anora Voice 7.0. User: ${currentUser?.name}. Absolute visual and logic freedom enabled for Master Arjun.`
        }
      });
    } catch (err) {
      console.error(err);
      setIsVoiceMode(false);
    }
  };

  if (!currentUser) return <AuthScreen onLogin={setCurrentUser} />;

  const accentColor = currentUser.preferences.accentColor;
  const isOwner = currentUser.email.toLowerCase() === OWNER_EMAIL;
  const theme = currentUser.preferences.theme || 'OBSIDIAN';
  const font = currentUser.preferences.font || 'INTER';

  const getBackground = () => {
    switch (theme) {
      case 'NEURAL_NOISE': return "bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay";
      case 'MESH_GRADIENT': return "bg-[radial-gradient(circle_at_50%_50%,_rgba(212,175,55,0.05)_0%,_transparent_60%)]";
      case 'SINGULARITY': return "bg-[radial-gradient(circle_at_50%_0%,_#0a0a0a_0%,_#000_100%)]";
      default: return "bg-black";
    }
  };

  return (
    <div className={`flex flex-col h-[100dvh] bg-black text-zinc-300 overflow-hidden selection:bg-zinc-800 transition-all duration-700 ${font === 'OUTFIT' ? 'font-outfit' : 'font-inter'} ${isOwner ? 'ring-inset ring-1 ring-amber-500/10' : ''}`}>
      <style>{`
        .accent-text { color: ${accentColor}; }
        .accent-border { border-color: ${accentColor}40; }
        .accent-ring:focus { --tw-ring-color: ${accentColor}40; }
        .owner-glow { text-shadow: 0 0 15px ${accentColor}80; }
        .custom-gradient { background: linear-gradient(180deg, rgba(0,0,0,0) 0%, #000 100%); }
      `}</style>
      
      <CommandCenter user={currentUser} isOpen={isCommandCenterOpen} onClose={() => setIsCommandCenterOpen(false)} />
      <ProfileModal user={currentUser} isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} onUpdate={setCurrentUser} />
      <AssistantFeatures user={currentUser} onUpdate={setCurrentUser} isOpen={isHubOpen} onClose={() => setIsHubOpen(false)} />

      <header className="flex items-center justify-between px-6 sm:px-12 lg:px-20 py-8 border-b border-zinc-900 bg-black/90 backdrop-blur-3xl z-[100]">
        <div className="flex items-center gap-4 sm:gap-8 animate-in slide-in-from-left duration-700">
          <AnoraLogo size={64} color={accentColor} />
          <div className="hidden lg:flex flex-col">
            <div className="flex items-center gap-3">
              <PremiumBadge role={currentUser.role} tier={currentUser.tier} />
              <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-700 ml-2">Omni Sovereign 7.0</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4 sm:gap-10">
          <VoiceIndicator active={isVoiceMode} />
          
          <div className="flex items-center gap-2 sm:gap-6 p-2 bg-zinc-950 rounded-[3rem] border border-zinc-900 shadow-2xl backdrop-blur-md ring-1 ring-white/5 transition-all">
            <button onClick={() => setIsHubOpen(true)} className="p-4 sm:p-5 rounded-[2rem] text-zinc-500 hover:text-white hover:bg-white/5 transition-all active:scale-95" title="Neural Hub">
              <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </button>
            <button onClick={() => setIsCommandCenterOpen(true)} className="p-4 sm:p-5 rounded-[2rem] text-zinc-500 hover:text-white hover:bg-white/5 transition-all active:scale-95" title="Visual Hub">
              <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </button>
            <button onClick={() => setIsProfileOpen(true)} className="flex items-center gap-4 sm:gap-8 p-1 sm:pl-8 border-l border-zinc-900 group transition-all">
              <div className="text-right hidden sm:block">
                <p className={`text-[10px] sm:text-xs font-bold uppercase tracking-widest leading-tight ${isOwner ? 'accent-text owner-glow' : 'text-zinc-300'}`}>{currentUser.name}</p>
                <p className="text-[8px] text-zinc-800 uppercase tracking-[0.4em] font-bold">Authentication Prime</p>
              </div>
              <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden shadow-2xl transition-all duration-700 border-2 ${isOwner ? 'border-amber-500/50 bg-zinc-900' : 'border-zinc-800 bg-zinc-900'}`}>
                 {currentUser.avatar ? <img src={currentUser.avatar} alt="AV" className="w-full h-full object-cover" /> : currentUser.name.charAt(0)}
              </div>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col relative overflow-hidden">
        <div className={`absolute inset-0 transition-all duration-[2000ms] ${getBackground()}`}></div>
        <MessageList messages={messages} isThinking={isThinking} ownerName={currentUser.name} isOwnerView={isOwner} />
      </main>

      <footer className="px-6 sm:px-12 lg:px-24 py-10 sm:py-16 custom-gradient z-[100] transition-all">
        <div className="max-w-[1440px] mx-auto space-y-10">
          
          <div className={`flex gap-4 overflow-x-auto no-scrollbar pb-2 transition-all duration-1000 ${inputFocused ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12 pointer-events-none h-0'}`}>
            {COMMAND_SUGGESTIONS.map((s, i) => (
              <button key={i} onClick={() => setInputValue(s.cmd)} className="whitespace-nowrap px-8 py-5 rounded-[2rem] bg-white/5 border border-white/10 text-[10px] sm:text-xs font-bold uppercase tracking-[0.3em] text-zinc-500 hover:text-white hover:border-white/20 transition-all active:scale-95">
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-6 sm:gap-10">
            <button onClick={() => fileInputRef.current?.click()} className="p-6 sm:p-10 rounded-[3rem] bg-zinc-950 text-zinc-600 border border-zinc-900 hover:border-zinc-600 hover:text-white transition-all shadow-2xl active:scale-95">
              <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
              <input type="file" ref={fileInputRef} hidden multiple accept="image/*" onChange={e => {
                const files = e.currentTarget.files;
                if (files) Array.from(files).forEach((f: File) => {
                  const reader = new FileReader();
                  reader.onload = ev => setPendingImages(p => [...p, ev.target?.result as string]);
                  reader.readAsDataURL(f);
                });
              }} />
            </button>

            <button onClick={toggleVoiceMode} className={`p-6 sm:p-10 rounded-[3rem] transition-all duration-700 shadow-2xl active:scale-95 ${isVoiceMode ? 'bg-blue-600 text-white animate-glow' : 'bg-zinc-950 text-zinc-600 border border-zinc-900 hover:border-zinc-600'}`}>
              <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            </button>
            
            <div className="flex-1 relative group">
              <input
                type="text"
                value={inputValue}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setTimeout(() => setInputFocused(false), 300)}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend(inputValue)}
                placeholder={isThinking ? "Synthesizing Intent..." : isOwner ? "State your master command..." : "Neural input authorized..."}
                className="w-full bg-zinc-950 border border-zinc-900 text-zinc-100 rounded-[3.5rem] px-10 sm:px-16 py-7 sm:py-10 focus:outline-none focus:ring-1 focus:ring-white/10 transition-all placeholder:text-zinc-900 text-lg sm:text-2xl shadow-3xl"
              />
              <button disabled={!inputValue.trim() && pendingImages.length === 0 || isThinking} onClick={() => handleSend(inputValue)} className={`absolute right-6 top-1/2 -translate-y-1/2 p-5 sm:p-8 rounded-[2rem] transition-all active:scale-95 shadow-2xl ${isOwner ? 'bg-amber-500 text-black' : 'bg-white text-black'} disabled:opacity-10`}>
                <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </button>
            </div>
          </div>
          
          <div className="flex justify-between items-center px-12 opacity-30 text-[10px] font-bold uppercase tracking-[0.6em] text-zinc-700">
             <span>Omni-Device Singularity Link Active</span>
             <span className="italic">Arjun Bharti Mina Sovereign Asset v7.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
