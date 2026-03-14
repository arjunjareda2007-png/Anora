
/**
 * Safe LocalStorage utility with quota management and pruning.
 */

export const safeLocalStorage = {
  /**
   * Safe setItem that handles QuotaExceededError by pruning old data.
   */
  setItem: (key: string, value: string): boolean => {
    let valueToSave = value;
    
    // If we're saving the users DB, ensure it's not already too large
    if (key === 'anora_users_db') {
      try {
        const users = JSON.parse(value);
        if (users.length > 20) {
          console.warn('Neural database overflow. Pruning input users list...');
          // Keep owner and most recent users
          const owner = users.find((u: any) => u.role === 'OWNER');
          const others = users.filter((u: any) => u.role !== 'OWNER').slice(-15);
          const pruned = owner ? [owner, ...others] : others;
          valueToSave = JSON.stringify(pruned);
        }
      } catch (e) {}
    }

    try {
      localStorage.setItem(key, valueToSave);
      return true;
    } catch (e: any) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.warn('Neural storage quota exceeded. Initiating emergency pruning protocol...');
        
        const keys = Object.keys(localStorage);
        
        // 1. Prune chat sessions (usually the largest)
        const sessionKeys = keys.filter(k => k.startsWith('anora_sessions_'));
        sessionKeys.forEach(k => {
          try {
            const sessions = JSON.parse(localStorage.getItem(k) || '[]');
            const prunedSessions = sessions.map((s: any) => ({
              ...s,
              messages: s.messages.slice(-2) // Keep only last 2 messages
            })).slice(-1); // Keep only last 1 session
            localStorage.setItem(k, JSON.stringify(prunedSessions));
          } catch (err) {
            localStorage.removeItem(k);
          }
        });

        // 2. Prune Gemini history
        const historyKeys = keys.filter(k => k.startsWith('anora_history_'));
        historyKeys.forEach(k => {
          try {
            const history = JSON.parse(localStorage.getItem(k) || '[]');
            localStorage.setItem(k, JSON.stringify(history.slice(-2))); // Keep only last 2 turns
          } catch (err) {
            localStorage.removeItem(k);
          }
        });

        // 3. Prune users database aggressively
        if (keys.includes('anora_users_db')) {
          try {
            const users = JSON.parse(localStorage.getItem('anora_users_db') || '[]');
            const owner = users.find((u: any) => u.role === 'OWNER');
            const currentUserSession = JSON.parse(localStorage.getItem('anora_session') || 'null');
            const essentialUsers = users.filter((u: any) => 
              u.id === currentUserSession?.id || u.role === 'OWNER'
            ).slice(0, 3);
            localStorage.setItem('anora_users_db', JSON.stringify(essentialUsers));
          } catch (err) {
            localStorage.removeItem('anora_users_db');
          }
        }
        
        // Try again
        try {
          localStorage.setItem(key, valueToSave);
          return true;
        } catch (retryErr) {
          // 4. Nuclear option: Clear everything except the key we are trying to save
          console.warn('Neural storage still full. Nuclear pruning initiated...');
          keys.forEach(k => {
            if (k !== key && k !== 'anora_session') {
              localStorage.removeItem(k);
            }
          });
          
          try {
            localStorage.setItem(key, valueToSave);
            return true;
          } catch (finalErr) {
            // 5. Final attempt: Truncate the value itself if it's still too large
            if (key === 'anora_users_db') {
               try {
                 const users = JSON.parse(valueToSave);
                 const currentUserSession = JSON.parse(localStorage.getItem('anora_session') || 'null');
                 const minimal = users.filter((u: any) => u.id === currentUserSession?.id);
                 localStorage.setItem(key, JSON.stringify(minimal));
                 return true;
               } catch (e) {}
            }
            
            console.error('Neural storage critical failure. Quota cannot be recovered.', finalErr);
            return false;
          }
        }
      }
      console.error('Neural storage error:', e);
      return false;
    }
  },

  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.error('Neural storage read error:', e);
      return null;
    }
  },

  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error('Neural storage removal error:', e);
    }
  }
};

/**
 * Prunes a user object to keep its size manageable.
 */
export const pruneUser = (user: any) => {
  if (!user) return user;
  
  const pruned = { ...user };
  
  // Limit memory items
  if (pruned.memory && pruned.memory.length > 20) {
    pruned.memory = pruned.memory.slice(-20);
  }
  
  // Limit reminders
  if (pruned.reminders && pruned.reminders.length > 30) {
    pruned.reminders = pruned.reminders.slice(-30);
  }
  
  // Limit notes
  if (pruned.notes && pruned.notes.length > 20) {
    pruned.notes = pruned.notes.slice(-20);
  }

  // Limit site logs
  if (pruned.siteLogs && pruned.siteLogs.length > 20) {
    pruned.siteLogs = pruned.siteLogs.slice(-20);
  }

  // Limit lyrics
  if (pruned.lyrics && pruned.lyrics.length > 10) {
    pruned.lyrics = pruned.lyrics.slice(-10);
  }
  
  return pruned;
};
