import { createPCMBlob } from "@/lib/audioUtils";
import { INPUT_SAMPLE_RATE } from "@/lib/constants";
import { pcmBlob } from "@/types";

export class AudioInput {
    private InputAudioContext: AudioContext | null = null;
    private MediaStream: MediaStream | null = null;
    private WorkletNode: AudioWorkletNode | null = null;
    private InputSource: MediaStreamAudioSourceNode | null = null;
   

    async initialize( sendAudio: (blob: pcmBlob ) => void )  {
        this.InputAudioContext = new AudioContext({ sampleRate: 16000 });

        if (this.InputAudioContext.state === "suspended") {
            this.InputAudioContext.resume();
        }

        await this.InputAudioContext.audioWorklet.addModule(
            "/worklets/mic-processor.js",
        );

        this.WorkletNode = new AudioWorkletNode(
            this.InputAudioContext,
            "mic-processor",
        );

        this.WorkletNode.connect(this.InputAudioContext.destination);

        this.MediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: INPUT_SAMPLE_RATE,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                channelCount: 1,
            },
        });

        this.InputSource = this.InputAudioContext.createMediaStreamSource(
            this.MediaStream,
        );

        this.WorkletNode.port.onmessage = (event) => {
                  try {
                    const pcmBlob = createPCMBlob(event.data as Float32Array);
                    sendAudio(pcmBlob);
                  } catch (err) {
                    console.error("Send failed:", err);
                  }
                };

        this.InputSource.connect(this.WorkletNode);

    }

    SetMute(isMutedVar: boolean) {
        
      if (this.MediaStream) {
        this.MediaStream.getAudioTracks().forEach((tracks) => {
          tracks.enabled = !isMutedVar
        })
      }

    }

    destroy() {
        this.InputAudioContext?.close();
        this.WorkletNode?.disconnect();
        this.InputSource?.disconnect();
    }

}