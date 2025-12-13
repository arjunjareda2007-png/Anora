import React, { useState } from 'react';
import { User, Role, SiteLog, LyricDraft, VaultItem } from '../types';

interface AssistantFeaturesProps {
  user: User;
  onUpdate: (user: User) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const AssistantFeatures: React.FC<AssistantFeaturesProps> = ({ user, onUpdate, isOpen, onClose }) => {
  const [tab, setTab] = useState<'PROJECTS' | 'CREATIVE' | 'ENGINEERING' | 'UTILITIES' | 'VAULT'>('PROJECTS');
  const [newItem, setNewItem] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [vaultLocked, setVaultLocked] = useState(true);
  const [vaultPass, setVaultPass] = useState('');

  if (!isOpen) return null;

  const isOwner = user.role === Role.OWNER;
  const isPremium = isOwner || user.role === Role.PREMIUM;

  const addItem = () => {
    if (!newItem.trim()) return;
    const updated = { ...user };
    if (tab === 'PROJECTS') {
      updated.projects.push({ id: Date.now().toString(), name: newItem, description: newDesc, status: 'ACTIVE' });
    } else if (tab === 'CREATIVE') {
      if (!updated.lyrics) updated.lyrics = [];
      updated.lyrics.push({ id: Date.now().toString(), title: newItem, genre: newDesc || 'General', content: '', timestamp: new Date().toISOString() });
    } else if (tab === 'ENGINEERING') {
      if (!updated.siteLogs) updated.siteLogs = [];
      updated.siteLogs.push({ id: Date.now().toString(), project: newItem, date: new Date().toLocaleDateString(), details: newDesc });
    }
    onUpdate(updated);
    setNewItem('');
    setNewDesc('');
  };

  const removeItem = (id: string, list: string) => {
    const updated = { ...user };
    if (list === 'projects') updated.projects = updated.projects.filter(i => i.id !== id);
    if (list === 'lyrics') updated.lyrics = (updated.lyrics || []).filter(i => i.id !== id);
    if (list === 'siteLogs') updated.siteLogs = (updated.siteLogs || []).filter(i => i.id !== id);
    onUpdate(updated);
  };

  const utilityModules = [
    { title: "Rhyme Matrix", icon: "🎵", desc: "Expert songwriting dictionary." },
    { title: "Concrete Estimator", icon: "🏗️", desc: "Quick volume slab calculator." },
    { title: "CAD Logic Pro", icon: "📐", desc: "Advanced AutoCAD command database." },
    { title: "BPM Pulse", icon: "⏱️", desc: "Tap-to-tempo lyric rhythm tool." },
    { title: "RHB Site Tracker", icon: "🗺️", desc: "Specialized project monitoring." },
    { title: "Unit Bridge", icon: "🔄", desc: "Civil engineering unit converter." },
    { title: "Neural Alarms", icon: "🔔", desc: "Context-aware project reminders." },
    { title: "Code Forge", icon: "💻", desc: "Sandbox for automation snippets." },
    { title: "Mood Board AI", icon: "🎨", desc: "Lyric-to-visual mood generator." },
    { title: "Blueprint Audit", icon: "👁️", desc: "AI-based drawing analysis (Vision)." }
  ];

  return (
    <div className="fixed inset-0 z-[150] flex items-end sm:items-stretch justify-end p-0 sm:p-6 bg-black/90 backdrop-blur-3xl animate-in fade-in slide-in-from-right duration-500">
      <div className="w-full max-w-2xl h-[95dvh] sm:h-auto bg-[#0a0a0a] border-t sm:border border-zinc-900 flex flex-col shadow-2xl overflow-hidden rounded-t-[4rem] sm:rounded-[4rem] ring-1 ring-white/5">
        
        {/* Header */}
        <div className="p-10 border-b border-zinc-900 flex items-center justify-between">
          <div>
            <h2 className={`text-2xl font-bold font-outfit ${isOwner ? 'text-amber-500' : 'text-white'}`}>Neural Hub v6.5</h2>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold mt-2">Core Assets & Logic Modules</p>
          </div>
          <button onClick={onClose} className="p-5 text-zinc-500 hover:text-white transition-all bg-white/5 rounded-2xl group active:scale-90">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 group-hover:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Navigation */}
        <div className="flex bg-black/60 p-2 mx-10 mt-8 rounded-3xl border border-zinc-900 overflow-x-auto no-scrollbar gap-2">
          {(['PROJECTS', 'CREATIVE', 'ENGINEERING', 'UTILITIES', 'VAULT'] as const).map(t => {
            if (t === 'ENGINEERING' && !isOwner) return null;
            if (t === 'CREATIVE' && !isPremium) return null;
            return (
              <button key={t} onClick={() => setTab(t)} className={`flex-1 min-w-[120px] py-4 text-[9px] font-bold uppercase tracking-[0.2em] rounded-2xl transition-all duration-700 ${tab === t ? 'bg-zinc-800 text-white shadow-xl scale-105' : 'text-zinc-700 hover:text-zinc-400'}`}>{t}</button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-10 space-y-12 no-scrollbar">
          
          {(tab === 'PROJECTS' || tab === 'CREATIVE' || tab === 'ENGINEERING') && (
            <div className="space-y-4 bg-zinc-900/30 p-8 rounded-[3rem] border border-zinc-800/50 shadow-inner group animate-in slide-in-from-top-4 duration-500">
              <div className="flex gap-4">
                <input value={newItem} onChange={e => setNewItem(e.target.value)} placeholder={`Label your ${tab.toLowerCase().slice(0, -1)}...`} className="flex-1 bg-black/50 border border-zinc-900 rounded-2xl px-6 py-5 text-sm focus:outline-none focus:border-zinc-700 transition-all font-medium text-zinc-100" />
                <button onClick={addItem} className={`px-8 rounded-2xl font-bold transition-all active:scale-90 ${isOwner ? 'bg-amber-500 text-black' : 'bg-white text-black'}`}>+</button>
              </div>
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Metadata / context..." className="w-full bg-black/30 border border-zinc-900 rounded-2xl px-6 py-5 text-xs focus:outline-none focus:border-zinc-700 transition-all text-zinc-400 h-24 resize-none" />
            </div>
          )}

          <div className="space-y-6">
            {tab === 'UTILITIES' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 animate-in fade-in zoom-in-95 duration-700">
                 {utilityModules.map((u, i) => (
                   <div key={i} className="p-7 bg-zinc-900/40 border border-zinc-800/40 rounded-[2.5rem] hover:border-zinc-600 transition-all group cursor-pointer relative overflow-hidden active:scale-95">
                      <div className="absolute top-0 right-0 p-5 text-white/5 group-hover:text-white/10 text-5xl transition-colors">{u.icon}</div>
                      <h4 className="text-white text-[11px] font-bold uppercase tracking-widest mb-2">{u.title}</h4>
                      <p className="text-[9px] text-zinc-700 font-bold uppercase tracking-tight leading-relaxed">{u.desc}</p>
                   </div>
                 ))}
              </div>
            )}

            {tab === 'VAULT' && vaultLocked && (
              <div className="flex flex-col items-center justify-center py-20 space-y-10 animate-in zoom-in-95 duration-700">
                <div className="w-28 h-28 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center text-amber-500 shadow-2xl relative">
                  <div className="absolute inset-0 bg-amber-500/10 blur-xl rounded-full animate-pulse"></div>
                  <svg className="w-14 h-14 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <div className="w-full max-w-xs space-y-4">
                  <input type="password" value={vaultPass} onChange={e => setVaultPass(e.target.value)} placeholder="NEURAL_KEY_6.5" className="w-full bg-zinc-900 border border-zinc-900 rounded-2xl px-6 py-5 text-center tracking-widest text-white focus:outline-none focus:border-amber-500/50" />
                  <button onClick={() => { if(vaultPass === 'aman1887') setVaultLocked(false); else alert("Invalid Key"); }} className="w-full py-5 bg-white text-black rounded-2xl font-bold uppercase text-[10px] tracking-[0.4em] hover:bg-zinc-200 transition-all active:scale-95">Authorize Access</button>
                </div>
              </div>
            )}

            {tab === 'PROJECTS' && user.projects.map(p => (
              <div key={p.id} className="p-8 bg-zinc-900/20 rounded-[3rem] border border-zinc-900 hover:border-zinc-700 transition-all group animate-in slide-in-from-right-4 duration-500">
                <div className="flex justify-between items-start mb-4">
                   <h4 className="text-white text-[12px] font-bold tracking-[0.2em] uppercase group-hover:text-amber-500 transition-colors">{p.name}</h4>
                   <button onClick={() => removeItem(p.id, 'projects')} className="text-zinc-800 hover:text-red-500 text-[9px] font-bold">PURGE</button>
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed font-medium">{p.description}</p>
              </div>
            ))}

            {tab === 'ENGINEERING' && (user.siteLogs || []).map(s => (
               <div key={s.id} className="p-8 bg-zinc-900/40 rounded-[3rem] border border-zinc-900 hover:border-zinc-700 transition-all group animate-in slide-in-from-right-4 duration-500">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="text-white text-[12px] font-bold tracking-wider uppercase">{s.project}</h4>
                      <p className="text-[8px] text-zinc-700 font-bold uppercase tracking-widest mt-1">{s.date}</p>
                    </div>
                    <button onClick={() => removeItem(s.id, 'siteLogs')} className="text-zinc-800 hover:text-red-500">×</button>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed font-medium mb-6">{s.details}</p>
                  <div className="flex gap-2">
                     <span className="px-3 py-1 bg-green-500/10 text-green-500 text-[7px] font-bold uppercase rounded-full border border-green-500/20">RHB Active</span>
                     <span className="px-3 py-1 bg-blue-500/10 text-blue-500 text-[7px] font-bold uppercase rounded-full border border-blue-500/20">CAD Sync</span>
                  </div>
               </div>
            ))}
          </div>
        </div>

        {/* Telemetry Stats */}
        <div className="p-10 border-t border-zinc-900 bg-black/80 backdrop-blur-3xl">
           <div className="grid grid-cols-4 gap-6 text-center">
              <div><p className="text-2xl font-bold text-white font-outfit">{user.projects.length}</p><p className="text-[7px] text-zinc-800 uppercase font-bold tracking-[0.3em]">LOGIC</p></div>
              <div><p className="text-2xl font-bold text-white font-outfit">{(user.lyrics || []).length}</p><p className="text-[7px] text-zinc-800 uppercase font-bold tracking-[0.3em]">MUSIC</p></div>
              <div><p className="text-2xl font-bold text-white font-outfit">{(user.siteLogs || []).length}</p><p className="text-[7px] text-zinc-800 uppercase font-bold tracking-[0.3em]">ENGINE</p></div>
              <div><p className="text-2xl font-bold text-white font-outfit">6.5</p><p className="text-[7px] text-zinc-800 uppercase font-bold tracking-[0.3em]">CORE</p></div>
           </div>
        </div>
      </div>
    </div>
  );
};