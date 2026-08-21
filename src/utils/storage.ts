
/**
 * Safe LocalStorage utility with quota management and pruning.
 */

export const safeLocalStorage = {
  /**
   * Safe setItem that handles QuotaExceededError by pruning old data.
   */
  setItem: (key: string, value: string): boolean => {
    let valueToSave = value;
    
    // Emergency: If value is absurdly large (> 4MB), skip saving to prevent crash
    if (value.length > 4 * 1024 * 1024) {
      console.warn(`Neural info: Data object [${key}] exceeds safe threshold (${(value.length / 1024 / 1024).toFixed(2)}MB). Managing payloads...`);
      if (key === 'anora_users_db') {
        try {
          const users = JSON.parse(value);
          const pruned = users.map((u: any) => ({ ...u, avatar: u.avatar?.length > 50000 ? "" : u.avatar }));
          valueToSave = JSON.stringify(pruned);
        } catch (e) { return false; }
      } else if (key.startsWith('anora_history_') || key.startsWith('anora_gallery_')) {
        // Redact images if they are making the key too big
        try {
          const items = JSON.parse(value);
          const pruned = Array.isArray(items) ? items.slice(-2) : items; // Keep only very last
          valueToSave = JSON.stringify(pruned);
        } catch (e) { return false; }
      }
    }

    // If we're saving the users DB, ensure it's not already too large
    if (key === 'anora_users_db') {
      try {
        const users = JSON.parse(valueToSave);
        if (users.length > 15) {
          console.warn('Neural database overflow. Pruning input users list...');
          const owner = users.find((u: any) => u.role === 'OWNER');
          const others = users.filter((u: any) => u.role !== 'OWNER').slice(-10);
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
        
        // 1. Prune visual repositories (usually the largest)
        const galleryKeys = keys.filter(k => k.startsWith('anora_gallery_'));
        galleryKeys.forEach(k => {
          try {
            const gallery = JSON.parse(localStorage.getItem(k) || '[]');
            localStorage.setItem(k, JSON.stringify(gallery.slice(0, 2))); // Keep only 2 assets
          } catch (err) { localStorage.removeItem(k); }
        });
        
        // 2. Prune neural history
        const historyKeys = keys.filter(k => k.startsWith('anora_history_'));
        historyKeys.forEach(k => {
          try {
            const history = JSON.parse(localStorage.getItem(k) || '[]');
            localStorage.setItem(k, JSON.stringify(history.slice(-2))); // Keep only last 2 turns
          } catch (err) { localStorage.removeItem(k); }
        });

        // 3. Prune users database aggressively
        if (keys.includes('anora_users_db')) {
          try {
            const users = JSON.parse(localStorage.getItem('anora_users_db') || '[]');
            const owner = users.find((u: any) => u.role === 'OWNER');
            const currentUserSession = JSON.parse(localStorage.getItem('anora_session') || 'null');
            const essentialUsers = users.filter((u: any) => 
              u.id === currentUserSession?.id || u.role === 'OWNER'
            ).map((u: any) => ({ ...u, avatar: u.avatar?.length > 100000 ? "" : u.avatar }));
            localStorage.setItem('anora_users_db', JSON.stringify(essentialUsers));
          } catch (err) { localStorage.removeItem('anora_users_db'); }
        }
        
        // Try again
        try {
          localStorage.setItem(key, valueToSave);
          return true;
        } catch (retryErr) {
          // 4. Nuclear option: Clear everything except the key we are trying to save
          console.warn('Neural storage critical. Purging all collateral data...');
          keys.forEach(k => {
            if (k !== key && k !== 'anora_session') {
              localStorage.removeItem(k);
            }
          });
          
          try {
            localStorage.setItem(key, valueToSave);
            return true;
          } catch (finalErr) {
            // 5. Final attempt: Truncate current value
            if (key === 'anora_users_db') {
               try {
                 const users = JSON.parse(valueToSave);
                 const currentUserSession = JSON.parse(localStorage.getItem('anora_session') || 'null');
                 const minimal = users.filter((u: any) => u.id === currentUserSession?.id).map((u: any) => ({ ...u, avatar: "" }));
                 localStorage.setItem(key, JSON.stringify(minimal));
                 return true;
               } catch (e) {}
            }
            
            console.error('Neural storage rejection: Data too large for sovereign allocation.', finalErr);
            return false;
          }
        }
      }
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
 * Prunes a user object to keep its size manageable and ensures no undefined values for Firestore.
 */
export const pruneUser = (user: any) => {
  if (!user) return user;
  
  const pruned: any = { ...user };
  
  // Ensure required fields for Firestore are not undefined
  pruned.bio = pruned.bio || "";
  pruned.avatar = pruned.avatar || "";
  pruned.dob = pruned.dob || "";
  pruned.phoneNumber = pruned.phoneNumber || "";

  // Remove any remaining undefined values recursively
  Object.keys(pruned).forEach(key => {
    if (pruned[key] === undefined) {
      delete pruned[key];
    } else if (pruned[key] && typeof pruned[key] === 'object' && !Array.isArray(pruned[key])) {
      // Clean nested objects (like preferences)
      Object.keys(pruned[key]).forEach(subKey => {
        if (pruned[key][subKey] === undefined) {
          delete pruned[key][subKey];
        }
      });
    }
  });
  
  // Limit memory items
  if (pruned.memory && pruned.memory.length > 20) {
    pruned.memory = pruned.memory.slice(-20);
  }

  // Prune high-res avatars to prevent storage bloat
  if (pruned.avatar && pruned.avatar.length > 50000) {
    console.warn(`Neural avatar overflow for ${pruned.name}. Redacting high-res visual payload.`);
    pruned.avatar = ""; 
  }

  // Prune persona avatars (Firestore 1MB document limit safety)
  if (pruned.personaAvatars) {
    const pAvatars = { ...pruned.personaAvatars };
    Object.keys(pAvatars).forEach(p => {
       // If any single persona avatar is > 60KB, it's too large for a 1MB doc with many objects
       if (pAvatars[p] && pAvatars[p].length > 60000) {
          console.warn(`Persona avatar [${p}] exceeds 60KB. Pruning for sync stability.`);
          delete pAvatars[p];
       }
    });
    pruned.personaAvatars = pAvatars;
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

/**
 * Recursively removes undefined values from an object or array to make it Firestore-compatible.
 */
export const cleanFirestoreData = (data: any): any => {
  if (data === undefined) return null; 
  if (data === null) return null;
  
  if (Array.isArray(data)) {
    return data.map(item => cleanFirestoreData(item));
  }
  
  if (typeof data === 'object' && !(data instanceof Date)) {
    const clean: any = {};
    Object.keys(data).forEach(key => {
      const value = cleanFirestoreData(data[key]);
      if (value !== undefined) {
        clean[key] = value;
      }
    });
    return clean;
  }
  
  return data;
};
