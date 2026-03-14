
import React, { useState, useEffect, useRef } from 'react';
import { User, Role, SubscriptionTier, CustomTier, Reminder, TierCapability, UpgradeRequest, NeuralMemoryItem, SiteLog, LyricDraft, VaultItem } from '../types';
import { LANGUAGES } from '../constants';
import { anoraService } from '../services/geminiService';

interface AssistantFeaturesProps {
  user: User;
  onUpdate: (user: User) => void;
  onClearHistory: () => void;
  messagesCount: number;
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'ANALYTICS' | 'NEURAL_MEMORY' | 'UPGRADE' | 'USERS' | 'REQUESTS' | 'ARJUN';
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
  ]
};

export const AssistantFeatures: React.FC<AssistantFeaturesProps> = ({ user, onUpdate, onClearHistory, messagesCount, isOpen, onClose, initialTab, isSection = false }) => {
  // Initial tab set to ANALYTICS for better overview
  const [tab, setTab] = useState<'ANALYTICS' | 'NEURAL_MEMORY' | 'UPGRADE' | 'USERS' | 'REQUESTS' | 'ARJUN'>(initialTab || 'ANALYTICS');
  const [newItem, setNewItem] = useState('');
  const [newDesc, setNewDesc] = useState('');
  
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [upgradeRequests, setUpgradeRequests] = useState<UpgradeRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [arjunDirectives, setArjunDirectives] = useState(user.preferences.arjunDirectives || '');
  
  const [requestedTier, setRequestedTier] = useState<SubscriptionTier>(SubscriptionTier.PRO);
  const [upgradeMessage, setUpgradeMessage] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);

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
    if (usersData) setAllUsers(JSON.parse(usersData));
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

  const isOwner = user.role === Role.OWNER;
  const isPremium = user.tier !== SubscriptionTier.FREE || isOwner;
  const isLifetime = user.tier === SubscriptionTier.LIFETIME;

  // RE-ARRANGED ORDER: Alphabetical
  const activeTabs = isOwner 
    ? (['ANALYTICS', 'ARJUN', 'NEURAL_MEMORY', 'REQUESTS', 'USERS'] as const)
    : (['ANALYTICS', 'NEURAL_MEMORY', 'UPGRADE'] as const);

  if (!isOpen && !isSection) return null;

  const content = (
    <div className={`flex flex-col ${isSection ? 'w-full h-full' : 'w-full max-w-xl h-[95dvh] sm:h-full bg-white dark:bg-zinc-900 border-l border-zinc-100 dark:border-white/5 shadow-2xl overflow-hidden rounded-t-[3rem] sm:rounded-none'}`}>
      
      {!isSection && (
        <div className="px-8 py-8 border-b border-zinc-50 dark:border-white/5 flex items-center justify-between shrink-0 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 rounded-2xl bg-zinc-50 dark:bg-white/5 flex items-center justify-center border border-zinc-100 dark:border-white/10 shadow-sm">
               <svg className="w-5 h-5 text-zinc-900 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
             </div>
             <div>
                <h2 className="text-xl font-black font-outfit text-zinc-900 dark:text-white">Neural Hub</h2>
                <p className="text-[9px] uppercase tracking-[0.3em] font-bold text-zinc-400 mt-1">Sovereign Intel v3.5</p>
             </div>
          </div>
          <button onClick={onClose} className="p-3 text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors bg-zinc-50 dark:bg-white/5 rounded-2xl shadow-sm border border-zinc-100 dark:border-white/10">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      <div className={`flex bg-zinc-50 dark:bg-black/20 p-1.5 mx-6 mt-6 rounded-2xl border border-zinc-100 dark:border-white/10 overflow-x-auto no-scrollbar gap-1 shrink-0 shadow-sm`}>
        {activeTabs.map(t => (
          <button key={t} onClick={() => setTab(t as any)} className={`flex-1 min-w-[90px] py-2.5 text-[8px] font-black uppercase tracking-widest rounded-xl transition-all ${tab === t ? 'bg-zinc-900 dark:bg-white text-white dark:text-black shadow-md' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'}`}>
            {t.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className={`flex-1 overflow-y-auto ${isSection ? 'p-0' : 'p-8'} space-y-10 no-scrollbar pb-32`}>
          {tab === 'ANALYTICS' && (
            <div className="space-y-6 animate-in fade-in duration-500">
               <div className="p-8 bg-zinc-900 rounded-[3rem] text-white space-y-4 shadow-xl">
                  <h3 className="text-xl font-black uppercase tracking-widest font-outfit">Neural Analytics</h3>
                  <div className="grid grid-cols-2 gap-4 pt-4">
                     <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                        <p className="text-[8px] font-black uppercase text-zinc-500 mb-1">Total Synapses</p>
                        <p className="text-2xl font-black">{messagesCount}</p>
                     </div>
                     <div className={`p-4 bg-white/5 rounded-2xl border border-white/10 ${isOwner ? 'border-amber-500/20' : ''}`}>
                        <p className="text-[8px] font-black uppercase text-zinc-500 mb-1">Neural Rank</p>
                        <p className="text-sm font-black text-amber-500 uppercase">{user.tier}</p>
                     </div>
                  </div>
               </div>
               <div className="p-6 bg-zinc-50 border border-zinc-100 rounded-[2.5rem] shadow-sm">
                  <h4 className="text-[10px] font-black text-zinc-900 uppercase tracking-widest mb-4">Compute Efficiency</h4>
                  <div className="space-y-3">
                     {[
                       { label: "Reasoning Core", val: isOwner ? 100 : 85 },
                       { label: "Image Manifest", val: isOwner ? 100 : 70 },
                       { label: "Temporal Motion", val: isOwner ? 100 : 40 }
                     ].map((s, i) => (
                       <div key={i} className="space-y-1">
                          <div className="flex justify-between text-[8px] font-black uppercase">
                             <span className="text-zinc-400">{s.label}</span>
                             <span className="text-zinc-900">{s.val}%</span>
                          </div>
                          <div className="h-1 bg-zinc-200 rounded-full overflow-hidden">
                             <div className="h-full bg-zinc-900" style={{ width: `${s.val}%` }}></div>
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
                  <h3 className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-widest">Active Synapse Records</h3>
                  <p className="text-[8px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest mt-1">Stored knowledge and preference patterns</p>
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

          {tab === 'UPGRADE' && !isOwner && !isLifetime && (
            <div className="space-y-8 animate-in fade-in duration-500 pb-10">
               <div className="p-8 bg-zinc-900 rounded-[3rem] text-white space-y-4 shadow-xl relative overflow-hidden">
                  <div className="absolute top-4 right-8 opacity-20 rotate-12 scale-150">
                    <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  </div>
                  <h3 className="text-xl font-black font-outfit uppercase tracking-tighter relative z-10">Ascend to Neural Pro</h3>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest leading-relaxed relative z-10">
                    Unlock visual synthesis, temporal video rendering, and unlimited deep intelligence cores. 
                    Your current status: <span className="text-white font-black">{user.tier}</span>
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
                        {user.tier === SubscriptionTier.FREE && (
                          <div className="space-y-2">
                             <button 
                              onClick={() => setShowPlanDetails(showPlanDetails === SubscriptionTier.PRO ? null : SubscriptionTier.PRO)}
                              className={`w-full group p-6 bg-white dark:bg-white/5 border rounded-[2.5rem] transition-all flex items-center justify-between active:scale-95 shadow-sm ${showPlanDetails === SubscriptionTier.PRO ? 'border-zinc-900 dark:border-white' : 'border-zinc-100 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/30'}`}
                            >
                               <div className="text-left">
                                  <p className="text-[11px] font-black text-zinc-900 dark:text-white uppercase">Neural Pro Monthly</p>
                                  <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-bold uppercase">Click for feature breakdown</p>
                               </div>
                               <p className="text-lg font-black text-zinc-900 dark:text-white">₹499<span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold ml-1">/MO</span></p>
                            </button>
                            {showPlanDetails === SubscriptionTier.PRO && (
                              <div className="p-6 bg-zinc-50 dark:bg-white/5 rounded-[2rem] border border-zinc-100 dark:border-white/10 animate-in slide-in-from-top-4 duration-300 space-y-4">
                                <ul className="space-y-2">
                                  {PLAN_FEATURES.PRO.map((f, i) => (
                                    <li key={i} className="flex items-center gap-2 text-[9px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">
                                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-900 dark:bg-white"></div>
                                      {f}
                                    </li>
                                  ))}
                                </ul>
                                <button onClick={() => initiatePayment(SubscriptionTier.PRO, 499)} className="w-full py-3 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">Activate Pro Neural Link</button>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="space-y-2">
                          <button 
                            onClick={() => setShowPlanDetails(showPlanDetails === SubscriptionTier.LIFETIME ? null : SubscriptionTier.LIFETIME)}
                            className={`w-full group p-6 rounded-[2.5rem] transition-all flex items-center justify-between active:scale-95 shadow-xl ${user.tier === SubscriptionTier.FREE ? 'bg-zinc-900 dark:bg-white text-white dark:text-black' : 'bg-amber-500 text-black'} ${showPlanDetails === SubscriptionTier.LIFETIME ? 'ring-2 ring-offset-2 ring-zinc-400' : ''}`}
                          >
                             <div className="text-left">
                                <p className={`text-[11px] font-black uppercase ${user.tier === SubscriptionTier.FREE ? 'text-white dark:text-black' : 'text-black'}`}>Neural Sovereign Lifetime</p>
                                <p className={`text-[9px] font-bold uppercase ${user.tier === SubscriptionTier.FREE ? 'text-zinc-500 dark:text-zinc-400' : 'text-amber-900/50'}`}>Eternal priority access</p>
                             </div>
                             <p className={`text-lg font-black ${user.tier === SubscriptionTier.FREE ? 'text-white dark:text-black' : 'text-black'}`}>₹9999<span className={`text-[10px] font-bold ml-1 ${user.tier === SubscriptionTier.FREE ? 'text-zinc-500 dark:text-zinc-400' : 'text-amber-900/50'}`}>ONE TIME</span></p>
                          </button>
                          {showPlanDetails === SubscriptionTier.LIFETIME && (
                            <div className={`p-6 rounded-[2rem] border animate-in slide-in-from-top-4 duration-300 space-y-4 ${user.tier === SubscriptionTier.FREE ? 'bg-zinc-900/5 dark:bg-white/5 text-zinc-900 dark:text-white border-zinc-100 dark:border-white/10' : 'bg-amber-50 text-amber-900 border-amber-100'}`}>
                              <ul className="space-y-2">
                                {PLAN_FEATURES.LIFETIME.map((f, i) => (
                                  <li key={i} className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest opacity-80">
                                    <div className={`w-1.5 h-1.5 rounded-full ${user.tier === SubscriptionTier.FREE ? 'bg-zinc-900 dark:bg-white' : 'bg-amber-600'}`}></div>
                                    {f}
                                  </li>
                                ))}
                              </ul>
                              <button onClick={() => initiatePayment(SubscriptionTier.LIFETIME, 9999)} className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg ${user.tier === SubscriptionTier.FREE ? 'bg-zinc-900 dark:bg-white text-white dark:text-black' : 'bg-amber-500 text-black'}`}>Establish Eternal Bond</button>
                            </div>
                          )}
                        </div>
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
            onClick={() => {
               if(window.confirm("Purge thread context and establish new synapse?")) {
                 onClearHistory();
                 onClose();
               }
            }}
            className="w-full py-5 rounded-[2rem] bg-zinc-900 dark:bg-white text-white dark:text-black font-black uppercase text-[10px] tracking-[0.4em] active:scale-[0.98] transition-all shadow-xl flex items-center justify-center gap-3"
          >
            Establish New Thread
          </button>
        </div>
      )}
    </div>
  );

  if (isSection) return content;

  return (
    <div className="fixed inset-0 z-[150] flex items-end sm:items-stretch justify-end bg-black/10 backdrop-blur-xl animate-in fade-in slide-in-from-right duration-300">
      {content}
    </div>
  );
};
