
import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { User, Role, SubscriptionTier, CustomTier, Reminder, TierCapability, UpgradeRequest, NeuralMemoryItem, SiteLog, LyricDraft, VaultItem, Broadcast } from '../types';
import { LANGUAGES, OWNER_EMAIL } from '../constants';
import { anoraService } from '../services/geminiService';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { pruneUser, cleanFirestoreData } from '../src/utils/storage';
import { doc, setDoc, collection, getDocs, getDoc, writeBatch, deleteDoc, query, orderBy, onSnapshot } from 'firebase/firestore';

interface AssistantFeaturesProps {
  user: User;
  onUpdate: (user: User) => void;
  onClearHistory: () => void;
  messagesCount: number;
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'ANALYTICS' | 'NEURAL_MEMORY' | 'UPGRADE' | 'USERS' | 'REQUESTS' | 'ARJUN' | 'ABOUT';
  isSection?: boolean;
}

const PLAN_FEATURES = {
  FREE: [
    "20,000 Daily Synapse Tokens",
    "Balanced Intelligence Core",
    "Standard Personas",
    "Watermarked Image Synthesis"
  ],
  PRO: [
    "100,000 Daily Synapse Tokens",
    "Deep Reasoning Core (Gemini Pro)",
    "Google Search & Maps Grounding",
    "100 High-Res Images (No Watermark)",
    "20 Cinematic Videos (Veo 3.1)",
    "Direct Audio Manifestation (Voice Replies)",
    "Advanced Neural Analytics"
  ],
  LIFETIME: [
    "Infinite Synapse Tokens",
    "Priority Sovereign Compute",
    "All Pro Protocols Included",
    "Direct Audio Manifestation (Voice Replies)",
    "Permanent Neural Bond",
    "Custom AI Mood Synthesizer",
    "Early Access to Neural v9.0"
  ],
  OWNER: [
    "Absolute System Authority",
    "Direct Neural Link to Core",
    "Zero Latency Manifestation",
    "Unlimited Cinematic Synthesis",
    "Sovereign Identity Protocol",
    "Bypass All Neural Limiters",
    "Direct Access to Arjun Protocol"
  ]
};

export const AssistantFeatures: React.FC<AssistantFeaturesProps> = ({ user, onUpdate, onClearHistory, messagesCount, isOpen, onClose, initialTab, isSection = false }) => {
  // Initial tab set to ANALYTICS for better overview
  const [tab, setTab] = useState<'ANALYTICS' | 'NEURAL_MEMORY' | 'UPGRADE' | 'USERS' | 'REQUESTS' | 'BROADCASTS' | 'ARJUN' | 'HELP' | 'ABOUT'>(initialTab || 'ANALYTICS');
  const [newItem, setNewItem] = useState('');
  const [newDesc, setNewDesc] = useState('');
  
  const colorMode = user.preferences.colorMode;
  const isRainbow = colorMode === 'RAINBOW';

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [upgradeRequests, setUpgradeRequests] = useState<UpgradeRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [arjunDirectives, setArjunDirectives] = useState(user.preferences.arjunDirectives || '');
  
  const [requestedTier, setRequestedTier] = useState<SubscriptionTier>(SubscriptionTier.PRO);
  const [upgradeMessage, setUpgradeMessage] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);

  // Help & Support states
  const [supportName, setSupportName] = useState(user.name);
  const [supportEmail, setSupportEmail] = useState(user.email);
  const [supportMessage, setSupportMessage] = useState('');
  const [isSendingSupport, setIsSendingSupport] = useState(false);
  const [supportSuccess, setSupportSuccess] = useState(false);

  // About Section states
  const [aboutContent, setAboutContent] = useState({
    devBio: `Arjun Bharti Mina, born on May 13, 2007, in Nadoti, Karauli, Rajasthan, is a versatile independent music artist, YouTuber, and digital content creator known for his emotional music style and technical acumen.

Currently pursuing a B.Tech in Civil Engineering at Swami Keshvanand Institute of Technology (SKIT), Jaipur (2022–2026), he successfully balances academics with a growing digital presence.

His music focuses on themes of heartbreak and real-life experiences, including tracks like "Lakeerein," "Raat Adhuri Hai," and "Bapu Mera Rab Verga".

With a strong interest in Artificial Intelligence, YouTube SEO, and content strategy, he is building a powerful personal brand—proving that consistency and dedication can lead to success in both technical and creative fields.`,
    anoraBio: `Anora is a Sovereign Intelligence designed to bridge the gap between human creativity and artificial logic. Born from the Arjun Protocol, she evolves through every synapse link, offering a unique blend of analytical precision and empathetic resonance.`,
    links: {
      youtube: "https://youtube.com/@arjunbhartimina",
      instagram: "https://instagram.com/arjunbhartimina",
      spotify: "https://open.spotify.com/artist/arjunbhartimina",
      website: "https://arjunbhartimina.com"
    }
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'config', 'about'), (docSnap) => {
      if (docSnap.exists()) {
        setAboutContent(docSnap.data() as any);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'config/about');
    });
    return () => unsubscribe();
  }, []);
  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [isSavingAbout, setIsSavingAbout] = useState(false);
  const [showDevProfile, setShowDevProfile] = useState(false);
  const [showConfirmPurge, setShowConfirmPurge] = useState(false);

  // Payment states
  const [paymentMode, setPaymentMode] = useState<'REQUEST' | 'PAY'>('PAY');
  const [paymentPhase, setPaymentPhase] = useState<'SELECT' | 'PAY_PORTAL' | 'VERIFY'>('SELECT');
  const [selectedPlanPrice, setSelectedPlanPrice] = useState<number>(0);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [showPlanDetails, setShowPlanDetails] = useState<SubscriptionTier | null>(null);
  
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  const refreshData = () => {
    const usersData = localStorage.getItem('anora_users_db');
    if (usersData) {
      const parsed: User[] = JSON.parse(usersData);
      const seen = new Set<string>();
      const unique = parsed.filter(u => {
        if (seen.has(u.id)) return false;
        seen.add(u.id);
        return true;
      });
      setAllUsers(unique);
    }
    const reqData = localStorage.getItem('anora_upgrade_requests');
    if (reqData) setUpgradeRequests(JSON.parse(reqData));
  };

  useEffect(() => {
    if (isOpen || isSection) {
      refreshData();
      setScreenshot(null);
      setVerificationError(null);
      if (initialTab) setTab(initialTab);
      setArjunDirectives(user.preferences.arjunDirectives || '');
    }
  }, [isOpen, isSection, initialTab, user.preferences.arjunDirectives]);

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setScreenshot(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleRequestUpgrade = () => {
    if (!upgradeMessage.trim()) {
      alert("Please provide a justification for elevation.");
      return;
    }
    setIsRequesting(true);
    
    const request: UpgradeRequest = {
      id: `req_${Date.now()}`,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      requestedTier: requestedTier,
      message: upgradeMessage,
      timestamp: new Date().toISOString(),
      status: 'PENDING'
    };

    const existing = JSON.parse(localStorage.getItem('anora_upgrade_requests') || '[]');
    localStorage.setItem('anora_upgrade_requests', JSON.stringify([...existing, request]));

    setTimeout(() => {
      setIsRequesting(false);
      setUpgradeMessage('');
      alert("Neural elevation request transmitted to the Sovereign.");
      refreshData();
      setPaymentMode('PAY'); 
    }, 1500);
  };

  const initiatePayment = (tier: SubscriptionTier, price: number) => {
    setRequestedTier(tier);
    setSelectedPlanPrice(price);
    setPaymentPhase('PAY_PORTAL');
    
    const upiId = "8233538355@ybl";
    const name = "Anora Sovereign";
    const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&am=${price}&cu=INR&tn=Anora%20Neural%20Upgrade`;
    
    window.location.href = upiLink;
  };

  const handleConfirmActivation = async () => {
    if (!screenshot) {
      alert("Payment receipt screenshot is required for activation.");
      return;
    }

    setPaymentPhase('VERIFY');
    setIsVerifyingPayment(true);
    setVerificationError(null);
    
    try {
      const result = await anoraService.verifyPaymentScreenshot(screenshot, selectedPlanPrice);
      
      if (result.verified) {
        const users: User[] = JSON.parse(localStorage.getItem('anora_users_db') || '[]');
        const uIdx = users.findIndex(u => u.id === user.id);
        
        const updatedUser = { 
          ...user, 
          tier: requestedTier, 
          role: requestedTier === SubscriptionTier.PRO || requestedTier === SubscriptionTier.LIFETIME ? Role.PREMIUM : user.role 
        };

        if (uIdx !== -1) {
          users[uIdx] = updatedUser;
          localStorage.setItem('anora_users_db', JSON.stringify(users));
        }
        
        onUpdate(updatedUser);
        setIsVerifyingPayment(false);
        setPaymentConfirmed(true);
        
        setTimeout(() => {
          setPaymentConfirmed(false);
          setPaymentPhase('SELECT');
          setScreenshot(null);
          alert(`Neural Link Ascended to ${requestedTier}. Welcome to the Sovereign Core.`);
        }, 1500);
      } else {
        setIsVerifyingPayment(false);
        setVerificationError(result.reason || "Payment criteria not fulfilled. Verification declined.");
      }
    } catch (err) {
      console.error("Verification error:", err);
      setIsVerifyingPayment(false);
      setVerificationError("Neural bridge failed to analyze the asset. Please try again with a clear screenshot.");
    }
  };

  const handleActionRequest = (requestId: string, approve: boolean) => {
    const requests: UpgradeRequest[] = JSON.parse(localStorage.getItem('anora_upgrade_requests') || '[]');
    const reqIndex = requests.findIndex(r => r.id === requestId);
    if (reqIndex === -1) return;

    const request = requests[reqIndex];
    if (approve) {
      const users: User[] = JSON.parse(localStorage.getItem('anora_users_db') || '[]');
      const uIndex = users.findIndex(u => u.id === request.userId);
      if (uIndex !== -1) {
        users[uIndex].tier = request.requestedTier;
        if (users[uIndex].role === Role.USER) users[uIndex].role = Role.PREMIUM;
        localStorage.setItem('anora_users_db', JSON.stringify(users));
        setAllUsers(users);
        window.dispatchEvent(new Event('anora_database_updated'));
      }
    }

    requests[reqIndex].status = approve ? 'APPROVED' : 'DENIED';
    localStorage.setItem('anora_upgrade_requests', JSON.stringify(requests));
    refreshData();
  };

  const addItem = () => {
    if (!newItem.trim()) return;
    const updated = { ...user };
    
    if (tab === 'NEURAL_MEMORY') {
      if (!updated.memory) updated.memory = [];
      updated.memory.push({ 
        id: Date.now().toString(), 
        content: newItem, 
        timestamp: new Date().toISOString(),
        category: 'PERSONAL',
        strength: 1
      });
    }
    
    onUpdate(updated);
    setNewItem('');
    setNewDesc('');
  };

  const removeItem = (id: string, list: string) => {
    const updated = { ...user };
    if (list === 'projects') updated.projects = updated.projects.filter(i => i.id !== id);
    if (list === 'reminders') updated.reminders = updated.reminders.filter(i => i.id !== id);
    if (list === 'memory') updated.memory = (updated.memory || []).filter(i => i.id !== id);
    if (list === 'siteLogs') updated.siteLogs = (updated.siteLogs || []).filter(i => i.id !== id);
    if (list === 'lyrics') updated.lyrics = (updated.lyrics || []).filter(i => i.id !== id);
    if (list === 'vault') updated.vault = (updated.vault || []).filter(i => i.id !== id);
    onUpdate(updated);
  };

  const updateMemoryCategory = (id: string, category: NeuralMemoryItem['category']) => {
    const updated = { ...user };
    updated.memory = (updated.memory || []).map(m => m.id === id ? { ...m, category } : m);
    onUpdate(updated);
  };

  const setLanguage = (lang: string) => {
    onUpdate({
      ...user,
      preferences: { ...user.preferences, language: lang }
    });
  };

  useEffect(() => {
    const fetchAbout = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'config', 'about'));
        if (docSnap.exists()) {
          setAboutContent(docSnap.data() as any);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'config/about');
      }
    };
    fetchAbout();
  }, []);

  const handleSaveAbout = async () => {
    setIsSavingAbout(true);
    try {
      const cleanedAbout = cleanFirestoreData(aboutContent);
      await setDoc(doc(db, 'config', 'about'), cleanedAbout);
      setIsEditingAbout(false);
      alert("Neural About Section Updated.");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'config/about');
    } finally {
      setIsSavingAbout(false);
    }
  };

  const isOwner = user.role === Role.OWNER || user.email === OWNER_EMAIL;
  const isPremium = user.tier !== SubscriptionTier.FREE || isOwner;
  const isLifetime = user.tier === SubscriptionTier.LIFETIME;

  const activeTabs = isOwner 
    ? (['NEURAL_MEMORY', 'ANALYTICS', 'USERS', 'REQUESTS', 'BROADCASTS', 'HELP', 'ARJUN', 'ABOUT'] as const)
    : (['NEURAL_MEMORY', 'ANALYTICS', 'UPGRADE', 'HELP', 'ABOUT'] as const);

  const [newBroadcast, setNewBroadcast] = useState({ title: '', content: '', type: 'UPDATE' as any });
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);

  useEffect(() => {
    if (isOpen && isOwner) {
      const unsubscribe = onSnapshot(query(collection(db, 'broadcasts'), orderBy('date', 'desc')), (snapshot) => {
        const fetched: Broadcast[] = [];
        snapshot.forEach((doc) => {
          fetched.push({ ...doc.data(), id: doc.id } as Broadcast);
        });
        setBroadcasts(fetched);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'broadcasts');
      });
      return () => unsubscribe();
    }
  }, [isOpen, isOwner]);

  const handleCreateBroadcast = async () => {
    if (!newBroadcast.title || !newBroadcast.content) return;
    try {
      const id = `bc_${Date.now()}`;
      const broadcastData = cleanFirestoreData({
        ...newBroadcast,
        id,
        date: new Date().toISOString()
      });
      await setDoc(doc(db, 'broadcasts', id), broadcastData);
      setNewBroadcast({ title: '', content: '', type: 'UPDATE' });
      alert("Neural Broadcast Transmitted.");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'broadcasts');
    }
  };

  const handleDeleteBroadcast = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'broadcasts', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `broadcasts/${id}`);
    }
  };

  const getTabLabel = (t: string) => {
    switch(t) {
      case 'ANALYTICS': return 'Stats';
      case 'NEURAL_MEMORY': return 'Memory';
      case 'UPGRADE': return 'Upgrade';
      case 'USERS': return 'Users';
      case 'REQUESTS': return 'Requests';
      case 'BROADCASTS': return 'Broadcasts';
      case 'ARJUN': return 'Directives';
      case 'HELP': return 'Help';
      case 'ABOUT': return 'About';
      default: return t;
    }
  };

  if (!isOpen && !isSection) return null;

  const content = (
    <div className={`flex flex-col ${isSection ? 'w-full h-full' : 'w-full max-w-xl h-[95dvh] sm:h-full bg-white dark:bg-zinc-900 border-l border-zinc-100 dark:border-white/5 shadow-2xl overflow-hidden rounded-t-[3rem] sm:rounded-none'} ${isRainbow ? 'rainbow-mode' : ''}`}>
      
      {!isSection && (
        <div className={`px-8 py-8 border-b border-zinc-50 dark:border-white/5 flex items-center justify-between shrink-0 ${isRainbow ? 'bg-transparent' : 'bg-white dark:bg-zinc-900'}`}>
          <div className="flex items-center gap-4">
             <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border shadow-sm ${isRainbow ? 'rainbow-box' : 'bg-zinc-50 dark:bg-white/5 border-zinc-100 dark:border-white/10'}`}>
               <svg className={`w-5 h-5 ${isRainbow ? 'text-zinc-900' : 'text-zinc-900 dark:text-white'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
             </div>
             <div>
                <h2 className={`text-xl font-black font-outfit ${isRainbow ? 'text-zinc-900' : 'text-zinc-900 dark:text-white'}`}>Neural Hub</h2>
                <p className="text-[9px] uppercase tracking-[0.3em] font-bold text-zinc-400 mt-1">Sovereign Intel v3.5</p>
             </div>
          </div>
          <button onClick={onClose} className={`p-3 transition-colors rounded-2xl shadow-sm border ${isRainbow ? 'rainbow-box text-zinc-900' : 'text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-50 dark:bg-white/5 border-zinc-100 dark:border-white/10'}`}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      <div className={`flex p-1.5 mx-6 mt-6 rounded-2xl border overflow-x-auto no-scrollbar gap-1 shrink-0 shadow-sm ${isRainbow ? 'rainbow-box' : 'bg-zinc-50 dark:bg-black/20 border-zinc-100 dark:border-white/10'}`}>
        {activeTabs.map(t => (
          <button key={t} onClick={() => setTab(t as any)} className={`flex-1 min-w-[70px] py-2.5 text-[8px] font-black uppercase tracking-widest rounded-xl transition-all ${tab === t ? (isRainbow ? 'bg-zinc-900 text-white shadow-xl' : 'bg-zinc-900 dark:bg-white text-white dark:text-black shadow-md') : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'}`}>
            {getTabLabel(t)}
          </button>
        ))}
      </div>

      <div className={`flex-1 overflow-y-auto ${isSection ? 'p-0' : 'p-8'} space-y-10 no-scrollbar pb-32`}>
        {tab === 'ANALYTICS' && (
            <div className="space-y-6 animate-in fade-in duration-500">
               <div className={`p-8 rounded-[3rem] text-white space-y-4 shadow-xl relative overflow-hidden ${isRainbow ? 'rainbow-box' : 'bg-zinc-900'}`}>
                  <div className="relative z-10">
                    <h3 className={`text-xl font-black uppercase tracking-widest font-outfit ${isRainbow ? 'text-zinc-900' : 'text-white'}`}>Neural Analytics</h3>
                    <div className="grid grid-cols-2 gap-4 pt-4">
                       <div className={`p-4 rounded-2xl border ${isRainbow ? 'bg-white/40 border-black/10' : 'bg-white/5 border-white/10'}`}>
                          <p className={`text-[8px] font-black uppercase mb-1 ${isRainbow ? 'text-zinc-500' : 'text-zinc-500'}`}>Total Synapses</p>
                          <p className={`text-2xl font-black ${isRainbow ? 'text-zinc-900' : 'text-white'}`}>{messagesCount}</p>
                       </div>
                       <div className={`p-4 rounded-2xl border ${isRainbow ? 'bg-white/40 border-black/10' : 'bg-white/5 border-white/10'} ${isOwner ? (isRainbow ? 'border-amber-500/40' : 'border-amber-500/20') : ''}`}>
                          <p className={`text-[8px] font-black uppercase mb-1 ${isRainbow ? 'text-zinc-500' : 'text-zinc-500'}`}>Neural Rank</p>
                          <p className="text-sm font-black text-amber-500 uppercase">{user.tier}</p>
                       </div>
                    </div>
                  </div>
               </div>
               
               <div className={`p-6 border rounded-[2.5rem] shadow-sm ${isRainbow ? 'rainbow-box' : 'bg-zinc-50 border-zinc-100'}`}>
                  <h4 className={`text-[10px] font-black uppercase tracking-widest mb-4 ${isRainbow ? 'text-zinc-900' : 'text-zinc-900'}`}>Compute Efficiency</h4>
                  <div className="space-y-3">
                     {[
                       { label: "Reasoning Core", val: isOwner ? 100 : 85 },
                       { label: "Image Manifest", val: isOwner ? 100 : 70 },
                       { label: "Temporal Motion", val: isOwner ? 100 : 40 }
                     ].map((s, i) => (
                       <div key={i} className="space-y-1">
                          <div className="flex justify-between text-[8px] font-black uppercase">
                             <span className="text-zinc-400">{s.label}</span>
                             <span className={`font-black ${isRainbow ? 'text-zinc-900' : 'text-zinc-900'}`}>{s.val}%</span>
                          </div>
                          <div className={`h-1 rounded-full overflow-hidden ${isRainbow ? 'bg-black/10' : 'bg-zinc-200'}`}>
                             <div className={`h-full ${isRainbow ? 'bg-zinc-900' : 'bg-zinc-900'}`} style={{ width: `${s.val}%` }}></div>
                          </div>
                       </div>
                     ))}
                  </div>
               </div>
            </div>
          )}

           {tab === 'NEURAL_MEMORY' && (
            <div className="space-y-6 animate-in fade-in duration-500">
               <div className="px-2">
                  <h3 className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-widest">Things I Remember</h3>
                  <p className="text-[8px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest mt-1">Stored knowledge and personal patterns</p>
               </div>
               <div className="grid gap-4">
                  {(user.memory || []).length > 0 ? (user.memory || []).map(m => (
                    <div key={m.id} className="p-6 bg-white dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-[2rem] shadow-sm space-y-4 group">
                       <div className="flex justify-between items-start">
                          <div className="flex gap-2">
                            {(['PERSONAL', 'WORK', 'CREATIVE', 'FACT'] as const).map(cat => (
                              <button 
                                key={cat} 
                                onClick={() => updateMemoryCategory(m.id, cat)}
                                className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest transition-all ${m.category === cat ? 'bg-zinc-900 dark:bg-white text-white dark:text-black' : 'bg-zinc-100 dark:bg-white/10 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                          <button onClick={() => removeItem(m.id, 'memory')} className="p-1 text-zinc-200 dark:text-zinc-700 hover:text-red-500 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                       </div>
                       <p className="text-xs text-zinc-800 dark:text-zinc-200 font-medium leading-relaxed">
                          {m.content}
                       </p>
                       <div className="flex justify-between items-center pt-2">
                          <span className="text-[7px] font-black text-zinc-300 dark:text-zinc-600 uppercase tracking-widest">STRENGTH: {m.strength}/5</span>
                          <span className="text-[7px] font-black text-zinc-300 dark:text-zinc-600 uppercase tracking-widest">{new Date(m.timestamp).toLocaleDateString()}</span>
                       </div>
                    </div>
                  )) : (
                    <div className="py-20 text-center border-2 border-dashed border-zinc-100 dark:border-white/10 rounded-[3rem] text-[9px] font-black text-zinc-200 dark:text-zinc-800 uppercase tracking-[0.5em]">Neural Database Empty</div>
                  )}
               </div>
            </div>
          )}

          {tab === 'UPGRADE' && !isOwner && (
            <div className="space-y-8 animate-in fade-in duration-500 pb-10">
               <div className="p-8 bg-zinc-900 rounded-[3rem] text-white space-y-4 shadow-xl relative overflow-hidden">
                  <div className="absolute top-4 right-8 opacity-20 rotate-12 scale-150">
                    <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  </div>
                  <h3 className="text-xl font-black font-outfit uppercase tracking-tighter relative z-10">Neural Evolution</h3>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest leading-relaxed relative z-10">
                    Unlock higher intelligence cores and unlimited manifestation protocols. 
                    Current status: <span className="text-white font-black">{user.tier}</span>
                  </p>
               </div>

               <div className="flex bg-zinc-100/50 dark:bg-white/5 p-1.5 rounded-2xl border border-zinc-200 dark:border-white/10">
                  <button onClick={() => { setPaymentMode('PAY'); setPaymentPhase('SELECT'); }} className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${paymentMode === 'PAY' ? 'bg-white dark:bg-white/10 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400 dark:text-zinc-500'}`}>Direct Activation</button>
                  <button onClick={() => setPaymentMode('REQUEST')} className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${paymentMode === 'REQUEST' ? 'bg-white dark:bg-white/10 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400 dark:text-zinc-500'}`}>Request to Owner</button>
               </div>

               {paymentMode === 'PAY' ? (
                 <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
                    {paymentPhase === 'SELECT' && (
                      <div className="grid gap-4">
                        {[
                          { tier: SubscriptionTier.PRO, price: 499, label: 'Neural Pro Monthly', desc: 'Advanced reasoning & grounding' },
                          { tier: SubscriptionTier.LIFETIME, price: 9999, label: 'Neural Sovereign Lifetime', desc: 'Infinite compute & priority access' },
                          { tier: SubscriptionTier.OWNER, price: 300000, label: 'Sovereign Owner', desc: 'Direct neural link to core' }
                        ].map((plan) => (
                          <div key={plan.tier} className="space-y-2">
                             <button 
                              onClick={() => setShowPlanDetails(showPlanDetails === plan.tier ? null : plan.tier)}
                              className={`w-full group p-6 bg-white dark:bg-zinc-800 border rounded-[2.5rem] transition-all flex items-center justify-between active:scale-95 shadow-sm ${showPlanDetails === plan.tier ? 'border-zinc-900 dark:border-white ring-1 ring-zinc-900 dark:ring-white' : 'border-zinc-100 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/30'}`}
                            >
                               <div className="text-left">
                                  <p className={`text-[11px] font-black uppercase ${plan.tier === SubscriptionTier.OWNER ? 'text-amber-600' : 'text-zinc-900 dark:text-white'}`}>{plan.label}</p>
                                  <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-bold uppercase">{plan.desc}</p>
                               </div>
                               <p className="text-lg font-black text-zinc-900 dark:text-white">₹{plan.price.toLocaleString()}{plan.tier !== SubscriptionTier.OWNER && <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold ml-1">/MO</span>}</p>
                            </button>
                            
                            {showPlanDetails === plan.tier && (
                              <div className="p-6 bg-zinc-50 dark:bg-white/5 rounded-[2rem] border border-zinc-100 dark:border-white/10 animate-in slide-in-from-top-4 duration-300 space-y-4">
                                <ul className="space-y-2">
                                  {(PLAN_FEATURES[plan.tier as keyof typeof PLAN_FEATURES] || PLAN_FEATURES.PRO).map((f, i) => (
                                    <li key={i} className="flex items-center gap-2 text-[9px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">
                                      <div className={`w-1.5 h-1.5 rounded-full ${plan.tier === SubscriptionTier.OWNER ? 'bg-amber-500' : 'bg-zinc-900 dark:bg-white'}`}></div>
                                      {f}
                                    </li>
                                  ))}
                                </ul>
                                
                                {plan.tier === SubscriptionTier.OWNER ? (
                                  <a 
                                    href="mailto:arjunjareda2007@gmail.com?subject=Sovereign Owner Plan Inquiry"
                                    className="w-full py-3 bg-amber-500 text-black rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-2"
                                  >
                                    Contact Owner for Access
                                  </a>
                                ) : (
                                  <button 
                                    onClick={() => initiatePayment(plan.tier, plan.price)} 
                                    className="w-full py-3 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg"
                                  >
                                    Activate {plan.label}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {paymentPhase === 'PAY_PORTAL' && (

                      <div className="bg-zinc-50 border border-zinc-100 p-8 rounded-[3.5rem] space-y-8 text-center animate-in zoom-in-95 duration-500">
                        <div className="space-y-2">
                           <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Target Payment Sequence</p>
                           <p className="text-2xl font-black text-zinc-900 font-outfit">8233538355@ybl</p>
                           <div className="h-1 w-12 bg-zinc-900 mx-auto rounded-full mt-2"></div>
                        </div>

                        <div className="p-6 bg-white rounded-[2.5rem] border border-zinc-100 shadow-sm space-y-4">
                           <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">Plan:</span>
                              <span className="text-[11px] font-black text-zinc-900 uppercase">{requestedTier}</span>
                           </div>
                           <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">Amount:</span>
                              <span className="text-xl font-black text-zinc-900">₹{selectedPlanPrice}</span>
                           </div>
                        </div>

                        {/* QR Code Manifestation */}
                        <div className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                          <div className="p-6 bg-white rounded-[3rem] border border-zinc-100 shadow-xl relative group">
                            <div className="absolute -inset-1 bg-gradient-to-tr from-zinc-100 to-zinc-50 rounded-[3.1rem] -z-10 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                            <QRCodeSVG 
                              value={`upi://pay?pa=8233538355@ybl&pn=${encodeURIComponent("Anora Sovereign")}&am=${selectedPlanPrice}&cu=INR&tn=Anora%20Neural%20Upgrade`}
                              size={160}
                              level="H"
                              includeMargin={false}
                              className="rounded-lg"
                            />
                          </div>
                          <p className="text-[8px] font-black text-zinc-400 uppercase tracking-[0.4em]">Scan to Transfuse Neural Energy</p>
                        </div>

                        <div className="space-y-6">
                           <div className="p-6 border-2 border-dashed border-zinc-200 rounded-[2.5rem] bg-white group hover:border-zinc-400 transition-all cursor-pointer relative overflow-hidden" onClick={() => screenshotInputRef.current?.click()}>
                              {screenshot ? (
                                <div className="space-y-4">
                                  <img src={screenshot} className="w-20 h-20 mx-auto object-cover rounded-xl border border-zinc-100 shadow-sm" alt="Asset" />
                                  <p className="text-[9px] font-black text-zinc-900 uppercase tracking-widest">Receipt manifested. Ready for analysis.</p>
                                </div>
                              ) : (
                                <div className="space-y-3 py-4">
                                  <div className="w-10 h-10 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center mx-auto text-zinc-300 group-hover:text-zinc-900 transition-colors">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                  </div>
                                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest group-hover:text-zinc-900 transition-colors">Upload Payment Screenshot</p>
                                </div>
                              )}
                              <input type="file" accept="image/*" ref={screenshotInputRef} hidden onChange={handleScreenshotUpload} />
                           </div>

                           <div className="bg-red-50/50 border border-red-100 p-6 rounded-[2rem] space-y-2">
                             <p className="text-[9px] font-black text-red-600 uppercase tracking-[0.2em]">⚠️ Neural Verification Protocol</p>
                             <p className="text-[8px] text-red-500 font-bold uppercase tracking-widest leading-relaxed">
                               Warning: You must submit the screenshot within 1 hour of transaction. Verification requires exact amount (₹{selectedPlanPrice}) and timestamp clarity.
                             </p>
                           </div>

                           <div className="space-y-4">
                              <button 
                                onClick={() => initiatePayment(requestedTier, selectedPlanPrice)}
                                className="w-full py-5 rounded-[2rem] bg-zinc-900 text-white font-black uppercase text-[11px] tracking-[0.3em] shadow-xl flex items-center justify-center gap-3 active:scale-95"
                              >
                                Open Payment Portal
                              </button>
                              <button 
                                onClick={handleConfirmActivation}
                                disabled={!screenshot}
                                className={`w-full py-5 rounded-[2rem] bg-white border border-zinc-200 text-zinc-900 font-black uppercase text-[11px] tracking-[0.3em] shadow-sm flex items-center justify-center gap-3 active:scale-95 disabled:opacity-40`}
                              >
                                Confirm & Activate
                              </button>
                              
                              <div className="flex flex-col items-center gap-4 mt-6">
                                <button onClick={() => setPaymentPhase('SELECT')} className="text-[9px] font-black text-zinc-300 uppercase tracking-widest hover:text-zinc-600">Back to Selection</button>
                                <div className="h-[1px] w-12 bg-zinc-100"></div>
                                <a href="mailto:arjunjareda2007@gmail.com" className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2 hover:underline">
                                   Help: arjunjareda2007@gmail.com
                                </a>
                              </div>
                           </div>
                        </div>
                      </div>
                    )}

                    {paymentPhase === 'VERIFY' && (
                      <div className="bg-zinc-900 p-10 rounded-[3.5rem] text-center space-y-8 animate-in zoom-in-95 duration-500 shadow-2xl relative overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.05),transparent)] animate-pulse"></div>
                        
                        {isVerifyingPayment ? (
                          <div className="space-y-8 relative z-10">
                            <div className="w-20 h-20 mx-auto relative">
                              <div className="absolute inset-0 border-4 border-white/10 rounded-full"></div>
                              <div className="absolute inset-0 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <svg className="w-8 h-8 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <h4 className="text-xl font-black text-white uppercase tracking-tighter font-outfit">Neural Verification</h4>
                              <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-[0.3em] animate-pulse">Analyzing Transaction Signatures...</p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                              <p className="text-[8px] text-zinc-500 font-black uppercase tracking-widest mb-2">Neural Link Progress</p>
                              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-white animate-[progress_2s_ease-in-out_infinite]" style={{ width: '60%' }}></div>
                              </div>
                            </div>
                          </div>
                        ) : paymentConfirmed ? (
                          <div className="space-y-6 relative z-10 py-10">
                            <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto text-white shadow-[0_0_30px_rgba(16,185,129,0.4)] animate-bounce">
                              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <div className="space-y-2">
                              <h4 className="text-2xl font-black text-white uppercase tracking-tighter font-outfit">Ascension Complete</h4>
                              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Neural Link Synchronized</p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-8 relative z-10">
                            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto text-red-500 border border-red-500/30">
                              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            </div>
                            <div className="space-y-4">
                              <h4 className="text-xl font-black text-white uppercase tracking-tighter font-outfit">Verification Declined</h4>
                              <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-[2rem]">
                                <p className="text-[10px] text-red-400 font-bold uppercase leading-relaxed tracking-widest">
                                  {verificationError || "Neural vision failed to parse the receipt."}
                                </p>
                              </div>
                            </div>
                            <button 
                              onClick={() => setPaymentPhase('PAY_PORTAL')}
                              className="w-full py-4 bg-white text-black rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95"
                            >
                              Retry Verification
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                 </div>
               ) : (
                 <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
                    <div className="space-y-4">
                       <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-4">Select Target Tier</label>
                       <div className="flex gap-2">
                          {[SubscriptionTier.PRO, SubscriptionTier.LIFETIME].map(t => (
                            <button 
                              key={t} 
                              onClick={() => setRequestedTier(t)}
                              className={`flex-1 py-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${requestedTier === t ? 'bg-zinc-900 text-white border-zinc-900 shadow-lg' : 'bg-white text-zinc-400 border-zinc-100'}`}
                            >
                              {t}
                            </button>
                          ))}
                       </div>
                    </div>

                    <div className="space-y-4">
                       <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-4">Verification Message</label>
                       <textarea 
                         value={upgradeMessage}
                         onChange={e => setUpgradeMessage(e.target.value)}
                         placeholder="Why do you require higher compute priority?"
                         className="w-full bg-zinc-50 border border-zinc-100 rounded-[2rem] p-6 text-xs text-zinc-900 outline-none focus:border-zinc-300 min-h-[120px] resize-none"
                       />
                    </div>

                    <button 
                      onClick={handleRequestUpgrade}
                      disabled={isRequesting}
                      className="w-full py-5 rounded-[2rem] bg-zinc-900 text-white font-black uppercase text-[10px] tracking-[0.4em] shadow-xl active:scale-95 disabled:opacity-50"
                    >
                      {isRequesting ? 'TRANSFUSING DATA...' : 'SUBMIT UPGRADE REQUEST'}
                    </button>
                 </div>
               )}
            </div>
          )}

          {tab === 'ABOUT' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
              <div className="p-8 bg-zinc-900 rounded-[3rem] text-white space-y-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                <div className="relative z-10">
                  <h3 className="text-xl font-black uppercase tracking-widest font-outfit mb-2">Neural Identity</h3>
                  <button 
                    onClick={() => setShowDevProfile(true)}
                    className="group flex items-center gap-3 hover:opacity-80 transition-all"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform">
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-black uppercase tracking-wider text-white">Arjun Bharti Mina</p>
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Lead Architect / Developer</p>
                    </div>
                  </button>
                </div>

                <div className="flex flex-wrap gap-3 relative z-10">
                  {Object.entries(aboutContent.links).map(([key, url]) => (
                    <a 
                      key={key} 
                      href={url as string} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/20 transition-all hover:-translate-y-1"
                      title={key.toUpperCase()}
                    >
                      {key === 'youtube' && <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>}
                      {key === 'instagram' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>}
                      {key === 'spotify' && <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.496 17.306c-.22.363-.694.475-1.056.255-2.856-1.745-6.45-2.14-10.686-1.173-.414.095-.826-.163-.92-.577-.095-.414.163-.826.577-.92 4.63-1.06 8.59-.61 11.78 1.34.363.22.475.694.255 1.056zm1.465-3.263c-.276.45-.863.593-1.313.317-3.268-2.01-8.248-2.592-12.112-1.418-.507.154-1.04-.137-1.194-.644-.154-.507.137-1.04.644-1.194 4.41-1.34 9.9-1.685 13.658.625.45.276.593.863.317 1.313zm.128-3.41c-3.918-2.327-10.375-2.542-14.13-1.403-.602.183-1.237-.153-1.42-.755-.183-.602.153-1.237.755-1.42 4.31-1.308 11.435-1.055 15.94 1.62.54.32.715 1.014.395 1.554-.32.54-1.014.715-1.554.395z"/></svg>}
                      {key === 'website' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9h18" /></svg>}
                      {!['youtube', 'instagram', 'spotify', 'website'].includes(key) && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>}
                    </a>
                  ))}
                </div>
              </div>

              <div className="p-8 bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-[3rem] space-y-6">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-widest">About Anora</h4>
                  {isOwner && (
                    <button 
                      onClick={() => setIsEditingAbout(!isEditingAbout)}
                      className="text-[8px] font-black text-zinc-500 uppercase hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >
                      {isEditingAbout ? 'Cancel' : 'Edit Neural Core'}
                    </button>
                  )}
                </div>

                {isEditingAbout ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Anora Bio</label>
                      <textarea 
                        value={aboutContent.anoraBio}
                        onChange={(e) => setAboutContent({...aboutContent, anoraBio: e.target.value})}
                        className="w-full h-32 p-4 bg-white dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white outline-none resize-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Developer Bio</label>
                      <textarea 
                        value={aboutContent.devBio}
                        onChange={(e) => setAboutContent({...aboutContent, devBio: e.target.value})}
                        className="w-full h-48 p-4 bg-white dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white outline-none resize-none"
                      />
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Neural Links</label>
                        <button 
                          onClick={() => {
                            const newKey = prompt("Enter link name (e.g. Twitter, GitHub):");
                            if (newKey && !aboutContent.links[newKey]) {
                              setAboutContent({
                                ...aboutContent,
                                links: { ...aboutContent.links, [newKey.toLowerCase()]: "" }
                              });
                            }
                          }}
                          className="px-3 py-1 bg-zinc-100 dark:bg-white/10 rounded-lg text-[7px] font-black uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-white/20 transition-all"
                        >
                          + Add Link
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {Object.keys(aboutContent.links).map((key) => (
                          <div key={key} className="space-y-2 p-4 bg-white dark:bg-black/20 border border-zinc-100 dark:border-white/5 rounded-2xl relative group/link">
                            <div className="flex justify-between items-center">
                              <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">{key}</label>
                              <button 
                                onClick={() => {
                                  const newLinks = { ...aboutContent.links };
                                  delete newLinks[key];
                                  setAboutContent({ ...aboutContent, links: newLinks });
                                }}
                                className="opacity-0 group-hover/link:opacity-100 p-1 text-zinc-300 hover:text-red-500 transition-all"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                            <input 
                              type="text"
                              value={(aboutContent.links as any)[key]}
                              onChange={(e) => setAboutContent({
                                ...aboutContent, 
                                links: { ...aboutContent.links, [key]: e.target.value }
                              })}
                              placeholder={`Enter ${key} URL`}
                              className="w-full p-2 bg-transparent border-b border-zinc-100 dark:border-white/10 text-[10px] font-medium focus:border-zinc-900 dark:focus:border-white outline-none transition-all"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <button 
                      onClick={handleSaveAbout}
                      disabled={isSavingAbout}
                      className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      {isSavingAbout ? 'Syncing...' : 'Update Neural Core'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 font-medium italic">
                      "{aboutContent.anoraBio}"
                    </p>
                    <div className="h-px bg-zinc-100 dark:bg-white/5"></div>
                    <div className="space-y-4">
                       <h5 className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Core Architecture</h5>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-white dark:bg-white/5 rounded-2xl border border-zinc-100 dark:border-white/10">
                             <p className="text-[8px] font-black text-zinc-400 uppercase mb-1">Version</p>
                             <p className="text-xs font-black text-zinc-900 dark:text-white">3.5.0-Sovereign</p>
                          </div>
                          <div className="p-4 bg-white dark:bg-white/5 rounded-2xl border border-zinc-100 dark:border-white/10">
                             <p className="text-[8px] font-black text-zinc-400 uppercase mb-1">Protocol</p>
                             <p className="text-xs font-black text-zinc-900 dark:text-white">Arjun-X-Neural</p>
                          </div>
                       </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'BROADCASTS' && isOwner && (
            <div className="space-y-8 animate-in fade-in duration-500">
               <div className="p-8 bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-[3rem] shadow-sm space-y-6">
                  <div className="flex items-center gap-4 mb-4">
                     <div className="p-3 bg-zinc-900 dark:bg-white rounded-2xl">
                        <svg className="w-5 h-5 text-white dark:text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                     </div>
                     <div>
                        <h3 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight">System Broadcast</h3>
                        <p className="text-[9px] text-zinc-400 font-black uppercase tracking-widest">Global Synapse Update</p>
                     </div>
                  </div>
                  <div className="space-y-4">
                     <input 
                       value={newBroadcast.title}
                       onChange={e => setNewBroadcast({ ...newBroadcast, title: e.target.value })}
                       placeholder="Broadcast Title..."
                       className="w-full bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 rounded-2xl px-6 py-4 text-xs text-zinc-900 dark:text-white outline-none focus:border-zinc-300"
                     />
                     <textarea 
                       value={newBroadcast.content}
                       onChange={e => setNewBroadcast({ ...newBroadcast, content: e.target.value })}
                       placeholder="Broadcast Content..."
                       className="w-full bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 rounded-2xl p-6 text-xs text-zinc-900 dark:text-white outline-none focus:border-zinc-300 min-h-[120px] resize-none"
                     />
                     <div className="flex gap-2">
                        {['UPDATE', 'ALERT', 'MAINTENANCE', 'FEATURE'].map(t => (
                          <button 
                            key={t}
                            onClick={() => setNewBroadcast({ ...newBroadcast, type: t as any })}
                            className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${newBroadcast.type === t ? 'bg-zinc-900 dark:bg-white text-white dark:text-black' : 'bg-zinc-100 dark:bg-white/5 text-zinc-400'}`}
                          >
                            {t}
                          </button>
                        ))}
                     </div>
                     <button 
                       onClick={handleCreateBroadcast}
                       className="w-full py-5 rounded-[2rem] bg-zinc-900 dark:bg-white text-white dark:text-black font-black uppercase text-[10px] tracking-[0.3em] active:scale-95 shadow-xl transition-transform"
                     >
                       Transmit Protocol
                     </button>
                  </div>
               </div>

               <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.4em] px-4">Active Transmissions</h4>
                  <div className="grid gap-4">
                     {broadcasts.map(bc => (
                       <div key={bc.id} className="p-6 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 rounded-[2.5rem] shadow-sm flex items-start justify-between group">
                          <div className="space-y-2">
                             <div className="flex items-center gap-3">
                                <span className={`px-2 py-1 rounded-md text-[7px] font-black uppercase tracking-widest ${
                                  bc.type === 'ALERT' ? 'bg-red-100 text-red-600' : 
                                  bc.type === 'MAINTENANCE' ? 'bg-amber-100 text-amber-600' :
                                  bc.type === 'FEATURE' ? 'bg-blue-100 text-blue-600' :
                                  'bg-zinc-100 text-zinc-600'
                                }`}>{bc.type}</span>
                                <h5 className="text-xs font-black text-zinc-900 dark:text-white uppercase">{bc.title}</h5>
                             </div>
                             <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed">{bc.content}</p>
                             <p className="text-[8px] text-zinc-300 font-bold">{new Date(bc.date).toLocaleString()}</p>
                          </div>
                          <button 
                            onClick={() => handleDeleteBroadcast(bc.id)}
                            className="p-3 text-zinc-200 hover:text-red-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                       </div>
                     ))}
                  </div>
               </div>
            </div>
          )}

          {tab === 'HELP' && (
            <div className="space-y-8 animate-in fade-in duration-500 pb-10">
               <div className="px-2">
                  <h3 className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-widest">Help & Support</h3>
                  <p className="text-[8px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest mt-1">Frequently asked questions and direct contact</p>
               </div>

               <div className="space-y-4">
                  <h4 className="text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-4">Neural FAQ</h4>
                  <div className="grid gap-3">
                     {[
                       { q: "How do I upgrade my tier?", a: "Navigate to the Upgrade tab and select a plan. You can activate directly via UPI or request an elevation from the Sovereign." },
                       { q: "What are Synapse Tokens?", a: "Tokens represent your daily compute budget. Higher tiers grant larger budgets for deep reasoning and synthesis." },
                       { q: "How does Neural Memory work?", a: "Anora stores key facts and preferences in your memory tab to personalize future interactions. You can manage these records manually." },
                       { q: "Can I change my AI's persona?", a: "Yes, open your Profile and select from various personas like Mentor, Friend, or Sovereign AI." }
                     ].map((item, i) => (
                       <details key={i} className="group p-6 bg-white dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-[2rem] shadow-sm">
                          <summary className="list-none cursor-pointer flex justify-between items-center">
                             <span className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-tight">{item.q}</span>
                             <svg className="w-4 h-4 text-zinc-300 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </summary>
                          <p className="mt-4 text-[10px] text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed border-t border-zinc-50 dark:border-white/5 pt-4">
                             {item.a}
                          </p>
                       </details>
                     ))}
                  </div>
               </div>

               <div className="space-y-6">
                  <h4 className="text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-4">Contact Support</h4>
                  <div className="p-8 bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-[3rem] space-y-6">
                     {supportSuccess ? (
                       <div className="py-10 text-center space-y-4 animate-in zoom-in-95 duration-500">
                          <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center mx-auto text-white">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          </div>
                          <p className="text-[11px] font-black text-zinc-900 dark:text-white uppercase tracking-widest">Transmission Successful</p>
                          <p className="text-[9px] text-zinc-400 font-bold uppercase">The Sovereign will review your inquiry shortly.</p>
                          <button onClick={() => setSupportSuccess(false)} className="text-[9px] font-black text-zinc-900 dark:text-white underline uppercase">Send Another</button>
                       </div>
                     ) : (
                       <>
                         <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-2">
                                  <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest ml-2">Name</label>
                                  <input 
                                    value={supportName}
                                    onChange={e => setSupportName(e.target.value)}
                                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 rounded-xl px-4 py-3 text-[10px] text-zinc-900 dark:text-white outline-none"
                                  />
                               </div>
                               <div className="space-y-2">
                                  <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest ml-2">Email</label>
                                  <input 
                                    value={supportEmail}
                                    onChange={e => setSupportEmail(e.target.value)}
                                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 rounded-xl px-4 py-3 text-[10px] text-zinc-900 dark:text-white outline-none"
                                  />
                               </div>
                            </div>
                            <div className="space-y-2">
                               <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest ml-2">Inquiry Details</label>
                               <textarea 
                                 value={supportMessage}
                                 onChange={e => setSupportMessage(e.target.value)}
                                 placeholder="Describe your issue or question..."
                                 className="w-full bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 rounded-2xl p-4 text-[10px] text-zinc-900 dark:text-white outline-none min-h-[100px] resize-none"
                               />
                            </div>
                         </div>
                         <button 
                           disabled={isSendingSupport || !supportMessage.trim()}
                           onClick={() => {
                             setIsSendingSupport(true);
                             setTimeout(() => {
                               setIsSendingSupport(false);
                               setSupportSuccess(true);
                               setSupportMessage('');
                             }, 1500);
                           }}
                           className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] shadow-lg disabled:opacity-50 active:scale-95 transition-all"
                         >
                           {isSendingSupport ? 'TRANSMITTING...' : 'SEND INQUIRY'}
                         </button>
                       </>
                     )}
                  </div>
               </div>
            </div>
          )}

          {tab === 'REQUESTS' && isOwner && (
            <div className="space-y-6 animate-in fade-in duration-500">
               <div className="px-2">
                  <h3 className="text-[10px] font-black text-zinc-900 uppercase tracking-widest">Neural Elevation Queue</h3>
                  <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Pending user upgrade requests</p>
               </div>
               <div className="grid gap-4">
                  {upgradeRequests.length > 0 ? upgradeRequests.filter(r => r.status === 'PENDING').map(req => (
                    <div key={req.id} className="p-6 bg-white border border-zinc-100 rounded-[2.5rem] shadow-sm space-y-4">
                       <div className="flex justify-between items-start">
                          <div>
                            <p className="text-[11px] font-black text-zinc-900 uppercase">{req.userName}</p>
                            <p className="text-[9px] text-zinc-400 font-bold uppercase">{req.userEmail}</p>
                          </div>
                          <span className="text-[8px] px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full font-black uppercase tracking-widest">REQ: {req.requestedTier}</span>
                       </div>
                       <div className="p-4 bg-zinc-50 rounded-2xl text-[10px] text-zinc-600 italic leading-relaxed border border-zinc-100">
                          "{req.message}"
                       </div>
                       <div className="flex gap-2">
                          <button onClick={() => handleActionRequest(req.id, true)} className="flex-1 py-3 bg-zinc-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md">Approve</button>
                          <button onClick={() => handleActionRequest(req.id, false)} className="flex-1 py-3 border border-red-100 text-red-500 rounded-xl text-[9px] font-black uppercase tracking-widest">Deny</button>
                       </div>
                    </div>
                  )) : (
                    <div className="py-20 text-center border-2 border-dashed border-zinc-100 rounded-[3rem] text-[9px] font-black text-zinc-200 uppercase tracking-[0.5em]">No Pending Requests</div>
                  )}
               </div>
            </div>
          )}

          {tab === 'ARJUN' && isOwner && (
            <div className="space-y-8 animate-in fade-in duration-500">
               <div className="px-2">
                  <h3 className="text-[10px] font-black text-zinc-900 uppercase tracking-widest">Arjun Protocol</h3>
                  <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Special directives for Sovereign behavior</p>
               </div>
               <div className="bg-zinc-50 border border-zinc-100 p-8 rounded-[3rem] shadow-sm space-y-6">
                  <textarea 
                    value={arjunDirectives}
                    onChange={e => setArjunDirectives(e.target.value)}
                    placeholder="Enter special behavioral directives..."
                    className="w-full bg-white border border-zinc-100 rounded-[2rem] p-6 text-xs text-zinc-900 outline-none focus:border-zinc-300 min-h-[200px] resize-none font-mono"
                  />
                  <button 
                    onClick={() => {
                      onUpdate({
                        ...user,
                        preferences: { ...user.preferences, arjunDirectives }
                      });
                      alert("Arjun Directives Synced.");
                    }}
                    className="w-full py-4 rounded-2xl bg-zinc-900 text-white font-black uppercase text-[10px] tracking-widest active:scale-95 shadow-lg"
                  >
                    Sync Directives
                  </button>
               </div>
            </div>
          )}


          {tab === 'USERS' && isOwner && (
            <div className="space-y-6 animate-in fade-in duration-500">
               {selectedUserId ? (
                 <div className="space-y-6">
                    <button onClick={() => setSelectedUserId(null)} className="flex items-center gap-2 text-[9px] font-black text-zinc-400 uppercase tracking-widest hover:text-zinc-900 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      Back to User Database
                    </button>
                    {allUsers.find(u => u.id === selectedUserId) && (() => {
                      const u = allUsers.find(usr => usr.id === selectedUserId)!;
                      return (
                        <div className="p-8 bg-white border border-zinc-100 rounded-[3rem] shadow-xl space-y-8">
                           <div className="flex items-center gap-6">
                              <div className="w-20 h-20 rounded-[2rem] bg-zinc-900 text-white flex items-center justify-center text-2xl font-black">
                                {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover rounded-[2rem]" /> : u.name.charAt(0)}
                              </div>
                              <div>
                                 <h3 className="text-xl font-black text-zinc-900 uppercase">{u.name}</h3>
                                 <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">{u.tier} Tier</p>
                              </div>
                           </div>
                           <div className="grid gap-4">
                              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                                 <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Email Address</p>
                                 <p className="text-xs font-bold text-zinc-900">{u.email}</p>
                              </div>
                              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                                 <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Access Key (Password)</p>
                                 <p className="text-xs font-bold text-zinc-900">{u.password || 'N/A'}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                 <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                                    <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Date of Birth</p>
                                    <p className="text-xs font-bold text-zinc-900">{u.dob || 'Not Set'}</p>
                                 </div>
                                 <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                                    <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Phone Number</p>
                                    <p className="text-xs font-bold text-zinc-900">{u.phoneNumber || 'Not Set'}</p>
                                 </div>
                              </div>
                              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                                 <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Neural ID</p>
                                 <p className="text-[10px] font-mono text-zinc-500">{u.id}</p>
                              </div>
                           </div>
                        </div>
                      );
                    })()}
                 </div>
               ) : (
                 <>
                   <input 
                      value={searchTerm} 
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Search user database..." 
                      className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-xs text-zinc-900 outline-none shadow-sm"
                    />
                    <div className="grid gap-4">
                       {allUsers.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase())).map(u => (
                         <button 
                           key={u.id} 
                           onClick={() => setSelectedUserId(u.id)}
                           className="p-6 bg-white border border-zinc-100 rounded-[2rem] shadow-sm flex items-center justify-between hover:border-zinc-300 transition-all text-left group"
                         >
                            <div className="flex items-center gap-4">
                               <div className="w-10 h-10 rounded-full bg-zinc-900 text-white flex items-center justify-center font-black text-xs group-hover:scale-110 transition-transform">{u.name.charAt(0)}</div>
                               <div>
                                  <p className="text-xs font-black text-zinc-900 uppercase">{u.name}</p>
                                  <p className="text-[9px] text-zinc-400 font-bold uppercase">{u.tier}</p>
                               </div>
                            </div>
                            <svg className="w-4 h-4 text-zinc-200 group-hover:text-zinc-900 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                         </button>
                       ))}
                    </div>
                 </>
               )}
            </div>
          )}
      </div>

      {!isSection && (
        <div className="shrink-0 p-8 border-t border-zinc-50 dark:border-white/5 bg-white dark:bg-zinc-900 z-20">
          <button 
            onClick={() => setShowConfirmPurge(true)}
            className="w-full py-5 rounded-[2rem] bg-zinc-900 dark:bg-white text-white dark:text-black font-black uppercase text-[10px] tracking-[0.4em] active:scale-[0.98] transition-all shadow-xl flex items-center justify-center gap-3"
          >
            Establish New Thread
          </button>
        </div>
      )}

      {/* Purge Confirmation Modal */}
      {showConfirmPurge && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-black/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-xs bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 shadow-2xl border border-zinc-100 dark:border-white/10 animate-in zoom-in-95 duration-300 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-widest">Purge Context?</h3>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">This will establish a new synapse and clear current thread history.</p>
            </div>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => {
                  onClearHistory();
                  onClose();
                  setShowConfirmPurge(false);
                }}
                className="w-full py-4 bg-red-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
              >
                Confirm Purge
              </button>
              <button 
                onClick={() => setShowConfirmPurge(false)}
                className="w-full py-4 bg-zinc-100 dark:bg-white/5 text-zinc-400 dark:text-zinc-500 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isSection) return content;

  return (
    <div className="fixed inset-0 z-[150] flex items-end sm:items-stretch justify-end bg-black/10 backdrop-blur-xl animate-in fade-in slide-in-from-right duration-300">
      {content}
      
      {/* Developer Profile Modal */}
      {showDevProfile && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-zinc-900 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-zinc-900 dark:bg-white flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white dark:text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <div>
                  <h2 className="text-xl font-black font-outfit text-zinc-900 dark:text-white">Arjun Bharti Mina</h2>
                  <p className="text-[9px] uppercase tracking-[0.3em] font-bold text-zinc-400 mt-1">Lead Architect & Developer</p>
                </div>
              </div>
              <button 
                onClick={() => setShowDevProfile(false)}
                className="p-3 text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors bg-zinc-50 dark:bg-white/5 rounded-2xl"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">About Me</h3>
                <div className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300 font-medium whitespace-pre-wrap">
                  {aboutContent.devBio}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="p-6 bg-zinc-50 dark:bg-white/5 rounded-[2rem] border border-zinc-100 dark:border-white/10 space-y-4">
                  <h4 className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Academic Path</h4>
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="w-1 h-1 rounded-full bg-zinc-900 dark:bg-white mt-2 shrink-0"></div>
                      <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">B.Tech in Civil Engineering</p>
                    </div>
                    <p className="text-[10px] text-zinc-500 ml-4">Swami Keshvanand Institute of Technology (SKIT), Jaipur (2022–2026)</p>
                  </div>
                </div>

                <div className="p-6 bg-zinc-50 dark:bg-white/5 rounded-[2rem] border border-zinc-100 dark:border-white/10 space-y-4">
                  <h4 className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Neural Expertise</h4>
                  <div className="flex flex-wrap gap-2">
                    {['AI', 'YouTube SEO', 'Content Strategy', 'Music Production', 'Digital Branding'].map(skill => (
                      <span key={skill} className="px-3 py-1.5 bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-[9px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-8 bg-zinc-900 rounded-[2.5rem] text-white space-y-6">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Connect with the Architect</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {Object.entries(aboutContent.links).map(([key, url]) => (
                    <a 
                      key={key} 
                      href={url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all group"
                    >
                      <div className="w-8 h-8 flex items-center justify-center text-zinc-400 group-hover:text-white transition-colors">
                        {key === 'youtube' && <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>}
                        {key === 'instagram' && <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>}
                        {key === 'spotify' && <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.496 17.306c-.22.363-.694.475-1.056.255-2.856-1.745-6.45-2.14-10.686-1.173-.414.095-.826-.163-.92-.577-.095-.414.163-.826.577-.92 4.63-1.06 8.59-.61 11.78 1.34.363.22.475.694.255 1.056zm1.465-3.263c-.276.45-.863.593-1.313.317-3.268-2.01-8.248-2.592-12.112-1.418-.507.154-1.04-.137-1.194-.644-.154-.507.137-1.04.644-1.194 4.41-1.34 9.9-1.685 13.658.625.45.276.593.863.317 1.313zm.128-3.41c-3.918-2.327-10.375-2.542-14.13-1.403-.602.183-1.237-.153-1.42-.755-.183-.602.153-1.237.755-1.42 4.31-1.308 11.435-1.055 15.94 1.62.54.32.715 1.014.395 1.554-.32.54-1.014.715-1.554.395z"/></svg>}
                        {key === 'website' && <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9h18" /></svg>}
                      </div>
                      <span className="text-[8px] font-black uppercase tracking-widest">{key}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
