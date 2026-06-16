  import { base64ToUint8Array, createPCMBlob, decodeAudioData } from "@/lib/audioUtils";
  import {  INPUT_SAMPLE_RATE, MODEL, OUTPUT_SAMPLE_RATE, PREFIXPADDINGMS, SILENCEDURATION_MS } from "@/lib/constants";
  import { ConnectConfig, ConnectionState, LiveManagerCallbacks } from "@/types";
  import {
    AuthToken,
    EndSensitivity,
    GoogleGenAI,
    LiveConnectConfig,
    LiveServerMessage,
    Modality,
    Session,
    StartSensitivity,
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
    private callbacks: LiveManagerCallbacks;
    private nextStartTime = 0;
    private sources = new Set<AudioBufferSourceNode>();
    private isMuted: boolean = false;
    private inputTranscription: string = "";
    private outputTranscription: string = "";
    private token : AuthToken;

    constructor(callbacks: LiveManagerCallbacks,token : AuthToken ) {
      
      this.ai = new GoogleGenAI({
        apiKey: token.name,
        apiVersion : "v1alpha"
      });
      this.callbacks = callbacks; 
      this.token = token;
    }

    async StartSession(connectConfig : ConnectConfig) {
      try {
        this.callbacks.onStateChange(ConnectionState.CONNECTING)

          const config : LiveConnectConfig = {
          responseModalities: [Modality.AUDIO], 
          speechConfig : {
            languageCode : connectConfig.selected_launguage_code,
            voiceConfig : {
              prebuiltVoiceConfig : {
                voiceName : connectConfig.selected_assistant_voice,
              }
            }
            },
          systemInstruction : this.generateSystemPrompt(connectConfig), 
          realtimeInputConfig: {
            automaticActivityDetection: {
              disabled: false,
              startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW, // less trigger-happy
              endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH, // detect silence faster
              prefixPaddingMs: PREFIXPADDINGMS,
              silenceDurationMs: SILENCEDURATION_MS, // declare end after 800ms of "silence"
            },
          },
        }

        this.ActiveSession = await this.ai.live.connect({
          model: MODEL,
          callbacks: {
            onopen: () => {
              console.log("Opened");
              this.callbacks.onStateChange(ConnectionState.CONNECTED)
            
            },
            onmessage: this.HandleMessage.bind(this), 
            onerror: (e) => {
              console.debug("Error:", e.message);
              this.callbacks.onStateChange(ConnectionState.ERROR)
              this.callbacks.onError("Could not connect")
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

        if (this.isMuted) {
          this.MediaStream.getAudioTracks().forEach(t => t.enabled = false);
          }

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
        this.callbacks.onError("Something went error.")
        this.Disconnect();
      }


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

     SetMute(isMutedVar: boolean) {

      this.isMuted = isMutedVar


      if (this.MediaStream) {
        this.MediaStream.getAudioTracks().forEach((tracks) => {
          tracks.enabled = !isMutedVar
        })
      }

    }

    async Disconnect() {
      await this.StopAllAudio();
      if(this.ActiveSession){
        this.ActiveSession.close();
      }
      this.InputSource?.disconnect();
      this.OutputNode?.disconnect();
      this.InputAudioContext?.close()
      this.OutputAudioContext?.close()
  
    }

    generateSystemPrompt(config: ConnectConfig) {
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

  }
