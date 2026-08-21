
import React, { useState, useEffect } from 'react';
import { User, Role, SubscriptionTier, AiMood, IntelligenceLevel } from '../types';
import { OWNER_EMAIL, OWNER_PASSWORD, ARJUN_DETAILED_BIO } from '../constants';
import { AnoraLogo } from './AnoraLogo';
import { Eye, EyeOff } from 'lucide-react';
import { signInWithGoogle, auth, db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { pruneUser, cleanFirestoreData, safeLocalStorage } from '../src/utils/storage';

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
  const [phase, setPhase] = useState(0); // 0: Start, 1: Form, 2: Neural Booting, 3: Recovery
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setPhase(1), 800);
    return () => clearTimeout(timer);
  }, []);

  const getUsers = (): User[] => {
    const data = safeLocalStorage.getItem('anora_users_db');
    return data ? JSON.parse(data) : [];
  };

  const saveUser = (user: User) => {
    const users = getUsers();
    users.push(user);
    safeLocalStorage.setItem('anora_users_db', JSON.stringify(users));
    window.dispatchEvent(new Event('anora_database_updated'));
  };

  const updateUsers = (updatedUsers: User[]) => {
    safeLocalStorage.setItem('anora_users_db', JSON.stringify(updatedUsers));
    window.dispatchEvent(new Event('anora_database_updated'));
  };

  const handleGoogleAuth = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithGoogle();
      const firebaseUser = result.user;
      const emailLower = firebaseUser.email?.toLowerCase().trim() || '';

      // Try fetching from Firestore first
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      let existingUser: User | undefined;

      if (userDoc.exists()) {
        existingUser = userDoc.data() as User;
      } else {
        // Check local storage as fallback
        const users = getUsers();
        const found = users.find(u => u.email.toLowerCase() === emailLower);
        
        if (found) {
          existingUser = { ...found, id: firebaseUser.uid };
        } else {
          const isOwner = emailLower === OWNER_EMAIL;
          const firstName = (firebaseUser.displayName || 'User').split(' ')[0].toLowerCase();
          // Default DOB to 13 May to match the user's example logic if not known
          const defaultDob = '2000-05-13'; 
          const day = defaultDob.split('-')[2];
          const defaultPassword = `${firstName}@${day}`;

          existingUser = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || 'Neural Link User',
            email: emailLower,
            password: defaultPassword,
            dob: defaultDob,
            avatar: firebaseUser.photoURL || undefined,
            role: isOwner ? Role.OWNER : Role.USER,
            tier: isOwner ? SubscriptionTier.LIFETIME : SubscriptionTier.FREE,
            bio: isOwner ? ARJUN_DETAILED_BIO : undefined,
            preferences: { 
              accentColor: isOwner ? '#d4af37' : '#3f3f46', 
              aiMood: (isOwner ? 'CREATIVE' : 'CALM') as AiMood, 
              voiceName: 'Kore',
              autoRead: false,
              continuousListening: false,
              intelligenceLevel: (isOwner ? 'DEEP' : 'BALANCED') as IntelligenceLevel,
              language: 'Hindi',
              theme: 'OBSIDIAN',
              font: isOwner ? 'OUTFIT' : 'INTER',
              soundEnabled: true,
              persona: 'DEFAULT',
              colorMode: 'WHITE'
            },
            createdAt: new Date().toISOString(),
            reminders: [],
            notes: [],
            memory: [],
            projects: []
          };
        }
        // Save to Firestore
        try {
          const pruned = cleanFirestoreData(pruneUser(existingUser));
          await setDoc(doc(db, 'users', firebaseUser.uid), pruned);
        } catch (syncErr) {
          handleFirestoreError(syncErr, OperationType.WRITE, `users/${firebaseUser.uid}`);
        }
      }

      setPhase(2);
      setTimeout(() => onLogin(existingUser!), 2000);
    } catch (err: any) {
      console.error(err);
      setError('Google Authentication failed. Protocol interrupted.');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(async () => {
      const users = getUsers();
      const emailLower = email.toLowerCase().trim();

      if (isLogin) {
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
                autoRead: false,
                continuousListening: false,
                intelligenceLevel: 'DEEP' as IntelligenceLevel,
                language: 'Hindi',
                theme: 'OBSIDIAN',
                font: 'OUTFIT',
                soundEnabled: true,
                persona: 'DEFAULT',
                colorMode: 'WHITE'
              },
              createdAt: new Date().toISOString(),
              reminders: [],
              notes: [],
              memory: [],
              projects: []
            };
            saveUser(owner);
          }
          // Sync to Firestore if authenticated
          if (auth.currentUser && auth.currentUser.uid === owner.id) {
            try {
              const pruned = cleanFirestoreData(pruneUser(owner));
              await setDoc(doc(db, 'users', owner.id), pruned);
            } catch (syncErr) {
              handleFirestoreError(syncErr, OperationType.WRITE, `users/${owner.id}`);
            }
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
          // Sync to Firestore if authenticated
          if (auth.currentUser && auth.currentUser.uid === found.id) {
            try {
              const pruned = cleanFirestoreData(pruneUser(found));
              await setDoc(doc(db, 'users', found.id), pruned);
            } catch (syncErr) {
              handleFirestoreError(syncErr, OperationType.WRITE, `users/${found.id}`);
            }
          }
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
              autoRead: false,
              continuousListening: false,
              intelligenceLevel: 'BALANCED' as IntelligenceLevel,
              language: 'Hindi',
              theme: 'OBSIDIAN',
              font: 'INTER',
              soundEnabled: true,
              persona: 'DEFAULT',
              colorMode: 'WHITE'
            },
            createdAt: new Date().toISOString(),
            reminders: [],
            notes: [],
            memory: [],
            projects: []
          };
          saveUser(newUser);
          // Sync to Firestore if authenticated
          if (auth.currentUser && auth.currentUser.uid === newUser.id) {
            try {
              const pruned = cleanFirestoreData(pruneUser(newUser));
              await setDoc(doc(db, 'users', newUser.id), pruned);
            } catch (syncErr) {
              handleFirestoreError(syncErr, OperationType.WRITE, `users/${newUser.id}`);
            }
          }
          setPhase(2);
          setTimeout(() => onLogin(newUser), 2000);
        }
      }
      setLoading(false);
    }, 1800);
  };

  const handleRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(async () => {
      const users = getUsers();
      const emailLower = email.toLowerCase().trim();
      const foundIdx = users.findIndex(u => u.email.toLowerCase() === emailLower);

      if (foundIdx === -1) {
        setError("Neural ID not found in database.");
        setLoading(false);
      } else if (emailLower === OWNER_EMAIL) {
        setError("Sovereign recovery requires manual protocol. Reference '8233538355'.");
        setLoading(false);
      } else {
        const updatedUsers = [...users];
        const updatedUser = { ...updatedUsers[foundIdx], password: password };
        updatedUsers[foundIdx] = updatedUser;
        updateUsers(updatedUsers);
        
        // Sync to Firestore if authenticated
        if (auth.currentUser && auth.currentUser.uid === updatedUser.id) {
          try {
            await updateDoc(doc(db, 'users', updatedUser.id), { password: password });
          } catch (syncErr) {
            handleFirestoreError(syncErr, OperationType.UPDATE, `users/${updatedUser.id}`);
          }
        }

        setRecoverySuccess(true);
        setLoading(false);
        setTimeout(() => {
          setPhase(1);
          setRecoverySuccess(false);
          setIsLogin(true);
        }, 3000);
      }
    }, 2000);
  };

  if (phase === 2) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col items-center justify-center p-8 space-y-12 font-outfit overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.05)_0%,_transparent_70%)] animate-pulse"></div>
        
        <div className="transition-all duration-1000 scale-150">
          <AnoraLogo size={160} color="#000" showName={false} animate={true} />
        </div>

        <div className="text-center space-y-8 relative z-10 w-full max-sm:max-w-xs max-w-md">
          <div className="space-y-3">
            <h2 className="text-zinc-900 dark:text-white text-3xl font-black tracking-[0.6em] animate-pulse">Neural Booting</h2>
            <p className="text-zinc-400 dark:text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em]">Establishing Sovereign Neural Link...</p>
          </div>
          
          <div className="w-full h-1.5 bg-zinc-100 dark:bg-white/5 rounded-full overflow-hidden border border-zinc-200 dark:border-white/10 shadow-sm">
            <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 animate-neural-progress"></div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
             {[1,2,3].map(i => (
               <div key={i} className="h-1 bg-zinc-100 dark:bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-zinc-900 dark:bg-white animate-pulse" style={{ animationDelay: `${i * 200}ms` }}></div>
               </div>
             ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center p-6 relative overflow-hidden font-outfit">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#f9f9f9_0%,_#fff_100%)] dark:bg-[radial-gradient(circle_at_center,_#0a0a0a_0%,_#000_100%)]"></div>
      
      <div className={`w-full max-w-md transition-all duration-1000 transform ${phase === 1 || phase === 3 ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'}`}>
        <div className="text-center mb-1 sm:mb-8 space-y-0.5 sm:space-y-4 animate-in fade-in slide-in-from-top-8 duration-1000">
          <div className="flex justify-center transform hover:scale-110 transition-all duration-1000 cursor-pointer">
            <AnoraLogo size={40} color="#000" showName={false} />
          </div>
          <div className="space-y-0 sm:space-y-1">
            <h1 className="text-lg sm:text-4xl font-black tracking-[0.4em] text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-white dark:via-zinc-400 dark:to-white dark:drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]">ANORA</h1>
            <p className="text-zinc-400 dark:text-zinc-500 text-[6px] sm:text-[9px] font-black uppercase tracking-[0.6em] animate-pulse">Sovereign Intelligence</p>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-3xl border border-zinc-100 dark:border-white/10 p-3 sm:p-10 rounded-[1.2rem] sm:rounded-[3rem] shadow-2xl ring-1 ring-black/5 relative group animate-in zoom-in-95 duration-1000">
          
          {phase === 1 ? (
            <>
              <div className="flex bg-zinc-100/50 dark:bg-white/5 p-1 rounded-lg border border-zinc-200 dark:border-white/10 mb-2 sm:mb-8 relative z-10">
                <button 
                  type="button"
                  onClick={() => { setIsLogin(true); setError(''); }}
                  className={`flex-1 py-1.5 sm:py-3 text-[7px] font-black uppercase tracking-[0.2em] rounded-lg transition-all duration-700 ${isLogin ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-md' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
                >
                  Access
                </button>
                <button 
                  type="button"
                  onClick={() => { setIsLogin(false); setError(''); }}
                  className={`flex-1 py-1.5 sm:py-3 text-[7px] font-black uppercase tracking-[0.2em] rounded-lg transition-all duration-700 ${!isLogin ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-md' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
                >
                  Link
                </button>
              </div>

              <form onSubmit={handleAuth} className="space-y-2 sm:space-y-4 relative z-10">
                {error && (
                  <div className="p-1.5 sm:p-3 bg-red-500/10 border border-red-500/20 rounded-lg animate-in shake-in duration-500">
                    <p className="text-red-600 text-[6px] sm:text-[8px] font-black uppercase tracking-widest text-center">{error}</p>
                  </div>
                )}

                <div className="space-y-1.5 sm:space-y-4">
                  {!isLogin && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className="block text-[6px] sm:text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-0.5 ml-2">Identity Signature</label>
                      <input
                        type="text" required value={name} onChange={(e) => setName(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg px-3 py-2 sm:px-5 sm:py-4 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-[10px] sm:text-sm placeholder:text-zinc-300 dark:placeholder:text-zinc-700"
                        placeholder="E.g. Arjun"
                      />
                    </div>
                  )}
                  
                  <div className="animate-in fade-in slide-in-from-top-2 duration-500">
                    <label className="block text-[6px] sm:text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-0.5 ml-2">Neural ID</label>
                    <input
                      type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg px-3 py-2 sm:px-5 sm:py-4 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-[10px] sm:text-sm placeholder:text-zinc-300 dark:placeholder:text-zinc-700"
                      placeholder="identity@neural.link"
                    />
                  </div>

                  <div className="animate-in fade-in slide-in-from-top-2 duration-700">
                    <label className="block text-[6px] sm:text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-0.5 ml-2">Access Key</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg px-3 py-2 sm:px-5 sm:py-4 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-[10px] sm:text-sm placeholder:text-zinc-300 dark:placeholder:text-zinc-700"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {!isLogin && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-900">
                      <label className="block text-[6px] sm:text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-0.5 ml-2">Verify Key</label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg px-3 py-2 sm:px-5 sm:py-4 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-[10px] sm:text-sm placeholder:text-zinc-300 dark:placeholder:text-zinc-700"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                        >
                          {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {isLogin && (
                  <div className="flex justify-end px-1">
                    <button type="button" onClick={() => setPhase(3)} className="text-[6px] sm:text-[8px] font-black text-zinc-400 uppercase tracking-widest hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                      Recovery Protocol
                    </button>
                  </div>
                )}

                <button
                  type="submit" disabled={loading}
                  className="w-full bg-zinc-900 dark:bg-white text-white dark:text-black font-black py-2.5 sm:py-5 rounded-xl sm:rounded-[2rem] hover:scale-[1.02] transition-all active:scale-[0.98] disabled:opacity-50 mt-1 sm:mt-4 overflow-hidden relative shadow-xl group/btn"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-0 group-hover/btn:opacity-10 transition-opacity"></div>
                  <span className="text-[9px] sm:text-xs uppercase tracking-widest">{loading ? "Synthesizing..." : (isLogin ? "Neural Sync" : "Initialize Link")}</span>
                </button>

                <div className="relative py-1 sm:py-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-100 dark:border-white/10"></div>
                  </div>
                  <div className="relative flex justify-center text-[7px] sm:text-[9px] font-black uppercase tracking-widest">
                    <span className="bg-white dark:bg-zinc-900 px-2 text-zinc-400">Or Neural Bridge</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white font-black py-2.5 sm:py-5 rounded-xl sm:rounded-[2.5rem] hover:scale-[1.02] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm group/google"
                >
                  <svg className="w-3.5 h-3.5 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span className="text-[8px] sm:text-[10px] uppercase tracking-[0.2em]">Continue with Google</span>
                </button>
              </form>
            </>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
              <h3 className="text-zinc-900 dark:text-white text-center text-[8px] sm:text-sm font-black uppercase tracking-[0.4em] mb-2 sm:mb-8">Neural Recovery</h3>
              
              {recoverySuccess ? (
                <div className="text-center space-y-2 sm:space-y-6 py-2 sm:py-8 animate-in zoom-in duration-700">
                   <div className="w-10 h-10 sm:w-20 sm:h-20 bg-green-500/10 border border-green-500/20 rounded-full mx-auto flex items-center justify-center">
                     <svg className="w-5 h-5 sm:w-10 sm:h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                   </div>
                   <div className="space-y-0 sm:space-y-2">
                     <p className="text-green-600 text-[8px] sm:text-[11px] font-black uppercase tracking-widest">Key Re-Synchronized</p>
                     <p className="text-zinc-400 text-[6px] sm:text-[9px] font-black uppercase tracking-widest">Returning to Core Access...</p>
                   </div>
                </div>
              ) : (
                <form onSubmit={handleRecovery} className="space-y-2 sm:space-y-6">
                  {error && (
                    <div className="p-1.5 sm:p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-center">
                      <p className="text-red-600 text-[6px] sm:text-[9px] font-black uppercase tracking-widest">{error}</p>
                    </div>
                  )}
                  <div className="space-y-1.5 sm:space-y-5">
                    <div>
                      <label className="block text-[6px] sm:text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-0.5 sm:mb-2 ml-2">Neural ID</label>
                      <input
                        type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg px-3 py-2 sm:px-6 sm:py-5 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-[10px] sm:text-sm"
                        placeholder="Verify email associated with link..."
                      />
                    </div>
                    <div>
                      <label className="block text-[6px] sm:text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-0.5 sm:mb-2 ml-2">New Access Key</label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                          className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg px-3 py-2 sm:px-6 sm:py-5 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-[10px] sm:text-sm"
                          placeholder="Define new encryption sequence..."
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                        >
                          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="pt-1 sm:pt-6 flex flex-col gap-1.5 sm:gap-4">
                    <button type="submit" disabled={loading} className="w-full bg-zinc-900 dark:bg-white text-white dark:text-black font-black py-2.5 sm:py-6 rounded-xl sm:rounded-[2.5rem] uppercase text-[7px] sm:text-[10px] tracking-widest hover:scale-[1.02] transition-all">
                      {loading ? "Validating Neural ID..." : "Reset Encryption Key"}
                    </button>
                    <button type="button" onClick={() => setPhase(1)} className="w-full text-zinc-400 font-black uppercase text-[7px] sm:text-[10px] tracking-widest hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                      Return to Sync
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
