
import React, { useState, useEffect } from 'react';
import { User, Role, SubscriptionTier, AiMood, IntelligenceLevel } from '../types';
import { OWNER_EMAIL, OWNER_PASSWORD, ARJUN_DETAILED_BIO } from '../constants';
import { AnoraLogo } from './AnoraLogo';

interface AuthScreenProps {
  onLogin: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState(0); // 0: Start, 1: Form, 2: Neural Booting

  useEffect(() => {
    const timer = setTimeout(() => setPhase(1), 800);
    return () => clearTimeout(timer);
  }, []);

  const getUsers = (): User[] => {
    const data = localStorage.getItem('anora_users_db');
    return data ? JSON.parse(data) : [];
  };

  const saveUser = (user: User) => {
    const users = getUsers();
    users.push(user);
    localStorage.setItem('anora_users_db', JSON.stringify(users));
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Artificial synthesis delay
    setTimeout(() => {
      const users = getUsers();
      const emailLower = email.toLowerCase().trim();

      if (isLogin) {
        // Owner verification logic
        if (emailLower === OWNER_EMAIL && password === OWNER_PASSWORD) {
          let owner = users.find(u => u.email.toLowerCase() === OWNER_EMAIL);
          if (!owner) {
            owner = {
              id: 'sovereign_arj',
              name: "Arjun Bharti Mina",
              email: OWNER_EMAIL,
              password: OWNER_PASSWORD,
              role: Role.OWNER,
              tier: SubscriptionTier.LIFETIME,
              bio: ARJUN_DETAILED_BIO,
              preferences: { 
                accentColor: '#d4af37', 
                aiMood: 'CREATIVE' as AiMood, 
                voiceName: 'Kore',
                autoRead: true,
                continuousListening: false,
                intelligenceLevel: 'DEEP' as IntelligenceLevel,
                language: 'English',
                theme: 'OBSIDIAN',
                font: 'OUTFIT',
                soundEnabled: true,
                persona: 'DEFAULT'
              },
              createdAt: new Date().toISOString(),
              reminders: [],
              notes: [],
              memory: [],
              projects: []
            };
            saveUser(owner);
          }
          setPhase(2);
          setTimeout(() => onLogin(owner!), 2500);
          return;
        }

        const found = users.find(u => u.email.toLowerCase() === emailLower);
        if (!found) {
          setError('Neural ID not recognized in database.');
        } else if (found.password !== password) {
          setError('Security mismatch. Verify encryption key.');
        } else {
          setPhase(2);
          setTimeout(() => onLogin(found), 2000);
        }
      } else {
        if (password !== confirmPassword) {
          setError('Encryption keys must be identical.');
        } else if (users.some(u => u.email.toLowerCase() === emailLower)) {
          setError('Neural ID already established.');
        } else if (password.length < 6) {
          setError('Key complexity requirements not met.');
        } else {
          const newUser: User = {
            id: Math.random().toString(36).substr(2, 9),
            name: name || 'Neural Link User',
            email: emailLower,
            password: password,
            role: Role.USER,
            tier: SubscriptionTier.FREE,
            preferences: { 
              accentColor: '#3f3f46', 
              aiMood: 'CALM' as AiMood, 
              voiceName: 'Kore',
              autoRead: true,
              continuousListening: false,
              intelligenceLevel: 'BALANCED' as IntelligenceLevel,
              language: 'English',
              theme: 'OBSIDIAN',
              font: 'INTER',
              soundEnabled: true,
              persona: 'DEFAULT'
            },
            createdAt: new Date().toISOString(),
            reminders: [],
            notes: [],
            memory: [],
            projects: []
          };
          saveUser(newUser);
          setPhase(2);
          setTimeout(() => onLogin(newUser), 2000);
        }
      }
      setLoading(false);
    }, 1800);
  };

  if (phase === 2) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-8 space-y-12 font-outfit overflow-hidden">
        {/* Dynamic Scanlines / Background Effect */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.05)_0%,_transparent_70%)] animate-pulse"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>
        
        <div className="animate-bounce transition-all duration-1000 scale-125">
          <AnoraLogo size={140} color="#fff" showName={false} />
        </div>

        <div className="text-center space-y-8 relative z-10 w-full max-w-sm">
          <div className="space-y-2">
            <h2 className="text-white text-2xl font-bold tracking-[0.5em] animate-pulse">BOOTING ANORA CORE</h2>
            <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-[0.3em]">Neural Integration in progress...</p>
          </div>
          
          <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/50 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
            <div className="h-full bg-white animate-neural-progress"></div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-left">
             <div className="p-3 bg-white/5 border border-white/10 rounded-xl space-y-1">
                <p className="text-[7px] text-zinc-500 uppercase font-bold tracking-widest">Neural Status</p>
                <p className="text-[10px] text-green-500 font-bold uppercase tracking-wider animate-pulse">OPTIMIZED</p>
             </div>
             <div className="p-3 bg-white/5 border border-white/10 rounded-xl space-y-1">
                <p className="text-[7px] text-zinc-500 uppercase font-bold tracking-widest">Logic Engine</p>
                <p className="text-[10px] text-blue-500 font-bold uppercase tracking-wider animate-pulse">SYNCHRONIZED</p>
             </div>
          </div>
          
          <div className="pt-4">
             <p className="text-zinc-800 text-[8px] font-bold uppercase tracking-[0.6em] animate-[pulse_3s_infinite]">End-to-End Encryption: ACTIVE</p>
          </div>
        </div>

        <style>{`
          @keyframes neural-progress {
            0% { width: 0%; transform: translateX(-100%); }
            50% { width: 60%; transform: translateX(50%); }
            100% { width: 10%; transform: translateX(400%); }
          }
          .animate-neural-progress {
            animation: neural-progress 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 relative overflow-hidden font-outfit">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#0a0a0a_0%,_#000_100%)]"></div>
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>
      
      {/* Decorative Aura */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/5 rounded-full blur-[150px] animate-pulse pointer-events-none"></div>

      <div className={`w-full max-w-md transition-all duration-[1200ms] transform ${phase === 1 ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'}`}>
        <div className="text-center mb-16 space-y-4">
          <div className="flex justify-center transform hover:scale-110 transition-transform duration-700">
            <AnoraLogo size={80} color="#fff" showName={false} />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-[0.4em] text-white">ANORA</h1>
            <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-[0.6em] animate-pulse">Sovereign Intel v3.5</p>
          </div>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800/50 p-12 rounded-[4rem] backdrop-blur-3xl shadow-[0_0_80px_rgba(0,0,0,0.5)] ring-1 ring-white/5 relative group">
          <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 rounded-[4rem]"></div>
          
          {/* Access Toggle */}
          <div className="flex bg-black/60 p-2 rounded-2xl border border-zinc-800/50 mb-10 relative z-10 overflow-hidden">
            <button 
              type="button"
              onClick={() => { setIsLogin(true); setError(''); }}
              className={`flex-1 py-3.5 text-[10px] font-bold uppercase tracking-[0.2em] rounded-xl transition-all duration-700 ${isLogin ? 'bg-zinc-800 text-white shadow-2xl' : 'text-zinc-600 hover:text-zinc-300'}`}
            >
              Access Core
            </button>
            <button 
              type="button"
              onClick={() => { setIsLogin(false); setError(''); }}
              className={`flex-1 py-3.5 text-[10px] font-bold uppercase tracking-[0.2em] rounded-xl transition-all duration-700 ${!isLogin ? 'bg-zinc-800 text-white shadow-2xl' : 'text-zinc-600 hover:text-zinc-300'}`}
            >
              Establish Link
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-6 relative z-10">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl animate-in slide-in-from-top-2 duration-500">
                <p className="text-red-400 text-[9px] font-bold uppercase tracking-widest text-center">{error}</p>
              </div>
            )}

            <div className="space-y-5">
              {!isLogin && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <label className="block text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-2 ml-2">Identity Signature</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-black/40 border border-zinc-800 rounded-2xl px-6 py-4.5 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all text-sm placeholder:text-zinc-800"
                    placeholder="E.g. Arjun"
                  />
                </div>
              )}
              
              <div className={`animate-in slide-in-from-top-2 duration-500 ${!isLogin ? 'delay-75' : ''}`}>
                <label className="block text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-2 ml-2">Neural ID (Email)</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/40 border border-zinc-800 rounded-2xl px-6 py-4.5 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all text-sm placeholder:text-zinc-800"
                  placeholder="identity@neural.link"
                />
              </div>

              <div className={`animate-in slide-in-from-top-2 duration-700 ${!isLogin ? 'delay-150' : ''}`}>
                <label className="block text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-2 ml-2">Access Key (Password)</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/40 border border-zinc-800 rounded-2xl px-6 py-4.5 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all text-sm placeholder:text-zinc-800"
                  placeholder="••••••••"
                />
              </div>

              {!isLogin && (
                <div className="animate-in slide-in-from-top-2 duration-1000 delay-200">
                  <label className="block text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-2 ml-2">Verify Encryption Key</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-black/40 border border-zinc-800 rounded-2xl px-6 py-4.5 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all text-sm placeholder:text-zinc-800"
                    placeholder="••••••••"
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black font-bold py-5 rounded-[2rem] hover:bg-zinc-200 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 shadow-2xl mt-10 overflow-hidden relative group/btn"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/5 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000"></div>
              {loading ? (
                 <div className="flex items-center gap-3">
                   <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                   <span className="text-[10px] uppercase tracking-[0.3em] font-bold">Synthesizing...</span>
                 </div>
              ) : (
                <span className="text-[10px] uppercase tracking-[0.4em] font-bold">{isLogin ? "Neural Sync" : "Initialize Link"}</span>
              )}
            </button>
          </form>
        </div>

        <div className="flex justify-center items-center gap-3 mt-16 opacity-30">
           <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
           <p className="text-zinc-500 text-[8px] font-bold uppercase tracking-[0.6em]">Neural Encryption Optimized</p>
        </div>
      </div>
    </div>
  );
};
