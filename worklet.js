/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	// The require scope
/******/ 	var __webpack_require__ = {};
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
/*!************************************!*\
  !*** ./adapter/sound-processor.js ***!
  \************************************/
__webpack_require__.r(__webpack_exports__);
class SoundProcessor extends AudioWorkletProcessor {
    constructor() {
        super();

        this.remains = 0;
        this.idx = 0;

        /*
        this.drawBuffer = new Float32Array(4096);
        this.drawIdx = 0;
        */

        this.isActive = true;

        this.port.onmessage = (event) => {
            const {msg, payload} = event.data;
            switch(msg) {
                case 'init':
                    //this.filled = new Int32Array(payload.fillSab);
                    this.filled = new Int32Array(payload.fillSab.buffer, payload.fillSab.ptr, 1);
                    this.channels = new Array(2);
                    //this.channels[0] = new Float32Array(payload.leftSab);
                    //this.channels[1] = new Float32Array(payload.rightSab);
                    this.bufferLen = payload.bufferLen;
                    this.channels[0] = new Float32Array(payload.leftSab.buffer, payload.leftSab.ptr, this.bufferLen);
                    this.channels[1] = new Float32Array(payload.rightSab.buffer, payload.rightSab.ptr, this.bufferLen);
                    break;
                case 'stop':
                    this.stop();
                    break;
                default:
            }
        };
    }

    stop() {
        this.isActive = false;
    }

    process(inputs, outputs) {
        if(!this.isActive) {
            return false;
        }

        const output = outputs[0];
        const outputCh1 = output[0];
        const outputCh2 = output[1];
        const len = outputCh1.length;

        /*
            souund mute code while test some emul code..
        if(len > 0) {
            Atomics.sub(this.filled, 0, len);
            return 0;
        }
        */

        this.remains = Atomics.load(this.filled, 0);

        //console.log(`remains: ${this.remains}`);

        if(this.remains <= 0) {
            console.log("%c not consume", 'background:green');

            for(let i = 0; i < len; i++) {
                outputCh1[i] = 0.000001;
                outputCh2[i] = 0.000001;
            }

            /*
            for(let i = 0; i < len; i++) {
                this.drawBuffer[this.drawIdx] = 0;
                this.drawIdx = (this.drawIdx+1)%4096;
            }

            if(this.drawIdx == 0) {
                this.port.postMessage({waveform: this.drawBuffer});
            }
            */

            return true;
        }

        for(let i = 0; i < len; i++) {
            
            outputCh1[i] = this.channels[0][this.idx];
            outputCh2[i] = this.channels[1][this.idx];
            
            this.idx = (this.idx + 1) % this.bufferLen;

            /*
            this.drawBuffer[this.drawIdx] = outputCh1[i];
            this.drawIdx = (this.drawIdx+1)%4096;
            */
        }

        Atomics.sub(this.filled, 0, len);

        /*
        if(this.drawIdx == 0) {
            this.port.postMessage({waveform: this.drawBuffer});
        }
        */
       
        return true;
    }
    
}

registerProcessor('soundprocessor', SoundProcessor);
/******/ })()
;