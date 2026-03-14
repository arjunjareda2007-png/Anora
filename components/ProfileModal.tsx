
import React, { useState, useEffect } from 'react';
import { User, Role, SubscriptionTier, AiMood, IntelligenceLevel, Persona, AppTheme } from '../types';
import { ACCENT_COLORS, PREBUILT_VOICES, PERSONA_INSTRUCTIONS, THEMES, LANGUAGES } from '../constants';
import { anoraService } from '../services/geminiService';
import { safeLocalStorage, pruneUser } from '../src/utils/storage';

interface ProfileModalProps {
  user: User;
  isOpen: boolean;
  initialSection?: string;
  onClose: () => void;
  onUpdate: (updatedUser: User) => void;
  onLogout: () => void;
}

const LIMIT_REFS = {
  FREE: { chat: 20000, image: 10, video: 0 },
  PRO: { chat: 100000, image: 100, video: 20 },
  LIFETIME: { chat: 100000, image: 100, video: 20 },
  OWNER: { chat: 1, image: 1, video: 1 } // Normalized for Infinity
};

export const ProfileModal: React.FC<ProfileModalProps> = ({ user, isOpen, initialSection, onClose, onUpdate, onLogout }) => {
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio || '');
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [mood, setMood] = useState<AiMood>(user.preferences.aiMood);
  const [accent, setAccent] = useState(user.preferences.accentColor);
  const [intel, setIntel] = useState<IntelligenceLevel>(user.preferences.intelligenceLevel || 'BALANCED');
  const [voiceName, setVoiceName] = useState(user.preferences.voiceName || 'Kore');
  const [persona, setPersona] = useState<Persona>(user.preferences.persona || 'DEFAULT');
  const [theme, setTheme] = useState<AppTheme>(user.preferences.theme || 'MINIMAL');
  const [colorMode, setColorMode] = useState<'WHITE' | 'DARK'>(user.preferences.colorMode || 'WHITE');
  const [dob, setDob] = useState(user.dob || '');
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber || '');
  const [password, setPassword] = useState(user.password || '');
  const [language, setLanguage] = useState(user.preferences.language || 'Hindi');
  const [transferEmail, setTransferEmail] = useState('');
  
  const [expandedSection, setExpandedSection] = useState<'PERSONA' | 'VOICE' | 'THEME' | 'OWNERSHIP' | 'USER_MANAGEMENT' | 'LANGUAGE' | null>(null);
  const [avatarPrompt, setAvatarPrompt] = useState('');
  const [generatingAvatar, setGeneratingAvatar] = useState(false);
  const [showToast, setShowToast] = useState(false);

  // User Management State
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(user.name);
      setBio(user.bio || '');
      setAvatar(user.avatar || '');
      setMood(user.preferences.aiMood);
      setAccent(user.preferences.accentColor);
      setIntel(user.preferences.intelligenceLevel || 'BALANCED');
      setVoiceName(user.preferences.voiceName || 'Kore');
      setPersona(user.preferences.persona || 'DEFAULT');
      setTheme(user.preferences.theme || 'MINIMAL');
      setColorMode(user.preferences.colorMode || 'WHITE');
      setDob(user.dob || '');
      setPhoneNumber(user.phoneNumber || '');
      setPassword(user.password || '');
      setLanguage(user.preferences.language || 'Hindi');
      setTransferEmail('');
      
      if (initialSection) {
        setExpandedSection(initialSection as any);
        // Auto-scroll to the section after a short delay to allow expansion
        setTimeout(() => {
          const element = document.getElementById(`section-${initialSection}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 300);
      }

      if (user.role === Role.OWNER) {
        try {
          const users = JSON.parse(safeLocalStorage.getItem('anora_users_db') || '[]');
          setAllUsers(users);
        } catch (e) {
          console.error("Neural database load error", e);
        }
      }
    }
  }, [user, isOpen, initialSection]);

  if (!isOpen) return null;

  const isOwner = user.role === Role.OWNER;
  const isPremium = user.tier !== SubscriptionTier.FREE || isOwner;
  const remainingChat = user.tokens?.chat ?? 0;
  const remainingImages = user.tokens?.image ?? 0;
  const remainingVideos = user.tokens?.video ?? 0;
  
  const limits = isOwner ? LIMIT_REFS.OWNER : (LIMIT_REFS[user.tier] || LIMIT_REFS.FREE);

  const handleSave = () => {
    onUpdate({
      ...user,
      name, bio, avatar,
      dob,
      phoneNumber,
      password,
      preferences: {
        ...user.preferences,
        aiMood: mood,
        accentColor: accent,
        intelligenceLevel: intel,
        voiceName,
        persona,
        theme,
        colorMode,
        language
      }
    });
    setShowToast(true);
    setTimeout(() => {
        setShowToast(false);
        onClose();
    }, 1500);
  };

  const handleTransferOwnership = () => {
    if (!transferEmail.trim()) return;
    
    // Using console for confirmation as per iframe restrictions, 
    // in a real app we'd use a custom modal.
    console.log(`Initiating ownership transfer to ${transferEmail}`);
    
    let users: User[] = [];
    try {
      users = JSON.parse(safeLocalStorage.getItem('anora_users_db') || '[]');
    } catch (e) {
      console.error("Neural database access error", e);
      return;
    }
    const targetUser = users.find(u => u.email.toLowerCase() === transferEmail.toLowerCase());
    
    if (!targetUser) {
      console.warn("Target identity not found in neural records.");
      return;
    }

    const updatedUsers = users.map(u => {
      if (u.email.toLowerCase() === transferEmail.toLowerCase()) {
        return { ...u, role: Role.OWNER, tier: SubscriptionTier.PRO };
      }
      return u;
    });

    const prunedUsers = updatedUsers.map(u => pruneUser(u));
    safeLocalStorage.setItem('anora_users_db', JSON.stringify(prunedUsers));
    window.dispatchEvent(new Event('anora_database_updated'));
    console.log(`Ownership protocol shared with ${targetUser.name}.`);
    setTransferEmail('');
    setExpandedSection(null);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleGenerateAvatar = async () => {
    if (!avatarPrompt.trim()) return;
    setGeneratingAvatar(true);
    try {
      const bytes = await anoraService.generateImage(`Futuristic high-fidelity digital avatar profile: ${avatarPrompt}`);
      setAvatar(`data:image/png;base64,${bytes}`);
      setAvatarPrompt('');
    } catch (err: any) {
      console.error(`Synthesis Error: ${err.message}`);
    } finally {
      setGeneratingAvatar(false);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAvatar(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateOtherUser = (updatedUser: User) => {
    try {
      const users: User[] = JSON.parse(safeLocalStorage.getItem('anora_users_db') || '[]');
      const prunedUpdated = pruneUser(updatedUser);
      const updatedUsers = users.map(u => u.id === updatedUser.id ? prunedUpdated : u);
      safeLocalStorage.setItem('anora_users_db', JSON.stringify(updatedUsers));
      setAllUsers(updatedUsers);
      setEditingUser(null);
      window.dispatchEvent(new Event('anora_database_updated'));
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } catch (e) {
      console.error("Neural identity update error", e);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 sm:p-6 bg-black/5 backdrop-blur-2xl animate-in fade-in duration-300">
      {showToast && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[220] animate-in slide-in-from-top-6 duration-500 shadow-2xl">
          <div className="px-10 py-4 bg-zinc-900 text-white rounded-full font-black text-[9px] uppercase tracking-[0.5em]">Neural Link Synced</div>
        </div>
      )}

      <div className={`w-full max-w-5xl bg-white dark:bg-zinc-900 border rounded-none sm:rounded-[4rem] shadow-2xl flex flex-col h-[100dvh] sm:h-auto sm:max-h-[92vh] overflow-hidden transition-all duration-500 relative ${isOwner ? 'border-amber-500/30 ring-1 ring-amber-500/10' : 'border-zinc-100 dark:border-white/10'}`}>
        
        {/* Unique Background Effect for Owner */}
        {isOwner && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20 z-0">
            <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-amber-500/20 blur-[120px] rounded-full animate-pulse"></div>
            <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] bg-amber-200/10 blur-[120px] rounded-full animate-pulse [animation-delay:2s]"></div>
          </div>
        )}

        <div className="shrink-0 px-8 py-8 border-b border-zinc-50 dark:border-white/5 flex items-center justify-between bg-white/90 dark:bg-black/20 backdrop-blur-md z-20">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-2xl font-black font-outfit text-zinc-900 dark:text-white tracking-tight">Profile Settings</h2>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-[9px] text-zinc-400 font-black uppercase tracking-[0.4em]">Neural Identity Sync</p>
                <div className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest ${isOwner ? 'bg-amber-500 text-black' : 'bg-zinc-100 dark:bg-white/10 text-zinc-500'}`}>
                  {isOwner ? 'Sovereign' : 'Neural Citizen'}
                </div>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-4 text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-all bg-zinc-50 dark:bg-white/5 rounded-3xl shadow-sm border border-zinc-100 dark:border-white/10">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-10 space-y-12 no-scrollbar relative z-10 pb-32">
          
          {/* Section 1: Identity Protocol */}
          <section id="section-PROFILE" className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-4 space-y-8">
               <div className="flex flex-col items-center gap-6">
                  <div className={`w-40 h-40 rounded-[3rem] bg-zinc-50 dark:bg-black/20 border flex items-center justify-center text-5xl font-black text-zinc-900 dark:text-white relative shadow-inner overflow-hidden group ${isOwner ? 'border-amber-500/20' : 'border-zinc-200 dark:border-white/10'}`}>
                    {avatar ? <img src={avatar} className="w-full h-full object-cover" /> : name.charAt(0)}
                    {generatingAvatar && <div className="absolute inset-0 bg-white/90 dark:bg-black/90 flex items-center justify-center backdrop-blur-md animate-pulse">...</div>}
                    <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <span className="text-[9px] font-black text-white uppercase tracking-widest">Upload Identity</span>
                      <input type="file" hidden accept="image/*" onChange={handleAvatarUpload} />
                    </label>
                  </div>
                  <div className="w-full space-y-2">
                     <input 
                       value={avatarPrompt} 
                       onChange={e => setAvatarPrompt(e.target.value)} 
                       placeholder="Appearance command..." 
                       className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-2xl px-5 py-3 text-[10px] text-zinc-900 dark:text-white outline-none shadow-sm focus:border-zinc-300 dark:focus:border-white/20"
                     />
                     <button onClick={handleGenerateAvatar} disabled={generatingAvatar || !avatarPrompt.trim()} className="w-full py-3 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 disabled:opacity-20">Re-Synth Appearance</button>
                  </div>
               </div>
            </div>

            <div className="lg:col-span-8 space-y-10">
               <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest ml-2">Neural Alias</label>
                  <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-2xl px-6 py-4 text-zinc-900 dark:text-white font-bold shadow-sm outline-none focus:border-zinc-300 dark:focus:border-white/20" />
               </div>
               <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest ml-2">Synapse Protocol (Bio)</label>
                  <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-[2rem] p-6 text-zinc-700 dark:text-zinc-300 text-sm outline-none shadow-sm focus:border-zinc-300 dark:focus:border-white/20 resize-none" placeholder="Provide core identity data..." />
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest ml-2">Date of Birth</label>
                    <input type="date" value={dob} onChange={e => setDob(e.target.value)} className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-2xl px-6 py-4 text-zinc-900 dark:text-white font-bold shadow-sm outline-none focus:border-zinc-300 dark:focus:border-white/20" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest ml-2">Phone Number</label>
                    <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="+1 234 567 890" className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-2xl px-6 py-4 text-zinc-900 dark:text-white font-bold shadow-sm outline-none focus:border-zinc-300 dark:focus:border-white/20" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest ml-2">Neural Access Key (Password)</label>
                    <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="Secure access key..." className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-2xl px-6 py-4 text-zinc-900 dark:text-white font-bold shadow-sm outline-none focus:border-zinc-300 dark:focus:border-white/20" />
                  </div>
                </div>
            </div>
          </section>

          {/* Section 2: Persona & Intelligence */}
          <section id="section-PERSONA" className="space-y-8 pt-6">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-2">
                <div>
                  <label className="text-[11px] font-black text-zinc-900 dark:text-white uppercase tracking-widest">AI Persona</label>
                  <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Behavioral archetype & intelligence</p>
                </div>
                <div className="flex gap-2">
                  {(['LITE', 'BALANCED', 'DEEP'] as IntelligenceLevel[]).map(i => (
                    <button key={i} onClick={() => setIntel(i)} className={`px-4 py-2 rounded-xl border text-[8px] font-black uppercase transition-all shadow-sm ${intel === i ? 'bg-zinc-900 dark:bg-white text-white dark:text-black border-zinc-900 dark:border-white' : 'bg-white dark:bg-white/5 text-zinc-400 border-zinc-100 dark:border-white/10'}`}>{i}</button>
                  ))}
                </div>
             </div>
             
             <div className="space-y-4">
                <button 
                  onClick={() => setExpandedSection(expandedSection === 'PERSONA' ? null : 'PERSONA')}
                  className="w-full flex items-center justify-between p-6 bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-[2rem] hover:border-zinc-300 dark:hover:border-white/20 transition-all group"
                >
                  <div className="flex flex-col text-left">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Active Persona</span>
                    <span className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight mt-1">{persona}</span>
                  </div>
                  <div className={`p-2 rounded-full bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-white/10 transition-transform duration-300 ${expandedSection === 'PERSONA' ? 'rotate-180' : ''}`}>
                    <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </button>

                {expandedSection === 'PERSONA' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in slide-in-from-top-4 duration-300">
                    {(Object.keys(PERSONA_INSTRUCTIONS) as Persona[]).map(pKey => (
                      <button 
                        key={pKey}
                        onClick={() => { setPersona(pKey); setExpandedSection(null); }}
                        className={`p-6 rounded-[2.5rem] border text-left transition-all relative group shadow-sm ${persona === pKey ? 'bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white text-white dark:text-black shadow-2xl scale-105 ring-4 ring-zinc-900/10 dark:ring-white/10' : 'bg-white dark:bg-white/5 border-zinc-100 dark:border-white/10 text-zinc-400 hover:border-zinc-300 dark:hover:border-white/20'}`}
                      >
                         <div className="flex justify-between items-center">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${persona === pKey ? (colorMode === 'DARK' ? 'text-black' : 'text-white') : 'text-zinc-900 dark:text-white'}`}>{pKey}</span>
                            {persona === pKey && (
                              <div className={`flex items-center justify-center w-5 h-5 rounded-full ${colorMode === 'DARK' ? 'bg-black text-white' : 'bg-white text-zinc-900'}`}>
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              </div>
                            )}
                         </div>
                      </button>
                    ))}
                  </div>
                )}
             </div>
          </section>

          {/* Section 3: Visuals & Voice */}
          <section id="section-VOICE" className="space-y-8 pt-6">
             <div className="px-2 flex justify-between items-center">
                <div>
                  <label className="text-[11px] font-black text-zinc-900 dark:text-white uppercase tracking-widest">Visuals & Voice</label>
                  <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Theme and vocal calibration</p>
                </div>
                {/* Language Selection - Inline Style */}
                <div className="relative">
                  <button 
                    onClick={() => setExpandedSection(expandedSection === 'LANGUAGE' ? null : 'LANGUAGE')}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-xl hover:border-zinc-300 transition-all"
                  >
                    <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Language:</span>
                    <span className="text-[9px] font-black text-zinc-900 dark:text-white uppercase tracking-tight">{language}</span>
                  </button>
                  
                  {expandedSection === 'LANGUAGE' && (
                    <div className="absolute right-0 top-full mt-2 w-48 max-h-64 overflow-y-auto bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-white/10 rounded-2xl shadow-2xl z-50 p-2 no-scrollbar animate-in fade-in slide-in-from-top-2 duration-200">
                      {LANGUAGES.map((l: string) => (
                        <button 
                          key={l} 
                          onClick={() => { setLanguage(l); setExpandedSection(null); }}
                          className={`w-full text-left px-4 py-3 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${language === l ? 'bg-zinc-900 dark:bg-white text-white dark:text-black' : 'text-zinc-400 hover:bg-zinc-50 dark:hover:bg-white/5'}`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
             </div>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Theme Selector */}
                <div className="space-y-4">
                  <button 
                    onClick={() => setExpandedSection(expandedSection === 'THEME' ? null : 'THEME')}
                    className="w-full flex items-center justify-between p-6 bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-[2rem] hover:border-zinc-300 dark:hover:border-white/20 transition-all group"
                  >
                    <div className="flex flex-col text-left">
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Visual Core</span>
                      <span className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight mt-1">{theme.replace('_', ' ')}</span>
                    </div>
                    <div className={`p-2 rounded-full bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-white/10 transition-transform duration-300 ${expandedSection === 'THEME' ? 'rotate-180' : ''}`}>
                      <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </button>

                  {expandedSection === 'THEME' && (
                    <div className="grid grid-cols-1 gap-2 p-4 bg-zinc-50 dark:bg-white/5 rounded-[2rem] animate-in slide-in-from-top-4 duration-300">
                      {THEMES.map(t => (
                        <button key={t} onClick={() => { setTheme(t); setExpandedSection(null); }} className={`w-full p-4 rounded-xl border text-left transition-all text-[8px] font-black uppercase tracking-widest ${theme === t ? 'bg-zinc-900 dark:bg-white text-white dark:text-black border-zinc-900 dark:border-white' : 'bg-white dark:bg-white/5 text-zinc-400 border-zinc-100 dark:border-white/10 hover:border-zinc-200 dark:hover:border-white/20'}`}>
                          {t.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Vocal Matrix */}
                <div className="space-y-4">
                  <button 
                    onClick={() => setExpandedSection(expandedSection === 'VOICE' ? null : 'VOICE')}
                    className="w-full flex items-center justify-between p-6 bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-[2rem] hover:border-zinc-300 dark:hover:border-white/20 transition-all group"
                  >
                    <div className="flex flex-col text-left">
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Vocal Manifest</span>
                      <span className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight mt-1">{voiceName}</span>
                    </div>
                    <div className={`p-2 rounded-full bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-white/10 transition-transform duration-300 ${expandedSection === 'VOICE' ? 'rotate-180' : ''}`}>
                      <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </button>

                  {expandedSection === 'VOICE' && (
                    <div className="space-y-2 max-h-[250px] overflow-y-auto no-scrollbar p-4 bg-zinc-50 dark:bg-white/5 rounded-[2rem] animate-in slide-in-from-top-4 duration-300">
                      {PREBUILT_VOICES.map((v, i) => (
                        <button key={i} onClick={() => { setVoiceName(v.name); setExpandedSection(null); }} className={`w-full p-4 rounded-xl border text-left transition-all ${voiceName === v.name ? 'bg-zinc-900 dark:bg-white text-white dark:text-black shadow-md' : 'bg-white dark:bg-white/5 border-zinc-100 dark:border-white/10 text-zinc-400'}`}>
                           <div className="flex justify-between items-center">
                              <span className="text-[8px] font-black uppercase tracking-widest">{(v as any).alias || v.name}</span>
                              <span className="text-[7px] font-bold opacity-30">{v.gender}</span>
                           </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Color Mode & Aura */}
                <div className="p-8 bg-zinc-50 dark:bg-black/20 border border-zinc-100 dark:border-white/10 rounded-[3rem] space-y-8 shadow-sm lg:col-span-2">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <h4 className="text-[9px] font-black text-zinc-300 dark:text-zinc-600 uppercase tracking-widest">Interface Mode</h4>
                        <div className="flex gap-2">
                           <button onClick={() => setColorMode('WHITE')} className={`flex-1 py-4 rounded-2xl border text-[9px] font-black uppercase tracking-widest transition-all ${colorMode === 'WHITE' ? 'bg-white text-zinc-900 border-zinc-300 shadow-sm' : 'bg-zinc-100 dark:bg-white/5 text-zinc-400 border-zinc-100 dark:border-white/10'}`}>Light</button>
                           <button onClick={() => setColorMode('DARK')} className={`flex-1 py-4 rounded-2xl border text-[9px] font-black uppercase tracking-widest transition-all ${colorMode === 'DARK' ? 'bg-zinc-800 text-white border-zinc-700 shadow-sm' : 'bg-zinc-100 dark:bg-white/5 text-zinc-400 border-zinc-100 dark:border-white/10'}`}>Dark</button>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[9px] font-black text-zinc-300 dark:text-zinc-600 uppercase tracking-widest">Neural Aura</h4>
                          <div className="flex items-center gap-2">
                             <span className="text-[7px] font-black text-zinc-400 uppercase tracking-widest">Live Preview</span>
                             <div className="w-3 h-3 rounded-full animate-pulse shadow-[0_0_10px_rgba(0,0,0,0.1)]" style={{ backgroundColor: accent, boxShadow: `0 0 15px ${accent}80` }}></div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-4">
                          {ACCENT_COLORS.map(c => (
                            <button 
                              key={c.name} 
                              onClick={() => setAccent(c.value)} 
                              className={`w-10 h-10 rounded-full border-2 transition-all shadow-sm flex items-center justify-center ${accent === c.value ? 'border-zinc-900 dark:border-white scale-125 ring-4 ring-zinc-900/10 dark:ring-white/10' : 'border-transparent opacity-40 hover:opacity-100'}`} 
                              style={{ backgroundColor: c.value }}
                            >
                              {accent === c.value && (
                                <svg className={`w-4 h-4 ${c.name === 'White' ? 'text-black' : 'text-white'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                   </div>
                </div>
             </div>
          </section>

          {/* Section 4: Resources */}
          <section id="section-RESOURCES" className="space-y-6 pt-6">
            <div className="flex justify-between items-center px-2">
              <div>
                <label className="text-[11px] font-black text-zinc-900 dark:text-white uppercase tracking-widest">Resources</label>
                <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Daily allocation: <span className="text-zinc-900 dark:text-white font-black">{user.tier}</span></p>
              </div>
              {!isPremium && (
                <button 
                  onClick={() => { onClose(); /* Hub will open via App logic if needed, or just tell user to use Hub */ }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[8px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                >
                  Upgrade to Pro
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 bg-zinc-50 dark:bg-black/20 border border-zinc-100 dark:border-white/10 rounded-2xl shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[7px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">Chat</span>
                  <span className={`text-sm font-black font-outfit ${isOwner ? 'text-amber-500' : 'text-zinc-900 dark:text-white'}`}>{isOwner ? '∞' : remainingChat.toLocaleString()}</span>
                </div>
                <div className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className={`h-full ${isOwner ? 'bg-amber-500 w-full' : 'bg-zinc-900 dark:bg-white'}`} style={{ width: isOwner ? '100%' : `${Math.min(100, (remainingChat / limits.chat) * 100)}%` }}></div>
                </div>
              </div>
              <div className="p-4 bg-zinc-50 dark:bg-black/20 border border-zinc-100 dark:border-white/10 rounded-2xl shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[7px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">Images</span>
                  <span className={`text-sm font-black font-outfit ${isOwner ? 'text-amber-500' : 'text-zinc-900 dark:text-white'}`}>{isOwner ? '∞' : remainingImages}</span>
                </div>
                <div className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className={`h-full ${isOwner ? 'bg-amber-500 w-full' : 'bg-zinc-900 dark:bg-white'}`} style={{ width: isOwner ? '100%' : `${Math.min(100, (remainingImages / limits.image) * 100)}%` }}></div>
                </div>
              </div>
              <div className="p-4 bg-zinc-50 dark:bg-black/20 border border-zinc-100 dark:border-white/10 rounded-2xl shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[7px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">Video</span>
                  <span className={`text-sm font-black font-outfit ${isOwner ? 'text-amber-500' : (remainingVideos > 0 ? 'text-zinc-900 dark:text-white' : 'text-zinc-300 dark:text-zinc-700')}`}>{isOwner ? '∞' : remainingVideos}</span>
                </div>
                <div className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className={`h-full ${isOwner ? 'bg-amber-500 w-full' : 'bg-zinc-900 dark:bg-white'}`} style={{ width: isOwner ? '100%' : limits.video > 0 ? `${Math.min(100, (remainingVideos / limits.video) * 100)}%` : '0%' }}></div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 5: Owner Protocols */}
          {isOwner && (
            <section className="space-y-6 pt-6 border-t border-zinc-50 dark:border-white/5">
              <div className="px-2">
                <label className="text-[11px] font-black text-amber-500 uppercase tracking-widest">Sovereign Protocols</label>
                <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Ownership & administrative controls</p>
              </div>
              
              <div className="space-y-4">
                {/* User Management */}
                <button 
                  onClick={() => setExpandedSection(expandedSection === 'USER_MANAGEMENT' ? null : 'USER_MANAGEMENT')}
                  className="w-full flex items-center justify-between p-6 bg-amber-500/5 border border-amber-500/20 rounded-[2rem] hover:bg-amber-500/10 transition-all group"
                >
                  <div className="flex flex-col text-left">
                    <span className="text-[10px] font-black text-amber-500/60 uppercase tracking-widest">User Management</span>
                    <span className="text-sm font-black text-amber-500 uppercase tracking-tight mt-1">Control Neural Identities</span>
                  </div>
                  <div className={`p-2 rounded-full bg-white dark:bg-zinc-800 border border-amber-500/20 transition-transform duration-300 ${expandedSection === 'USER_MANAGEMENT' ? 'rotate-180' : ''}`}>
                    <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </button>

                {expandedSection === 'USER_MANAGEMENT' && (
                  <div className="p-6 bg-zinc-50 dark:bg-black/20 border border-zinc-100 dark:border-white/10 rounded-[3rem] space-y-6 animate-in slide-in-from-top-4 duration-300">
                    {editingUser ? (
                      <div className="space-y-6 p-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-widest">Editing: {editingUser.name}</h4>
                          <button onClick={() => setEditingUser(null)} className="text-[8px] font-black uppercase text-zinc-400 hover:text-zinc-900 dark:hover:text-white">Cancel</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest ml-1">DOB</label>
                            <input type="date" value={editingUser.dob || ''} onChange={e => setEditingUser({...editingUser, dob: e.target.value})} className="w-full bg-white dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs outline-none" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest ml-1">Phone</label>
                            <input type="tel" value={editingUser.phoneNumber || ''} onChange={e => setEditingUser({...editingUser, phoneNumber: e.target.value})} className="w-full bg-white dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs outline-none" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest ml-1">Password</label>
                            <input type="text" value={editingUser.password} onChange={e => setEditingUser({...editingUser, password: e.target.value})} className="w-full bg-white dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs outline-none" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest ml-1">Tier</label>
                            <select value={editingUser.tier} onChange={e => setEditingUser({...editingUser, tier: e.target.value as SubscriptionTier})} className="w-full bg-white dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs outline-none">
                              <option value={SubscriptionTier.FREE}>Free</option>
                              <option value={SubscriptionTier.PRO}>Pro</option>
                              <option value={SubscriptionTier.LIFETIME}>Lifetime</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest ml-1">Role</label>
                            <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as Role})} className="w-full bg-white dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs outline-none">
                              <option value={Role.USER}>User</option>
                              <option value={Role.OWNER}>Owner</option>
                            </select>
                          </div>
                        </div>
                        <button onClick={() => handleUpdateOtherUser(editingUser)} className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-lg">Save Changes</button>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[400px] overflow-y-auto no-scrollbar pr-2">
                        {allUsers.map(u => (
                          <div key={u.id} className="flex items-center justify-between p-4 bg-white dark:bg-black/40 border border-zinc-100 dark:border-white/10 rounded-2xl hover:border-amber-500/30 transition-all">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-white/5 flex items-center justify-center text-xs font-black overflow-hidden">
                                {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : u.name.charAt(0)}
                              </div>
                              <div>
                                <h5 className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-tight">{u.name}</h5>
                                <p className="text-[7px] text-zinc-400 font-bold uppercase tracking-widest">{u.email} // {u.tier}</p>
                              </div>
                            </div>
                            <button onClick={() => setEditingUser(u)} className="px-3 py-1.5 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-lg text-[7px] font-black uppercase tracking-widest shadow-sm">Edit</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Ownership Transfer */}
                <button 
                  onClick={() => setExpandedSection(expandedSection === 'OWNERSHIP' ? null : 'OWNERSHIP')}
                  className="w-full flex items-center justify-between p-6 bg-amber-500/5 border border-amber-500/20 rounded-[2rem] hover:bg-amber-500/10 transition-all group"
                >
                  <div className="flex flex-col text-left">
                    <span className="text-[10px] font-black text-amber-500/60 uppercase tracking-widest">Ownership Transfer</span>
                    <span className="text-sm font-black text-amber-500 uppercase tracking-tight mt-1">Share Sovereign Authority</span>
                  </div>
                  <div className={`p-2 rounded-full bg-white dark:bg-zinc-800 border border-amber-500/20 transition-transform duration-300 ${expandedSection === 'OWNERSHIP' ? 'rotate-180' : ''}`}>
                    <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </button>

                {expandedSection === 'OWNERSHIP' && (
                  <div className="p-8 bg-zinc-50 dark:bg-black/20 border border-zinc-100 dark:border-white/10 rounded-[3rem] space-y-6 animate-in slide-in-from-top-4 duration-300">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">Target Identity Email</label>
                      <input 
                        type="email" 
                        value={transferEmail} 
                        onChange={e => setTransferEmail(e.target.value)} 
                        placeholder="identity@neural.link"
                        className="w-full bg-white dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-2xl px-6 py-4 text-zinc-900 dark:text-white font-bold shadow-sm outline-none focus:border-amber-500/50" 
                      />
                    </div>
                    <button 
                      onClick={handleTransferOwnership}
                      disabled={!transferEmail.trim()}
                      className="w-full py-5 bg-amber-500 text-black rounded-[2rem] text-[10px] font-black uppercase tracking-[0.3em] shadow-xl shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-20"
                    >
                      Grant Sovereign Access
                    </button>
                    <p className="text-[8px] text-zinc-400 text-center font-bold uppercase tracking-widest leading-relaxed">
                      Warning: Granting ownership provides full access to system protocols and administrative tools. This action is recorded in the neural ledger.
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Section 6: Architect Signature */}
          <section className="flex flex-col items-center justify-center py-10 border-t border-zinc-50 dark:border-white/5 opacity-60 hover:opacity-100 transition-opacity">
             <span className="text-[7px] font-black uppercase tracking-[1em] text-zinc-300 dark:text-zinc-700 mb-3">Sovereign Architect</span>
             <h3 className="text-lg font-black text-zinc-900 dark:text-white tracking-[0.3em] font-outfit uppercase">Arjun Bharti Mina</h3>
             <div className="flex gap-3 mt-4">
                <div className="px-3 py-1 bg-zinc-900 dark:bg-white rounded-full text-[7px] font-black text-white dark:text-black uppercase tracking-widest shadow-lg">Civil Engineer // CAD Expert</div>
                <div className="px-3 py-1 border border-zinc-100 dark:border-white/10 rounded-full text-[7px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest bg-white dark:bg-black shadow-sm">Anora v8.5 Core</div>
             </div>
          </section>
        </div>

        <div className="shrink-0 p-8 border-t border-zinc-50 dark:border-white/5 flex flex-col sm:flex-row gap-4 bg-white dark:bg-zinc-900 z-20">
          <button onClick={handleSave} className="flex-[2] font-black py-5 rounded-[2rem] bg-zinc-900 dark:bg-white text-white dark:text-black uppercase text-[10px] tracking-[0.4em] shadow-xl hover:bg-black dark:hover:bg-zinc-100 transition-all active:scale-[0.98]">Synchronize Profile</button>
          <button onClick={onLogout} className="flex-1 py-5 rounded-[2rem] bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 font-black uppercase text-[10px] tracking-[0.2em] shadow-sm hover:bg-red-500 hover:text-white transition-all">Sign Out</button>
        </div>
      </div>
    </div>
  );
};
