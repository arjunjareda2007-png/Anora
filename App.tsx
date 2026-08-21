
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAIBlob } from '@google/genai';
import { Message, Role, User, SubscriptionTier, Persona, NeuralAffect, TokenUsage, ChatSession, Broadcast } from './types';
import { INITIAL_MESSAGE, OWNER_EMAIL, PERSONA_INSTRUCTIONS } from './constants';
import { anoraService } from './services/geminiService';
import { safeLocalStorage, pruneUser, cleanFirestoreData } from './src/utils/storage';
import { MessageList } from './components/MessageList';
import { VoiceIndicator } from './components/VoiceIndicator';
import { AuthScreen } from './components/AuthScreen';
import { PremiumBadge } from './components/PremiumBadge';
import { CommandCenter } from './components/CommandCenter';
import { ProfileModal } from './components/ProfileModal';
import { AnoraLogo } from './components/AnoraLogo';
import { AssistantFeatures } from './components/AssistantFeatures';
import { NeuralSearch } from './components/NeuralSearch';
import { NeuralAudio } from './components/NeuralAudio';
import { NeuralGallery } from './components/NeuralGallery';
import { NeuralMenu } from './components/NeuralMenu';
import { OnboardingModal } from './components/OnboardingModal';
import { WelcomeScreen } from './components/WelcomeScreen';
import { PullToRefresh } from './components/PullToRefresh';
import { PersonaHub } from './components/PersonaHub';
import { AppearanceModal } from './components/AppearanceModal';
import { motion, AnimatePresence } from 'motion/react';
import { Palette, Eye, Search, Layers, Menu, Zap, Volume2, Mic2, Sparkles, Send, Plus, Trash2, Settings, User as UserIcon, Grid, Image as ImageIcon, X, Menu as HamburgerMenu, Sun, Moon, Square, RefreshCw, Play, Download } from 'lucide-react';

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
  DIAMOND: { chat: 1000000, image: 1000, video: 500, audio: 500 },
  LIFETIME: { chat: 1000000, image: 1000, video: 500, audio: 500 },
  PLATINUM: { chat: 500000, image: 500, video: 100, audio: 200 },
  PRO: { chat: 100000, image: 100, video: 20, audio: 50 },
  FREE: { chat: 20000, image: 10, video: 0, audio: 0 },
};

import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, orderBy, limit, deleteDoc } from 'firebase/firestore';

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
  const handleUserUpdate = useCallback((updated: User) => {
    setCurrentUser(prev => {
      if (prev && JSON.stringify(prev) === JSON.stringify(updated)) return prev;
      return updated;
    });
  }, []);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const isInitializedRef = useRef<string | null>(null);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Set up real-time listener for the user document
        unsubscribeSnapshot = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data() as User;
            setCurrentUser(prev => {
              if (prev && JSON.stringify(prev) === JSON.stringify(userData)) return prev;
              return userData;
            });
            safeLocalStorage.setItem('anora_session', JSON.stringify(userData));
          } else {
            // Fallback to local storage if Firestore is empty (initial setup)
            const users: User[] = JSON.parse(safeLocalStorage.getItem('anora_users_db') || '[]');
            const found = users.find(u => u.id === firebaseUser.uid || u.email.toLowerCase() === firebaseUser.email?.toLowerCase());
            if (found) {
              const reconciledUser = { ...found, id: firebaseUser.uid };
              setCurrentUser(reconciledUser);
              safeLocalStorage.setItem('anora_session', JSON.stringify(reconciledUser));
              // Sync to Firestore for future
              try {
                const pruned = cleanFirestoreData(pruneUser(reconciledUser));
                setDoc(doc(db, 'users', firebaseUser.uid), pruned).catch(e => 
                  handleFirestoreError(e, OperationType.WRITE, `users/${firebaseUser.uid}`)
                );
              } catch (syncErr) {
                console.error("Sync error", syncErr);
              }
            }
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        });

        setShowWelcome(true);
      } else {
        if (unsubscribeSnapshot) {
          unsubscribeSnapshot();
          unsubscribeSnapshot = null;
        }
        // Fallback to local storage for non-google users if needed
        const saved = safeLocalStorage.getItem('anora_session');
        if (saved) {
          setCurrentUser(JSON.parse(saved));
        } else {
          setCurrentUser(null);
        }
      }
      setIsAuthReady(true);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);
  
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  useEffect(() => {
    const broadcastsRef = collection(db, 'broadcasts');
    const unsubscribe = onSnapshot(query(broadcastsRef, orderBy('date', 'desc'), limit(5)), (snapshot) => {
      const fetched: Broadcast[] = [];
      snapshot.forEach((doc) => {
        fetched.push({ ...doc.data(), id: doc.id } as Broadcast);
      });
      setBroadcasts(fetched);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'broadcasts');
    });

    return () => unsubscribe();
  }, []);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [currentMood, setCurrentMood] = useState<string>('CALM');
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
  const [commandCenterMode, setCommandCenterMode] = useState<'IMAGE' | 'VIDEO' | undefined>(undefined);
  const [isAudioOpen, setIsAudioOpen] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const [isPersonaHubOpen, setIsPersonaHubOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [ownerAvatars, setOwnerAvatars] = useState<Record<string, string>>({});

  useEffect(() => {
    const userTheme = currentUser?.preferences?.theme || 'MINIMAL';
    const userColorMode = currentUser?.preferences?.colorMode || 'WHITE';
    const isDark = userColorMode === 'DARK' || userColorMode === 'AMOLED' || userTheme === 'OBSIDIAN' || userTheme === 'NEURAL_NOISE' || userTheme === 'SINGULARITY' || userTheme === 'NEON_DREAM' || userTheme === 'EMERALD_CITY';
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [currentUser?.preferences?.colorMode, currentUser?.preferences?.theme]);

  useEffect(() => {
    // Fetch global owner-defined persona avatars
    const unsubscribe = onSnapshot(doc(db, 'config', 'persona_avatars'), (docSnap) => {
      if (docSnap.exists()) {
        setOwnerAvatars(docSnap.data().avatars || {});
      }
    }, (error) => {
      console.warn("Global persona avatars unavailable", error);
    });
    return () => unsubscribe();
  }, []);

  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [historyTab, setHistoryTab] = useState<'chats' | 'audios'>('chats');
  const [audioHistory, setAudioHistory] = useState<{ id: string; text: string; raw?: string; timestamp?: string; source?: string }[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const currentVocalizeIdRef = useRef<string | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isHistoryOpen && currentUser?.email) {
      const audioKey = `anora_audio_history_${currentUser.email}`;
      const saved = localStorage.getItem(audioKey);
      if (saved) {
        try {
          setAudioHistory(JSON.parse(saved));
        } catch (e) {
          console.error("Audio history damage", e);
        }
      }
    }
  }, [isHistoryOpen, currentUser?.email]);

  const handlePlayHistoryAudio = async (id: string, base64: string) => {
    if (speakingId === id) { stopCurrentVocalize(); return; }
    stopCurrentVocalize();
    setSpeakingId(id); currentVocalizeIdRef.current = id;
    
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
      let buffer: AudioBuffer;
      if (base64.startsWith('data:audio/')) {
        const res = await fetch(base64);
        const arrayBuffer = await res.arrayBuffer();
        buffer = await audioCtxRef.current.decodeAudioData(arrayBuffer);
      } else {
        buffer = await decodeAudioData(decode(base64), audioCtxRef.current, 24000, 1);
      }
      const source = audioCtxRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtxRef.current.destination);
      activeSourceRef.current = source;
      source.onended = () => { if (currentVocalizeIdRef.current === id) setSpeakingId(null); };
      source.start();
    } catch (e) {
      console.error(e);
      setSpeakingId(null);
    }
  };

  const createWavUrlApp = (base64Pcm: string): string => {
    if (base64Pcm.startsWith('data:audio/')) return base64Pcm;
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

  const handleDownloadHistoryAudio = (item: any) => {
    if (!item.raw) return;
    const wavUrl = createWavUrlApp(item.raw);
    const link = document.createElement('a');
    link.href = wavUrl;
    link.download = `${item.text.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.wav`;
    link.click();
    if (!item.raw.startsWith('data:audio/')) {
      setTimeout(() => URL.revokeObjectURL(wavUrl), 2000);
    }
  };

  const handleDeleteHistoryAudio = (id: string) => {
    if (!currentUser?.email) return;
    const audioKey = `anora_audio_history_${currentUser.email}`;
    const updated = audioHistory.filter(item => item.id !== id);
    setAudioHistory(updated);
    localStorage.setItem(audioKey, JSON.stringify(updated));
  };

  useEffect(() => {
    const handleDbUpdate = () => {
      if (!currentUser) return;
      try {
        const users: User[] = JSON.parse(safeLocalStorage.getItem('anora_users_db') || '[]');
        const updated = users.find(u => u.id === currentUser.id);
        if (updated && (updated.tier !== currentUser.tier || updated.role !== currentUser.role)) {
          handleUserUpdate(updated);
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

  const lastSyncedUserRef = useRef<string>('');
  const lastSyncedMessagesRef = useRef<string>('');

  useEffect(() => {
    if (currentUser) {
      const today = new Date().toDateString();
      if (!currentUser.tokens || currentUser.tokens.lastReset !== today || currentUser.tokens.tier !== currentUser.tier) {
        const limits = currentUser.role === Role.OWNER ? TOKEN_LIMITS.OWNER : (TOKEN_LIMITS[currentUser.tier] || TOKEN_LIMITS.FREE);
        const resetUser = {
          ...currentUser,
          tokens: { ...limits, lastReset: today, tier: currentUser.tier }
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
        // Only sync if the ID matches the authenticated user to prevent permission errors
        if (auth.currentUser && auth.currentUser.uid === currentUser.id) {
          const userStr = JSON.stringify(prunedCurrent);
          if (lastSyncedUserRef.current !== userStr) {
            lastSyncedUserRef.current = userStr;
            const cleanedUser = cleanFirestoreData(prunedCurrent);
            setDoc(doc(db, 'users', currentUser.id), cleanedUser).catch(firestoreErr => {
              console.error("Neural cloud sync failed", firestoreErr);
            });
          }
        }
      } catch (e) {
        console.error("Neural database persistence error", e);
      }
      anoraService.initChat(currentUser);
    }
  }, [currentUser]);

  // handleNewChat and associated useEffect blocks defined below to solve lexical scope warnings

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
    
    if (currentUser) {
      deleteDoc(doc(db, 'users', currentUser.id, 'sessions', id)).catch(err => 
        handleFirestoreError(err, OperationType.DELETE, `users/${currentUser.id}/sessions/${id}`)
      );
    }

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
    setSessions(prev => {
      const updated = prev.map(s => {
        if (s.id === activeSessionId) {
          let title = s.title;
          if (title === 'New Neural Link' || title === 'Neural Link') {
            const firstUserMsg = newMessages.find(m => m.role === 'user');
            if (firstUserMsg) {
              title = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '');
            }
          }
          return { ...s, messages: newMessages, updatedAt: new Date(), title };
        }
        return s;
      });

      // Trigger auto-naming if we have enough messages and title is still generic
      const session = updated.find(s => s.id === activeSessionId);
      if (session && (session.title === 'New Neural Link' || session.title.length < 10) && session.messages.length >= 2) {
        autoRenameSession(session);
      }

      return updated;
    });
  }, [activeSessionId]);

  const autoRenameSession = async (session: ChatSession) => {
    if (!currentUser) return;
    try {
      const title = await anoraService.generateTitle(session.messages);
      if (title) {
        setSessions(prev => prev.map(s => s.id === session.id ? { ...s, title } : s));
      }
    } catch (e) {
      console.error("Neural auto-naming failed", e);
    }
  };

  useEffect(() => {
    if (messages.length > 0 && messages.length % 6 === 0) {
      const summarize = async () => {
        const newMemories = await anoraService.summarizeMemory(messages);
        if (newMemories.length > 0 && currentUser) {
          const existingIds = new Set((currentUser.memory || []).map(m => m.content.toLowerCase()));
          const filtered = newMemories.filter(m => !existingIds.has(m.content.toLowerCase()));
          if (filtered.length > 0) {
            setCurrentUser({
              ...currentUser,
              memory: [...(currentUser.memory || []), ...filtered]
            });
          }
        }
      };
      summarize();
    }
  }, [messages.length]);

  useEffect(() => {
    if (messages.length > 0) {
      updateActiveSessionMessages(messages);
      const lastAnora = [...messages].reverse().find(m => m.role === 'anora');
      if (lastAnora?.affect) setActiveAffect(lastAnora.affect);
    }
  }, [messages, updateActiveSessionMessages]);

  const deductTokens = useCallback((type: keyof Omit<TokenUsage, 'lastReset' | 'tier'>, amount: number) => {
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

  const handleSavePersonaImage = async (pKey: Persona, url: string) => {
    if (!currentUser) return;
    const currentAvatars = currentUser.personaAvatars || {};
    await handleUserUpdate({
      ...currentUser,
      personaAvatars: { ...currentAvatars, [pKey]: url }
    });
  };

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
    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
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
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const sessionPromise = ai.live.connect({
        model: 'gemini-3.1-flash-live-preview',
        callbacks: {
          onopen: () => {
            const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              sessionPromise.then(session => session.sendRealtimeInput({ audio: createBlob(inputData) }));
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

  const appendToAudioHistory = useCallback((id: string, text: string, base64: string, source: 'vocalized' | 'generated' | 'uploaded') => {
    if (!currentUser?.email) return;
    try {
      const audioKey = `anora_audio_history_${currentUser.email}`;
      const saved = localStorage.getItem(audioKey);
      let currentList: any[] = [];
      if (saved) {
        try {
          currentList = JSON.parse(saved);
        } catch (_) {
          currentList = [];
        }
      }
      
      if (currentList.some((item: any) => item.id === id)) return;
      
      const newEntry = {
        id,
        text: text.slice(0, 45) + (text.length > 45 ? '...' : ''),
        raw: base64,
        timestamp: new Date().toISOString(),
        source
      };
      
      let updatedList = [newEntry, ...currentList];
      
      // Limit list size to top 10 items to save quota space
      if (updatedList.length > 10) {
        updatedList = updatedList.slice(0, 10);
      }
      
      while (updatedList.length > 0) {
        try {
          localStorage.setItem(audioKey, JSON.stringify(updatedList));
          break; // Saved successfully!
        } catch (err) {
          if (updatedList.length > 1) {
            updatedList.pop(); // Evict oldest and retry
          } else {
            console.error("Storage quota exhausted completely inside appendToAudioHistory", err);
            localStorage.removeItem(audioKey);
            updatedList = [];
            break;
          }
        }
      }
      
      setAudioHistory(updatedList);
    } catch (e) {
      console.error("Failed to append audio history", e);
    }
  }, [currentUser?.email]);

  const handleVocalize = async (id: string, text: string, affect: NeuralAffect = 'SOVEREIGN') => {
    if (speakingId === id) { stopCurrentVocalize(); return; }
    stopCurrentVocalize();
    setSpeakingId(id); currentVocalizeIdRef.current = id;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
      const base64 = await anoraService.speak(text, currentUser?.preferences.voiceName || 'Kore', affect);
      if (currentVocalizeIdRef.current !== id) return;
      if (!base64) throw new Error("No audio generated");
      
      // Update message with audioUrl to display inline download / controls option in MessageList
      setMessages(prev => prev.map(m => m.id === id ? { ...m, audioUrl: base64 } : m));
      // Store in global audio history list
      appendToAudioHistory(id, text, base64, 'vocalized');

      const buffer = await decodeAudioData(decode(base64), audioCtxRef.current, 24000, 1);
      const source = audioCtxRef.current.createBufferSource();
      source.buffer = buffer; 
      source.playbackRate.value = 1.15; // Increased for higher responsiveness
      source.connect(audioCtxRef.current.destination);
      source.onended = () => { if (currentVocalizeIdRef.current === id) setSpeakingId(null); };
      activeSourceRef.current = source; source.start();
    } catch (err) { 
      console.warn("Neural TTS unavailable, falling back to Web Speech Synthesis:", err);
      if (currentVocalizeIdRef.current !== id) return;
      try {
        if (window.speechSynthesis) {
          const cleanText = text.replace(/[*_`#~]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();
          const u = new SpeechSynthesisUtterance(cleanText);
          const voices = window.speechSynthesis.getVoices();
          
          // Use standard language code or fallback
          u.lang = currentUser?.preferences.language || 'en-US';
          u.rate = 1.15;
          u.onend = () => { if (currentVocalizeIdRef.current === id) setSpeakingId(null); };
          u.onerror = () => { if (currentVocalizeIdRef.current === id) setSpeakingId(null); };
          
          window.speechSynthesis.speak(u);
        } else {
          setSpeakingId(null);
        }
      } catch (speechErr) {
        console.error("Browser speech synthesis failed:", speechErr);
        setSpeakingId(null);
      }
    }
  };

  const handleNewChat = useCallback(() => {
    if (!currentUser) return;
    const initialRaw = INITIAL_MESSAGE(
      currentUser.name, 
      currentUser.role, 
      currentUser.preferences.persona || 'DEFAULT',
      currentUser.preferences.arjunDirectives
    );
    const { content: initContent, affect: initAffect } = anoraService.parseAffect(initialRaw);
    const initialMsgId = generateId('init');
    const initial: Message = { id: initialMsgId, role: 'anora', content: initContent, affect: initAffect, timestamp: new Date() };
    
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

    // Sync to Firestore
    const cleanedSession = cleanFirestoreData(newSession);
    setDoc(doc(db, 'users', currentUser.id, 'sessions', newSession.id), cleanedSession).catch(e => 
      handleFirestoreError(e, OperationType.WRITE, `users/${currentUser.id}/sessions/${newSession.id}`)
    );

    // Run dynamic welcome generation/translation asynchronously
    const persona = currentUser.preferences.persona || 'DEFAULT';
    const lang = currentUser.preferences.language || 'English';
    const personaInstruction = PERSONA_INSTRUCTIONS[persona] || PERSONA_INSTRUCTIONS.DEFAULT;

    anoraService.generateWelcomeMessage(currentUser.name, persona, lang, personaInstruction).then((genMessage) => {
      if (!genMessage) {
        if (currentUser?.preferences.autoRead) {
          handleVocalize(initialMsgId, initContent, initAffect);
        }
        return;
      }
      const { content: cleanGenContent, affect: cleanGenAffect } = anoraService.parseAffect(genMessage);
      
      // Update sessions state
      setSessions(prev => prev.map(s => s.id === newSession.id ? {
        ...s,
        messages: s.messages.map(m => m.id === initialMsgId ? { ...m, content: cleanGenContent, affect: cleanGenAffect } : m)
      } : s));

      // Update local message list state if we're still on this session
      setMessages(prev => {
        const hasMsg = prev.find(m => m.id === initialMsgId);
        if (hasMsg) {
          return prev.map(m => m.id === initialMsgId ? { ...m, content: cleanGenContent, affect: cleanGenAffect } : m);
        }
        return prev;
      });

      // Update in Firestore
      const updatedSession = {
        ...newSession,
        messages: [{ ...initial, content: cleanGenContent, affect: cleanGenAffect }]
      };
      const cleanedUpdatedSession = cleanFirestoreData(updatedSession);
      setDoc(doc(db, 'users', currentUser.id, 'sessions', newSession.id), cleanedUpdatedSession).catch(e => 
         console.warn("Dynamic welcome sync deferred", e)
      );

      // Speak dynamic welcome message
      if (currentUser?.preferences.autoRead) {
        handleVocalize(initialMsgId, cleanGenContent, cleanGenAffect);
      }
    }).catch((e) => {
      console.warn("Dynamic neural welcome failed, fallback to default", e);
      if (currentUser?.preferences.autoRead) {
        handleVocalize(initialMsgId, initContent, initAffect);
      }
    });

  }, [currentUser, handleVocalize]);

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
    let unsubscribeSessions: (() => void) | null = null;

    if (currentUser) {
      const sessionsRef = collection(db, 'users', currentUser.id, 'sessions');
      unsubscribeSessions = onSnapshot(query(sessionsRef, orderBy('updatedAt', 'desc')), (snapshot) => {
        const fetchedSessions: ChatSession[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          fetchedSessions.push({
            ...data,
            id: doc.id,
            updatedAt: data.updatedAt?.toDate() || new Date(),
            messages: (data.messages || []).map((m: any) => ({
              ...m,
              timestamp: m.timestamp?.toDate() || new Date()
            }))
          } as ChatSession);
        });
        
        if (fetchedSessions.length > 0) {
          setSessions(prev => {
            if (JSON.stringify(prev) === JSON.stringify(fetchedSessions)) return prev;
            return fetchedSessions;
          });
          // Auto-select first session if none active
          if (!activeSessionId) {
            setActiveSessionId(fetchedSessions[0].id);
            setMessages(fetchedSessions[0].messages);
          }
        } else {
          // If no sessions in Firestore, check local storage or start new
          const sessionsKey = `anora_sessions_${currentUser.email}`;
          const saved = safeLocalStorage.getItem(sessionsKey);
          if (saved) {
            const localSessions = JSON.parse(saved);
            setSessions(localSessions);
            // Sync local to Firestore
            localSessions.forEach((s: ChatSession) => {
              const cleanedSession = cleanFirestoreData(s);
              setDoc(doc(db, 'users', currentUser.id, 'sessions', s.id), cleanedSession).catch(e => 
                handleFirestoreError(e, OperationType.WRITE, `users/${currentUser.id}/sessions/${s.id}`)
              );
            });
          } else {
            handleNewChat();
          }
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${currentUser.id}/sessions`);
      });
    }

    return () => {
      if (unsubscribeSessions) unsubscribeSessions();
    };
  }, [currentUser?.id]);

  // Sync active session messages to Firestore
  useEffect(() => {
    if (currentUser && activeSessionId && messages.length > 0) {
      const session = sessions.find(s => s.id === activeSessionId);
      if (session) {
        const syncData = cleanFirestoreData({
          ...session,
          messages,
          updatedAt: new Date()
        });
        const syncStr = JSON.stringify({ id: session.id, messages: messages }); // Minimal check to avoid updatedAt loops
        if (lastSyncedMessagesRef.current !== syncStr) {
          lastSyncedMessagesRef.current = syncStr;
          setDoc(doc(db, 'users', currentUser.id, 'sessions', activeSessionId), syncData, { merge: true }).catch(e => 
            handleFirestoreError(e, OperationType.WRITE, `users/${currentUser.id}/sessions/${activeSessionId}`)
          );
        }
      }
    }
  }, [messages, activeSessionId, currentUser?.id]);

  const prevPersonaRef = useRef<Persona | undefined>(currentUser?.preferences.persona);

  useEffect(() => {
    if (currentUser?.preferences.persona && currentUser.preferences.persona !== prevPersonaRef.current) {
      handleNewChat();
      prevPersonaRef.current = currentUser.preferences.persona;
    }
  }, [currentUser?.preferences.persona, handleNewChat]);

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

    // Detect mood
    anoraService.detectMood(val).then(mood => setCurrentMood(mood));

    const assistantId = generateId('anora');
    const assistantMsg: Message = { id: assistantId, role: 'anora', content: '', timestamp: new Date() };
    setMessages(prev => [...prev, assistantMsg]);
    
    try {
      let fullContent = "";
      let finalAffect: NeuralAffect = 'SOVEREIGN';
      let hasVocalizedFirstSentence = false;

      const stream = anoraService.sendMessageStream(userMsg.content, userMsg.images || [], messages.slice(-15));
      
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
          finalAffect = chunk.affect as NeuralAffect;
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullContent, affect: finalAffect } : m));
          
          // Speed up vocalization: start as soon as we have a full sentence
          if (currentUser?.preferences.autoRead && !hasVocalizedFirstSentence && (fullContent.includes('.') || fullContent.includes('!') || fullContent.includes('?'))) {
             handleVocalize(assistantId, fullContent, finalAffect);
             hasVocalizedFirstSentence = true;
          }
        }
      }
    } catch (err: any) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Stream aborted by user
      } else {
        console.error("Neural Stream Exception:", err);
        const errMsg = err?.message?.toLowerCase() || "";
        let errorMsg = "Neural synapse temporarily interrupted. Re-synchronizing link...";
        
        if (!navigator.onLine) {
          errorMsg = "Offline sovereign state. Reconnect network to continue live neural intelligence.";
        } else if (errMsg.includes('quota') || errMsg.includes('429') || errMsg.includes('resource_exhausted')) {
          errorMsg = "Neural cognitive bandwidth is momentarily saturated. Please pause 5 seconds and resend.";
        } else if (errMsg.includes('blocked') || errMsg.includes('safety')) {
          errorMsg = "Request was filtered by sovereign safety protocol.";
        } else if (err?.message) {
          errorMsg = `Neural status: ${err.message}`;
        }
        
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: errorMsg } : m));
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

  const isOwner = currentUser?.role === Role.OWNER || currentUser?.email === OWNER_EMAIL;
  const isPremium = currentUser?.tier !== SubscriptionTier.FREE || isOwner;

  const effectivePersonaAvatars = useMemo(() => {
    // Free users see owner defined images, premium users can override with their own
    if (!currentUser || !isPremium) return ownerAvatars;
    return {
      ...ownerAvatars,
      ...(currentUser.personaAvatars || {})
    };
  }, [ownerAvatars, currentUser?.personaAvatars, isPremium]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <AnoraLogo size={80} color="#000" showName={false} animate={true} />
      </div>
    );
  }

  const handleRefresh = async () => {
    // Simulate a refresh delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    window.location.reload();
  };

  if (!currentUser) return <AuthScreen onLogin={setCurrentUser} />;

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

  const getColorModeClass = () => {
    switch(colorMode) {
      case 'DARK': return 'bg-black text-white';
      case 'BRIGHT': return 'bg-white text-zinc-900 border-zinc-300';
      case 'AMOLED': return 'bg-black text-white shadow-inner';
      case 'DIM': return 'bg-zinc-100 text-zinc-800';
      case 'COLOURFUL': return 'bg-gradient-to-br from-indigo-50/50 via-purple-50/50 to-pink-50/50 text-indigo-950 backdrop-blur-3xl';
      case 'RAINBOW': return 'bg-white text-zinc-900 rainbow-mode';
      default: return 'bg-white text-zinc-900';
    }
  };

  const getHeaderClass = () => {
    if (colorMode === 'RAINBOW') return 'bg-white/80 border-transparent';
    if (colorMode === 'DARK' || colorMode === 'AMOLED') return 'bg-black/40 border-white/5';
    if (colorMode === 'BRIGHT') return 'bg-white border-zinc-200';
    if (colorMode === 'DIM') return 'bg-zinc-200/50 border-zinc-300';
    if (colorMode === 'COLOURFUL') return 'bg-white/40 border-indigo-100';
    return 'bg-white/80 border-zinc-100';
  };

  const getFooterClass = () => {
    if (colorMode === 'RAINBOW') return 'bg-white/90 border-transparent';
    if (colorMode === 'DARK' || colorMode === 'AMOLED') return 'bg-black/60 border-white/5';
    if (colorMode === 'BRIGHT') return 'bg-white border-zinc-200 shadow-2xl';
    if (colorMode === 'DIM') return 'bg-zinc-200/60 border-zinc-300';
    if (colorMode === 'COLOURFUL') return 'bg-white/40 border-indigo-100';
    return 'bg-white/90 border-zinc-100';
  };

  const getInputClass = () => {
    if (colorMode === 'RAINBOW') return 'bg-white border-transparent text-black shadow-lg';
    if (colorMode === 'DARK' || colorMode === 'AMOLED') return 'bg-white/5 border-white/10 text-white focus:bg-white/10 focus:border-white/20';
    if (colorMode === 'BRIGHT') return 'bg-white border-zinc-300 text-black focus:border-zinc-500';
    if (colorMode === 'DIM') return 'bg-white/50 border-zinc-300 text-zinc-900 focus:bg-white';
    if (colorMode === 'COLOURFUL') return 'bg-white/60 border-indigo-200 text-indigo-900 focus:bg-white focus:border-indigo-400';
    return 'bg-zinc-50 border-zinc-100 text-zinc-900 focus:bg-white focus:border-zinc-300';
  };

  return (
    <>
    <div className={`flex flex-col h-[100dvh] transition-all duration-700 overflow-hidden ${getThemeClass()} ${getColorModeClass()} ${currentUser.preferences.font === 'OUTFIT' ? 'font-outfit' : 'font-inter'} relative ${isOwner ? 'owner-scanline' : ''}`}>
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
      <CommandCenter 
        user={currentUser} 
        isOpen={isCommandCenterOpen} 
        onDeductToken={deductTokens} 
        onClose={() => {
          setIsCommandCenterOpen(false);
          setCommandCenterMode(undefined);
        }} 
        initialMode={commandCenterMode}
      />
      <ProfileModal 
        user={currentUser} 
        isOpen={isProfileOpen} 
        initialSection={profileSection as any} 
        onClose={() => { setIsProfileOpen(false); setProfileSection(undefined); }} 
        onUpdate={handleUserUpdate} 
        onLogout={handleLogout}
        onOpenHubWithTab={(tab) => { setHubTab(tab); setIsHubOpen(true); setIsProfileOpen(false); }}
        ownerAvatars={ownerAvatars}
      />
      {!currentUser.preferences.onboardingComplete && (
        <OnboardingModal user={currentUser} onComplete={handleUserUpdate} />
      )}
      <AssistantFeatures 
        user={currentUser} 
        onUpdate={handleUserUpdate} 
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

      
      {/* Mood Indicator */}
      <div className="fixed top-24 left-6 z-[100] flex flex-col gap-2">
      </div>
      <NeuralAudio user={currentUser} isOpen={isAudioOpen} onClose={() => setIsAudioOpen(false)} />
      <NeuralGallery user={currentUser} isOpen={isGalleryOpen} onClose={() => setIsGalleryOpen(false)} />
      {isHistoryOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={() => setIsHistoryOpen(false)}></div>
          <div className={`relative w-full max-w-md max-h-[80vh] overflow-hidden rounded-3xl border shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 ${
            colorMode === 'WHITE' ? 'bg-white border-zinc-250 text-zinc-900' : 'bg-zinc-950 border-white/5 text-zinc-100'
          }`}>
            <div className="p-5 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between bg-zinc-50/20 dark:bg-black/20">
               <div>
                 <h2 className="text-sm font-black uppercase tracking-tight">Synaptic Records</h2>
                 <p className="text-[7px] text-zinc-400 font-extrabold uppercase tracking-widest mt-0.5">Sovereign Link History</p>
               </div>
               <div className="flex items-center gap-1">
                 <button 
                   type="button"
                   onClick={async () => {
                     for (const s of sessions) {
                       if (s.messages.length >= 2) await autoRenameSession(s);
                     }
                   }}
                   className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                   title="Auto calibrate labels"
                 >
                   <RefreshCw className="w-3.5 h-3.5" />
                 </button>
                 <button type="button" onClick={() => setIsHistoryOpen(false)} className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                   <X className="w-4.5 h-4.5" />
                 </button>
               </div>
            </div>

            <div className="flex border-b border-zinc-100 dark:border-white/5 p-1 bg-zinc-50/50 dark:bg-black/10">
              <button
                type="button"
                onClick={() => setHistoryTab('chats')}
                className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${
                  historyTab === 'chats'
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200'
                }`}
              >
                Chat Links
              </button>
              <button
                type="button"
                onClick={() => setHistoryTab('audios')}
                className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${
                  historyTab === 'audios'
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200'
                }`}
              >
                Voice Vault
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5 no-scrollbar">
              {historyTab === 'chats' ? (
                sessions.filter((s, idx, self) => self.findIndex(t => t.id === s.id) === idx).length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">No Chat Links Installed</p>
                  </div>
                ) : (
                  sessions.filter((s, idx, self) => self.findIndex(t => t.id === s.id) === idx).map(s => {
                    const isActive = activeSessionId === s.id;
                    return (
                      <div 
                        key={s.id} 
                        onClick={() => switchSession(s.id)}
                        className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                          isActive 
                            ? 'border-zinc-900 dark:border-white bg-zinc-100 dark:bg-white/5 shadow-sm' 
                            : 'bg-zinc-50/40 border-zinc-100 dark:bg-white/10 hover:border-zinc-350'
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="text-[9px] font-black uppercase tracking-tight truncate text-zinc-850 dark:text-zinc-100">{s.title}</p>
                          <p className="text-[7px] font-bold uppercase tracking-widest mt-0.5 text-zinc-400">{s.updatedAt.toLocaleDateString()} • {s.messages.length} signals</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); autoRenameSession(s); }} 
                            className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all active:scale-90"
                            title="Calibrate title"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => deleteSession(s.id, e)} 
                            className="p-1.5 text-zinc-400 hover:text-red-500 transition-all active:scale-90"
                            title="Purge link"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )
              ) : (
                audioHistory.length === 0 ? (
                  <div className="py-8 text-center animate-in fade-in duration-150">
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Audio History Clean</p>
                    <p className="text-[7px] text-zinc-500 font-extrabold uppercase mt-1 tracking-wider">Use vocalization or sound synthesis</p>
                  </div>
                ) : (
                  audioHistory.map((item, idx) => {
                    const isCurrentPlaying = speakingId === item.id;
                    return (
                      <div 
                        key={`${item.id}-${idx}`}
                        className="p-3.5 bg-zinc-50/40 dark:bg-white/5 border border-zinc-100/60 dark:border-white/5 rounded-xl flex items-center justify-between gap-4 animate-in fade-in duration-150"
                      >
                        <div className="flex items-center gap-3 overflow-hidden min-w-0">
                          <button 
                            type="button"
                            onClick={() => item.raw && handlePlayHistoryAudio(item.id, item.raw)} 
                            className={`p-2 rounded-xl border flex items-center justify-center transition-all shrink-0 ${
                              isCurrentPlaying 
                                ? 'bg-amber-500 text-black border-amber-500 animate-pulse' 
                                : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border-zinc-100 dark:border-white/10 hover:scale-105'
                            }`}
                          >
                            {isCurrentPlaying ? <Volume2 className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                          </button>
                          <div className="min-w-0">
                            <span className="text-[9px] font-black uppercase tracking-tight text-zinc-800 dark:text-zinc-200 block truncate">{item.text}</span>
                            <span className="text-[7px] font-extrabold text-zinc-400 uppercase tracking-widest block mt-0.5">
                              {item.source ? `${item.source.toUpperCase()}` : 'WAV'} • {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : 'RECORD'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 shrink-0">
                          <button 
                            type="button"
                            onClick={() => handleDownloadHistoryAudio(item)}
                            title="Download WAV audio"
                            className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors active:scale-90"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleDeleteHistoryAudio(item.id)}
                            title="Purge sound file"
                            className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )
              )}
            </div>
            
            <div className="p-4 border-t border-zinc-100 dark:border-white/5 bg-zinc-50/10 dark:bg-black/10">
               <button 
                 type="button"
                 onClick={handleNewChat} 
                 className={`w-full py-3 rounded-2xl flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all active:scale-[0.98] shadow-md ${
                   colorMode === 'WHITE' ? 'bg-zinc-900 text-white hover:bg-black' : 'bg-white text-black hover:bg-zinc-200'
                 }`}
               >
                 <Plus className="w-3.5 h-3.5 text-inherit" />
                 Initialize Link
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
        onOpenArtisan={() => {
          setCommandCenterMode('IMAGE');
          setIsCommandCenterOpen(true);
        }}
        onOpenVision={() => {}} 
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenGallery={() => setIsGalleryOpen(true)}
        onOpenAudio={() => setIsAudioOpen(true)}
        onOpenWorkspace={() => {}}
        onOpenHub={() => { setHubTab(undefined); setIsHubOpen(true); }}
        onOpenHubWithTab={(tab) => { setHubTab(tab); setIsHubOpen(true); }}
        onOpenCommandCenter={() => setIsCommandCenterOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onLogout={handleLogout}
        onNewChat={handleNewChat}
        onOpenAppearance={() => setIsAppearanceOpen(true)}
        onOpenPersonaHub={() => setIsPersonaHubOpen(true)}
      />
      <AppearanceModal 
        isOpen={isAppearanceOpen} 
        onClose={() => setIsAppearanceOpen(false)} 
        user={currentUser} 
        onUpdate={handleUserUpdate} 
      />
      <PersonaHub 
        isOpen={isPersonaHubOpen} 
        onClose={() => setIsPersonaHubOpen(false)} 
        user={currentUser} 
        onUpdate={handleUserUpdate} 
        onSavePersonaImage={handleSavePersonaImage}
        ownerAvatars={ownerAvatars}
      />
      
      <header className={`flex items-center justify-between px-4 sm:px-8 lg:px-12 pt-[calc(var(--sat)+1rem)] sm:pt-[calc(var(--sat)+1.5rem)] pb-4 sm:pb-6 border-b transition-all duration-700 ${getHeaderClass()} backdrop-blur-3xl shrink-0 sticky top-0 z-[100]`}>
        <div className="flex items-center gap-3 sm:gap-4">
          <AnoraLogo size={32} className="sm:w-[42px] sm:h-[42px]" color={accent} showName={false} />
          <div className="flex flex-col">
             <h1 className="text-sm sm:text-base font-bold font-outfit tracking-[0.25em] text-zinc-900 dark:text-zinc-100 uppercase">
               {isOwner ? 'Sovereign Anora' : 'Anora'}
             </h1>
             <p className="text-[7px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.3em] mt-0.5">
               {isOwner ? 'Absolute Authority' : 'Intelligence System'}
             </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
             {isVoiceMode && (
               <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full animate-pulse">
                 <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                 <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">Listening...</span>
               </div>
             )}
             <button onClick={() => setIsMenuOpen(true)} className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border transition-all active:scale-90 shadow-sm ${getInputClass()}`}>
                <HamburgerMenu className="w-5 h-5 sm:w-6 sm:h-6" />
             </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col relative overflow-hidden">
        {broadcasts.length > 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-2xl animate-in slide-in-from-top-4 duration-500">
            <div className="p-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-100 dark:border-white/10 rounded-3xl shadow-xl flex items-center gap-4">
               <div className={`p-2 rounded-xl ${
                 broadcasts[0].type === 'ALERT' ? 'bg-red-500' : 
                 broadcasts[0].type === 'MAINTENANCE' ? 'bg-amber-500' :
                 broadcasts[0].type === 'FEATURE' ? 'bg-blue-500' :
                 'bg-zinc-900 dark:bg-white'
               } text-white dark:text-black`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
               </div>
               <div className="flex-1 min-w-0">
                  <h4 className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-tight truncate">{broadcasts[0].title}</h4>
                  <p className="text-[9px] text-zinc-500 dark:text-zinc-400 truncate">{broadcasts[0].content}</p>
               </div>
               <button 
                 onClick={() => setBroadcasts(prev => prev.slice(1))}
                 className="p-2 text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
               >
                 <X className="w-4 h-4" />
               </button>
            </div>
          </div>
        )}
        <PullToRefresh 
          onRefresh={handleRefresh} 
          className="flex-1"
          persona={currentUser.preferences.persona} 
          personaAvatars={effectivePersonaAvatars}
          onViewImage={setViewingImage}
        >
          <MessageList 
            messages={messages} 
            isThinking={isThinking} 
            isStreaming={isStreaming}
            ownerName={currentUser.name} 
            isOwnerView={isOwner} 
            userTier={currentUser.tier} 
            isVerified={currentUser.isVerified || isOwner}
            onVocalize={handleVocalize} 
            onDeleteMessage={handleDeleteMessage} 
            onSaveToMemory={handleSaveToMemory} 
            onSaveToReminders={handleSaveToReminders} 
            onRegenerate={handleRegenerate}
            speakingId={speakingId}
            currentMood={currentMood}
            persona={currentUser.preferences.persona}
            personaAvatars={effectivePersonaAvatars}
            onViewImage={setViewingImage}
          />
        </PullToRefresh>
      </main>

      <footer className={`px-4 sm:px-8 lg:px-12 pb-[calc(var(--sab)+1.5rem)] sm:pb-[calc(var(--sab)+2.5rem)] pt-4 sm:pt-6 border-t shrink-0 backdrop-blur-3xl transition-all duration-700 ${getFooterClass()}`}>
        <div className="max-w-4xl mx-auto space-y-4">
          {pendingImages.length > 0 && (
            <div className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar py-2 px-1 animate-in slide-in-from-bottom-4 duration-500">
               {pendingImages.map((img, idx) => (
                 <div key={idx} className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-[1.2rem] sm:rounded-[1.5rem] overflow-hidden border shadow-xl shrink-0 group hover:scale-105 transition-transform ${colorMode === 'WHITE' || colorMode === 'BRIGHT' || colorMode === 'DIM' || colorMode === 'COLOURFUL' ? 'border-zinc-200' : 'border-white/10'}`}>
                    <img src={img} className="w-full h-full object-cover" />
                    <button onClick={() => setPendingImages(prev => prev.filter((_, i) => i !== idx))} className="absolute top-1 right-1 p-1 bg-black/70 text-white rounded-full backdrop-blur-md opacity-100 transition-opacity shadow-lg">
                      <X className="w-2.5 h-2.5" />
                    </button>
                 </div>
               ))}
            </div>
          )}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* +icon in left to upload images */}
            <button 
              type="button"
              onClick={handleFileSelect} 
              className={`p-3.5 sm:p-4 rounded-[1.2rem] sm:rounded-[1.5rem] border transition-all active:scale-95 shadow-sm hover:opacity-80 flex items-center justify-center shrink-0 ${getInputClass()}`}
              title="Add visual resources"
            >
              <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
              <input 
                type="file" 
                ref={fileInputRef} 
                hidden 
                multiple 
                accept="image/*" 
                onChange={e => { 
                  const files = e.currentTarget.files; 
                  if (files) (Array.from(files) as File[]).forEach(f => { 
                    const reader = new FileReader(); 
                    reader.onload = ev => {
                      const url = ev.target?.result as string;
                      setPendingImages(p => [...p, url]); 
                      anoraService.saveToGallery(url);
                    };
                    reader.readAsDataURL(f); 
                  }); 
                  e.target.value = '';
                }} 
              />
            </button>

            {/* A bar to type message */}
            <div className="flex-1 relative flex items-center group">
              <input 
                type="text" 
                value={inputValue} 
                onChange={e => setInputValue(e.target.value)} 
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (isStreaming || isThinking) {
                      handleStopResponse();
                    } else {
                      handleSend(inputValue);
                    }
                  }
                }}
                placeholder={isOwner ? "Sovereign Command..." : "Neural Sync..."} 
                className={`w-full border rounded-[1.5rem] sm:rounded-[2rem] pl-6 sm:pl-8 pr-14 sm:pr-16 py-3 sm:py-4.5 text-sm sm:text-[15px] outline-none transition-all shadow-sm ${getInputClass()}`} 
              />
              
              {/* In bar right side show send message icon or pause chat icon */}
              <div className="absolute right-2 sm:right-2.5 flex items-center">
                 {isStreaming || isThinking ? (
                   <button 
                     type="button"
                     onClick={handleStopResponse} 
                     className="p-2 sm:p-3 rounded-xl sm:rounded-[1.2rem] transition-all active:scale-90 bg-red-600 hover:bg-red-500 text-white shadow-md hover:shadow-lg flex items-center justify-center"
                     title="Pause response"
                   >
                     <Square className="w-3.5 h-3.5 sm:w-4 h-4 fill-white text-white" />
                   </button>
                 ) : (
                   <button 
                     type="button"
                     onClick={() => handleSend(inputValue)} 
                     className={`p-2 sm:p-3 rounded-xl sm:rounded-[1.2rem] transition-all active:scale-90 ${isOwner ? 'bg-amber-500 hover:bg-amber-400 text-black' : (colorMode === 'DARK' || colorMode === 'AMOLED' || theme === 'OBSIDIAN' || theme === 'NEURAL_NOISE' || theme === 'SINGULARITY' || theme === 'NEON_DREAM' || theme === 'EMERALD_CITY') ? 'bg-white hover:bg-zinc-100 text-zinc-950' : 'bg-zinc-900 hover:bg-zinc-800 text-white'} shadow-md hover:shadow-lg flex items-center justify-center`}
                     title="Send Sync"
                   >
                     <Send className="w-3.5 h-3.5 sm:w-4 h-4" />
                   </button>
                 )}
              </div>
            </div>

            {/* Voice listening icon to talk to Anora */}
            <button 
              type="button"
              onClick={toggleVoiceMode} 
              className={`p-3.5 sm:p-4 rounded-[1.2rem] sm:rounded-[1.5rem] border transition-all active:scale-95 shadow-sm hover:opacity-80 flex items-center justify-center shrink-0 ${
                isVoiceMode 
                  ? 'bg-red-500 text-white border-red-500 animate-pulse' 
                  : getInputClass()
              }`}
              title="Talk to Anora"
            >
              <Mic2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>
      </footer>
    </div>
    <AnimatePresence>
      {viewingImage && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setViewingImage(null)}
          className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-4 sm:p-8 cursor-zoom-out"
        >
          <motion.button 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            className="absolute top-6 right-6 p-4 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all z-10"
            onClick={() => setViewingImage(null)}
          >
            <X className="w-6 h-6" />
          </motion.button>
          <motion.img 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            src={viewingImage} 
            className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="mt-6 flex gap-4" onClick={(e) => e.stopPropagation()}>
            <button 
              type="button"
              onClick={() => {
                const link = document.createElement('a');
                link.href = viewingImage;
                link.download = `anora_generation_${Date.now()}.png`;
                link.click();
              }}
              className="px-6 py-3 bg-white text-zinc-900 rounded-xl font-black uppercase text-[9px] tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Asset
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
};

export default () => (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
