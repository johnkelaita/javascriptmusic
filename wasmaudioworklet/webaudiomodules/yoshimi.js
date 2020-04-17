// YOSHIMI WAM Controller
// Jari Kleimola 2018-19 (jari@webaudiomodules.org)

var WAM = WAM || {}

WAM.YOSHIMI = class YOSHIMI extends WAMController
{
  constructor (actx, state) {
    var options = {};
    options.numberOfInputs  = 0;
    options.numberOfOutputs = 1;
    options.outputChannelCount = [2];
    options.processorOptions = { desc:state, wasm:YOSHIMI.wasm, js:YOSHIMI.js }

    super(actx, "YOSHIMI", options);
  }

  waitForMessage() {
    return new Promise(resolve => this.waitForMessageResolve = resolve);
  }

  onmessage(msg) {
      if (this.waitForMessageResolve) {
        this.waitForMessageResolve();
        this.waitForMessageResolve = null;
      }
  }

  // -- wasm and scripts need to be loaded first, and in order
  //
  static async importScripts (actx, prefix = "") {
    YOSHIMI.wasm = await YOSHIMI.load("https://petersalomonsen.github.io/yoshimi/wam/dist/worklet/yoshimi.wasm", "bin");
    YOSHIMI.js   = await YOSHIMI.load("https://petersalomonsen.github.io/yoshimi/wam/dist/worklet/yoshimi.js", "text");
    await actx.audioWorklet.addModule("https://petersalomonsen.github.io/yoshimi/wam/dist/libs/wam-processor.js");
    await actx.audioWorklet.addModule("webaudiomodules/yoshimi-awp.js");
  }

  static async load (url,type) {
    let resp = await fetch(url);
    let abuf = await (type == "bin") ? resp.arrayBuffer() : resp.text();
    return abuf;
  }
}

WAM.YOSHIMI.title = "webYOSHIMI";
