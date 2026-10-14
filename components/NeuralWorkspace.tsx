
import React, { useState } from 'react';
import { User, VaultItem, SiteLog, LyricDraft, NeuralMemoryItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Folder, 
  Shield, 
  Music, 
  ClipboardList, 
  Brain, 
  Plus, 
  Trash2, 
  ExternalLink,
  ChevronRight,
  Search,
  Cpu
} from 'lucide-react';

interface NeuralWorkspaceProps {
  user: User;
  onUpdate: (updatedUser: User) => void;
  onClose: () => void;
}

type WorkspaceTab = 'VAULT' | 'PROJECTS' | 'LYRICS' | 'LOGS' | 'MEMORY';

export const NeuralWorkspace: React.FC<NeuralWorkspaceProps> = ({ user, onUpdate, onClose }) => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('VAULT');
  const [searchQuery, setSearchQuery] = useState('');

  const tabs: { id: WorkspaceTab; label: string; icon: any; color: string }[] = [
    { id: 'VAULT', label: 'Neural Vault', icon: Shield, color: 'text-zinc-900' },
    { id: 'PROJECTS', label: 'Active Projects', icon: Folder, color: 'text-zinc-900' },
    { id: 'LYRICS', label: 'Lyric Manifests', icon: Music, color: 'text-zinc-900' },
    { id: 'LOGS', label: 'Site Protocols', icon: ClipboardList, color: 'text-zinc-900' },
    { id: 'MEMORY', label: 'Neural Memory', icon: Brain, color: 'text-zinc-900' },
  ];

  const handleDeleteItem = (tab: WorkspaceTab, id: string) => {
    const updatedUser = { ...user };
    if (tab === 'VAULT' && updatedUser.vault) {
      updatedUser.vault = updatedUser.vault.filter(item => item.id !== id);
    } else if (tab === 'LOGS' && updatedUser.siteLogs) {
      updatedUser.siteLogs = updatedUser.siteLogs.filter(item => item.id !== id);
    } else if (tab === 'LYRICS' && updatedUser.lyrics) {
      updatedUser.lyrics = updatedUser.lyrics.filter(item => item.id !== id);
    } else if (tab === 'MEMORY') {
      updatedUser.memory = updatedUser.memory.filter(item => item.id !== id);
    }
    onUpdate(updatedUser);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'VAULT':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(user.vault || []).filter(v => v.title.toLowerCase().includes(searchQuery.toLowerCase())).map((item, itemIdx) => (
              <motion.div 
                layout
                key={item.id ? `${item.id}-${itemIdx}` : `vault-${itemIdx}`} 
                className="p-6 bg-zinc-50 border border-zinc-100 rounded-[2rem] group hover:border-zinc-300 transition-all"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-white rounded-2xl border border-zinc-100 shadow-sm">
                    <Shield className="w-4 h-4 text-zinc-900" />
                  </div>
                  <button onClick={() => handleDeleteItem('VAULT', item.id)} className="p-2 text-zinc-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <h4 className="text-sm font-black text-zinc-900 uppercase tracking-widest mb-2">{item.title}</h4>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed line-clamp-3">{item.content}</p>
                <div className="mt-4 pt-4 border-t border-zinc-100 flex justify-between items-center">
                  <span className="text-[8px] font-black text-zinc-300 uppercase tracking-widest">{item.type}</span>
                  <button className="text-[8px] font-black text-zinc-900 uppercase tracking-widest flex items-center gap-1">Access <ChevronRight className="w-3 h-3" /></button>
                </div>
              </motion.div>
            ))}
            {(user.vault || []).length === 0 && (
              <div className="col-span-full py-20 text-center">
                <p className="text-[10px] font-black text-zinc-300 uppercase tracking-[0.5em]">Vault is currently empty</p>
              </div>
            )}
          </div>
        );
      case 'MEMORY':
        return (
          <div className="space-y-4">
            {user.memory.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase())).map((mem, memIdx) => (
              <motion.div 
                layout
                key={mem.id ? `${mem.id}-${memIdx}` : `mem-${memIdx}`} 
                className="p-6 bg-zinc-50 border border-zinc-100 rounded-[2.5rem] flex items-center gap-6 group hover:border-zinc-300 transition-all"
              >
                <div className="w-12 h-12 rounded-2xl bg-white border border-zinc-100 flex items-center justify-center shadow-sm">
                  <Brain className="w-5 h-5 text-zinc-900" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">{mem.category}</span>
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <div key={`${mem.id || memIdx}-dot-${i}`} className={`w-1 h-1 rounded-full ${i < mem.strength ? 'bg-zinc-900' : 'bg-zinc-200'}`} />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs font-bold text-zinc-900 leading-relaxed">{mem.content}</p>
                </div>
                <button onClick={() => handleDeleteItem('MEMORY', mem.id)} className="p-3 text-zinc-300 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        );
      case 'LOGS':
        return (
          <div className="space-y-4">
            {(user.siteLogs || []).map((log, logIdx) => (
              <div key={log.id ? `${log.id}-${logIdx}` : `log-${logIdx}`} className="p-6 bg-zinc-50 border border-zinc-100 rounded-[2.5rem] flex flex-col sm:flex-row sm:items-center gap-6">
                <div className="flex-1">
                   <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 rounded-full text-[7px] font-black uppercase tracking-widest ${log.status === 'CRITICAL' ? 'bg-red-500 text-white' : log.status === 'COMPLETED' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-400 border border-zinc-100'}`}>{log.status}</span>
                      <span className="text-[8px] font-black text-zinc-300 uppercase tracking-widest">{log.date}</span>
                   </div>
                   <h4 className="text-sm font-black text-zinc-900 uppercase tracking-widest mb-1">{log.project}</h4>
                   <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{log.details}</p>
                </div>
                <div className="flex items-center gap-4">
                   {log.autoCadLinked && <div className="p-3 bg-white border border-zinc-100 rounded-2xl shadow-sm" title="AutoCAD Linked"><Cpu className="w-4 h-4 text-zinc-900" /></div>}
                   <button onClick={() => handleDeleteItem('LOGS', log.id)} className="p-3 text-zinc-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        );
      default:
        return (
          <div className="py-20 text-center">
            <p className="text-[10px] font-black text-zinc-300 uppercase tracking-[0.5em]">Protocol under development</p>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-0 sm:p-8 bg-white/95 backdrop-blur-3xl animate-in fade-in duration-500">
      <div className="w-full max-w-7xl bg-white border border-zinc-200 rounded-none sm:rounded-[4rem] shadow-2xl flex flex-col h-full sm:h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="shrink-0 p-8 sm:p-12 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-black font-outfit text-zinc-900 tracking-tight">Neural Workspace</h2>
            <p className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.5em] mt-2">Sovereign Data Management Protocol</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300 group-focus-within:text-zinc-900 transition-colors" />
              <input 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search Synapse..." 
                className="bg-zinc-50 border border-zinc-100 rounded-2xl pl-12 pr-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-900 outline-none focus:border-zinc-300 transition-all w-full sm:w-64"
              />
            </div>
            <button onClick={onClose} className="p-5 text-zinc-400 hover:text-zinc-900 transition-all bg-zinc-50 rounded-3xl shadow-sm border border-zinc-100">
              <Plus className="w-6 h-6 rotate-45" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-full lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-100 p-6 sm:p-10 space-y-2 overflow-x-auto lg:overflow-y-auto no-scrollbar flex lg:flex-col gap-2 lg:gap-0">
            {tabs.map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-4 px-6 py-5 rounded-[2rem] transition-all text-left w-full shrink-0 lg:shrink ${activeTab === tab.id ? 'bg-zinc-900 text-white shadow-xl' : 'text-zinc-400 hover:bg-zinc-50'}`}
              >
                <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-white' : 'text-zinc-400'}`} />
                <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto p-8 sm:p-12 no-scrollbar bg-zinc-50/30">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 p-8 border-t border-zinc-100 flex justify-between items-center bg-white">
           <div className="flex gap-4">
              <div className="flex flex-col">
                 <span className="text-[7px] font-black text-zinc-300 uppercase tracking-widest">Neural Load</span>
                 <div className="flex gap-1 mt-1">
                    {[...Array(8)].map((_, i) => <div key={`load-bar-${i}`} className={`w-3 h-1 rounded-full ${i < 3 ? 'bg-zinc-900' : 'bg-zinc-100'}`} />)}
                 </div>
              </div>
           </div>
           <button className="px-10 py-4 bg-zinc-900 text-white rounded-full text-[10px] font-black uppercase tracking-[0.4em] shadow-xl hover:bg-black transition-all active:scale-95">Sync All Nodes</button>
        </div>
      </div>
    </div>
  );
};
