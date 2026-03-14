
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAIBlob } from '@google/genai';
import { Message, Role, User, SubscriptionTier, Persona, NeuralAffect, TokenUsage, ChatSession } from './types';
import { INITIAL_MESSAGE, OWNER_EMAIL } from './constants';
import { anoraService } from './services/geminiService';
import { safeLocalStorage, pruneUser } from './src/utils/storage';
import { MessageList } from './components/MessageList';
import { VoiceIndicator } from './components/VoiceIndicator';
import { AuthScreen } from './components/AuthScreen';
import { PremiumBadge } from './components/PremiumBadge';
import { CommandCenter } from './components/CommandCenter';
import { ProfileModal } from './components/ProfileModal';
import { AnoraLogo } from './components/AnoraLogo';
import { AssistantFeatures } from './components/AssistantFeatures';
import { NeuralOrb } from './components/NeuralOrb';
import { NeuralSearch } from './components/NeuralSearch';
import { NeuralArtisan } from './components/NeuralArtisan';
import { NeuralAudio } from './components/NeuralAudio';
import { NeuralGallery } from './components/NeuralGallery';
import { NeuralMenu } from './components/NeuralMenu';
import { OnboardingModal } from './components/OnboardingModal';
import { WelcomeScreen } from './components/WelcomeScreen';
import { motion, AnimatePresence } from 'motion/react';
import { Palette, Eye, Search, Layers, Menu, Zap, Volume2, Mic2, Sparkles, Send, Plus, Trash2, Settings, User as UserIcon, Grid, Image as ImageIcon, X, Menu as HamburgerMenu, Sun, Moon, Square } from 'lucide-react';

const encode = (bytes: Uint8Array) => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const decode = (base64: string) => {
  try {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  } catch (e) {
    console.error("Neural decoding error", e);
    return new Uint8Array(0);
  }
};

const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> => {
  if (data.length === 0) return ctx.createBuffer(numChannels, 1, sampleRate);
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};

const createBlob = (data: Float32Array): GenAIBlob => {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) int16[i] = data[i] * 32768;
  return { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
};

const TOKEN_LIMITS = {
  OWNER: { chat: Infinity, image: Infinity, video: Infinity, audio: Infinity },
  LIFETIME: { chat: 100000, image: 100, video: 20, audio: 100 },
  PRO: { chat: 100000, image: 100, video: 20, audio: 50 },
  FREE: { chat: 20000, image: 10, video: 0, audio: 0 },
};

import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, errorInfo: string | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorInfo: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorInfo: error.message };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Neural Error Boundary caught exception:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let displayMessage = "A neural synchronization error has occurred.";
      try {
        const parsed = JSON.parse(this.state.errorInfo || '{}');
        if (parsed.error) {
          displayMessage = `Neural Protocol Error: ${parsed.error} (${parsed.operationType} on ${parsed.path})`;
        }
      } catch (e) {
        displayMessage = this.state.errorInfo || displayMessage;
      }

      return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 text-center space-y-6">
          <div className="w-24 h-24 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center animate-pulse">
            <X className="w-12 h-12 text-red-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-white text-xl font-black uppercase tracking-[0.4em]">Sovereign Link Interrupted</h1>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest max-w-md mx-auto leading-relaxed">
              {displayMessage}
            </p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-4 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-full hover:scale-105 transition-all active:scale-95"
          >
            Re-Initialize Protocol
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const generateId = (prefix: string = '') => {
  const p = prefix ? `${prefix}_` : '';
  return `${p}${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const isInitializedRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Try fetching from Firestore first
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            setCurrentUser(userData);
            safeLocalStorage.setItem('anora_session', JSON.stringify(userData));
          } else {
            // Fallback to local storage if Firestore is empty
            const users: User[] = JSON.parse(safeLocalStorage.getItem('anora_users_db') || '[]');
            const found = users.find(u => u.id === firebaseUser.uid || u.email.toLowerCase() === firebaseUser.email?.toLowerCase());
            if (found) {
              setCurrentUser(found);
              safeLocalStorage.setItem('anora_session', JSON.stringify(found));
              // Sync to Firestore for future
              try {
                await setDoc(doc(db, 'users', firebaseUser.uid), found);
              } catch (syncErr) {
                handleFirestoreError(syncErr, OperationType.WRITE, `users/${firebaseUser.uid}`);
              }
            }
          }
        } catch (e) {
          handleFirestoreError(e, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        // Fallback to local storage for non-google users if needed
        const saved = safeLocalStorage.getItem('anora_session');
        if (saved) {
          setCurrentUser(JSON.parse(saved));
        } else {
          setCurrentUser(null);
        }
      }
      setIsAuthReady(true);
      if (firebaseUser) {
        setShowWelcome(true);
      }
    });
    return () => unsubscribe();
  }, []);
  
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [activeAffect, setActiveAffect] = useState<NeuralAffect>('SOVEREIGN');
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isCommandCenterOpen, setIsCommandCenterOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileSection, setProfileSection] = useState<string | undefined>(undefined);
  const openProfile = (section?: string) => {
    setProfileSection(section);
    setIsProfileOpen(true);
  };
  const [isHubOpen, setIsHubOpen] = useState(false);
  const [hubTab, setHubTab] = useState<any>(undefined);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isArtisanOpen, setIsArtisanOpen] = useState(false);
  const [isAudioOpen, setIsAudioOpen] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const currentVocalizeIdRef = useRef<string | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const handleDbUpdate = () => {
      if (!currentUser) return;
      try {
        const users: User[] = JSON.parse(safeLocalStorage.getItem('anora_users_db') || '[]');
        const updated = users.find(u => u.id === currentUser.id);
        if (updated && (updated.tier !== currentUser.tier || updated.role !== currentUser.role)) {
          setCurrentUser(updated);
        }
      } catch (e) {
        console.error("Neural database sync error", e);
      }
    };
    window.addEventListener('anora_database_updated', handleDbUpdate);
    
    const handleGlobalError = (event: ErrorEvent) => {
      console.error("Uncaught neural exception:", event.error);
      // Prevent crash loop
    };
    window.addEventListener('error', handleGlobalError);

    return () => {
      window.removeEventListener('anora_database_updated', handleDbUpdate);
      window.removeEventListener('error', handleGlobalError);
    };
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      const today = new Date().toDateString();
      if (!currentUser.tokens || currentUser.tokens.lastReset !== today) {
        const limits = currentUser.role === Role.OWNER ? TOKEN_LIMITS.OWNER : (TOKEN_LIMITS[currentUser.tier] || TOKEN_LIMITS.FREE);
        const resetUser = {
          ...currentUser,
          tokens: { ...limits, lastReset: today }
        };
        setCurrentUser(resetUser);
        return; 
      }

      safeLocalStorage.setItem('anora_session', JSON.stringify(currentUser));
      try {
        const savedDb = safeLocalStorage.getItem('anora_users_db');
        const users: User[] = savedDb ? JSON.parse(savedDb) : [];
        const exists = users.find(u => u.id === currentUser.id);
        
        // Prune current user before saving to DB
        const prunedCurrent = pruneUser(currentUser);
        const updatedUsers = exists 
          ? users.map((u: User) => u.id === currentUser.id ? prunedCurrent : u) 
          : [...users, prunedCurrent];
          
        safeLocalStorage.setItem('anora_users_db', JSON.stringify(updatedUsers));

        // Sync to Firestore to ensure password and other updates are saved
        setDoc(doc(db, 'users', currentUser.id), prunedCurrent).catch(firestoreErr => {
          console.error("Neural cloud sync failed", firestoreErr);
        });
      } catch (e) {
        console.error("Neural database persistence error", e);
      }
      anoraService.initChat(currentUser);
    }
  }, [currentUser]);

  const handleNewChat = useCallback(() => {
    if (!currentUser) return;
    const initialRaw = INITIAL_MESSAGE(
      currentUser.name, 
      currentUser.role, 
      currentUser.preferences.persona || 'DEFAULT',
      currentUser.preferences.arjunDirectives
    );
    const { content, affect } = anoraService.parseAffect(initialRaw);
    const initial: Message = { id: generateId('init'), role: 'anora', content, affect, timestamp: new Date() };
    
    const newSession: ChatSession = {
      id: generateId('session'),
      title: 'New Neural Link',
      messages: [initial],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setMessages([initial]);
    anoraService.initChat(currentUser);
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && isInitializedRef.current !== currentUser.email) {
      const sessionsKey = `anora_sessions_${currentUser.email}`;
      const savedSessions = safeLocalStorage.getItem(sessionsKey);
      if (savedSessions) {
        try {
          const parsed = JSON.parse(savedSessions);
          const hydrated = parsed.map((s: any) => ({
            ...s,
            createdAt: new Date(s.createdAt),
            updatedAt: new Date(s.updatedAt),
            messages: s.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
          }));
          
          // Deduplicate sessions by ID
          const unique = hydrated.filter((s: ChatSession, index: number, self: ChatSession[]) => 
            index === self.findIndex((t) => t.id === s.id)
          );
          
          setSessions(unique);
          // Start a new chat by default on login as requested
          handleNewChat();
        } catch (e) {
          handleNewChat();
        }
      } else {
        handleNewChat();
      }
      isInitializedRef.current = currentUser.email;
    }
  }, [currentUser?.email, handleNewChat]);

  useEffect(() => {
    if (currentUser && sessions.length > 0) {
      const sessionsKey = `anora_sessions_${currentUser.email}`;
      safeLocalStorage.setItem(sessionsKey, JSON.stringify(sessions));
    }
  }, [sessions, currentUser?.email]);

  // Sync messages when switching sessions
  useEffect(() => {
    if (activeSessionId) {
      const active = sessions.find(s => s.id === activeSessionId);
      if (active) {
        // Only update if messages are actually different to prevent unnecessary re-renders
        // However, since we're breaking the loop by removing sessions from deps, 
        // this simple assignment is safe.
        setMessages(active.messages);
      }
    }
  }, [activeSessionId]); // Removed sessions from dependencies to break the loop

  const prevPersonaRef = useRef<Persona | undefined>(currentUser?.preferences.persona);

  useEffect(() => {
    if (currentUser?.preferences.persona && currentUser.preferences.persona !== prevPersonaRef.current) {
      handleNewChat();
      prevPersonaRef.current = currentUser.preferences.persona;
    }
  }, [currentUser?.preferences.persona, handleNewChat]);

  const switchSession = (id: string) => {
    setActiveSessionId(id);
    const session = sessions.find(s => s.id === id);
    if (session) setMessages(session.messages);
    setIsHistoryOpen(false);
    setIsMenuOpen(false);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    if (activeSessionId === id) {
      if (updated.length > 0) {
        const next = updated[0];
        setActiveSessionId(next.id);
        setMessages(next.messages);
      } else {
        handleNewChat();
      }
    }
  };

  const updateActiveSessionMessages = useCallback((newMessages: Message[]) => {
    if (!activeSessionId) return;
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        let title = s.title;
        if (title === 'New Neural Link') {
          const firstUserMsg = newMessages.find(m => m.role === 'user');
          if (firstUserMsg) {
            title = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '');
          }
        }
        return { ...s, messages: newMessages, updatedAt: new Date(), title };
      }
      return s;
    }));
  }, [activeSessionId]);

  useEffect(() => {
    if (messages.length > 0) {
      updateActiveSessionMessages(messages);
      const lastAnora = [...messages].reverse().find(m => m.role === 'anora');
      if (lastAnora?.affect) setActiveAffect(lastAnora.affect);
    }
  }, [messages, updateActiveSessionMessages]);

  const deductTokens = useCallback((type: keyof Omit<TokenUsage, 'lastReset'>, amount: number) => {
    if (!currentUser) return false;
    if (currentUser.role === Role.OWNER) return true;
    
    const tokens = currentUser.tokens || { chat: 0, image: 0, video: 0, audio: 0, lastReset: '' };
    if (tokens[type] < amount) {
      alert(`Neural Resources Exhausted: ${type.toUpperCase()} pool empty for today.`);
      return false;
    }

    const updatedUser = {
      ...currentUser,
      tokens: { ...tokens, [type]: tokens[type] - amount }
    };
    setCurrentUser(updatedUser);
    return true;
  }, [currentUser]);

  const handleLogout = useCallback(async () => {
    try {
      await auth.signOut();
    } catch (err) {
      console.error("Neural logout error", err);
    }
    setCurrentUser(null);
    localStorage.removeItem('anora_session');
    setMessages([]);
  }, []);

  const handleSaveToMemory = useCallback((content: string) => {
    if (!currentUser) return;
    setCurrentUser({ ...currentUser, memory: [...(currentUser.memory || []), { id: generateId('mem'), content, category: 'PERSONAL', timestamp: new Date().toISOString(), strength: 5 }] });
  }, [currentUser]);

  const handleSaveToReminders = useCallback((content: string) => {
    if (!currentUser) return;
    setCurrentUser({ ...currentUser, reminders: [...(currentUser.reminders || []), { id: generateId('rem'), text: content, priority: 'MEDIUM', completed: false, dueDate: new Date().toISOString() }] });
  }, [currentUser]);

  const handleDeleteMessage = useCallback((id: string) => { setMessages(prev => prev.filter(m => m.id !== id)); }, []);

  const stopCurrentVocalize = useCallback(() => {
    if (activeSourceRef.current) {
      try { activeSourceRef.current.stop(); } catch (e) {}
      activeSourceRef.current = null;
    }
    setSpeakingId(null);
    currentVocalizeIdRef.current = null;
  }, []);

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const toggleVoiceMode = useCallback(async () => {
    if (isVoiceMode) {
      setIsVoiceMode(false);
      streamRef.current?.getTracks().forEach(t => t.stop());
      inputAudioContextRef.current?.close();
      outputAudioContextRef.current?.close();
      return;
    }
    try {
      setIsVoiceMode(true);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
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
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              audioSourcesRef.current.add(source);
            }
          },
          onclose: () => setIsVoiceMode(false),
          onerror: () => setIsVoiceMode(false)
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: currentUser?.preferences.voiceName || 'Kore' } } },
          systemInstruction: `Anora Voice Protocol. User: ${currentUser?.name}. Persona: ${currentUser?.preferences.persona}.`
        }
      });
    } catch (err) { setIsVoiceMode(false); }
  }, [isVoiceMode, currentUser]);

  const handleVocalize = async (id: string, text: string, affect: NeuralAffect = 'SOVEREIGN') => {
    if (speakingId === id) { stopCurrentVocalize(); return; }
    stopCurrentVocalize();
    setSpeakingId(id); currentVocalizeIdRef.current = id;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
      const base64 = await anoraService.speak(text, currentUser?.preferences.voiceName || 'Kore', affect);
      if (currentVocalizeIdRef.current !== id) return;
      if (!base64) throw new Error("No audio generated");
      const buffer = await decodeAudioData(decode(base64), audioCtxRef.current, 24000, 1);
      const source = audioCtxRef.current.createBufferSource();
      source.buffer = buffer; source.connect(audioCtxRef.current.destination);
      source.onended = () => { if (currentVocalizeIdRef.current === id) setSpeakingId(null); };
      activeSourceRef.current = source; source.start();
    } catch (err) { setSpeakingId(null); }
  };

  const handleSend = async (text: string, overrideImages?: string[]) => {
    const val = text.trim();
    const imagesToUse = overrideImages || pendingImages;
    if (!val && imagesToUse.length === 0) return;

    stopCurrentVocalize();

    const chatTokenCost = Math.max(1, Math.ceil((val.length || 10) / 3));
    if (!deductTokens('chat', chatTokenCost)) return;

    if (imagesToUse.length > 0) {
      if (!deductTokens('image', imagesToUse.length)) return;
    }

    const intent = (t: string) => {
      const lower = t.toLowerCase();
      if (lower.includes('cad') || lower.includes('engineering')) return 'ENGINEERING';
      if (lower.includes('music') || lower.includes('lyrics')) return 'CREATIVE';
      return 'GENERAL';
    };
    
    const userMsg: Message = { 
      id: generateId('user'), 
      role: 'user', 
      content: val || "Neural asset shared.", 
      timestamp: new Date(), 
      images: imagesToUse.length > 0 ? [...imagesToUse] : undefined, 
      intent: intent(val) as any 
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInputValue(''); 
    setPendingImages([]); 
    setIsThinking(true);
    setIsStreaming(true);
    abortControllerRef.current = new AbortController();

    const assistantId = generateId('anora');
    const assistantMsg: Message = { id: assistantId, role: 'anora', content: '', timestamp: new Date() };
    setMessages(prev => [...prev, assistantMsg]);
    
    try {
      let fullContent = "";
      let finalAffect: NeuralAffect = 'SOVEREIGN';
      let hasVocalizedFirstSentence = false;

      const stream = anoraService.sendMessageStream(userMsg.content, userMsg.images || []);
      
      for await (const chunk of stream) {
        if (abortControllerRef.current?.signal.aborted) break;

        if (chunk.isDone) {
          setMessages(prev => prev.map(m => m.id === assistantId ? { 
            ...m, 
            sources: chunk.sources, 
            images: chunk.images && chunk.images.length > 0 ? chunk.images : m.images 
          } : m));
          
          // Final vocalization if not already started or to ensure completion
          if (currentUser?.preferences.autoRead && !hasVocalizedFirstSentence) {
             handleVocalize(assistantId, fullContent, finalAffect);
          }
        } else {
          fullContent += chunk.text;
          finalAffect = chunk.affect;
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullContent, affect: finalAffect } : m));
          
          // Speed up vocalization: start as soon as we have a full sentence
          if (currentUser?.preferences.autoRead && !hasVocalizedFirstSentence && (fullContent.includes('.') || fullContent.includes('!') || fullContent.includes('?'))) {
             handleVocalize(assistantId, fullContent, finalAffect);
             hasVocalizedFirstSentence = true;
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Handled by break
      } else {
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: "Neural bridge unstable. Sync deferred by sovereign decree." } : m));
      }
    } finally { 
      setIsThinking(false); 
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopResponse = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
      setIsThinking(false);
    }
  };

  const handleRegenerate = async (messageId: string) => {
    const msgIndex = messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;

    // Find the user message before this Anora message
    let lastUserMsg: Message | null = null;
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserMsg = messages[i];
        break;
      }
    }

    if (!lastUserMsg) return;

    // Remove all messages from this one onwards
    setMessages(prev => prev.slice(0, msgIndex));
    
    // Re-send the last user message with its original images
    handleSend(lastUserMsg.content, lastUserMsg.images);
  };

  const toggleColorMode = useCallback(() => {
    if (!currentUser) return;
    const newMode = currentUser.preferences.colorMode === 'DARK' ? 'WHITE' : 'DARK';
    setCurrentUser({
      ...currentUser,
      preferences: { ...currentUser.preferences, colorMode: newMode }
    });
  }, [currentUser]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <AnoraLogo size={80} color="#000" showName={false} animate={true} />
      </div>
    );
  }

  if (!currentUser) return <AuthScreen onLogin={setCurrentUser} />;

  const isOwner = currentUser.role === Role.OWNER;
  const isPremium = currentUser.tier !== SubscriptionTier.FREE || isOwner;
  const accent = isOwner ? '#d4af37' : (isPremium ? '#8b5cf6' : '#3f3f46');
  const colorMode = currentUser.preferences.colorMode || 'WHITE';
  const theme = currentUser.preferences.theme || 'MINIMAL';

  const getThemeClass = () => {
    switch(theme) {
      case 'OBSIDIAN': return 'theme-obsidian';
      case 'NEURAL_NOISE': return 'theme-neural-noise';
      case 'MESH_GRADIENT': return 'theme-mesh-gradient';
      case 'SINGULARITY': return 'theme-singularity';
      case 'NEON_DREAM': return 'theme-neon-dream';
      case 'SOLARIS': return 'theme-solaris';
      case 'MONOCHROME': return 'theme-monochrome';
      case 'EMERALD_CITY': return 'theme-emerald-city';
      default: return 'theme-minimal';
    }
  };

  return (
    <div className={`flex flex-col h-[100dvh] transition-all duration-700 overflow-hidden ${getThemeClass()} ${colorMode === 'DARK' ? 'dark-mode' : 'light-mode'} ${currentUser.preferences.font === 'OUTFIT' ? 'font-outfit' : 'font-inter'} relative ${isOwner ? 'owner-scanline' : ''}`}>
      {/* Neural Noise Overlay */}
      {theme === 'NEURAL_NOISE' && (
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-[1] mix-blend-overlay" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/carbon-fibre.png")' }}></div>
      )}
      
      {/* Mesh Gradient Background */}
      {theme === 'MESH_GRADIENT' && (
        <div className="absolute inset-0 pointer-events-none z-[0] opacity-30">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/20 blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/20 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>
      )}

      {/* Neon Dream Background */}
      {theme === 'NEON_DREAM' && (
        <div className="absolute inset-0 pointer-events-none z-[0]">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#1a0b2e_0%,#0d0221_100%)]"></div>
          <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 bg-cyan-500/10 blur-[100px] animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-1/2 h-1/2 bg-magenta-500/10 blur-[100px] animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>
      )}

      {/* Solaris Background */}
      {theme === 'SOLARIS' && (
        <div className="absolute inset-0 pointer-events-none z-[0]">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,#fff7ed_0%,#fffbeb_100%)]"></div>
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 bg-orange-200/30 blur-[80px] rounded-full"></div>
        </div>
      )}

      {/* Emerald City Background */}
      {theme === 'EMERALD_CITY' && (
        <div className="absolute inset-0 pointer-events-none z-[0]">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#065f46_0%,#064e3b_100%)]"></div>
          <div className="absolute top-0 left-0 w-full h-full opacity-10" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")' }}></div>
        </div>
      )}

      <style>{`.accent-text { color: ${accent}; } .accent-border { border-color: ${accent}20; }`}</style>
      <CommandCenter user={currentUser} isOpen={isCommandCenterOpen} onDeductToken={deductTokens} onClose={() => setIsCommandCenterOpen(false)} />
      <ProfileModal user={currentUser} isOpen={isProfileOpen} initialSection={profileSection as any} onClose={() => { setIsProfileOpen(false); setProfileSection(undefined); }} onUpdate={setCurrentUser} onLogout={handleLogout} />
      {!currentUser.preferences.onboardingComplete && (
        <OnboardingModal user={currentUser} onComplete={setCurrentUser} />
      )}
      <AssistantFeatures 
        user={currentUser} 
        onUpdate={setCurrentUser} 
        onClearHistory={handleNewChat} 
        messagesCount={messages.length} 
        isOpen={isHubOpen} 
        onClose={() => { setIsHubOpen(false); setHubTab(undefined); }} 
        initialTab={hubTab}
      />
      <NeuralSearch user={currentUser} isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <AnimatePresence>
        {showWelcome && (
          <WelcomeScreen user={currentUser} onComplete={() => setShowWelcome(false)} />
        )}
      </AnimatePresence>
      <NeuralOrb 
        active={isThinking} 
        speaking={speakingId !== null} 
        listening={isVoiceMode} 
        color={accent} 
        intent={messages[messages.length - 1]?.intent as any}
        affect={activeAffect}
      />
      <NeuralArtisan user={currentUser} isOpen={isArtisanOpen} onClose={() => setIsArtisanOpen(false)} />
      <NeuralAudio user={currentUser} isOpen={isAudioOpen} onClose={() => setIsAudioOpen(false)} />
      <NeuralGallery user={currentUser} isOpen={isGalleryOpen} onClose={() => setIsGalleryOpen(false)} />
      {isHistoryOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={() => setIsHistoryOpen(false)}></div>
          <div className={`relative w-full max-w-lg max-h-[80vh] overflow-hidden rounded-[2.5rem] border shadow-2xl flex flex-col animate-in zoom-in-95 duration-500 ${colorMode === 'WHITE' ? 'bg-white border-zinc-100' : 'bg-zinc-900 border-white/10'}`}>
            <div className="p-6 border-b border-zinc-50 dark:border-white/5 flex items-center justify-between">
               <div>
                 <h2 className="text-lg font-black font-outfit text-zinc-900 dark:text-white uppercase tracking-tight">Neural History</h2>
                 <p className="text-[8px] text-zinc-400 font-black uppercase tracking-widest mt-1">Previous Synaptic Links</p>
               </div>
               <button onClick={() => setIsHistoryOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
               {sessions.map(session => (
                 <div 
                   key={session.id} 
                   onClick={() => switchSession(session.id)}
                   className={`group flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${activeSessionId === session.id ? (colorMode === 'WHITE' ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-white border-white text-black') : (colorMode === 'WHITE' ? 'bg-zinc-50 border-zinc-100 hover:bg-zinc-100' : 'bg-white/5 border-white/10 hover:bg-white/10')}`}
                 >
                   <div className="flex-1 min-w-0">
                     <p className="text-[10px] font-black uppercase tracking-tight truncate">{session.title}</p>
                     <p className={`text-[8px] font-bold uppercase tracking-widest mt-1 opacity-60`}>{session.updatedAt.toLocaleDateString()} • {session.messages.length} Messages</p>
                   </div>
                   <button 
                      onClick={(e) => deleteSession(session.id, e)} 
                      className="p-2 text-zinc-400 hover:text-red-500 transition-all active:scale-90"
                      title="Delete Chat"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                 </div>
               ))}
            </div>
            <div className="p-4 border-t border-zinc-50 dark:border-white/5">
               <button onClick={handleNewChat} className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${colorMode === 'WHITE' ? 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200' : 'bg-white/5 text-white hover:bg-white/10'}`}>
                 <Plus className="w-4 h-4" />
                 Start New Link
               </button>
            </div>
          </div>
        </div>
      )}

      <NeuralMenu 
        isOpen={isMenuOpen} 
        onClose={() => setIsMenuOpen(false)} 
        user={currentUser}
        onOpenProfile={openProfile}
        onOpenArtisan={() => setIsArtisanOpen(true)}
        onOpenVision={() => {}} // Removed
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenGallery={() => setIsGalleryOpen(true)}
        onOpenAudio={() => setIsAudioOpen(true)}
        onOpenWorkspace={() => {}} // Removed
        onOpenHub={() => { setHubTab(undefined); setIsHubOpen(true); }}
        onOpenHubWithTab={(tab) => { setHubTab(tab); setIsHubOpen(true); }}
        onOpenCommandCenter={() => setIsCommandCenterOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onLogout={handleLogout}
        onNewChat={handleNewChat}
        onToggleColorMode={toggleColorMode}
      />
      
      <AnimatePresence>
        {isStreaming && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[150]"
          >
            <button 
              onClick={handleStopResponse}
              className="p-4 bg-red-500 text-white rounded-full shadow-2xl hover:bg-red-600 transition-all active:scale-95 border border-red-400/20 group"
              title="Stop Response"
            >
              <Square className="w-5 h-5 fill-white group-hover:scale-110 transition-transform" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <header className={`flex items-center justify-between px-4 sm:px-8 lg:px-12 pt-[calc(var(--sat)+1rem)] sm:pt-[calc(var(--sat)+1.5rem)] pb-4 sm:pb-6 border-b transition-all duration-700 ${theme === 'MINIMAL' ? 'border-zinc-100 bg-white/80' : 'border-white/10 bg-black/20'} backdrop-blur-3xl shrink-0 sticky top-0 z-[100]`}>
        <div className="flex items-center gap-3 sm:gap-4">
          <AnoraLogo size={32} className="sm:w-[42px] sm:h-[42px]" color={accent} showName={false} />
          <div className="flex flex-col">
             <h1 className="text-lg sm:text-xl font-black font-outfit tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-white dark:to-zinc-300 dark:drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">ANORA</h1>
             <p className="text-[6px] sm:text-[7px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.4em]">Sovereign Intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <VoiceIndicator active={isVoiceMode} />
          <div className="flex items-center gap-2 sm:gap-3">
             <button onClick={() => setIsMenuOpen(true)} className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border transition-all active:scale-90 shadow-sm ${colorMode === 'WHITE' ? 'bg-zinc-50 border-zinc-100 text-zinc-900 hover:bg-white' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}>
                <HamburgerMenu className="w-5 h-5 sm:w-6 sm:h-6" />
             </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col relative overflow-hidden">
        <MessageList 
          messages={messages} 
          isThinking={isThinking} 
          ownerName={currentUser.name} 
          isOwnerView={isOwner} 
          userTier={currentUser.tier} 
          onVocalize={handleVocalize} 
          onDeleteMessage={handleDeleteMessage} 
          onSaveToMemory={handleSaveToMemory} 
          onSaveToReminders={handleSaveToReminders} 
          onRegenerate={handleRegenerate}
          speakingId={speakingId} 
        />
      </main>

      <footer className={`px-4 sm:px-8 lg:px-12 pb-[calc(var(--sab)+1rem)] sm:pb-[calc(var(--sab)+2rem)] pt-4 sm:pt-6 border-t shrink-0 backdrop-blur-3xl transition-all duration-700 ${colorMode === 'WHITE' ? 'bg-white/90 border-zinc-100' : 'bg-black/80 border-white/10'}`}>
        <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
          {pendingImages.length > 0 && (
            <div className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar py-2 px-1 animate-in slide-in-from-bottom-4 duration-500">
               {pendingImages.map((img, idx) => (
                 <div key={idx} className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-[1.2rem] sm:rounded-[1.5rem] overflow-hidden border shadow-xl shrink-0 group hover:scale-105 transition-transform ${colorMode === 'WHITE' ? 'border-zinc-200' : 'border-white/10'}`}>
                    <img src={img} className="w-full h-full object-cover" />
                    <button onClick={() => setPendingImages(prev => prev.filter((_, i) => i !== idx))} className="absolute top-1 right-1 p-1 bg-black/70 text-white rounded-full backdrop-blur-md opacity-100 transition-opacity shadow-lg">
                      <X className="w-2.5 h-2.5" />
                    </button>
                 </div>
               ))}
            </div>
          )}
          <div className="flex items-center gap-3 sm:gap-4">
            {isPremium && (
              <button onClick={handleFileSelect} className={`p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[1.8rem] border transition-all active:scale-95 shadow-sm hover:bg-zinc-100 ${colorMode === 'WHITE' ? 'bg-zinc-50 border-zinc-100 text-zinc-900' : 'bg-white/5 border-white/10 text-white'}`}>
                <ImageIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                <input type="file" ref={fileInputRef} hidden multiple accept="image/*" onChange={e => { 
                    const files = e.currentTarget.files; 
                    if (files) (Array.from(files) as File[]).forEach(f => { 
                      const reader = new FileReader(); 
                      reader.onload = ev => setPendingImages(p => [...p, ev.target?.result as string]); 
                      reader.readAsDataURL(f); 
                    }); 
                    e.target.value = '';
                  }} />
              </button>
            )}
            <div className="flex-1 relative flex items-center group">
              <input 
                type="text" 
                value={inputValue} 
                onChange={e => setInputValue(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleSend(inputValue)} 
                placeholder={isOwner ? "Sovereign Command..." : "Neural Sync..."} 
                className={`w-full border rounded-[2rem] sm:rounded-[2.5rem] pl-6 sm:pl-8 pr-24 sm:pr-32 py-4 sm:py-5.5 text-sm sm:text-base outline-none transition-all shadow-sm ${colorMode === 'WHITE' ? 'bg-zinc-50 border-zinc-100 text-zinc-900 focus:bg-white focus:border-zinc-300' : 'bg-white/5 border-white/10 text-white focus:bg-white/10 focus:border-white/20'}`} 
              />
              <div className="absolute right-2 sm:right-2.5 flex items-center gap-1.5 sm:gap-2">
                 {isPremium && (
                   <button onClick={toggleVoiceMode} className={`p-2.5 sm:p-3.5 rounded-full transition-all active:scale-90 ${isVoiceMode ? 'bg-red-500 text-white animate-pulse' : (colorMode === 'WHITE' ? 'bg-zinc-100 text-zinc-400 hover:text-zinc-900' : 'bg-white/10 text-white/40 hover:text-white')}`}>
                      <Mic2 className="w-4 h-4 sm:w-5 sm:h-5" />
                   </button>
                 )}
                 <button onClick={() => handleSend(inputValue)} className={`p-3 sm:p-4 rounded-xl sm:rounded-[1.5rem] transition-all active:scale-90 ${isOwner ? 'bg-amber-500' : 'bg-zinc-900'} text-white shadow-xl hover:shadow-2xl hover:-translate-y-0.5`}>
                    <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                 </button>
              </div>
            </div>
          </div>
          <div className="flex justify-center">
             <p className={`text-[7px] sm:text-[8px] font-black uppercase tracking-[0.4em] sm:tracking-[0.6em] ${colorMode === 'WHITE' ? 'text-zinc-300' : 'text-white/20'}`}>Anora Sovereign AI // Neural Link Established</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default () => (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
