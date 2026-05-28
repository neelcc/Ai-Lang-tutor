import { LiveManager } from "@/services/LiveManager";
import { ConnectionState } from "@/types";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

type AudioStore = {
  connect: () => Promise<void>;
  LiveManagerInstance: LiveManager | null;
  connectionState: ConnectionState;
  error: string | null;
};

export const useAudioStore = create<AudioStore>()(
  devtools(
    (set, get) => ({
      LiveManagerInstance: null,
      connectionState: ConnectionState.DISCONNECTED,
      error: null,

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
          connectionState: ConnectionState.CONNECTING,
        });

        try {
          await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
        } catch {
          set({
            error: "Microphone Permission Denied.",
            connectionState: ConnectionState.DISCONNECTED,
          });

          return;
        }

        try {
          let manager = state.LiveManagerInstance;

          if (!manager) {
            manager = new LiveManager();

            set({
              LiveManagerInstance: manager,
            });
          }

           manager.StartSession();

          set({
            connectionState: ConnectionState.CONNECTED,
          });
        } catch (error) {
          console.error(error);

          set({
            error: "Failed to connect.",
            connectionState: ConnectionState.DISCONNECTED,
          });
        }
      },
    }),
  )
);