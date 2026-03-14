
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
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  }

  private async callWithRetry<T>(fn: () => Promise<T>, retries = 7, delay = 3000): Promise<T> {
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
      
      if (isQuotaError && retries > 0) {
        const jitter = Math.random() * 2000;
        console.warn(`Neural Link saturated. Retrying in ${delay + jitter}ms... (${retries} attempts left)`);
        await wait(delay + jitter);
        return this.callWithRetry(fn, retries - 1, delay * 2);
      }
      throw err;
    }
  }

  initChat(user: User) {
    this.currentUser = user;
  }

  async summarizeMemory(messages: any[]): Promise<NeuralMemoryItem[]> {
      if (messages.length < 4 || !this.currentUser) return [];
      try {
        return await this.callWithRetry(async () => {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
          const result = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: `Analyze history and extract long-term memories/preferences.
              Return JSON array: { 'content', 'category', 'strength' (1-5) }.
              History: ${messages.slice(-10).map(m => `[${m.role}] ${m.content}`).join(' | ')}`,
              config: { responseMimeType: 'application/json' }
          });
          const memories = JSON.parse(result.text || "[]");
          return memories.map((m: any) => ({ ...m, id: `mem_${Date.now()}_${Math.random()}`, timestamp: new Date().toISOString() }));
        }, 3, 5000);
      } catch (e) { 
        return []; 
      }
  }

  async speak(text: string, voiceName: string = 'Kore', affect: NeuralAffect = 'SOVEREIGN'): Promise<string> {
    const cleanText = sanitizeForTTS(text);
    const emotionInstruction = affectPrompts[affect] || affectPrompts.SOVEREIGN;
    
    return this.callWithRetry(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `${emotionInstruction}\n\nText to speak: ${cleanText}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
        },
      });
      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
    });
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

  async *sendMessageStream(text: string, images: string[]) {
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
      tools.push({ googleSearch: {} });
      if (isOwner) tools.push({ googleMaps: {} });
    } else {
      tools.push({ functionDeclarations: [generateImageTool] });
    }

    const modelName = this.currentUser.preferences.intelligenceLevel === 'DEEP' ? 'gemini-3.1-pro-preview' : 'gemini-3-flash-preview';
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

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const config: any = { 
      systemInstruction: sysInstruction, 
      tools: tools.length > 0 ? tools : undefined,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } // Set thinkingLevel to LOW for faster response
    };
    
    const result: any = await ai.models.generateContentStream({ model: modelName, contents, config });
    
    let fullText = "";
    let affect: NeuralAffect = 'SOVEREIGN';
    const sources: GroundingSource[] = [];

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

    // Save history
    const updatedHistory = [...savedHistory, { role: 'user', content: text, images }, { role: 'anora', content: fullText }].slice(-20);
    safeLocalStorage.setItem(historyKey, JSON.stringify(updatedHistory));

    yield { text: "", affect, isDone: true, sources: uniqueSources, images: [] };
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
      tools.push({ googleSearch: {} });
      if (isOwner) tools.push({ googleMaps: {} });
    } else {
      tools.push({ functionDeclarations: [generateImageTool] });
    }

    const modelName = this.currentUser.preferences.intelligenceLevel === 'DEEP' ? 'gemini-3.1-pro-preview' : 'gemini-3-flash-preview';
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
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const config: any = { 
          systemInstruction: sysInstruction, 
          tools: tools.length > 0 ? tools : undefined,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
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
        ctx.font = `900 ${fontSize}px 'Outfit', sans-serif`;
        const text = "ANORA";
        const metrics = ctx.measureText(text);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        const bgWidth = metrics.width + (padding * 4);
        const bgHeight = fontSize + (padding * 2);
        ctx.fillRect(canvas.width - bgWidth - padding, canvas.height - bgHeight - padding, bgWidth, bgHeight);
        ctx.fillStyle = 'white'; ctx.textAlign = 'right';
        ctx.fillText(text, canvas.width - (padding * 2), canvas.height - (padding * 1.8));
        resolve(canvas.toDataURL('image/png').split(',')[1]);
      };
      img.onerror = () => resolve(base64Data);
      img.src = `data:image/png;base64,${base64Data}`;
    });
  }

  async generateImage(prompt: string, aspectRatio: ImageAspectRatio = '1:1') {
    const bytes = await this.callWithRetry(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: {
          parts: [{ text: `High-fidelity neural manifestation: ${prompt}` }],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: "1K"
          }
        }
      });
      
      let imageBytes = "";
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageBytes = part.inlineData.data;
          break;
        }
      }
      
      if (!imageBytes) throw new Error("Neural synthesis yielded no visual data.");
      return imageBytes;
    });

    if (this.currentUser && this.currentUser.role !== Role.OWNER && this.currentUser.tier === SubscriptionTier.FREE) {
      try { return await this.applyWatermark(bytes); } catch (err) { return bytes; }
    }
    return bytes;
  }

  async verifyPaymentScreenshot(base64Image: string, expectedAmount: number): Promise<{ verified: boolean, reason: string }> {
    return this.callWithRetry(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const prompt = `Verify payment screenshot for ₹${expectedAmount}. Status must be SUCCESS. Time limit: 1hr. JSON: { "verified": boolean, "reason": "string" }`;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: extractBase64(base64Image) } }, { text: prompt }] },
        config: { responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
      });
      try { return JSON.parse(response.text || '{"verified": false}'); } catch (e) { return { verified: false, reason: "Verification logic error." }; }
    });
  }

  async generateVideo(prompt: string, aspectRatio: '16:9' | '9:16' = '16:9') {
    return this.callWithRetry(async () => {
      const genAI = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      let operation = await genAI.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: { numberOfVideos: 1, resolution: '720p', aspectRatio: aspectRatio }
      });
      while (!operation.done) {
        await wait(10000);
        operation = await genAI.operations.getVideosOperation({ operation: operation });
      }
      return `${operation.response?.generatedVideos?.[0]?.video?.uri}&key=${process.env.API_KEY}`;
    });
  }
}

export const anoraService = new AnoraAI();
