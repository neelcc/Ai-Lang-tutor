class MicProcessor extends AudioWorkletProcessor {

  // sampleRate/RenderQuantumSize  = 16000/128 = 125 times / second - 8ms
  process(inputs) {
    
    if(!inputs.length) return true;

    // inputs looks like [ [ [ Float32Array  ] [ Float32Array ] ] ]

    const input = inputs[0];

    // Mono Channel
    if(!input.length) return true;
    
    const channelData = input[0] 

    // copy buffer for reuse
    const pcm = new Float32Array(channelData.length)
    pcm.set(channelData)



    this.port.postMessage(pcm);
    return true;
    
  }
}

registerProcessor("mic-processor", MicProcessor);