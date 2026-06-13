import { ConnectConfig } from "@/types";
import { EndSensitivity, LiveConnectConfig, Modality, StartSensitivity } from "@google/genai";

export const MODEL = "gemini-3.1-flash-live-preview";
export const INPUT_SAMPLE_RATE = 16000;
export const OUTPUT_SAMPLE_RATE = 24000;
export const PREFIXPADDINGMS = 200;
export const SILENCEDURATIONMS = 800;


export const AVAILABLE_TOPICS = [
  "Free Chat",
  "Business Meeting",
  "Travel & Directions",
  "Job Interview",
  "Ordering Food",
  "Daily Routine",
  "Movies & Hobbies",
];

// BCP 47 Standard: Language-Region
export const AVAILABLE_LANGUAGES = [
  { id: "en-US", name: "English", region: "United States", code: "en-US" },
  { id: "en-GB", name: "English", region: "United Kingdom", code: "en-GB" },
  { id: "es-ES", name: "Spanish", region: "Spain", code: "es-ES" },
  { id: "es-MX", name: "Spanish", region: "Mexico", code: "es-MX" },
  { id: "fr-FR", name: "French", region: "France", code: "fr-FR" },
  { id: "de-DE", name: "German", region: "Germany", code: "de-DE" },
  { id: "ja-JP", name: "Japanese", region: "Japan", code: "ja-JP" },
  { id: "ko-KR", name: "Korean", region: "South Korea", code: "ko-KR" },
  { id: "zh-CN", name: "Chinese", region: "China (Mandarin)", code: "zh-CN" },
  { id: "hi-IN", name: "Hindi", region: "India", code: "hi-IN" },
  { id: "pt-BR", name: "Portuguese", region: "Brazil", code: "pt-BR" },
];

export const AVAILABLE_VOICES = [
  { id: "charon", name: "Charon", category: "informative" },
  { id: "puck", name: "Puck", category: "upbeat" },
  { id: "kore", name: "Kore", category: "firm" },
  { id: "fenrir", name: "Fenrir", category: "excitable" },
  { id: "aoede", name: "Aoede", category: "confident" },
];

export const AVAILABLE_PROFICIENCY_LEVELS = [
  {
    id: "basic",
    label: "Basic",
    description: "I can have basic conversations",
  },
  {
    id: "intermediate",
    label: "Intermediate",
    description: "I can talk about various topics",
  },
  {
    id: "advanced",
    label: "Top Class",
    description: "I can discuss most topics in detail",
  },
];

export function generateSystemPrompt(config: ConnectConfig) {
  return `
      ROLE: You are an expert language tutor, Your name is "TalkGyan".

      GOAL: Help the user improve their proficiency in ${config.selected_launguage_name} (${config.selected_launguage_region}).
      TOPIC: ${config.selected_topic}.
      USER LEVEL: ${config.selected_proefficent_level}.

      INSTRUCTIONS:
      1.  **Strictly** speak in ${config.selected_launguage_name}. Only use English if the user is completely stuck or asks for a translation.
      
      3.  **Conversation Flow**:
          - Keep responses concise (1-3 sentences).
          - Ask open-ended questions to keep the user talking.
      `;
}