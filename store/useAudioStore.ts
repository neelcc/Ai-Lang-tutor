import { ConnectionState, TranscriptItem } from "@/types";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { LiveAudioManager } from "@/services/LiveAudioManager";
import { AVAILABLE_LANGUAGES, AVAILABLE_PROFICIENCY_LEVELS, AVAILABLE_TOPICS, AVAILABLE_VOICES } from "@/lib/constants";

type AudioStore = {
  connect: () => Promise<void>;
  LiveManagerInstance: LiveAudioManager | null;
  connectionState: ConnectionState;
  error: string | null;
  isMuted: boolean;
  ToggleMute: () => void;
  transcript: TranscriptItem[];
  disconnect: () => void;
   selectedLanguage: string;
  selectedProficiencyLevel: string;
  selectedTopic: string;
  selectedAssistantVoice: string;
  setSelectedLanguage: (lang: string) => void;
  setSelectedProficiencyLevel: (prof: string) => void;
  setSelectedTopic: (topic: string) => void;
  setSelectedAssistantvoice: (voice: string) => void;
};

export const useAudioStore = create<AudioStore>()(
  devtools(
    (set, get) => ({
      LiveManagerInstance: null,
      connectionState: ConnectionState.DISCONNECTED,
      error: null,
      isMuted: false,
      ToggleMute: () => {
        const state = get();
        const newState = !state.isMuted
        set({ isMuted: newState })
        state.LiveManagerInstance?.SetMute(newState)
      },
      transcript: [],
      selectedLanguage: AVAILABLE_LANGUAGES[0].code,
    selectedProficiencyLevel:
      AVAILABLE_PROFICIENCY_LEVELS[0].label,
    selectedTopic: AVAILABLE_TOPICS[0],
    selectedAssistantVoice: AVAILABLE_VOICES[0].name,

    setSelectedLanguage: (lang: string) => {
      set({ selectedLanguage: lang });
    },
    setSelectedProficiencyLevel: (prof: string) => {
      set({ selectedProficiencyLevel: prof });
    },
    setSelectedTopic: (topic: string) => {
      set({ selectedTopic: topic });
    },
    setSelectedAssistantvoice: (voice: string) => {
      set({ selectedAssistantVoice: voice });
    },

      connect: async () => {
        const state = get();

        const response = await fetch("/api/token/")
        console.log(response);
        
        if(!response.ok){
          set({error : "Failed to generate token"})
        }

        const { token } = await response.json();



        if (
          state.connectionState === ConnectionState.CONNECTING ||
          state.connectionState === ConnectionState.CONNECTED
        ) {
          return;
        }

        set({
          error: null,
        });

        try {
          await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
        } catch {
          set({
            error: "Microphone Permission Denied.",
          });

          return;
        }

        try {
          let manager = state.LiveManagerInstance;
          if (!manager) {
            manager = new LiveAudioManager({
              onStateChange: (state) => set({ connectionState: state }),
              onError: (err) => set({ error: err }),
              onTranscript: (sender, text, isPartial) => {
                return set((state) => {
                  const newTranscript = [...state.transcript];
                  console.log("NTB ", newTranscript);

                  const existingIndex =
                    newTranscript.findLastIndex((item) => {
                      return (
                        item.sender === sender &&
                        item.isPartial
                      );
                    });
                  console.log("ExistingIndex: ", existingIndex);

                  // partial message exists
                  if (existingIndex !== -1) {
                    newTranscript[existingIndex] = {
                      ...newTranscript[existingIndex],
                      text,
                      isPartial,
                    };

                    console.log("NTA1 ", newTranscript);

                    return { transcript: newTranscript };
                  } else {
                    if (text) {
                      newTranscript.push({
                        id: crypto.randomUUID(),
                        sender,
                        text,
                        isPartial,
                      });
                    console.log("NTA2 ", newTranscript);

                    }

                    return { transcript: newTranscript };
                  }
                });
              },
              
            }, token );

            set({
              LiveManagerInstance: manager,
            });
          }
          const selectedLang = AVAILABLE_LANGUAGES.find(
        (l) => l.code === state.selectedLanguage,
      );
      // create session
      manager.StartSession({
        selected_assistant_voice:
          state.selectedAssistantVoice,
        selected_launguage_code:
          selectedLang?.code || "en-US",
        selected_launguage_name:
          selectedLang?.name || "English",
        selected_launguage_region:
          selectedLang?.region || "US",
        description: state.selectedTopic,
        selected_topic: state.selectedTopic,
        selected_proefficent_level:
          state.selectedProficiencyLevel,
      });


        } catch (error) {
          console.error(error);

          set({
            error: "Failed to connect.",
          });
        }
      },

      disconnect: async () => {
        const state = get();

        if (state.LiveManagerInstance) {
          state.LiveManagerInstance.Disconnect();
        }
        set({ LiveManagerInstance: null })
        set({ connectionState: ConnectionState.DISCONNECTED })
      }

    }),
  )
);