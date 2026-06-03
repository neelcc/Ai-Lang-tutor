import { ConnectionState, TranscriptItem } from "@/types";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { LiveAudioManager } from "@/services/LiveAudioManager";

type AudioStore = {
  connect: () => Promise<void>;
  LiveManagerInstance: LiveAudioManager | null;
  connectionState: ConnectionState;
  error: string | null;
  isMuted : boolean;
  ToggleMute : () => void;
  transcript : TranscriptItem[];
  disconnect : () => void;
};

export const useAudioStore = create<AudioStore>()(
  devtools(
    (set, get) => ({
      LiveManagerInstance: null,
      connectionState: ConnectionState.DISCONNECTED,
      error: null,
      isMuted : false,
      ToggleMute : () => {
        const state = get();
        const newState = !state.isMuted
        set({isMuted : newState})
          state.LiveManagerInstance?.SetMute(newState)
      },
      transcript : [],

      connect: async () => {
        const state = get();

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
            // @ts-ignore
            manager = new LiveAudioManager({
              onStateChange : (state) => set({ connectionState : state }), 
              onError : (err) => set({ error : err }),
              onTranscript: (sender, text, isPartial) => {
              return set((state) => {
                const newTranscript = [...state.transcript];

                const existingIndex =
                  newTranscript.findLastIndex((item) => {
                    return (
                      item.sender === sender &&
                      item.isPartial
                    );
                  });

                // partial message exists
                if (existingIndex !== -1) {
                  newTranscript[existingIndex] = {
                    ...newTranscript[existingIndex],
                    text,
                    isPartial,
                  };

                  return { transcript: newTranscript };
                } else {
                  if (text) {
                    newTranscript.push({
                      id: crypto.randomUUID(),
                      sender,
                      text,
                      isPartial,
                    });
                  }

                  return { transcript: newTranscript };
                }
              });
            },

            });

            set({
              LiveManagerInstance: manager,
            });
          }

           manager.StartSession();

          
        } catch (error) {
          console.error(error);

          set({
            error: "Failed to connect.",
          });
        }
      },

      disconnect : async () => {
        const state = get();

        if(state.LiveManagerInstance){
          state.LiveManagerInstance.Disconnect();
        }
        set({LiveManagerInstance : null})
        set({connectionState : ConnectionState.DISCONNECTED })
      }

    }),
  )
);