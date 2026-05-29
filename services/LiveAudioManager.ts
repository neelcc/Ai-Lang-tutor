import { INPUT_SAMPLE_RATE, MODEL, } from "@/lib/constants";
import { GoogleGenAI, Modality, Session } from "@google/genai";

export class LiveAudioManager {
  private ai: GoogleGenAI;
  private ActiveSession: Session | null = null;
  private InputAudioContext : AudioContext | null = null;
  private OutputAudioContext : AudioContext | null = null;
  private OutputNode : GainNode | null = null;
  private MediaStream : MediaStream | null = null;


  constructor() {
    this.ai = new GoogleGenAI({
      apiKey: process.env.NEXT_PUBLIC_API_KEY,
    });
  }

  async StartSession() {
    const config = { responseModalities: [Modality.AUDIO] };
    this.ActiveSession = await this.ai.live.connect({
      model: MODEL,
      callbacks: {
        onopen: function () {
          console.debug("Opened");
        },
        onmessage: function (message) {
          console.debug(message);
        },
        onerror: function (e) {
          console.debug("Error:", e.message);
        },
        onclose: function (e) {
          console.debug("Close:", e.reason);
        },
      },
      config: config,
    });

    this.InputAudioContext = new AudioContext();
    this.OutputAudioContext = new AudioContext();

    if(this.InputAudioContext.state === "suspended"){
      this.InputAudioContext.resume();
    }

    if(this.OutputAudioContext.state === "suspended"){
      this.OutputAudioContext.resume();
    }

    this.OutputNode = this.OutputAudioContext.createGain()

    this.OutputNode.connect(this.OutputAudioContext.destination)

    this.MediaStream = await navigator.mediaDevices.getUserMedia({
      audio : {
        sampleRate : INPUT_SAMPLE_RATE,
        channelCount : 1,
        echoCancellation : true,
        noiseSuppression : true,
        autoGainControl : true,
      }
    })

    console.log(this.ActiveSession);
    
  }
}
