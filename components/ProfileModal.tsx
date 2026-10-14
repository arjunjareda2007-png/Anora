
import React, { useState, useEffect, useCallback } from 'react';
import { User, Role, SubscriptionTier, AiMood, IntelligenceLevel, Persona, AppTheme } from '../types';
import { ACCENT_COLORS, PREBUILT_VOICES, PERSONA_INSTRUCTIONS, THEMES, LANGUAGES, OWNER_EMAIL } from '../constants';
import { anoraService } from '../services/geminiService';
import { safeLocalStorage, pruneUser, cleanFirestoreData } from '../src/utils/storage';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc, onSnapshot, collection } from 'firebase/firestore';
import Cropper from 'react-easy-crop';
import { Camera, Crop as CropIcon, Check, X as CloseIcon, CheckCircle2 } from 'lucide-react';
import { VerificationTick } from './VerificationTick';
import { PersonaImageEditor } from './PersonaImageEditor';
import { PERSONA_IMAGES } from '../src/constants/personas';

interface ProfileModalProps {
  user: User;
  isOpen: boolean;
  initialSection?: string;
  onClose: () => void;
  onUpdate: (updatedUser: User) => void;
  onLogout: () => void;
  onOpenHubWithTab?: (tab: 'ANALYTICS' | 'NEURAL_MEMORY' | 'UPGRADE' | 'USERS' | 'REQUESTS' | 'ARJUN' | 'HELP' | 'NOTIFICATIONS' | 'BROADCAST') => void;
  ownerAvatars?: Record<string, string>;
}

const LIMIT_REFS = {
  FREE: { chat: 20000, image: 10, video: 0 },
  PRO: { chat: 100000, image: 100, video: 20 },
  PLATINUM: { chat: 500000, image: 500, video: 100 },
  DIAMOND: { chat: 1000000, image: 1000, video: 500 },
  LIFETIME: { chat: 1000000, image: 1000, video: 500 },
  OWNER: { chat: 1, image: 1, video: 1 } // Normalized for Infinity
};

const FAQ_ITEMS = [
  { q: "What is Anora?", a: "Anora is a Sovereign Intelligence designed to facilitate your creative and engineering objectives with precision and human-like empathy." },
  { q: "How do I upgrade my plan?", a: "You can upgrade through the 'Upgrade' section in your profile. For the Owner plan, you must contact the Sovereign Architect directly." },
  { q: "Can I change my AI persona?", a: "Yes, you can switch between various personas like Friend, Mentor, or Teacher in the 'Persona & Intelligence' section." },
  { q: "How do I contact support?", a: "Use the contact form below or reach out to support@anora.ai for direct assistance." }
];

const NOTIFICATIONS = [
  { id: '1', title: 'Anora v13.05.2007 Core Release', date: '2026-08-18', content: 'Neural pathways optimized with enhanced error recovery, sleek minimal interface, and instant PWA standalone architecture.' },
  { id: '2', title: 'New Persona: Sovereign AI', date: '2026-08-10', content: 'A new post-human intelligence persona is now available for all users.' },
  { id: '3', title: 'Neural Mesh Synchronized', date: '2026-08-01', content: 'Full offline reliability, real-time streaming recovery, and multi-modal intelligence updated.' }
];

type ExpandedSection = 'PERSONA' | 'VOICE' | 'THEME' | 'OWNERSHIP' | 'USER_MANAGEMENT' | 'LANGUAGE' | 'HELP' | 'NOTIFICATIONS' | 'UPGRADE' | 'IDENTITY' | 'RESOURCES' | 'INTELLIGENCE' | null;

export const ProfileModal: React.FC<ProfileModalProps> = ({ user, isOpen, initialSection, onClose, onUpdate, onLogout, onOpenHubWithTab, ownerAvatars = {} }) => {
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio || '');
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [mood, setMood] = useState<AiMood>(user.preferences.aiMood);
  const [accent, setAccent] = useState(user.preferences.accentColor);
  const [intel, setIntel] = useState<IntelligenceLevel>(user.preferences.intelligenceLevel || 'BALANCED');
  const [voiceName, setVoiceName] = useState(user.preferences.voiceName || 'Kore');
  const [requestStatus, setRequestStatus] = useState<{tier: string, status: 'IDLE' | 'SENDING' | 'SUCCESS' | 'ERROR'}>({tier: '', status: 'IDLE'});
  const [dob, setDob] = useState(user.dob || '');
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber || '');
  const [password, setPassword] = useState(user.password || '');
  const [showPassword, setShowPassword] = useState(false);
  const [language, setLanguage] = useState(user.preferences.language || 'Hindi');
  const [transferEmail, setTransferEmail] = useState('');
  
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);
  const [contactForm, setContactForm] = useState({ name: user.name, email: user.email, message: '' });
  const [submittingContact, setSubmittingContact] = useState(false);
  const [avatarPrompt, setAvatarPrompt] = useState('');
  const [generatingAvatar, setGeneratingAvatar] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isCropping, setIsCropping] = useState(false);
  const [isPersonaEditorOpen, setIsPersonaEditorOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [tempAvatar, setTempAvatar] = useState<string | null>(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const defaultAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${user.email}&backgroundColor=000000&fontFamily=Arial&fontWeight=900`;
  const currentAvatar = avatar || defaultAvatar;

  // User Management State
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    if (isOpen && user.role === Role.OWNER) {
      unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
        const users: User[] = [];
        snapshot.forEach((doc) => {
          users.push({ ...doc.data(), id: doc.id } as User);
        });
        setAllUsers(users);
        // Also sync to local storage for consistency
        safeLocalStorage.setItem('anora_users_db', JSON.stringify(users));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen, user.role]);

  useEffect(() => {
    if (isOpen) {
      setName(user.name);
      setBio(user.bio || '');
      setAvatar(user.avatar || '');
      setMood(user.preferences.aiMood);
      setAccent(user.preferences.accentColor);
      setIntel(user.preferences.intelligenceLevel || 'BALANCED');
      setVoiceName(user.preferences.voiceName || 'Kore');
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
    }
  }, [user, isOpen, initialSection]);

  if (!isOpen) return null;

  const isOwner = user.role === Role.OWNER || user.email === OWNER_EMAIL;
  const isPremium = user.tier !== SubscriptionTier.FREE || isOwner;
  const remainingChat = user.tokens?.chat ?? 0;
  const remainingImages = user.tokens?.image ?? 0;
  const remainingVideos = user.tokens?.video ?? 0;
  
  const limits = isOwner ? LIMIT_REFS.OWNER : (LIMIT_REFS[user.tier] || LIMIT_REFS.FREE);

  const isRainbow = user.preferences.colorMode === 'RAINBOW';

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
        setTempAvatar(ev.target?.result as string);
        setIsCropping(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSavePersonaImage = async (p: Persona, base64: string) => {
    // Only premium or owner can change persona images
    if (!isPremium && !isOwner) {
      console.warn("Neural Protocol: Custom persona imagery restricted to premium identities.");
      return;
    }

    const updatedAvatars = {
      ...(user.personaAvatars || {}),
      [p]: base64
    };
    
    const updatedUser = {
      ...user,
      personaAvatars: updatedAvatars
    };

    onUpdate(updatedUser);
    
    if (user?.id) {
      try {
        // Use pruneUser to ensure personaAvatars are within safety bounds before Firestore sync
        const prunedUser = pruneUser(updatedUser);
        const cleanedAvatars = cleanFirestoreData(prunedUser.personaAvatars || {});
        
        // Update user's specific document
        await setDoc(doc(db, 'users', user.id), { personaAvatars: cleanedAvatars }, { merge: true });
        
        // If owner, also update the global defaults
        if (isOwner) {
          const globalAvatars = { ...ownerAvatars, [p]: base64 };
          await setDoc(doc(db, 'config', 'persona_avatars'), { avatars: globalAvatars }, { merge: true });
        }
      } catch (e) {
        console.error("Neural persona sync failed", e);
      }
    }
  };

  const handleCropSave = async () => {
    if (!tempAvatar || !croppedAreaPixels) return;
    
    try {
      const canvas = document.createElement('canvas');
      const img = new Image();
      img.src = tempAvatar;
      await new Promise(r => img.onload = r);
      
      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(
          img,
          croppedAreaPixels.x,
          croppedAreaPixels.y,
          croppedAreaPixels.width,
          croppedAreaPixels.height,
          0,
          0,
          croppedAreaPixels.width,
          croppedAreaPixels.height
        );
        setAvatar(canvas.toDataURL('image/jpeg'));
        setIsCropping(false);
        setTempAvatar(null);
      }
    } catch (e) {
      console.error("Neural crop error", e);
    }
  };

  const handleUpdateOtherUser = async (updatedUser: User) => {
    try {
      const users: User[] = JSON.parse(safeLocalStorage.getItem('anora_users_db') || '[]');
      const prunedUpdated = pruneUser(updatedUser);
      const updatedUsers = users.map(u => u.id === updatedUser.id ? prunedUpdated : u);
      safeLocalStorage.setItem('anora_users_db', JSON.stringify(updatedUsers));
      setAllUsers(updatedUsers);
      setEditingUser(null);
      
      // Sync to Firestore if it's an admin/owner updating another user
      if (updatedUser?.id) {
        try {
          const cleanedUpdated = cleanFirestoreData(prunedUpdated);
          await setDoc(doc(db, 'users', updatedUser.id), cleanedUpdated);
        } catch (firestoreErr) {
          console.error("Neural cloud sync failed for target identity", firestoreErr);
        }
      }

      window.dispatchEvent(new Event('anora_database_updated'));
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } catch (e) {
      console.error("Neural identity update error", e);
    }
  };

  return (
    <div className={`fixed inset-0 z-[200] flex items-center justify-center p-0 sm:p-6 bg-black/5 backdrop-blur-2xl animate-in fade-in duration-300 ${isRainbow ? 'rainbow-mode' : ''}`}>
      {showToast && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[220] animate-in slide-in-from-top-6 duration-500 shadow-2xl">
          <div className={`px-10 py-4 text-white rounded-full font-black text-[9px] uppercase tracking-[0.5em] ${isRainbow ? 'rainbow-box bg-zinc-900' : 'bg-zinc-900'}`}>Neural Link Synced</div>
        </div>
      )}

      <div className={`w-full max-w-5xl bg-white dark:bg-zinc-900 border rounded-none sm:rounded-[4rem] shadow-2xl flex flex-col h-[100dvh] sm:h-auto sm:max-h-[92vh] overflow-hidden transition-all duration-500 relative ${isRainbow ? 'rainbow-box border-transparent' : (isOwner ? 'border-amber-500/30 ring-1 ring-amber-500/10' : 'border-zinc-100 dark:border-white/10')}`}>
        
        {/* Cropper Modal Overlay */}
        {isCropping && tempAvatar && (
          <div className="absolute inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-300">
            <div className="relative flex-1">
              <Cropper
                image={tempAvatar}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            <div className="p-8 bg-zinc-900 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                <span className="text-[10px] font-black text-white uppercase tracking-widest">Zoom</span>
                <input 
                  type="range" 
                  value={zoom} 
                  min={1} 
                  max={3} 
                  step={0.1} 
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 accent-white"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setIsCropping(false)} className="px-6 py-3 bg-zinc-800 text-white rounded-xl text-[8px] font-black uppercase tracking-widest">Cancel</button>
                <button onClick={handleCropSave} className="px-8 py-3 bg-white text-black rounded-xl text-[8px] font-black uppercase tracking-widest shadow-xl">Apply Crop</button>
              </div>
            </div>
          </div>
        )}
        
        {/* Unique Background Effect for Owner */}
        {isOwner && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20 z-0">
            <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-amber-500/20 blur-[120px] rounded-full animate-pulse"></div>
            <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] bg-amber-200/10 blur-[120px] rounded-full animate-pulse [animation-delay:2s]"></div>
          </div>
        )}

        <PersonaImageEditor 
          isOpen={isPersonaEditorOpen}
          onClose={() => setIsPersonaEditorOpen(false)}
          onSave={handleSavePersonaImage}
          currentPersona={editingPersona || 'DEFAULT'}
        />

        <div className="shrink-0 px-8 py-6 border-b border-zinc-50 dark:border-white/5 flex items-center justify-between bg-white/90 dark:bg-black/20 backdrop-blur-md z-20">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-black font-black text-lg shadow-lg">A</div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black font-outfit text-zinc-900 dark:text-white tracking-tight">Identity Hub</h2>
                <VerificationTick 
                  role={user.role} 
                  tier={user.tier} 
                  isVerified={user.isVerified}
                  size={16} 
                />
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[7px] text-zinc-400 font-black uppercase tracking-[0.3em]">Neural Link Status</p>
                <div className={`px-1.5 py-0.5 rounded-full text-[5px] font-black uppercase tracking-widest ${isOwner ? 'bg-amber-500 text-black' : 'bg-zinc-100 dark:bg-white/10 text-zinc-500'}`}>
                  {isOwner ? 'Sovereign' : user.tier}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-3 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all bg-zinc-50 dark:bg-white/5 rounded-2xl border border-zinc-100 dark:border-white/10">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-8 space-y-10 no-scrollbar relative z-10 pb-32">
          


          {/* Section 1: Identity Protocol */}
          <section id="section-PROFILE" className="space-y-8">
            <div className="flex flex-col md:flex-row items-start gap-10">
              <div className="flex flex-col items-center gap-6">
                 <div className={`w-32 h-32 rounded-[2.5rem] bg-zinc-50 dark:bg-black/20 border flex items-center justify-center text-4xl font-black text-zinc-900 dark:text-white relative shadow-inner overflow-hidden group ${isOwner ? 'border-amber-500/20' : 'border-zinc-200 dark:border-white/10'}`}>
                   <img src={currentAvatar} className="w-full h-full object-cover" />
                   {generatingAvatar && <div className="absolute inset-0 bg-white/90 dark:bg-black/90 flex items-center justify-center backdrop-blur-md animate-pulse">...</div>}
                   <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                     <span className="text-[7px] font-black text-white uppercase tracking-widest">Upload</span>
                     <input type="file" hidden accept="image/*" onChange={handleAvatarUpload} />
                   </label>
                 </div>
                 <div className="flex flex-col gap-2 w-full">
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="Image URL..." 
                        className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-xl px-3 py-2 text-[8px] text-zinc-900 dark:text-white outline-none focus:border-zinc-400"
                        onBlur={(e) => {
                          if (e.target.value.startsWith('http')) setAvatar(e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = (e.target as HTMLInputElement).value;
                            if (val.startsWith('http')) setAvatar(val);
                          }
                        }}
                      />
                    </div>
                    <button onClick={() => setExpandedSection(expandedSection === 'IDENTITY' ? null : 'IDENTITY')} className="w-full py-2 bg-zinc-100 dark:bg-white/5 text-zinc-900 dark:text-white rounded-xl text-[7px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all">Synth Appearance</button>
                 </div>
              </div>

              <div className="flex-1 w-full space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-1.5">
                      <div className="flex items-center gap-2 ml-1">
                        <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Neural Alias</label>
                        <VerificationTick 
                          role={user.role} 
                          tier={user.tier} 
                          isVerified={user.isVerified}
                          size={12} 
                        />
                      </div>
                      <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-transparent border-b border-zinc-100 dark:border-white/10 py-2 text-zinc-900 dark:text-white font-bold text-sm outline-none focus:border-zinc-900 dark:focus:border-white transition-all" />
                   </div>
                   <div className="space-y-1.5 relative">
                      <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest ml-1">Identity & Security</label>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10">
                        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          Secured via Clerk
                        </span>
                        <span className="text-[9px] font-mono text-zinc-400">Connected</span>
                      </div>
                   </div>
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest ml-1">Neural Synapse (Bio)</label>
                    <textarea value={bio} onChange={e => setBio(e.target.value)} rows={1} className="w-full bg-transparent border-b border-zinc-100 dark:border-white/10 py-2 text-zinc-700 dark:text-zinc-300 text-xs outline-none focus:border-zinc-900 dark:focus:border-white transition-all resize-none" placeholder="Provide core identity data..." />
                 </div>
              </div>
            </div>

            {expandedSection === 'IDENTITY' && (
              <div className="p-6 bg-zinc-50 dark:bg-black/20 border border-zinc-100 dark:border-white/10 rounded-[2rem] space-y-4 animate-in slide-in-from-top-4 duration-300">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[8px] font-black text-zinc-900 dark:text-white uppercase tracking-widest">Neural Appearance Synthesis</h4>
                  <button onClick={() => setExpandedSection(null)} className="text-[7px] font-black text-zinc-400 uppercase">Close</button>
                </div>
                <div className="flex gap-3">
                  <input 
                    value={avatarPrompt} 
                    onChange={e => setAvatarPrompt(e.target.value)} 
                    placeholder="Describe your desired appearance..." 
                    className="flex-1 bg-white dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-[9px] text-zinc-900 dark:text-white outline-none"
                  />
                  <button onClick={handleGenerateAvatar} disabled={generatingAvatar || !avatarPrompt.trim()} className="px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl text-[8px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 disabled:opacity-20">Synth</button>
                </div>
              </div>
            )}
          </section>

          {/* Section 2: Neural Intelligence */}
          <section id="section-INTELLIGENCE" className="space-y-6 pt-4 border-t border-zinc-50 dark:border-white/5">
             <button 
                onClick={() => setExpandedSection(expandedSection === 'INTELLIGENCE' ? null : 'INTELLIGENCE')}
                className="w-full flex items-center justify-between p-6 bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-[2.5rem] hover:border-zinc-300 dark:hover:border-white/20 transition-all group"
             >
                <div className="flex flex-col text-left">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Processing Intelligence</span>
                  <span className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight mt-1">{intel} Mode Active</span>
                </div>
                <div className={`p-2 rounded-full bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-white/10 transition-transform duration-300 ${expandedSection === 'INTELLIGENCE' ? 'rotate-180' : ''}`}>
                  <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                </div>
             </button>

             {expandedSection === 'INTELLIGENCE' && (
               <div className="flex gap-2 p-6 bg-zinc-50 dark:bg-black/20 rounded-[2rem] border border-zinc-100 dark:border-white/10 animate-in slide-in-from-top-4 duration-300">
                  {(['LITE', 'BALANCED', 'DEEP'] as IntelligenceLevel[]).map(i => (
                    <button key={i} onClick={() => setIntel(i)} className={`flex-1 py-3 rounded-xl border text-[8px] font-black uppercase transition-all shadow-sm ${intel === i ? 'bg-zinc-900 dark:bg-white text-white dark:text-black border-zinc-900 dark:border-white' : 'bg-white dark:bg-white/5 text-zinc-400 border-zinc-100 dark:border-white/10'}`}>{i}</button>
                  ))}
               </div>
             )}
          </section>

          {/* Section 3: Neural Voice Synthesis */}
          <section id="section-VOICE" className="space-y-6 pt-4 border-t border-zinc-50 dark:border-white/5">
             <div className="px-2 flex justify-between items-center">
                <div>
                  <label className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-widest">Visuals & Voice</label>
                  <p className="text-[7px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">Theme and vocal calibration</p>
                </div>
                {/* Language Selection - Inline Style */}
                <div className="relative">
                  <button 
                    onClick={() => setExpandedSection(expandedSection === 'LANGUAGE' ? null : 'LANGUAGE')}
                    className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-xl hover:border-zinc-300 transition-all"
                  >
                    <span className="text-[7px] font-black text-zinc-400 uppercase tracking-widest">Lang:</span>
                    <span className="text-[8px] font-black text-zinc-900 dark:text-white uppercase tracking-tight">{language}</span>
                  </button>
                  
                  {expandedSection === 'LANGUAGE' && (
                    <div className="absolute right-0 top-full mt-2 w-40 max-h-48 overflow-y-auto bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-white/10 rounded-xl shadow-2xl z-50 p-1 no-scrollbar animate-in fade-in slide-in-from-top-2 duration-200">
                      {LANGUAGES.map((l: string) => (
                        <button 
                          key={l} 
                          onClick={() => { setLanguage(l); setExpandedSection(null); }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-[7px] font-black uppercase tracking-widest transition-all ${language === l ? 'bg-zinc-900 dark:bg-white text-white dark:text-black' : 'text-zinc-400 hover:bg-zinc-50 dark:hover:bg-white/5'}`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
             </div>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Vocal Matrix */}
                <div className="space-y-3 lg:col-span-2">
                  <button 
                    onClick={() => setExpandedSection(expandedSection === 'VOICE' ? null : 'VOICE')}
                    className="w-full flex items-center justify-between p-6 bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-[2rem] hover:border-zinc-300 dark:hover:border-white/20 transition-all group"
                  >
                    <div className="flex flex-col text-left">
                      <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Neural Vocal Manifest</span>
                      <span className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight mt-1">{voiceName}</span>
                    </div>
                    <div className={`p-2 rounded-full bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-white/10 transition-transform duration-300 ${expandedSection === 'VOICE' ? 'rotate-180' : ''}`}>
                      <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </button>

                   {expandedSection === 'VOICE' && (
                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto no-scrollbar p-3 bg-zinc-50 dark:bg-white/5 rounded-2xl animate-in slide-in-from-top-4 duration-300 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {PREBUILT_VOICES.map((v, i) => (
                        <button key={`voice-${v.name}-${i}`} onClick={() => { setVoiceName(v.name); setExpandedSection(null); }} className={`p-4 rounded-xl border text-left transition-all ${voiceName === v.name ? 'bg-zinc-900 dark:bg-white text-white dark:text-black shadow-lg scale-[1.02]' : 'bg-white dark:bg-white/10 border-zinc-100 dark:border-white/10 text-zinc-400'}`}>
                           <div className="flex justify-between items-center">
                              <span className="text-[8px] font-black uppercase tracking-widest">{(v as any).alias || v.name}</span>
                              <span className="text-[6px] font-bold opacity-30">{v.gender}</span>
                           </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
             </div>
          </section>

          {/* Section 4: Resources & Upgrade */}
          <section id="section-RESOURCES" className="space-y-6 pt-4 border-t border-zinc-50 dark:border-white/5">
             <button 
                onClick={() => setExpandedSection(expandedSection === 'RESOURCES' ? null : 'RESOURCES')}
                className={`w-full flex items-center justify-between p-6 rounded-[2.5rem] border transition-all group ${isRainbow ? 'rainbow-box' : 'bg-zinc-50 dark:bg-white/5 border-zinc-100 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20'}`}
             >
                <div className="flex flex-col text-left">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isRainbow ? 'text-zinc-600' : 'text-zinc-400'}`}>Neural Resources</span>
                  <span className={`text-sm font-black uppercase tracking-tight mt-1 ${isRainbow ? 'text-zinc-900' : 'text-zinc-900 dark:text-white'}`}>Limit: {user.tier}</span>
                </div>
                <div className={`p-2 rounded-full border transition-transform duration-300 ${isRainbow ? 'rainbow-box rotate-0' : 'bg-white dark:bg-zinc-800 border-zinc-100 dark:border-white/10'} ${expandedSection === 'RESOURCES' ? 'rotate-180' : ''}`}>
                  <svg className={`w-4 h-4 ${isRainbow ? 'text-zinc-900' : 'text-zinc-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                </div>
             </button>

             {expandedSection === 'RESOURCES' && (
               <div className="space-y-6 animate-in slide-in-from-top-4 duration-300 p-6 bg-zinc-50 dark:bg-black/20 rounded-[3rem] border border-zinc-100 dark:border-white/10">
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 bg-white dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-2xl shadow-sm flex flex-col">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[7px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">Chat</span>
                        <span className={`text-xs font-black font-outfit ${isOwner ? 'text-amber-500' : 'text-zinc-900 dark:text-white'}`}>{isOwner ? '∞' : remainingChat.toLocaleString()}</span>
                      </div>
                      <div className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className={`h-full ${isOwner ? 'bg-amber-500 w-full' : 'bg-zinc-900 dark:bg-white'}`} style={{ width: isOwner ? '100%' : `${Math.min(100, (remainingChat / limits.chat) * 100)}%` }}></div>
                      </div>
                    </div>
                    <div className="p-4 bg-white dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-2xl shadow-sm flex flex-col">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[7px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">Images</span>
                        <span className={`text-xs font-black font-outfit ${isOwner ? 'text-amber-500' : 'text-zinc-900 dark:text-white'}`}>{isOwner ? '∞' : remainingImages}</span>
                      </div>
                      <div className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className={`h-full ${isOwner ? 'bg-amber-500 w-full' : 'bg-zinc-900 dark:bg-white'}`} style={{ width: isOwner ? '100%' : `${Math.min(100, (remainingImages / limits.image) * 100)}%` }}></div>
                      </div>
                    </div>
                    <div className="p-4 bg-white dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-2xl shadow-sm flex flex-col">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[7px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">Video</span>
                        <span className={`text-xs font-black font-outfit ${isOwner ? 'text-amber-500' : (remainingVideos > 0 ? 'text-zinc-900 dark:text-white' : 'text-zinc-300 dark:text-zinc-700')}`}>{isOwner ? '∞' : remainingVideos}</span>
                      </div>
                      <div className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className={`h-full ${isOwner ? 'bg-amber-500 w-full' : 'bg-zinc-900 dark:bg-white'}`} style={{ width: isOwner ? '100%' : limits.video > 0 ? `${Math.min(100, (remainingVideos / limits.video) * 100)}%` : '0%' }}></div>
                      </div>
                    </div>
                 </div>

                 <div className="px-2 pt-2 border-t border-zinc-100 dark:border-white/5">
                   <button 
                     onClick={() => setExpandedSection('UPGRADE')}
                     className={`w-full py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${isRainbow ? 'rainbow-box text-zinc-900' : 'bg-zinc-900 dark:bg-white text-white dark:text-black shadow-lg'}`}
                   >
                     Manage Subscription & Elevate Link
                   </button>
                 </div>
               </div>
             )}

             {expandedSection === 'UPGRADE' && (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in slide-in-from-top-4 duration-300">
                {[
                  { tier: 'PRO', price: '₹1,499', features: ['100k Chat Tokens', '100 Image Synthesis', '20 Video Synthesis', 'Advanced Reasoning', 'Priority Support'] },
                  { tier: 'PLATINUM', price: '₹3,999', features: ['500k Chat Tokens', '500 Image Synthesis', '100 Video Synthesis', 'Priority Neural Link', 'Custom Personas'] },
                  { tier: 'DIAMOND', price: '₹9,999', features: ['1M Chat Tokens', '1000 Image Synthesis', '500 Video Synthesis', 'Exclusive Personas', 'Early Access'] },
                  { tier: 'OWNER', price: '₹3,00,000', features: ['Infinite Resources', 'Sovereign Authority', 'Full System Access', 'Direct Support', 'Neural Ledger Access'], contact: true }
                ].map(plan => (
                  <div key={plan.tier} className={`p-6 rounded-[2rem] border flex flex-col ${user.tier === plan.tier ? 'border-zinc-900 dark:border-white bg-zinc-900 dark:bg-white text-white dark:text-black shadow-xl' : 'border-zinc-100 dark:border-white/10 bg-white dark:bg-zinc-800/50 text-zinc-400'}`}>
                    <h4 className="text-[10px] font-black uppercase tracking-widest mb-1">{plan.tier}</h4>
                    <p className="text-xl font-black mb-4">{plan.price}</p>
                    <ul className="space-y-2 mb-6 flex-1">
                      {plan.features.map((f, fIdx) => (
                        <li key={`${plan.tier}-feat-${fIdx}`} className="text-[8px] font-bold uppercase tracking-tight flex items-center gap-2">
                          <div className={`w-1 h-1 rounded-full ${user.tier === plan.tier ? (user.preferences.colorMode === 'DARK' ? 'bg-black' : 'bg-white') : 'bg-zinc-300'}`}></div>
                          {f}
                        </li>
                      ))}
                    </ul>
                    {plan.tier === 'OWNER' ? (
                      <a 
                        href={`mailto:owner@anora.ai?subject=Ownership Protocol Request: ${user.email}`}
                        className="w-full py-3 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all bg-amber-500 text-black hover:bg-amber-400 text-center"
                      >
                        Connect with Owner
                      </a>
                    ) : (
                      <div className="space-y-2">
                        <button 
                          disabled={user.tier === plan.tier || requestStatus.status === 'SENDING'}
                          onClick={() => {
                            setRequestStatus({ tier: plan.tier, status: 'SENDING' });
                            
                            // Simulate network delay for neural feel
                            setTimeout(() => {
                              try {
                                const request = {
                                  id: `req_${Date.now()}`,
                                  userId: user.id,
                                  userName: user.name,
                                  userEmail: user.email,
                                  requestedTier: plan.tier as SubscriptionTier,
                                  status: 'PENDING',
                                  timestamp: new Date().toISOString(),
                                  message: `Upgrade request from Profile Hub to ${plan.tier}`
                                };
                                
                                const requests = JSON.parse(localStorage.getItem('anora_upgrade_requests') || '[]');
                                localStorage.setItem('anora_upgrade_requests', JSON.stringify([request, ...requests]));
                                window.dispatchEvent(new Event('anora_database_updated'));
                                
                                setRequestStatus({ tier: plan.tier, status: 'SUCCESS' });
                                setTimeout(() => setRequestStatus({ tier: '', status: 'IDLE' }), 3000);
                              } catch (e) {
                                setRequestStatus({ tier: plan.tier, status: 'ERROR' });
                                setTimeout(() => setRequestStatus({ tier: '', status: 'IDLE' }), 3000);
                              }
                            }, 1500);
                          }}
                          className={`w-full py-3 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${user.tier === plan.tier ? 'bg-white/20 dark:bg-black/20' : 'bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-white hover:bg-zinc-200'}`}
                        >
                          {user.tier === plan.tier ? 'Active' : requestStatus.tier === plan.tier && requestStatus.status === 'SENDING' ? 'Transmitting...' : 'Select Plan'}
                        </button>
                        
                        {requestStatus.tier === plan.tier && requestStatus.status === 'SUCCESS' && (
                          <p className="text-[7px] text-emerald-500 font-black uppercase tracking-widest text-center animate-in fade-in zoom-in-95">Request Transmitted Successfully</p>
                        )}
                        {requestStatus.tier === plan.tier && requestStatus.status === 'ERROR' && (
                          <p className="text-[7px] text-red-500 font-black uppercase tracking-widest text-center animate-in fade-in zoom-in-95">Transmission Failed</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 bg-zinc-50 dark:bg-black/20 border border-zinc-100 dark:border-white/10 rounded-2xl shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[7px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">Chat</span>
                  <span className={`text-xs font-black font-outfit ${isOwner ? 'text-amber-500' : 'text-zinc-900 dark:text-white'}`}>{isOwner ? '∞' : remainingChat.toLocaleString()}</span>
                </div>
                <div className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className={`h-full ${isOwner ? 'bg-amber-500 w-full' : 'bg-zinc-900 dark:bg-white'}`} style={{ width: isOwner ? '100%' : `${Math.min(100, (remainingChat / limits.chat) * 100)}%` }}></div>
                </div>
              </div>
              <div className="p-4 bg-zinc-50 dark:bg-black/20 border border-zinc-100 dark:border-white/10 rounded-2xl shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[7px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">Images</span>
                  <span className={`text-xs font-black font-outfit ${isOwner ? 'text-amber-500' : 'text-zinc-900 dark:text-white'}`}>{isOwner ? '∞' : remainingImages}</span>
                </div>
                <div className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className={`h-full ${isOwner ? 'bg-amber-500 w-full' : 'bg-zinc-900 dark:bg-white'}`} style={{ width: isOwner ? '100%' : `${Math.min(100, (remainingImages / limits.image) * 100)}%` }}></div>
                </div>
              </div>
              <div className="p-4 bg-zinc-50 dark:bg-black/20 border border-zinc-100 dark:border-white/10 rounded-2xl shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[7px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">Video</span>
                  <span className={`text-xs font-black font-outfit ${isOwner ? 'text-amber-500' : (remainingVideos > 0 ? 'text-zinc-900 dark:text-white' : 'text-zinc-300 dark:text-zinc-700')}`}>{isOwner ? '∞' : remainingVideos}</span>
                </div>
                <div className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className={`h-full ${isOwner ? 'bg-amber-500 w-full' : 'bg-zinc-900 dark:bg-white'}`} style={{ width: isOwner ? '100%' : limits.video > 0 ? `${Math.min(100, (remainingVideos / limits.video) * 100)}%` : '0%' }}></div>
                </div>
              </div>
            </div>
          </section>

          {/* Help & Support Section */}
          <section id="section-HELP" className="space-y-6 pt-4">
            <button 
              onClick={() => setExpandedSection(expandedSection === 'HELP' ? null : 'HELP')}
              className="w-full flex items-center justify-between p-6 bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-[2.5rem] hover:border-zinc-300 dark:hover:border-white/20 transition-all group"
            >
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Help & Support</span>
                <span className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight mt-1">FAQ & Contact Protocols</span>
              </div>
              <div className={`p-2 rounded-full bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-white/10 transition-transform duration-300 ${expandedSection === 'HELP' ? 'rotate-180' : ''}`}>
                <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </button>

            {expandedSection === 'HELP' && (
              <div className="space-y-8 p-8 bg-zinc-50 dark:bg-black/20 border border-zinc-100 dark:border-white/10 rounded-[3rem] animate-in slide-in-from-top-4 duration-300">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-widest ml-2">Frequently Asked Questions</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {FAQ_ITEMS.map((item, i) => (
                      <div key={`faq-item-${i}`} className="p-5 bg-white dark:bg-zinc-800/50 border border-zinc-100 dark:border-white/5 rounded-2xl shadow-sm">
                        <h5 className="text-[9px] font-black text-zinc-900 dark:text-white uppercase tracking-tight mb-2">{item.q}</h5>
                        <p className="text-[9px] text-zinc-500 dark:text-zinc-400 leading-relaxed">{item.a}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-white/5">
                  <h4 className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-widest ml-2">Contact Support</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input 
                      value={contactForm.name} 
                      onChange={e => setContactForm({...contactForm, name: e.target.value})} 
                      placeholder="Your Name" 
                      className="w-full bg-white dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl px-5 py-3.5 text-xs outline-none focus:border-zinc-400" 
                    />
                    <input 
                      value={contactForm.email} 
                      onChange={e => setContactForm({...contactForm, email: e.target.value})} 
                      placeholder="Your Email" 
                      className="w-full bg-white dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl px-5 py-3.5 text-xs outline-none focus:border-zinc-400" 
                    />
                  </div>
                  <textarea 
                    value={contactForm.message} 
                    onChange={e => setContactForm({...contactForm, message: e.target.value})} 
                    placeholder="Describe your inquiry..." 
                    rows={3} 
                    className="w-full bg-white dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-2xl p-5 text-xs outline-none focus:border-zinc-400 resize-none" 
                  />
                  <button 
                    onClick={() => {
                      setSubmittingContact(true);
                      setTimeout(() => {
                        setSubmittingContact(false);
                        setContactForm({...contactForm, message: ''});
                        console.log("Contact request sent to Sovereign Architect.");
                      }, 1500);
                    }}
                    disabled={submittingContact || !contactForm.message.trim()}
                    className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-lg disabled:opacity-20 transition-all"
                  >
                    {submittingContact ? 'Transmitting...' : 'Send Inquiry'}
                  </button>
                </div>
              </div>
            )}
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
                            <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest ml-1">Clerk User ID</label>
                            <input type="text" readOnly value={editingUser.id} className="w-full bg-zinc-100 dark:bg-black/60 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs outline-none font-mono text-zinc-500" />
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
                          <div className="space-y-2">
                            <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest ml-1">Verification Status</label>
                            <button 
                              type="button"
                              onClick={() => setEditingUser({...editingUser, isVerified: !editingUser.isVerified})}
                              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${editingUser.isVerified ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-500' : 'bg-white dark:bg-black/40 border-zinc-200 dark:border-white/10 text-zinc-400'}`}
                            >
                              <span className="text-xs font-bold uppercase tracking-widest">{editingUser.isVerified ? 'Verified' : 'Unverified'}</span>
                              <CheckCircle2 className={`w-4 h-4 ${editingUser.isVerified ? 'text-indigo-500 fill-indigo-500/20' : 'text-zinc-300'}`} />
                            </button>
                          </div>
                          <div className="md:col-span-2 space-y-2">
                            <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest ml-1">Push Neural Directive (Reminder)</label>
                            <textarea 
                              placeholder="Enter a directive to push to this user's reminders..."
                              className="w-full bg-white dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs outline-none min-h-[80px] resize-none"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  const text = e.currentTarget.value.trim();
                                  if (text) {
                                    const newReminder = {
                                      id: `rem_${Date.now()}`,
                                      text,
                                      priority: 'SOVEREIGN' as const,
                                      completed: false,
                                      dueDate: new Date().toISOString()
                                    };
                                    setEditingUser({
                                      ...editingUser,
                                      reminders: [...(editingUser.reminders || []), newReminder]
                                    });
                                    e.currentTarget.value = '';
                                    alert("Directive Queued. Save to transmit.");
                                  }
                                }
                              }}
                            />
                          </div>
                        </div>
                        <button onClick={() => handleUpdateOtherUser(editingUser)} className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-lg">Save Changes & Transmit</button>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[400px] overflow-y-auto no-scrollbar pr-2">
                        {allUsers.map((u, uIdx) => (
                          <div key={u.id ? `${u.id}-${uIdx}` : `user-${uIdx}`} className="flex items-center justify-between p-4 bg-white dark:bg-black/40 border border-zinc-100 dark:border-white/10 rounded-2xl hover:border-amber-500/30 transition-all">
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
