import { MODEL } from "@/lib/constants";
import { GoogleGenAI, Modality, Session } from "@google/genai";

export class LiveAudioManager {
  private ai: GoogleGenAI;
  private ActiveSession: Session | null = null;

  constructor() {
    this.ai = new GoogleGenAI({
      apiKey: "AIzaSyDFpJCnqgwTwIhlAyKS5S7eN2ymm1PPrws",
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
    console.log(this.ActiveSession);
    
  }
}
