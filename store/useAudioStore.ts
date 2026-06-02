import { ConnectionState } from "@/types";
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
    }),
  )
);