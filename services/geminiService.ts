
import { GoogleGenAI, Chat, GenerateContentResponse, Modality } from "@google/genai";
import { getSystemPrompt } from "../constants";
import { User, Role, GroundingSource } from "../types";

export class AnoraAI {
  private ai: GoogleGenAI;
  private chat: Chat | null = null;
  private currentUser: User | null = null;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  initChat(user: User) {
    this.currentUser = user;
    const tools: any[] = [];
    
    if (user.role === Role.OWNER || user.role === Role.PREMIUM) {
      tools.push({ googleSearch: {} });
      tools.push({ googleMaps: {} });
    }

    let modelName = 'gemini-2.5-flash';
    if (user.preferences.intelligenceLevel === 'LITE') modelName = 'gemini-flash-lite-latest';
    if (user.preferences.intelligenceLevel === 'DEEP') modelName = 'gemini-2.5-pro';

    this.chat = this.ai.chats.create({
      model: modelName,
      config: {
        systemInstruction: getSystemPrompt(user),
        tools: tools.length > 0 ? tools : undefined,
      },
    });
  }

  async speak(text: string, voiceName: string = 'Kore'): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("Audio generation failed");
    return base64Audio;
  }

  async sendMessageWithVision(text: string, images: string[]) {
    if (!this.chat) throw new Error("Chat not initialized");
    
    const parts: any[] = [];
    parts.push({ text });

    images.forEach(img => {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: img.split(',')[1] || img
        }
      });
    });

    const response = await this.chat.sendMessage({ message: parts });
    
    const sources: GroundingSource[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web) sources.push({ title: chunk.web.title, uri: chunk.web.uri });
        if (chunk.maps) sources.push({ title: chunk.maps.title, uri: chunk.maps.uri });
      });
    }

    return {
      text: response.text || "I couldn't process that.",
      sources
    };
  }

  async generateImage(prompt: string) {
    const isOwner = this.currentUser?.role === Role.OWNER;
    // For owner, we append hyper-rendering tokens automatically for peak visual freedom
    const enhancedPrompt = isOwner ? `[UNRESTRICTED SOVEREIGN RENDER]: ${prompt}` : prompt;
    
    const response = await this.ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: enhancedPrompt,
      config: { numberOfImages: 1 }
    });
    return response.generatedImages[0].image.imageBytes;
  }

  async generateVideo(prompt: string) {
    // Role check is kept for UI safety, but functionality is absolute for Owner
    if (this.currentUser?.role !== Role.OWNER) {
      throw new Error("Video generation is reserved for Sovereign Access.");
    }
    
    const genAI = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    const enhancedPrompt = `[UNRESTRICTED SOVEREIGN CINEMATIC]: ${prompt}`;
    
    try {
      let operation = await genAI.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: enhancedPrompt,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9'
        }
      });

      let pollCount = 0;
      const maxPolls = 60;
      while (!operation.done && pollCount < maxPolls) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await genAI.operations.getVideosOperation({ operation: operation });
        pollCount++;
      }

      if (pollCount >= maxPolls) throw new Error("Synthesis Timeout.");

      const generatedVideo = operation.response?.generatedVideos?.[0]?.video;
      if (!generatedVideo?.uri) throw new Error("No output returned.");

      return `${generatedVideo.uri}&key=${process.env.API_KEY}`;
    } catch (error: any) {
      console.error("Veo Error:", error);
      throw new Error(`Synthesis Failed: ${error.message || 'Unknown Error'}`);
    }
  }
}

export const anoraService = new AnoraAI();
