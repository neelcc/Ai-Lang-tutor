import { base64ToUint8Array, decodeAudioData } from "@/lib/audioUtils";
import { OUTPUT_SAMPLE_RATE } from "@/lib/constants";
import { LiveManagerCallbacks } from "@/types";
import { LiveServerMessage } from "@google/genai";

export class AudioOutput {


  private OutputAudioContext: AudioContext | null = null;
  private OutputNode: GainNode | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private inputTranscription: string = "";
  private outputTranscription: string = "";
  private callbacks : LiveManagerCallbacks;

  constructor(callbacks : LiveManagerCallbacks ){
    this.callbacks = callbacks
  }
  

  async initialize() {

    this.OutputAudioContext = new AudioContext({ sampleRate: 24000 });

    if (this.OutputAudioContext.state === "suspended") {
      this.OutputAudioContext.resume();
    }

    this.OutputNode = this.OutputAudioContext.createGain();

    this.OutputNode.connect(this.OutputAudioContext.destination);
  }

  async HandleMessage(message: LiveServerMessage) {

    const ServerContent = message.serverContent;


    if (ServerContent?.interrupted) {
      this.StopAllAudio();
    }

    if (ServerContent?.inputTranscription?.text) {
      this.inputTranscription += ServerContent?.inputTranscription?.text;
      this.callbacks.onTranscript("user", this.inputTranscription, true)

    }

    if (ServerContent?.outputTranscription?.text) {
      this.outputTranscription += ServerContent?.outputTranscription?.text;
      this.callbacks.onTranscript("model", this.outputTranscription, true)
    }


    if (ServerContent?.turnComplete) {
      if (this.inputTranscription) {
        this.callbacks.onTranscript(
          "user",
          this.inputTranscription,
          false,
        );


        this.inputTranscription = "";
      }

      if (this.outputTranscription) {
        this.callbacks.onTranscript(
          "model",
          this.outputTranscription,
          false,
        );
        this.outputTranscription = "";
      }
    }

    const Base64Data = ServerContent?.modelTurn?.parts?.[0]?.inlineData?.data

    if (!Base64Data) return;

    await this.PlayAudioChunk(Base64Data as string)

  }

  async PlayAudioChunk(base64Data: string) {
        const Uint8Data = base64ToUint8Array(base64Data)
  
        if (!this.OutputAudioContext || !this.OutputNode) return;
  
        const AudioBuffer = await decodeAudioData(Uint8Data, this.OutputAudioContext, OUTPUT_SAMPLE_RATE, 1)
  
        if (this.nextStartTime < this.OutputAudioContext.currentTime) {
          this.nextStartTime = this.OutputAudioContext.currentTime;
        }
  
        const source: AudioBufferSourceNode = this.OutputAudioContext.createBufferSource();
  
  
        source.connect(this.OutputNode)
  
        source.buffer = AudioBuffer;
  
        source.start(this.nextStartTime);
  
        this.nextStartTime += AudioBuffer.duration
  
        this.sources.add(source)
  
        source.addEventListener("ended", () => {
          this.sources.delete(source);
        })
  
      }


   async StopAllAudio() {
      this.sources.forEach((source) => {
        try {
          source.stop();
        } catch (error) {
          console.log("Error ", error);
        }
      })

      this.sources.clear();

      if (this.OutputAudioContext) this.nextStartTime = this.OutputAudioContext?.currentTime;


    }

  async destroy() {
    this.OutputAudioContext?.close();
    this.OutputNode?.disconnect();
  }

}