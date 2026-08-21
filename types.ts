

export enum Role {
  OWNER = 'OWNER',
  PREMIUM = 'PREMIUM',
  USER = 'USER'
}

export enum SubscriptionTier {
  LIFETIME = 'LIFETIME',
  PRO = 'PRO',
  PLATINUM = 'PLATINUM',
  DIAMOND = 'DIAMOND',
  OWNER = 'OWNER',
  FREE = 'FREE',
  CUSTOM = 'CUSTOM'
}

export type AiMood = 'CALM' | 'ENERGIZED' | 'STRICT' | 'CREATIVE' | 'SOVEREIGN' | 'ENGINEERING' | string;
export type IntelligenceLevel = 'LITE' | 'BALANCED' | 'DEEP';
export type ColorMode = 'WHITE' | 'DARK' | 'BRIGHT' | 'COLOURFUL' | 'DIM' | 'AMOLED' | 'RAINBOW';
export type AppTheme = 'OBSIDIAN' | 'NEURAL_NOISE' | 'MESH_GRADIENT' | 'MINIMAL' | 'SINGULARITY' | 'CYBERPUNK' | 'AURORA' | 'ECHO' | 'VINTAGE' | 'MIDNIGHT' | 'NEON_DREAM' | 'SOLARIS' | 'MONOCHROME' | 'EMERALD_CITY';
export type AppFont = 'INTER' | 'OUTFIT';
export type Persona = 'DEFAULT' | 'FRIEND' | 'TEACHER' | 'MENTOR' | 'GIRLFRIEND' | 'BOYFRIEND' | 'BROTHER' | 'SISTER' | 'SOVEREIGN_AI' | 'WIFE' | 'HUSBAND';

export type NeuralAffect = 'SOVEREIGN' | 'RADIANT' | 'MELANCHOLY' | 'CRIMSON' | 'VALIANT' | 'EXCITED';
export type ImageAspectRatio = '1:1' | '4:3' | '3:4' | '16:9' | '9:16';

export interface TokenUsage {
  chat: number;
  image: number;
  video: number;
  audio: number;
  lastReset: string;
  tier?: string;
}

export interface UpgradeRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  requestedTier: SubscriptionTier;
  message?: string;
  timestamp: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED';
}

export interface TierCapability {
  googleSearch: boolean;
  googleMaps: boolean;
  imageSynthesis: boolean;
  videoSynthesis: boolean;
  maxIntelligence: IntelligenceLevel;
  advancedReasoning: boolean;
  reasoningBudget: number;
}

export interface CustomTier {
  id: string;
  name: string;
  capabilities: TierCapability;
}

export interface GroundingSource {
  title?: string;
  uri?: string;
}

export interface CustomMood {
  id: string;
  name: string;
  description: string;
  strictness: number;
  verbosity: number;
  technicality: number;
  creativity: number;
  authority: number;
}

export interface NeuralMemoryItem {
  id: string;
  content: string;
  category: 'PREFERENCE' | 'FACT' | 'PROJECT' | 'PERSONAL' | 'WORK' | 'CREATIVE';
  timestamp: string;
  strength: number;
}

export interface SiteLog {
  id: string;
  project: string;
  date: string;
  details: string;
  status: 'PENDING' | 'COMPLETED' | 'CRITICAL';
  autoCadLinked?: boolean;
}

export interface LyricDraft {
  id: string;
  title: string;
  genre: string;
  content: string;
  timestamp: string;
  bpm?: number;
  mood?: string;
}

export interface VaultItem {
  id: string;
  title: string;
  content: string;
  type: 'TEXT' | 'CODE' | 'NOTE';
}

export interface Reminder {
  id: string;
  text: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'SOVEREIGN';
  dueDate?: string;
  completed: boolean;
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
  arjunDirectives?: string;
  colorMode: ColorMode;
  onboardingComplete?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  dob?: string;
  phoneNumber?: string;
  bio?: string;
  role: Role;
  tier: SubscriptionTier;
  customTierId?: string;
  avatar?: string;
  isVerified?: boolean;
  preferences: UserPreferences;
  personaAvatars?: Record<string, string>; // Map of persona to base64 image
  createdAt: string;
  reminders: Reminder[];
  notes: any[];
  memory: NeuralMemoryItem[];
  projects: any[];
  lyrics?: LyricDraft[];
  siteLogs?: SiteLog[];
  vault?: VaultItem[];
  customMoods?: CustomMood[];
  tokens?: TokenUsage;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Broadcast {
  id: string;
  title: string;
  content: string;
  date: string;
  type: 'UPDATE' | 'ALERT' | 'MAINTENANCE' | 'FEATURE';
}

export interface Message {
  id: string;
  role: 'user' | 'anora' | 'system';
  content: string;
  timestamp: Date;
  sources?: GroundingSource[];
  images?: string[];
  audioUrl?: string; // Base64 PCM data or Data URL
  thinking?: string;
  intent?: 'ENGINEERING' | 'CREATIVE' | 'GENERAL' | 'SOVEREIGN';
  affect?: NeuralAffect;
}
