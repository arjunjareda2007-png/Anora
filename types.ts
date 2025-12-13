
export enum Role {
  OWNER = 'OWNER',
  PREMIUM = 'PREMIUM',
  USER = 'USER'
}

export enum SubscriptionTier {
  LIFETIME = 'LIFETIME',
  PRO = 'PRO',
  FREE = 'FREE'
}

export type AiMood = 'CALM' | 'ENERGIZED' | 'STRICT' | 'CREATIVE' | 'SOVEREIGN' | 'ENGINEERING' | string;
export type IntelligenceLevel = 'LITE' | 'BALANCED' | 'DEEP';
export type AppTheme = 'OBSIDIAN' | 'NEURAL_NOISE' | 'MESH_GRADIENT' | 'MINIMAL' | 'SINGULARITY';
export type AppFont = 'INTER' | 'OUTFIT';
export type Persona = 'DEFAULT' | 'FRIEND' | 'TEACHER' | 'MENTOR' | 'GIRLFRIEND' | 'BOYFRIEND' | 'BROTHER' | 'SISTER' | 'SOVEREIGN_AI';

export interface GroundingSource {
  title?: string;
  uri?: string;
}

export interface CustomMood {
  id: string;
  name: string;
  description: string;
  strictness: number; // 0-100
  verbosity: number; // 0-100
  technicality: number; // 0-100
  creativity: number; // 0-100
  authority: number; // 0-100
}

export interface SiteLog {
  id: string;
  project: string;
  date: string;
  details: string;
  autoCadLinked?: boolean;
}

export interface LyricDraft {
  id: string;
  title: string;
  genre: string;
  content: string;
  timestamp: string;
  bpm?: number;
}

export interface VaultItem {
  id: string;
  title: string;
  content: string;
  type: 'TEXT' | 'CODE' | 'NOTE';
}

export interface UserPreferences {
  accentColor: string;
  aiMood: AiMood;
  voiceName: string;
  autoRead: boolean;
  continuousListening: boolean;
  intelligenceLevel: IntelligenceLevel;
  language: string;
  theme: AppTheme;
  font: AppFont;
  soundEnabled: boolean;
  persona: Persona;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  bio?: string;
  role: Role;
  tier: SubscriptionTier;
  avatar?: string;
  preferences: UserPreferences;
  createdAt: string;
  reminders: any[];
  notes: any[];
  memory: any[];
  projects: any[];
  lyrics?: LyricDraft[];
  siteLogs?: SiteLog[];
  vault?: VaultItem[];
  customMoods?: CustomMood[];
}

export interface Message {
  id: string;
  role: 'user' | 'anora' | 'system';
  content: string;
  timestamp: Date;
  sources?: GroundingSource[];
  images?: string[];
  audioUrl?: string;
}
