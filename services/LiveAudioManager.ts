import { base64ToUint8Array, createPCMBlob, decodeAudioData } from "@/lib/audioUtils";
import { config, INPUT_SAMPLE_RATE, MODEL, OUTPUT_SAMPLE_RATE } from "@/lib/constants";
import { ConnectionState, LiveManagerCallbacks } from "@/types";
import {
  GoogleGenAI,
  LiveServerMessage,
  Session,
} from "@google/genai";

export class LiveAudioManager {
  private ai: GoogleGenAI;
  private ActiveSession: Session | null = null;
  private InputAudioContext: AudioContext | null = null;
  private OutputAudioContext: AudioContext | null = null;
  private OutputNode: GainNode | null = null;
  private MediaStream: MediaStream | null = null;
  private WorkletNode: AudioWorkletNode | null = null;
  private InputSource: MediaStreamAudioSourceNode | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private callback : LiveManagerCallbacks;
  private isMuted : boolean = false ;

  constructor( callback : LiveManagerCallbacks ) {
    this.ai = new GoogleGenAI({
      apiKey: process.env.NEXT_PUBLIC_API_KEY,
    });
    this.callback = callback;

  }
  
  SetMute(isMutedVar : boolean) {

    this.isMuted = isMutedVar

    if(this.MediaStream){
      this.MediaStream.getAudioTracks().forEach((tracks)=>{
        tracks.enabled = !isMutedVar
      })
    }
    
  }

  async StartSession() {

    try {
       this.callback.onStateChange(ConnectionState.CONNECTING)

    this.ActiveSession = await this.ai.live.connect({
      model: MODEL,
      callbacks: {
        onopen:  () =>  {
          console.log("Opened");
          this.callback.onStateChange(ConnectionState.CONNECTED)
        },
        onmessage: this.HandleMessage.bind(this),
        onerror:  (e) => {
          console.debug("Error:", e.message);
          this.callback.onStateChange(ConnectionState.ERROR)
          this.callback.onError("Could not connect")
        },
        onclose: function (e) {
          console.log("Close:", e.reason);
        },
      },
      config: config,
    });

    this.InputAudioContext = new AudioContext({ sampleRate: 16000 });
    this.OutputAudioContext = new AudioContext({ sampleRate: 24000 });

    if (this.InputAudioContext.state === "suspended") {
      this.InputAudioContext.resume();
    }

    if (this.OutputAudioContext.state === "suspended") {
      this.OutputAudioContext.resume();
    }

    this.OutputNode = this.OutputAudioContext.createGain();

    this.OutputNode.connect(this.OutputAudioContext.destination);

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
        this.ActiveSession?.sendRealtimeInput({
          audio: pcmBlob,
        });
      } catch (err) {
        console.error("Send failed:", err);
      }
    };

    this.InputSource.connect(this.WorkletNode);
    } catch (error) {
      console.log(error);
      this.callback.onError("Something went error.")      
    }
   

  }

  async HandleMessage(message: LiveServerMessage) {

    const ServerContent = message.serverContent;
    console.log(ServerContent?.inputTranscription);
    console.log(ServerContent?.outputTranscription);
    console.log(ServerContent?.outputTranscription?.finished);
    

    if(ServerContent?.interrupted){
      this.StopAllAudio();
    }

    const Base64Data = ServerContent?.modelTurn?.parts?.[0]?.inlineData?.data

    if(!Base64Data) return;

    await this.PlayAudioChunk(Base64Data as string)

  }

  async PlayAudioChunk(base64Data: string) {
    const Uint8Data = base64ToUint8Array(base64Data)

    if(!this.OutputAudioContext || !this.OutputNode  ) return;
    
    const AudioBuffer  = await decodeAudioData(Uint8Data,this.OutputAudioContext,OUTPUT_SAMPLE_RATE,1)
    
    if(this.nextStartTime < this.OutputAudioContext.currentTime){
      this.nextStartTime = this.OutputAudioContext.currentTime;
    }

    const source : AudioBufferSourceNode = this.OutputAudioContext.createBufferSource();


    source.connect(this.OutputNode)

    source.buffer = AudioBuffer;
   
    source.start(this.nextStartTime);
    
    this.nextStartTime += AudioBuffer.duration

    this.sources.add(source)

    source.addEventListener("ended",()=>{
      this.sources.delete(source);
    })

  }

  async StopAllAudio(){
    this.sources.forEach((source)=>{
      try {
      source.stop();
      } catch (error) {
        console.log("Error ",error);
      }
    })

    this.sources.clear();

    if(this.OutputAudioContext) this.nextStartTime = this.OutputAudioContext?.currentTime;


  }

}
