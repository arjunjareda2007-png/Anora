
import React, { useState, useEffect } from 'react';
import { User, Role, SubscriptionTier, AiMood, IntelligenceLevel, AppTheme, AppFont, Persona, CustomMood } from '../types';
import { ACCENT_COLORS, AI_MOODS, THEMES, LANGUAGES } from '../constants';
import { anoraService } from '../services/geminiService';

interface ProfileModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedUser: User) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ user, isOpen, onClose, onUpdate }) => {
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio || '');
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [mood, setMood] = useState<AiMood>(user.preferences.aiMood);
  const [accent, setAccent] = useState(user.preferences.accentColor);
  const [intel, setIntel] = useState<IntelligenceLevel>(user.preferences.intelligenceLevel || 'BALANCED');
  const [lang, setLang] = useState(user.preferences.language || 'English');
  const [theme, setTheme] = useState<AppTheme>(user.preferences.theme || 'OBSIDIAN');
  const [font, setFont] = useState<AppFont>(user.preferences.font || 'INTER');
  const [sound, setSound] = useState(user.preferences.soundEnabled ?? true);
  const [persona, setPersona] = useState<Persona>(user.preferences.persona || 'DEFAULT');
  
  // Custom Moods State
  const [customMoods, setCustomMoods] = useState<CustomMood[]>(user.customMoods || []);
  const [editingMood, setEditingMood] = useState<Partial<CustomMood> | null>(null);

  const [avatarPrompt, setAvatarPrompt] = useState('');
  const [generatingAvatar, setGeneratingAvatar] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  if (!isOpen) return null;

  const handleSave = () => {
    onUpdate({
      ...user,
      name,
      bio,
      avatar,
      customMoods,
      preferences: {
        ...user.preferences,
        aiMood: mood,
        accentColor: accent,
        intelligenceLevel: intel,
        language: lang,
        theme,
        font,
        soundEnabled: sound,
        persona
      }
    });
    setShowToast(true);
    setTimeout(onClose, 1200);
  };

  const handleGenerateAvatar = async () => {
    if (!avatarPrompt.trim()) return;
    setGeneratingAvatar(true);
    try {
      const base64 = await anoraService.generateImage(`Cinematic high-fidelity portrait, aesthetic AI art: ${avatarPrompt}`);
      setAvatar(`data:image/png;base64,${base64}`);
      setAvatarPrompt('');
    } catch (err: any) {
      alert(`Synthesis Failed: ${err.message}`);
    } finally {
      setGeneratingAvatar(false);
    }
  };

  const isOwner = user.role === Role.OWNER;
  const personaIcons: Record<Persona, string> = {
    DEFAULT: '🤖', FRIEND: '👋', TEACHER: '📚', MENTOR: '💼', GIRLFRIEND: '❤️',
    BOYFRIEND: '🤝', BROTHER: '🤜', SISTER: '🧚', SOVEREIGN_AI: '🌌'
  };

  const startNewMood = () => {
    setEditingMood({
      id: `mood_${Date.now()}`,
      name: '',
      description: '',
      strictness: 50,
      verbosity: 50,
      technicality: 50,
      creativity: 50,
      authority: 50,
    });
  };

  const saveCustomMood = () => {
    if (!editingMood || !editingMood.name) return;
    const moodToSave = editingMood as CustomMood;
    const exists = customMoods.find(m => m.id === moodToSave.id);
    if (exists) {
      setCustomMoods(customMoods.map(m => m.id === moodToSave.id ? moodToSave : m));
    } else {
      setCustomMoods([...customMoods, moodToSave]);
    }
    setEditingMood(null);
  };

  const deleteCustomMood = (id: string) => {
    setCustomMoods(customMoods.filter(m => m.id !== id));
    if (mood === id) setMood('CALM');
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 sm:p-6 bg-black/95 backdrop-blur-3xl animate-in fade-in duration-300">
      
      {showToast && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[220] animate-in slide-in-from-top-6 duration-500">
          <div className="bg-white text-black px-12 py-4 rounded-[3rem] font-bold text-[10px] uppercase tracking-[0.5em] shadow-[0_0_60px_rgba(255,255,255,0.2)]">
            Neural Link Updated
          </div>
        </div>
      )}

      <div className={`w-full max-w-4xl bg-[#030303] border-t sm:border border-zinc-900 rounded-none sm:rounded-[5rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col h-[100dvh] sm:h-auto sm:max-h-[92vh] transition-all duration-700 ${isOwner ? 'ring-1 ring-amber-500/10' : ''} animate-in zoom-in-95 duration-500 overflow-hidden`}>
        
        <div className="shrink-0 px-8 sm:px-12 py-10 border-b border-zinc-900 flex items-center justify-between bg-[#030303] z-20">
          <div className="animate-in slide-in-from-left duration-700">
            <h2 className={`text-2xl font-bold font-outfit ${isOwner ? 'text-amber-500' : 'text-white'}`}>Sovereign Config</h2>
            <p className="text-[10px] text-zinc-700 uppercase tracking-[0.3em] font-bold mt-2">Identity & Persona Matrix</p>
          </div>
          <button onClick={onClose} className="p-5 text-zinc-600 hover:text-white transition-all bg-white/5 rounded-[2rem] group active:scale-90 hover:bg-white/10">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 group-hover:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 sm:px-12 py-12 space-y-20 no-scrollbar scroll-smooth">
          
          <section className="flex flex-col md:flex-row gap-12 p-10 bg-zinc-900/10 rounded-[3.5rem] border border-zinc-900 animate-in slide-in-from-bottom-8 duration-700">
             <div className="flex flex-col items-center gap-6 shrink-0">
                <div className={`w-40 h-40 rounded-full flex items-center justify-center text-5xl font-bold border-2 transition-all duration-1000 overflow-hidden relative shadow-2xl ${isOwner ? 'border-amber-500/40 shadow-amber-500/10' : 'border-zinc-800'}`}>
                  {avatar ? <img src={avatar} className="w-full h-full object-cover" alt="AV" /> : user.name.charAt(0)}
                  {generatingAvatar && (
                    <div className="absolute inset-0 bg-black/90 flex items-center justify-center backdrop-blur-md">
                      <div className="w-10 h-10 border-4 border-white/5 border-t-white rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                <div className="w-full space-y-3">
                   <input type="text" placeholder="Dream an avatar style..." value={avatarPrompt} onChange={(e) => setAvatarPrompt(e.target.value)} className="w-full bg-black/50 border border-zinc-900 rounded-2xl px-5 py-3.5 text-[10px] outline-none focus:border-zinc-600 transition-all font-medium text-center text-white" />
                   <button onClick={handleGenerateAvatar} disabled={generatingAvatar || !avatarPrompt.trim()} className="w-full py-3.5 bg-white text-black rounded-2xl text-[9px] font-bold uppercase hover:bg-zinc-200 transition-all active:scale-95">Synthesis Engine</button>
                </div>
             </div>

             <div className="flex-1 space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                   <div className="space-y-3">
                      <label className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest block ml-2">Neural Alias</label>
                      <input value={name} onChange={(e) => setName(e.target.value)} className="bg-zinc-900/40 border border-zinc-900 rounded-2xl px-6 py-4.5 text-white font-bold text-lg w-full outline-none focus:border-zinc-500 transition-all" />
                   </div>
                   <div className="space-y-3">
                      <label className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest block ml-2">Language Protocol</label>
                      <select value={lang} onChange={(e) => setLang(e.target.value)} className="w-full bg-zinc-900/40 border border-zinc-900 rounded-2xl px-6 py-4.5 text-zinc-300 focus:outline-none appearance-none text-[10px] font-bold uppercase tracking-widest hover:border-zinc-700 cursor-pointer">
                        {LANGUAGES.map(l => <option key={l} value={l} className="bg-[#030303]">{l}</option>)}
                      </select>
                   </div>
                </div>
                <div className="space-y-3">
                   <label className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest block ml-2">Neural Bio (Memory Context)</label>
                   <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="bg-zinc-900/40 border border-zinc-900 rounded-[2.5rem] p-8 focus:border-zinc-700 text-zinc-300 text-sm w-full outline-none transition-all resize-none leading-relaxed" placeholder="Share your engineering or musical context..." />
                </div>
             </div>
          </section>

          {isOwner && (
            <section className="space-y-10 animate-in slide-in-from-bottom-8 duration-700 delay-100">
               <div className="flex items-center justify-between px-4">
                  <label className="text-[11px] font-bold text-amber-500 uppercase tracking-[0.4em] block">Mood Forge (Owner Exclusive)</label>
                  <button onClick={startNewMood} className="px-6 py-2 bg-amber-500/10 border border-amber-500/30 rounded-full text-[9px] font-bold text-amber-500 uppercase tracking-widest hover:bg-amber-500 hover:text-black transition-all">Establish New Mood</button>
               </div>

               {editingMood && (
                 <div className="p-10 bg-zinc-950 border border-amber-500/20 rounded-[3rem] space-y-10 animate-in zoom-in-95 duration-500">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                       <input 
                         placeholder="Mood Logic Label" 
                         value={editingMood.name} 
                         onChange={e => setEditingMood({...editingMood, name: e.target.value})} 
                         className="bg-black border border-zinc-900 rounded-2xl px-6 py-4 text-white text-sm focus:border-amber-500/50 outline-none transition-all" 
                       />
                       <input 
                         placeholder="Behavioral Overview" 
                         value={editingMood.description} 
                         onChange={e => setEditingMood({...editingMood, description: e.target.value})} 
                         className="bg-black border border-zinc-900 rounded-2xl px-6 py-4 text-white text-sm focus:border-amber-500/50 outline-none transition-all" 
                       />
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
                       {[
                         { label: 'Strictness', key: 'strictness' },
                         { label: 'Verbosity', key: 'verbosity' },
                         { label: 'Technicality', key: 'technicality' },
                         { label: 'Creativity', key: 'creativity' },
                         { label: 'Authority', key: 'authority' }
                       ].map((param) => (
                         <div key={param.key} className="space-y-3">
                            <div className="flex justify-between">
                               <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">{param.label}</label>
                               <span className="text-[9px] font-bold text-amber-500">{(editingMood as any)[param.key]}%</span>
                            </div>
                            <input 
                              type="range" 
                              min="0" max="100" 
                              value={(editingMood as any)[param.key]} 
                              onChange={e => setEditingMood({...editingMood, [param.key]: parseInt(e.target.value)})}
                              className="w-full accent-amber-500" 
                            />
                         </div>
                       ))}
                    </div>

                    <div className="flex gap-4">
                       <button onClick={saveCustomMood} className="flex-1 py-4 bg-amber-500 text-black font-bold rounded-2xl text-[10px] uppercase tracking-widest hover:bg-amber-400 transition-all">Flash to Memory</button>
                       <button onClick={() => setEditingMood(null)} className="flex-1 py-4 bg-zinc-900 text-zinc-500 font-bold rounded-2xl text-[10px] uppercase tracking-widest hover:bg-zinc-800 transition-all">Abort Forge</button>
                    </div>
                 </div>
               )}

               <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {customMoods.map(m => (
                    <div key={m.id} className={`p-8 bg-zinc-900/20 border rounded-[2.5rem] transition-all group relative ${mood === m.id ? 'border-amber-500/50 shadow-lg scale-105' : 'border-zinc-900 hover:border-zinc-800'}`}>
                       <div className="flex justify-between items-start mb-4">
                          <h4 className="text-white text-xs font-bold uppercase tracking-widest">{m.name}</h4>
                          <button onClick={() => deleteCustomMood(m.id)} className="text-zinc-800 hover:text-red-500 transition-colors">×</button>
                       </div>
                       <p className="text-[10px] text-zinc-600 line-clamp-2 mb-6">{m.description}</p>
                       <button 
                         onClick={() => setMood(m.id)} 
                         className={`w-full py-3 rounded-xl text-[8px] font-bold uppercase tracking-widest transition-all ${mood === m.id ? 'bg-amber-500 text-black' : 'bg-black text-zinc-500 group-hover:bg-zinc-800'}`}
                       >
                         {mood === m.id ? 'Active Matrix' : 'Activate Mood'}
                       </button>
                    </div>
                  ))}
               </div>
            </section>
          )}

          <section className="space-y-10 animate-in slide-in-from-bottom-8 duration-700 delay-200">
            <label className="text-[11px] font-bold text-zinc-700 uppercase tracking-[0.4em] block text-center">Standard Logic Disposition</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
              {Object.keys(AI_MOODS).map(m => (
                <button key={m} onClick={() => setMood(m)} className={`py-8 px-4 rounded-[2.5rem] border transition-all flex flex-col items-center gap-4 relative group ${mood === m ? 'bg-white border-white text-black shadow-xl scale-105' : 'bg-zinc-900/20 border-zinc-900 text-zinc-700 hover:border-zinc-800'}`}>
                   <span className="text-[10px] font-bold tracking-tighter uppercase text-center leading-tight">{m}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-10 animate-in slide-in-from-bottom-8 duration-700 delay-300">
            <label className="text-[11px] font-bold text-zinc-700 uppercase tracking-[0.4em] block text-center">Persona Sub-Routines</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-5">
              {(Object.keys(personaIcons) as Persona[]).map((p) => (
                <button key={p} onClick={() => setPersona(p)} className={`py-10 px-4 rounded-[3rem] border transition-all flex flex-col items-center gap-5 relative group ${persona === p ? 'bg-white border-white text-black shadow-2xl scale-105' : 'bg-zinc-900/20 border-zinc-900 text-zinc-700 hover:border-zinc-700'}`}>
                  <span className={`text-3xl transition-all duration-700 ${persona === p ? 'scale-125' : 'grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100'}`}>{personaIcons[p]}</span>
                  <span className="text-[9px] font-bold tracking-tighter uppercase text-center leading-tight">{p.replace('_', ' ')}</span>
                </button>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 animate-in slide-in-from-bottom-8 duration-700 delay-400">
             <div className="space-y-5">
                <label className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest block ml-2">Compute Priority</label>
                <div className="flex flex-col gap-3">
                   {(['LITE', 'BALANCED', 'DEEP'] as IntelligenceLevel[]).map(i => (
                     <button key={i} onClick={() => setIntel(i)} className={`py-5 rounded-2xl border text-[10px] font-bold uppercase tracking-[0.3em] transition-all active:scale-95 ${intel === i ? 'bg-white text-black border-white shadow-xl' : 'bg-zinc-900/30 border-zinc-900 text-zinc-800 hover:text-zinc-500'}`}>{i}</button>
                   ))}
                </div>
             </div>
             <div className="space-y-5">
                <label className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest block ml-2">Neural Aura</label>
                <div className="flex flex-wrap gap-4 p-8 bg-zinc-900/20 rounded-[3rem] border border-zinc-900">
                  {ACCENT_COLORS.map(c => <button key={c.name} onClick={() => setAccent(c.value)} className={`w-10 h-10 rounded-full border-2 transition-all hover:scale-125 active:scale-90 ${accent === c.value ? 'border-white scale-150 z-10 shadow-2xl' : 'border-transparent opacity-30 hover:opacity-100'}`} style={{ backgroundColor: c.value }} title={c.name} />)}
                </div>
             </div>
             <div className="space-y-5">
                <label className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest block ml-2">Audio Logic</label>
                <button onClick={() => setSound(!sound)} className={`w-full p-6 rounded-[2.5rem] border transition-all flex items-center justify-between active:scale-95 ${sound ? 'bg-white/5 border-white/20 text-white' : 'bg-zinc-900/30 border-zinc-900 text-zinc-800'}`}>
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em]">{sound ? 'Feedback ON' : 'Feedback OFF'}</span>
                  <div className={`w-14 h-7 rounded-full relative transition-all duration-500 ${sound ? 'bg-white' : 'bg-zinc-800'}`}>
                    <div className={`absolute top-1 w-5 h-5 bg-black rounded-full transition-all duration-500 ${sound ? 'right-1' : 'left-1'}`}></div>
                  </div>
                </button>
             </div>
          </div>

          <div className="h-20" />
        </div>

        <div className="shrink-0 p-8 sm:p-12 border-t border-zinc-900 flex flex-col sm:flex-row gap-6 bg-[#030303] z-20">
          <button onClick={handleSave} className={`flex-[2] font-bold py-7 rounded-[3rem] transition-all shadow-2xl active:scale-95 text-[11px] tracking-[0.6em] uppercase border ${isOwner ? 'bg-amber-500 text-black border-amber-500 hover:bg-amber-400' : 'bg-white text-black border-white hover:bg-zinc-200'}`}>Synchronize Neural State</button>
          <button onClick={onClose} className="flex-1 py-7 rounded-[3rem] bg-zinc-900 border border-zinc-800 text-zinc-600 font-bold uppercase text-[10px] tracking-widest hover:text-white hover:bg-zinc-800 transition-all active:scale-95">EXIT CONFIG</button>
        </div>
      </div>
    </div>
  );
};
