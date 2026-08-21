import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { anoraService } from '../services/geminiService';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Download, Loader2, X, Volume2, Mic2, Trash2, Share2, Sparkles, Upload } from 'lucide-react';

interface NeuralAudioProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  isSection?: boolean;
}

export const NeuralAudio: React.FC<NeuralAudioProps> = ({ user, isOpen, onClose, isSection = false }) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{id: string, text: string, raw?: string}[]>([]);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email) {
      const audioKey = `anora_audio_history_${user.email}`;
      const saved = localStorage.getItem(audioKey);
      if (saved) {
        try {
          const list = JSON.parse(saved);
          setHistory(list);
        } catch (e) {
          console.error("Audio history payload damaged", e);
        }
      }
    }
  }, [user?.email]);

  const updateHistory = (updated: typeof history) => {
    let listToSave = [...updated];
    // Keep at most 10 items to prevent bloating public storage
    if (listToSave.length > 10) {
      listToSave = listToSave.slice(0, 10);
    }
    
    if (user?.email) {
      const audioKey = `anora_audio_history_${user.email}`;
      while (listToSave.length > 0) {
        try {
          localStorage.setItem(audioKey, JSON.stringify(listToSave));
          break; // Saved successfully!
        } catch (e) {
          if (listToSave.length > 1) {
            listToSave.pop(); // Evict oldest and retry
          } else {
            console.error("Storage quota completely full inside updateHistory", e);
            localStorage.removeItem(audioKey);
            listToSave = [];
            break;
          }
        }
      }
    }
    setHistory(listToSave);
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        const newId = `upload_${Date.now()}`;
        const cleanName = file.name || "Uploaded Audio Record";
        const updated = [{ id: newId, text: cleanName, raw: base64 }, ...history];
        updateHistory(updated);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> => {
    if (data.length === 0) return ctx.createBuffer(numChannels, 1, sampleRate);
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  };

  const decode = (base64: string) => {
    try {
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
      return bytes;
    } catch (e) {
      console.error("Neural decoding error", e);
      return new Uint8Array(0);
    }
  };

  const handlePlayRaw = async (id: string, base64: string) => {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
    if (activeSourceRef.current) {
      try { activeSourceRef.current.stop(); } catch (e) {}
    }
    setIsPlaying(id);
    
    try {
      const buffer = await decodeAudioData(decode(base64), audioCtxRef.current, 24000, 1);
      const source = audioCtxRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtxRef.current.destination);
      activeSourceRef.current = source;
      source.onended = () => {
        setIsPlaying(null);
      };
      source.start();
    } catch (error) {
      console.error("Audio playback error", error);
      setIsPlaying(null);
    }
  };

  const encodeWAV = (samples: Int16Array, sampleRate: number = 24000): Blob => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (view: DataView, offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // Raw PCM S16 S16
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // Byte rate
    view.setUint16(32, 2, true); // Block align
    view.setUint16(34, 16, true); // 16 bits
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    for (let i = 0; i < samples.length; i++) {
      view.setInt16(44 + i * 2, samples[i], true);
    }

    return new Blob([view], { type: 'audio/wav' });
  };

  const handleDownload = (base64: string, textSnippet: string) => {
    try {
      const binary = decode(base64);
      const pcmSamples = new Int16Array(binary.buffer);
      const wavBlob = encodeWAV(pcmSamples, 24000);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      const cleanSnippet = textSnippet.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 20) || "audio";
      a.download = `anora_${cleanSnippet}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download failure", e);
    }
  };

  const handleShare = async (id: string, base64: string, fullText: string) => {
    try {
      const binary = decode(base64);
      const pcmSamples = new Int16Array(binary.buffer);
      const wavBlob = encodeWAV(pcmSamples, 24000);
      const file = new File([wavBlob], 'vocal_manifestation.wav', { type: 'audio/wav' });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Anora Vocal Output',
          text: `Manifestation from Anora Core: "${fullText}"`,
        });
      } else {
        // Fallback: Copy raw audio URL if available or simply copy text
        await navigator.clipboard.writeText(fullText);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2500);
      }
    } catch (err: any) {
      if (err instanceof Error && (err.name === 'AbortError' || err.message?.includes('canceled') || err.message?.includes('cancelled'))) {
        console.log('Share dismissed by user/agent');
      } else {
        console.warn('Sharing output failed', err);
      }
    }
  };

  const handleSynthesize = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const base64 = await anoraService.speak(text, user.preferences.voiceName || 'Kore');
      const textTitle = text.slice(0, 45) + (text.length > 45 ? '...' : '');
      const newId = `gen_${Date.now()}`;
      const updated = [{ id: newId, text: textTitle, raw: base64 }, ...history];
      updateHistory(updated);
      handlePlayRaw(newId, base64);
    } catch (err) {
      console.error("Vocal synthesis failed", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen && !isSection) return null;

  const content = (
    <div className={`flex flex-col h-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 ${isSection ? 'w-full' : 'w-full max-w-xl border border-zinc-200 dark:border-white/10 rounded-3xl sm:rounded-[3rem] shadow-2xl overflow-hidden'}`}>
      
      {!isSection && (
        <div className="shrink-0 p-6 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-2xl">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-md font-black tracking-tight uppercase">Neural Audio</h2>
              <p className="text-[7px] text-zinc-400 font-extrabold uppercase tracking-widest mt-0.5">Physical Voice Manifest Protocol</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-xl transition-all">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Speech Command Input</span>
            <span className="text-[7px] font-extrabold uppercase tracking-widest text-amber-500">{user.preferences.voiceName || 'Kore'} calibrated</span>
          </div>
          <textarea 
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Type any sentiment to manifest as realistic physical sound frequencies..." 
            className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-2xl p-5 text-sm font-bold text-zinc-800 dark:text-white outline-none focus:border-zinc-300 dark:focus:border-white/20 transition-all resize-none h-28"
          />
          <div className="flex gap-3">
            <button 
              onClick={handleSynthesize}
              disabled={loading || !text.trim()}
              className="flex-1 h-14 bg-zinc-900 hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-white rounded-2xl font-black uppercase text-[10px] tracking-wider active:scale-98 transition-all disabled:opacity-25 flex items-center justify-center gap-3 shadow-lg"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic2 className="w-4 h-4" />}
              {loading ? 'Manifesting Sound Waves...' : 'Execute Vocalization'}
            </button>
            <button
              onClick={() => uploadInputRef.current?.click()}
              className="px-5 h-14 bg-zinc-150 hover:bg-zinc-250 dark:bg-zinc-900/40 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 rounded-2xl font-black uppercase text-[10px] tracking-wider active:scale-98 transition-all flex items-center justify-center gap-2 border border-zinc-200 dark:border-white/5"
              title="Upload custom audio record"
            >
              <Upload className="w-4 h-4" />
              Upload
            </button>
            <input 
              type="file" 
              ref={uploadInputRef} 
              accept="audio/*" 
              onChange={handleAudioUpload} 
              className="hidden" 
            />
          </div>
        </div>

        {/* Current & Past Synthesations List */}
        <AnimatePresence mode="popLayout">
          {history.length > 0 && (
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Acoustic Synaptic Records</span>
                <span className="text-[7px] font-bold text-zinc-400">{history.length} Records</span>
              </div>
              <div className="space-y-2">
                {history.map((item, index) => (
                  <motion.div 
                    key={`${item.id}-${index}`}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className="p-4 bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5 rounded-2xl flex items-center justify-between gap-4 group hover:border-zinc-300 dark:hover:border-white/10 transition-all"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <button 
                        onClick={() => item.raw && handlePlayRaw(item.id, item.raw)} 
                        className={`p-2 rounded-xl border flex items-center justify-center transition-all shrink-0 ${
                          isPlaying === item.id 
                            ? 'bg-amber-500 text-black border-amber-500 animate-pulse' 
                            : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border-zinc-100 dark:border-white/10 hover:scale-105'
                        }`}
                      >
                        {isPlaying === item.id ? <Volume2 className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                      </button>
                      <div className="min-w-0">
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200 block truncate">{item.text}</span>
                        <span className="text-[7px] font-extrabold text-zinc-400 uppercase tracking-widest">
                          {item.id.startsWith('upload') ? 'UPLOADED AUDIO' : 'PCM SYNTHESIZED'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Download option */}
                      <button 
                        onClick={() => item.raw && handleDownload(item.raw, item.text)}
                        title="Download vocal asset (.wav)"
                        className="p-2 hover:bg-zinc-100 dark:hover:bg-white/10 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all active:scale-90"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {/* Share option */}
                      <button 
                        onClick={() => item.raw && handleShare(item.id, item.raw, item.text)}
                        title="Share / Copy text"
                        className="p-2 hover:bg-zinc-100 dark:hover:bg-white/10 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all active:scale-90 relative"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        {copiedId === item.id && (
                          <span className="absolute bottom-full right-1/2 translate-x-1/2 mb-1 px-2 py-0.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-[6px] font-black rounded uppercase tracking-wider whitespace-nowrap z-50">Copied!</span>
                        )}
                      </button>

                      {/* Delete */}
                      <button 
                        onClick={() => updateHistory(history.filter(h => h.id !== item.id))}
                        className="p-2 hover:bg-red-500/10 text-zinc-400 hover:text-red-500 transition-colors rounded-xl"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {!isSection && (
        <div className="shrink-0 p-4 border-t border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-black/20 flex justify-center">
          <p className="text-[7px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.3em]">Pure WAVE Format Synthesis // Sovereign Core</p>
        </div>
      )}
    </div>
  );

  if (isSection) return content;

  return (
    <div className="fixed inset-0 z-[550] flex items-center justify-center p-4 bg-black/40 backdrop-blur-3xl animate-in fade-in duration-300">
      {content}
    </div>
  );
};
