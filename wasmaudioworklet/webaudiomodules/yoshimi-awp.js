// YOSHIMI WAM Processor
// Jari Kleimola 2018-19 (jari@webaudiomodules.org)

class YOSHIMIAWP extends AudioWorkletGlobalScope.WAMProcessor
{
  constructor(options) {
    let awgs = AudioWorkletGlobalScope;
    awgs.WAM = awgs.WAM || {}
    awgs.WAM.YOSHIMI = awgs.WAM.YOSHIMI || { ENVIRONMENT: "WEB" };
    awgs.WAM.YOSHIMI.wasmBinary = new Uint8Array(options.processorOptions.wasm);
    eval(options.processorOptions.js);

    options.mod = AudioWorkletGlobalScope.WAM.YOSHIMI;
    super(options);
    this.numOutChannels = [2];
    this.sequence = [];
  }

  onmessage (e) {
    var msg  = e.data;
    var data = msg.data;
    switch (msg.type) {
      case "midi":  this.onmidi(data[0], data[1], data[2]); break;
      case "sysex": this.onsysex(data); break;
      case "patch": this.onpatch(data); break;
      case "param": this.onparam(msg.key, msg.value); break;
      case "msg": 
        if (msg.prop === 'seq') {
          // update sequence
          if (this.sequence.length > 0 && msg.data.length > 0) {
            // Replace while playing
            const currentTime = (this.currentFrame / this.sr) * 1000;
            this.sequenceIndex = msg.data.findIndex(evt => evt.time >= currentTime);
          } else {
            // Start playing from the beginning
            this.sequenceIndex = 0;
            this.currentFrame = 0;
          }
          this.sequence = msg.data;                    
        } else {
          this.onmsg(msg.verb, msg.prop, msg.data);          
        }
        // ACK
        this.port.postMessage({ type: msg.type });
        break;
    }
  }

  process (inputs,outputs,params) {
    let currentTime = (this.currentFrame / this.sr) * 1000;
    while (this.sequenceIndex < this.sequence.length &&
        this.sequence[this.sequenceIndex].time < currentTime) {
      let message = this.sequence[this.sequenceIndex].message;
      if (message[0] === -1) {
        // loop
        this.sequenceIndex = 0;
        this.currentFrame = 0;
        currentTime = 0;
        message = this.sequence[0].message;
      } 
      this.WAM._wam_onmidi(this.inst, message[0], message[1], message[2]);      
      this.sequenceIndex ++;
    }
    this.currentFrame += this.bufsize;
    return super.process(inputs, outputs, params);
  }
}

registerProcessor("YOSHIMI", YOSHIMIAWP);
