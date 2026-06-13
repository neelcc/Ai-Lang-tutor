import { generateSystemPrompt, MODEL, PREFIXPADDINGMS, SILENCEDURATIONMS } from "@/lib/constants";
import { ConnectConfig, ConnectionState, LiveManagerCallbacks, pcmBlob } from "@/types";
import { AuthToken, EndSensitivity, GoogleGenAI, LiveConnectConfig, LiveServerMessage, Modality, Session, StartSensitivity } from "@google/genai";

export class LiveSession {

    private ai: GoogleGenAI;
    private ActiveSession: Session | null = null;
    private callbacks: LiveManagerCallbacks;
    private token: AuthToken;



    constructor(callbacks: LiveManagerCallbacks, token: AuthToken) {

        this.ai = new GoogleGenAI({
            apiKey: token.name,
            apiVersion: "v1alpha"
        });
        this.callbacks = callbacks;
        this.token = token;
    }

    async StartSession(connectConfig: ConnectConfig, callbacks: { onMessage: (message : LiveServerMessage) => void }) {
        try {
            this.callbacks.onStateChange(ConnectionState.CONNECTING)

            const config: LiveConnectConfig = {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    languageCode: connectConfig.selected_launguage_code,
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: connectConfig.selected_assistant_voice,
                        }
                    }
                },
                systemInstruction: generateSystemPrompt(connectConfig),
                realtimeInputConfig: {
                    automaticActivityDetection: {
                        disabled: false,
                        startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW, // less trigger-happy
                        endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH, // detect silence faster
                        prefixPaddingMs: PREFIXPADDINGMS,
                        silenceDurationMs: SILENCEDURATIONMS, // declare end after 800ms of "silence"
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
                    onmessage: (message) => {
                        callbacks.onMessage(message)
                    },
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


        } catch (error) {
            console.log(error);
            this.callbacks.onError("Something went error.")
            this.StopSession();
        }

    }

    sendAudio(blob : pcmBlob){
        if(!this.ActiveSession){
            this.callbacks.onError("No ActiveSession Found!")
            return;
        }
       this.ActiveSession.sendRealtimeInput({audio:blob})
    }


    async StopSession() {
        if (this.ActiveSession) {
            this.ActiveSession.close();
            this.ActiveSession = null;
            this.callbacks.onStateChange(ConnectionState.DISCONNECTED)
        }
    }


}