/******/ (() => { // webpackBootstrap
/*!**************************************!*\
  !*** ./public/js/sound-processor.js ***!
  \**************************************/
console.log('open');

class SoundProcessor extends AudioWorkletProcessor {
    constructor() {
        super();

        console.log('in constructor');

        this.remains = 0;
        this.idx = 0;

        this.port.onmessage = (event) => {
            this.filled = new Int32Array(event.data.fillSab);
            this.channels = new Array(2);
            this.channels[0] = new Float32Array(event.data.leftSab);
            this.channels[1] = new Float32Array(event.data.rightSab);
            this.bufferLen = event.data.bufferLen;
            console.log("receive processor");
        };
    }

    process(inputs, outputs) {
        const output = outputs[0];
        const outputCh1 = output[0];
        const outputCh2 = output[1];

        this.remains = Atomics.load(this.filled, 0);
        if(this.remains <= 0) {
            console.log("not consume");
            return true;
        }

        const len = outputCh1.length;
        for(let i = 0; i < len; i++) {
            outputCh1[i] = this.channels[0][this.idx];
            outputCh2[i] = this.channels[1][this.idx];
            
            this.idx = (this.idx + 1) % this.bufferLen;
        }

        Atomics.sub(this.filled, 0, len);

        return true;
    }
    
}

registerProcessor('soundprocessor', SoundProcessor);
/******/ })()
;