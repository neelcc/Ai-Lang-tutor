import { ConnectConfig, LiveManagerCallbacks } from "@/types";
import { LiveSession } from "./LiveSession";
import { AuthToken, LiveServerMessage } from "@google/genai";
import { AudioInput } from "./AudioInput";
import { AudioOutput } from "./AudioOutput";

export class LiveAudioManager {

    private liveService : LiveSession;
    private callback : LiveManagerCallbacks
    private token : AuthToken
    private audioInput : AudioInput
    private audioOutput : AudioOutput


    constructor(callback : LiveManagerCallbacks, token : AuthToken ){
        this.callback = callback;
        this.token = token;
        this.liveService = new LiveSession(callback,token);
        this.audioInput = new AudioInput();
        this.audioOutput = new AudioOutput(callback);

    };

    async initialize(connectConfig : ConnectConfig){
        await this.liveService.StartSession(connectConfig, {
            onMessage : (message : LiveServerMessage ) => this.audioOutput.HandleMessage(message)
        } );
        await this.audioInput.initialize(
            (pcmBlob) => {
                this.liveService.sendAudio(pcmBlob)
        }
       );
       await this.audioOutput.initialize();
    }

    SetMute(isMuted : boolean ){
        this.audioInput.SetMute(isMuted);
        // this.audioOutput.SetMute(isMuted);
    }

    async destroy(){
        this.liveService.StopSession();
        this.audioOutput.destroy();
        this.audioInput.destroy();
    }   

}
