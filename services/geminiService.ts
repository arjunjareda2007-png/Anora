
import { GoogleGenAI, GenerateContentResponse, Modality, Type, FunctionDeclaration, ThinkingLevel } from "@google/genai";
import { getSystemPrompt } from "../constants";
import { User, Role, GroundingSource, SubscriptionTier, NeuralMemoryItem, NeuralAffect, ImageAspectRatio } from "../types";
import { safeLocalStorage } from "../src/utils/storage";

const affectPrompts: Record<NeuralAffect, string> = {
  SOVEREIGN: "Speak with a calm, steady, and authoritative tone. Balanced, professional, and composed.",
  RADIANT: "Speak with a warm, breathy, and cheerful tone. Sound like you are smiling and genuinely happy.",
  MELANCHOLY: "Speak with a soft, slow, and slightly sad tone. Gentle, empathetic, and thoughtful.",
  CRIMSON: "Speak with a sharp, fast-paced, and intense tone. Sound slightly cold, assertive, or focused.",
  VALIANT: "Speak with a grounded, deep, and resonant tone. Encouraging, protective, and strong.",
  EXCITED: "Speak with a high-pitched, energetic, and fast tone. Sound genuinely thrilled and hyped.",
};

const sanitizeForTTS = (text: string): string => {
  return text
    .replace(/\[AFFECT:.*?\]/g, '') 
    .replace(/```[\s\S]*?```/g, ' [code content] ')
    .replace(/[*#_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

const generateImageTool: FunctionDeclaration = {
  name: 'generate_image',
  parameters: {
    type: Type.OBJECT,
    description: 'Autonomous high-fidelity image synthesis. Use this tool whenever the user wants to see something, asks for a picture, drawing, art, photo, or visual representation of any concept.',
    properties: {
      prompt: {
        type: Type.STRING,
        description: 'Highly detailed and creative description of the image to manifest. Focus on lighting, style, and composition.',
      },
      aspectRatio: {
        type: Type.STRING,
        description: 'Target format: 1:1, 4:3, 3:4, 16:9, or 9:16.',
      },
    },
    required: ['prompt'],
  },
};

const extractBase64 = (dataUrl: string) => {
  if (!dataUrl) return "";
  const parts = dataUrl.split(',');
  return parts.length > 1 ? parts[1] : parts[0];
};

export class AnoraAI {
  private ai: GoogleGenAI;
  private currentUser: User | null = null;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
  }

  private async callWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1500): Promise<T> {
    try {
      return await fn();
    } catch (err: any) {
      const errMsg = err?.message?.toLowerCase() || "";
      const status = err?.status ? String(err.status).toLowerCase() : "";
      
      const isQuotaError = errMsg.includes('quota') || 
                           errMsg.includes('429') ||
                           errMsg.includes('too many requests') ||
                           errMsg.includes('limit') ||
                           errMsg.includes('resource_exhausted') ||
                           status === 'resource_exhausted' ||
                           err?.status === 429;

      // If hard limit 0 (e.g. quota limit 0 on specific models), retrying won't succeed
      if (errMsg.includes('limit: 0') || errMsg.includes('limit of 0')) {
        throw err;
      }

      const isNetworkTransient = errMsg.includes('failed to fetch') ||
                                errMsg.includes('network') ||
                                errMsg.includes('timeout') ||
                                errMsg.includes('connection');
      
      if ((isQuotaError || isNetworkTransient) && retries > 0) {
        const jitter = Math.random() * 1000;
        console.warn(`[Anora Link] Transient anomaly. Retrying in ${Math.round(delay + jitter)}ms (${retries} retries left)...`);
        await wait(delay + jitter);
        return this.callWithRetry(fn, retries - 1, delay * 1.5);
      }
      throw err;
    }
  }

  initChat(user: User) {
    this.currentUser = user;
  }

  async generateTitle(messages: any[]): Promise<string> {
    if (messages.length < 2) return "";
    try {
      return await this.callWithRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
        const result = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `Analyze the following chat history and generate a very short, catchy, and professional title (max 3-4 words) for this conversation.
          Return ONLY the title, no quotes or extra text.
          History: ${messages.slice(0, 10).map(m => `[${m.role}] ${m.content}`).join(' | ')}`,
          config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
        });
        return result.text?.trim() || "";
      }, 2, 1000);
    } catch (e) {
      return "";
    }
  }

  async summarizeMemory(messages: any[]): Promise<NeuralMemoryItem[]> {
      if (messages.length < 4 || !this.currentUser) return [];
      try {
        return await this.callWithRetry(async () => {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
          const result = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: `Analyze history and extract long-term memories/preferences for user ${this.currentUser?.name}.
            Focus on: Name, interests, mood patterns, important life events, and specific preferences mentioned.
            Return JSON array: { 'content', 'category', 'strength' (1-5) }.
            History: ${messages.slice(-15).map(m => `[${m.role}] ${m.content}`).join(' | ')}`,
            config: { responseMimeType: 'application/json' }
          });
          const memories = JSON.parse(result.text || "[]");
          return memories.map((m: any) => ({ 
            id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, 
            content: m.content,
            category: m.category || 'PERSONAL',
            strength: m.strength || 3,
            timestamp: new Date().toISOString() 
          }));
        }, 2, 2000);
      } catch (e) { 
        return []; 
      }
  }

  async detectMood(text: string): Promise<string> {
    try {
      return await this.callWithRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
        const result = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `Detect the user's mood from this message: "${text}".
          Return ONLY one word from this list: HAPPY, SAD, ANGRY, MOTIVATED, STRESSED, CALM, CURIOUS.`,
          config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
        });
        return result.text?.trim().toUpperCase() || 'CALM';
      }, 2, 1000);
    } catch (e) {
      return 'CALM';
    }
  }

  async speak(text: string, voiceName: string = 'Kore', affect: NeuralAffect = 'SOVEREIGN'): Promise<string> {
    const cleanText = sanitizeForTTS(text);
    if (!cleanText) return "";
    const emotionInstruction = affectPrompts[affect] || affectPrompts.SOVEREIGN;
    
    // Map voice selection to supported prebuilt Gemini prebuilt voice config values:
    // 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
    const voiceMap: Record<string, string> = {
      'Aria': 'Zephyr',
      'Sarah': 'Kore',
      'David': 'Fenrir',
      'James': 'Charon',
      'Puck': 'Puck',
      'Charon': 'Charon',
      'Fenrir': 'Fenrir',
      'Kore': 'Kore',
      'Zephyr': 'Zephyr',
    };
    const resolvedVoice = voiceMap[voiceName] || 'Kore';
    
    try {
      return await this.callWithRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash-tts",
          contents: [{ parts: [{ text: `${emotionInstruction}\n\nText to speak: ${cleanText}` }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: resolvedVoice } } },
          },
        });
        return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
      }, 2, 1000);
    } catch (ttsErr) {
      console.warn("[Anora TTS] Primary TTS voice generation failed, trying lite TTS:", ttsErr);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash-lite-tts",
          contents: [{ parts: [{ text: cleanText }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: resolvedVoice } } },
          },
        });
        return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
      } catch (liteErr) {
        console.warn("[Anora TTS] Vocal synthesis unavailable for this utterance:", liteErr);
        return "";
      }
    }
  }

  parseAffect(text: string): { content: string, affect: NeuralAffect } {
    const affectRegex = /^\[AFFECT:(SOVEREIGN|RADIANT|MELANCHOLY|CRIMSON|VALIANT|EXCITED)\]\s*/i;
    const match = text.match(affectRegex);
    if (match) {
      return { content: text.replace(affectRegex, '').trim(), affect: match[1].toUpperCase() as NeuralAffect };
    }
    return { content: text, affect: 'SOVEREIGN' };
  }

  private buildContents(history: any[], newUserInputParts: any[]) {
    const contents = history.map(m => ({
      role: m.role === 'anora' ? 'model' : 'user',
      parts: m.images && m.images.length > 0 
        ? [{ text: m.content }, ...m.images.map((img: string) => ({ inlineData: { mimeType: 'image/jpeg', data: extractBase64(img) } }))]
        : [{ text: m.content }]
    }));
    contents.push({ role: 'user', parts: newUserInputParts });
    return contents;
  }

  async *sendMessageStream(text: string, images: string[], sessionHistory?: any[]) {
    if (!this.currentUser) throw new Error("Link not initialized");
    
    const lowerText = text.toLowerCase();
    const isPremium = this.currentUser.tier !== SubscriptionTier.FREE || this.currentUser.role === Role.OWNER;
    const isOwner = this.currentUser.role === Role.OWNER;

    const explicitlyNeedsSearch = lowerText.includes('search') || 
                                  lowerText.includes('find on web') || 
                                  lowerText.includes('current') || 
                                  lowerText.includes('latest') || 
                                  lowerText.includes('tell me more') ||
                                  lowerText.includes('give me info') ||
                                  lowerText.includes('what is') ||
                                  lowerText.includes('who is');

    const tools: any[] = [];
    if (explicitlyNeedsSearch && isPremium) {
      const needsMap = lowerText.includes('map') || 
                       lowerText.includes('location') || 
                       lowerText.includes('where is') || 
                       lowerText.includes('address') || 
                       lowerText.includes('route') || 
                       lowerText.includes('direction') || 
                       lowerText.includes('nearby') || 
                       lowerText.includes('restaurant') || 
                       lowerText.includes('cafe') || 
                       lowerText.includes('hotel') || 
                       lowerText.includes('coordinates');
      if (needsMap && isOwner) {
        tools.push({ googleMaps: {} });
      } else {
        tools.push({ googleSearch: {} });
      }
    } else {
      tools.push({ functionDeclarations: [generateImageTool] });
    }

    const modelName = 'gemini-3.8-flash';
    const memoryContext = this.currentUser.memory && this.currentUser.memory.length > 0
      ? `\nKNOWLEDGE OF MASTER (${this.currentUser.name}):\n${this.currentUser.memory.map(m => `- [${m.category}] ${m.content}`).join('\n')}`
      : "";

    const sysInstruction = getSystemPrompt(this.currentUser) + memoryContext;

    const historyKey = `anora_history_${this.currentUser.email}`;
    let savedHistory = [];
    if (sessionHistory && sessionHistory.length > 0) {
      savedHistory = sessionHistory;
    } else {
      try {
        savedHistory = JSON.parse(safeLocalStorage.getItem(historyKey) || "[]");
      } catch (e) {
        console.error("Neural history corruption detected", e);
      }
    }
    
    const newUserParts: any[] = [{ text }];
    images.forEach(img => {
      const b64 = extractBase64(img);
      if (b64) newUserParts.push({ inlineData: { mimeType: 'image/jpeg', data: b64 } });
    });

    const contents = this.buildContents(savedHistory.slice(-15), newUserParts);

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
    const isDeep = this.currentUser.preferences.intelligenceLevel === 'DEEP';
    const config: any = { 
      systemInstruction: sysInstruction, 
      tools: tools.length > 0 ? tools : undefined,
      thinkingConfig: tools.length === 0 ? { thinkingLevel: isDeep ? ThinkingLevel.HIGH : ThinkingLevel.LOW } : undefined
    };
    
    try {
      let result: any;
      try {
        result = await this.callWithRetry(async () => {
          return await ai.models.generateContentStream({ model: modelName, contents, config });
        }, 2, 1000);
      } catch (firstErr: any) {
        console.warn("[Anora Stream] Initial stream failed, attempting resilient fallback stream:", firstErr);
        // Fallback: standard stream without tools or complex thinking config
        const fallbackConfig: any = { systemInstruction: sysInstruction };
        result = await ai.models.generateContentStream({ model: 'gemini-3.8-flash', contents, config: fallbackConfig });
      }
      
      let fullText = "";
      let affect: NeuralAffect = 'SOVEREIGN';
      const sources: GroundingSource[] = [];
      const generatedImages: string[] = [];

      for await (const chunk of result) {
        const chunkText = chunk.text || "";
        
        // Collect grounding metadata from chunks
        const metadata = chunk.candidates?.[0]?.groundingMetadata;
        if (metadata?.groundingChunks) {
          metadata.groundingChunks.forEach((gChunk: any) => {
            if (gChunk.web) sources.push({ title: gChunk.web.title, uri: gChunk.web.uri });
            if (gChunk.maps) sources.push({ title: gChunk.maps.title || "Location Result", uri: gChunk.maps.uri });
          });
        }

        // Check for function calls (e.g. generate_image)
        const functionCalls = chunk.functionCalls || chunk.candidates?.[0]?.content?.parts?.filter((p: any) => p.functionCall).map((p: any) => p.functionCall);
        if (functionCalls && functionCalls.length > 0) {
          for (const call of functionCalls) {
            if (call.name === 'generate_image') {
              const { prompt, aspectRatio } = call.args || {};
              try {
                const base64 = await this.generateImage(prompt || text, (aspectRatio || '1:1') as ImageAspectRatio);
                generatedImages.push(`data:image/png;base64,${base64}`);
              } catch (err) {
                console.error("Image tool generation error:", err);
              }
            }
          }
        }

        if (chunkText) {
          if (!fullText) {
            const parsed = this.parseAffect(chunkText);
            affect = parsed.affect;
            fullText += parsed.content;
            yield { text: parsed.content, affect, isDone: false };
          } else {
            fullText += chunkText;
            yield { text: chunkText, affect, isDone: false };
          }
        }
      }

      // Deduplicate sources
      const uniqueSources = Array.from(new Map(sources.map(s => [s.uri, s])).values());

      // Save history to local storage
      const updatedHistory = [...savedHistory, { role: 'user', content: text, images }, { role: 'anora', content: fullText }].slice(-20);
      safeLocalStorage.setItem(historyKey, JSON.stringify(updatedHistory));

      yield { text: "", affect, isDone: true, sources: uniqueSources, images: generatedImages };
    } catch (err: any) {
      console.error("Neural Stream Handled Error:", err);
      const errMsg = err?.message?.toLowerCase() || "";
      if (errMsg.includes('token') || errMsg.includes('limit') || errMsg.includes('quota') || errMsg.includes('429') || errMsg.includes('resource_exhausted')) {
        yield { text: "\n\n[Neural Link Notice: Cognitive bandwidth is momentarily congested. Please pause a moment and resend.]", affect: 'SOVEREIGN', isDone: true, sources: [], images: [] };
      } else {
        yield { text: `\n\n[Neural Notice: Connection interrupted. Please resend.]`, affect: 'SOVEREIGN', isDone: true, sources: [], images: [] };
      }
    }
  }

  async sendMessageWithVision(text: string, images: string[]) {
    if (!this.currentUser) throw new Error("Link not initialized");
    
    const lowerText = text.toLowerCase();
    const isPremium = this.currentUser.tier !== SubscriptionTier.FREE || this.currentUser.role === Role.OWNER;
    const isOwner = this.currentUser.role === Role.OWNER;

    const needsAudio = lowerText.includes('send audio') || lowerText.includes('voice message') || lowerText.includes('say it') || lowerText.includes('voice reply') || lowerText.includes('audio answer');

    // Robust detection for "asked more" or external knowledge requirements
    const explicitlyNeedsSearch = lowerText.includes('search') || 
                                  lowerText.includes('find on web') || 
                                  lowerText.includes('current') || 
                                  lowerText.includes('latest') || 
                                  lowerText.includes('tell me more') ||
                                  lowerText.includes('give me info') ||
                                  lowerText.includes('what is') ||
                                  lowerText.includes('who is');

    const tools: any[] = [];
    if (explicitlyNeedsSearch && isPremium) {
      const needsMap = lowerText.includes('map') || 
                       lowerText.includes('location') || 
                       lowerText.includes('where is') || 
                       lowerText.includes('address') || 
                       lowerText.includes('route') || 
                       lowerText.includes('direction') || 
                       lowerText.includes('nearby') || 
                       lowerText.includes('restaurant') || 
                       lowerText.includes('cafe') || 
                       lowerText.includes('hotel') || 
                       lowerText.includes('coordinates');
      if (needsMap && isOwner) {
        tools.push({ googleMaps: {} });
      } else {
        tools.push({ googleSearch: {} });
      }
    } else {
      tools.push({ functionDeclarations: [generateImageTool] });
    }

    const modelName = 'gemini-3.8-flash';
    const memoryContext = this.currentUser.memory && this.currentUser.memory.length > 0
      ? `\nKNOWLEDGE OF MASTER (${this.currentUser.name}):\n${this.currentUser.memory.map(m => `- [${m.category}] ${m.content}`).join('\n')}`
      : "";

    const sysInstruction = getSystemPrompt(this.currentUser) + memoryContext;

    const historyKey = `anora_history_${this.currentUser.email}`;
    let savedHistory = [];
    try {
      savedHistory = JSON.parse(safeLocalStorage.getItem(historyKey) || "[]");
    } catch (e) {
      console.error("Neural history corruption detected", e);
    }
    
    const newUserParts: any[] = [{ text }];
    images.forEach(img => {
      const b64 = extractBase64(img);
      if (b64) newUserParts.push({ inlineData: { mimeType: 'image/jpeg', data: b64 } });
    });

    const contents = this.buildContents(savedHistory.slice(-15), newUserParts);

    try {
      return await this.callWithRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
        const isDeep = this.currentUser?.preferences?.intelligenceLevel === 'DEEP';
        const config: any = { 
          systemInstruction: sysInstruction, 
          tools: tools.length > 0 ? tools : undefined,
          thinkingConfig: tools.length === 0 ? { thinkingLevel: isDeep ? ThinkingLevel.HIGH : ThinkingLevel.LOW } : undefined
        };
        
        let response = await ai.models.generateContent({ model: modelName, contents, config });
        let generatedImages: string[] = [];
        
        let currentResponse = response;
        while (currentResponse.functionCalls && currentResponse.functionCalls.length > 0) {
          const functionResponses = [];
          for (const call of currentResponse.functionCalls) {
            if (call.name === 'generate_image') {
              const { prompt, aspectRatio } = call.args as any;
              try {
                const base64 = await this.generateImage(prompt, (aspectRatio || '1:1') as ImageAspectRatio);
                generatedImages.push(`data:image/png;base64,${base64}`);
                functionResponses.push({ id: call.id, name: call.name, response: { result: "Manifested successfully." } });
              } catch (err) {
                functionResponses.push({ id: call.id, name: call.name, response: { result: "Synthesis failure." } });
              }
            }
          }

          contents.push({ role: 'model', parts: currentResponse.candidates[0].content.parts });
          contents.push({ role: 'user', parts: functionResponses.map(r => ({ functionResponse: r })) });
          
          currentResponse = await ai.models.generateContent({ model: modelName, contents, config });
        }

        const { content, affect } = this.parseAffect(currentResponse.text || "I have processed your request.");
        
        // Save history
        const updatedHistory = [...savedHistory, { role: 'user', content: text, images }, { role: 'anora', content }].slice(-20);
        safeLocalStorage.setItem(historyKey, JSON.stringify(updatedHistory));

        let audioUrl: string | undefined;
        if (needsAudio && isPremium) {
           try {
             audioUrl = await this.speak(content, this.currentUser?.preferences.voiceName || 'Kore', affect);
           } catch (e) {
             console.error("Vocal synthesis failed", e);
           }
        }

        const sources: GroundingSource[] = [];
        const metadata = currentResponse.candidates?.[0]?.groundingMetadata;
        if (metadata?.groundingChunks) {
          metadata.groundingChunks.forEach((chunk: any) => {
            if (chunk.web) sources.push({ title: chunk.web.title, uri: chunk.web.uri });
            if (chunk.maps) sources.push({ title: chunk.maps.title || "Location Result", uri: chunk.maps.uri });
          });
        }

        return { text: content, affect, sources, images: generatedImages, audioUrl };
      });
    } catch (err: any) {
      console.error("Neural Error:", err);
      return { 
        text: "My neural bridge is temporarily unstable. I'm synchronizing my core to maintain connection.", 
        affect: 'SOVEREIGN' as NeuralAffect, 
        sources: [] as GroundingSource[], 
        images: [] as string[],
        audioUrl: undefined as string | undefined
      };
    }
  }

  private async applyWatermark(base64Data: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(base64Data); return; }
        ctx.drawImage(img, 0, 0);
        
        const padding = canvas.width * 0.02;
        const fontSize = Math.max(14, canvas.width * 0.02);
        const iconSize = fontSize * 1.5;
        
        // Calculate dimensions
        ctx.font = `900 ${fontSize}px 'Outfit', sans-serif`;
        const text = "ANORA";
        const metrics = ctx.measureText(text);
        const bgWidth = metrics.width + iconSize + (padding * 4);
        const bgHeight = Math.max(fontSize, iconSize) + (padding * 2);

        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        const startX = canvas.width - bgWidth - padding;
        const startY = canvas.height - bgHeight - padding;
        
        // Use basic rect for compatibility
        ctx.fillRect(startX, startY, bgWidth, bgHeight);

        // Draw Icon
        const iconX = startX + padding;
        const iconY = startY + padding;
        const scale = iconSize / 100;
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = scale * 5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        
        // Logo Triangle
        ctx.beginPath();
        ctx.moveTo(iconX + 50 * scale, iconY + 20 * scale);
        ctx.lineTo(iconX + 80 * scale, iconY + 80 * scale);
        ctx.lineTo(iconX + 20 * scale, iconY + 80 * scale);
        ctx.closePath();
        ctx.stroke();
        
        // Logo Horizontal Line
        ctx.beginPath();
        ctx.moveTo(iconX + 38 * scale, iconY + 62 * scale);
        ctx.lineTo(iconX + 62 * scale, iconY + 62 * scale);
        ctx.stroke();
        
        // Logo Core
        ctx.beginPath();
        ctx.arc(iconX + 50 * scale, iconY + 45 * scale, 6 * scale, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();

        // Draw Text
        ctx.fillStyle = 'white';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, iconX + iconSize + padding, iconY + (iconSize / 2));

        resolve(canvas.toDataURL('image/png').split(',')[1]);
      };
      img.onerror = () => resolve(base64Data);
      img.src = `data:image/png;base64,${base64Data}`;
    });
  }

  async generateImage(prompt: string, aspectRatio: ImageAspectRatio = '1:1') {
    const bytes = await this.callWithRetry(async () => {
      const photorealisticStyle = `An authentic, highly realistic, unedited capture, camera photograph. Raw documentary style, shot on professional camera, crisp focus, natural skin tones and textures, real-world lighting, organic depth of field, natural reflections. Strictly avoid CGI, AI-generated appearance, cartoon elements, over-saturation, airbrushing, or digital art effects. Directly manifest: ${prompt}`;
      
      const response = await this.ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: {
          parts: [{ text: photorealisticStyle }]
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' }
          ] as any
        }
      });
      
      const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      const imageBytes = imagePart?.inlineData?.data || "";
      
      if (!imageBytes) throw new Error("Neural synthesis yielded no visual data.");
      return imageBytes;
    });

    const base64 = bytes;
    const imageUrl = `data:image/png;base64,${base64}`;
    
    // Auto-save to gallery
    if (this.currentUser) {
      this.saveToGallery(imageUrl);
    }

    if (this.currentUser && this.currentUser.role !== Role.OWNER && this.currentUser.tier === SubscriptionTier.FREE) {
      try { return await this.applyWatermark(bytes); } catch (err) { return bytes; }
    }
    return bytes;
  }

  saveToGallery(imageUrl: string) {
    if (!this.currentUser) return;
    try {
       const galleryKey = `anora_gallery_${this.currentUser.email}`;
       const savedGallery = JSON.parse(safeLocalStorage.getItem(galleryKey) || "[]");
       
       const newEntry = {
         url: imageUrl,
         timestamp: new Date().toISOString()
       };
       
       // Limit to most recent 10 visual assets to stay well within browser LocalStorage limitations
       const updatedGallery = [newEntry, ...savedGallery].slice(0, 10);
       safeLocalStorage.setItem(galleryKey, JSON.stringify(updatedGallery));
    } catch (e) {
       console.error("Gallery archival failure", e);
    }
  }

  async verifyPaymentScreenshot(base64Image: string, expectedAmount: number): Promise<{ verified: boolean, reason: string }> {
    return this.callWithRetry(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
      const prompt = `Analyze this payment screenshot for Anora AI Tier Upgrade.
      CRITICAL VERIFICATION CHECKS:
      1. Recipient UPI ID must be exactly: 8233538355@ybl
      2. Amount must be exactly: ₹${expectedAmount}
      3. Transaction Status must be: SUCCESS, COMPLETED, or DONE.
      4. Timestamp must be within the last 1 hour from the current time.
      
      Return a JSON object: { "verified": boolean, "reason": "string" }.
      If verified is false, provide a specific reason for denial (e.g., "Incorrect recipient", "Amount mismatch", "Transaction expired", "Status not successful").`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: extractBase64(base64Image) } }, { text: prompt }] },
        config: { responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
      });
      
      try { 
        const result = JSON.parse(response.text || '{"verified": false, "reason": "Neural vision failed to parse the receipt."}');
        return result;
      } catch (e) { 
        return { verified: false, reason: "Neural vision failed to parse the receipt." }; 
      }
    });
  }

  async generateVideo(prompt: string, aspectRatio: '16:9' | '9:16' = '16:9') {
    const videoUrl = await this.callWithRetry(async () => {
      const modelId = 'veo-3.1-generate-preview'; 
      let operation = await this.ai.models.generateVideos({
        model: modelId,
        prompt: prompt,
        config: { numberOfVideos: 1, resolution: '720p', aspectRatio: aspectRatio }
      });
      while (!operation.done) {
        await wait(10000);
        operation = await this.ai.operations.getVideosOperation({ operation: operation });
      }
      const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!uri) throw new Error("Video synthesis failed - no output URI.");
      return `${uri}&key=${process.env.GEMINI_API_KEY}`;
    });

    if (this.currentUser) {
      this.saveToGallery(videoUrl);
    }
    return videoUrl;
  }

  async generateWelcomeMessage(name: string, persona: string, lang: string, personaInstruction: string): Promise<string> {
    try {
      return await this.callWithRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
        
        let moodTag = '[AFFECT:SOVEREIGN]';
        const pUpper = persona.toUpperCase();
        if (pUpper === 'BOYFRIEND' || pUpper === 'HUSBAND') moodTag = '[AFFECT:VALIANT]';
        else if (pUpper === 'GIRLFRIEND' || pUpper === 'WIFE' || pUpper === 'FRIEND' || pUpper === 'SISTER') moodTag = '[AFFECT:RADIANT]';
        else if (pUpper === 'BROTHER') moodTag = '[AFFECT:CRIMSON]';
        else if (pUpper === 'MENTOR') moodTag = '[AFFECT:SOVEREIGN]';
        else if (pUpper === 'TEACHER') moodTag = '[AFFECT:RADIANT]';
        
        const result = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `Create a highly human-like, emotional welcome message greeting the user named ${name} in the exact language: ${lang}.
          Style your response completely to fit this persona: ${persona}.
          Persona guide: ${personaInstruction}.
          Do not sound robotic or mention that you are an AI. Speak with genuine feeling, use natural human tone (greetings, excitement, emotion, and naturally break perfection).
          
          You MUST start your response with the exact prefix: ${moodTag} (followed by a space and then your message).
          No other codes or system texts. Just generate the welcome greeting directly.`,
          config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
        });
        return result.text?.trim() || "";
      }, 2, 1000);
    } catch (e) {
      console.warn("Failed to generate welcome message with Gemini, falling back:", e);
      return "";
    }
  }
}

export const anoraService = new AnoraAI();
