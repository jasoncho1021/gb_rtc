/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./adapter/orderlock.js":
/*!******************************!*\
  !*** ./adapter/orderlock.js ***!
  \******************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   OrderLock: () => (/* binding */ OrderLock)
/* harmony export */ });
/*
   INT_SIZE should be 2 to the power of n
   to use bitwise operation as modular operation.
*/
const INT_SIZE = 32;
const BIT_MOD = INT_SIZE - 1; 

class OrderLock {

  constructor(opt_order) {
    this._order_buffer = opt_order || new SharedArrayBuffer(4*(INT_SIZE));
    this._order = new Int32Array(this._order_buffer);
    this._order[0] = 1;
  }
 
  static connect(mu) {
    return new OrderLock(mu._order_buffer);
  }

  getId() {
    const enterId = Atomics.add(this._order, 0, 1) % INT_SIZE;
    Atomics.and(this._order, 0, BIT_MOD);
    return enterId;
  }

};


/***/ }),

/***/ "./adapter/sync.js":
/*!*************************!*\
  !*** ./adapter/sync.js ***!
  \*************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Mutex: () => (/* binding */ Mutex)
/* harmony export */ });
const locked = 1;
const unlocked = 0;

class Mutex {
  /**
   * Instantiate Mutex.
   * If opt_sab is provided, the mutex will use it as a backing array.
   * @param {SharedArrayBuffer} opt_sab Optional SharedArrayBuffer.
   */
  constructor(opt_sab) {
    this._sab = opt_sab || new SharedArrayBuffer(4);
    this._mu = new Int32Array(this._sab);
  }

  /**
   * Instantiate a Mutex connected to the given one.
   * @param {Mutex} mu the other Mutex.
   */
  static connect(mu) {
    return new Mutex(mu._sab);
  }

  lock() {
    for(;;) {
      if (Atomics.compareExchange(this._mu, 0, unlocked, locked) == unlocked) {
        // get lock
        return;
      }
      Atomics.wait(this._mu, 0, locked);
      // retry
    }
  }

  spinlock() {
    for(;;) {
      if (Atomics.compareExchange(this._mu, 0, unlocked, locked) == unlocked) {
        // get lock
        return;
      }
      // retry
    }
  }

  lockAsync() {
    if(Atomics.compareExchange(this._mu, 0, unlocked, locked) == unlocked) {
      return;
    }
    return Atomics.waitAsync(this._mu, 0, locked);
  }

  unlock() {
    if (Atomics.compareExchange(this._mu, 0, locked, unlocked) != locked) {
        return;
      //throw new Error("Mutex is in inconsistent state: unlock on unlocked Mutex.");
    }
    Atomics.notify(this._mu, 0, 1);
  }

  isLocked() {
    return Atomics.load(this._mu, 0) == locked;
  }

  getState() {
    return Atomics.load(this._mu, 0);
  }
};


/***/ }),

/***/ "./gb.js":
/*!***************!*\
  !*** ./gb.js ***!
  \***************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   instantiate: () => (/* binding */ instantiate)
/* harmony export */ });
async function instantiate(module, imports = {}) {
  const adaptedImports = {
    env: Object.assign(Object.create(globalThis), imports.env || {}, {
      abort(message, fileName, lineNumber, columnNumber) {
        // ~lib/builtins/abort(~lib/string/String | null?, ~lib/string/String | null?, u32?, u32?) => void
        message = __liftString(message >>> 0);
        fileName = __liftString(fileName >>> 0);
        lineNumber = lineNumber >>> 0;
        columnNumber = columnNumber >>> 0;
        (() => {
          // @external.js
          throw Error(`${message} in ${fileName}:${lineNumber}:${columnNumber}`);
        })();
      },
      "Date.now"() {
        // assembly/ts/gb/rtc/now() => f64
        return Date.now();
      },
      "console.log"(text) {
        // ~lib/bindings/dom/console.log(~lib/string/String) => void
        text = __liftString(text >>> 0);
        console.log(text);
      },
    }),
  };
  const { instance : { exports } } = await WebAssembly.instantiate(module, adaptedImports);
  const memory = exports.memory || imports.env.memory;
  const adaptedExports = Object.setPrototypeOf({
    getSave() {
      // assembly/ts/gb/getSave() => assembly/ts/savefile/SaveDataDto
      return __liftRecord26(exports.getSave() >>> 0);
    },
    setLoadedData(encryptData) {
      // assembly/ts/gb/setLoadedData(~lib/string/String) => void
      encryptData = __lowerString(encryptData) || __notnull();
      exports.setLoadedData(encryptData);
    },
    getDecryptData(encryptData) {
      // assembly/ts/gb/getDecryptData(~lib/string/String) => assembly/ts/gb/cartridge/SaveData
      encryptData = __lowerString(encryptData) || __notnull();
      return __liftRecord18(exports.getDecryptData(encryptData) >>> 0);
    },
    getCartridge() {
      // assembly/ts/gb/getCartridge() => assembly/ts/gb/cartridge/Cartridge
      return __liftRecord16(exports.getCartridge() >>> 0);
    },
    getLeftAudioBufferAddr() {
      // assembly/ts/gb/getLeftAudioBufferAddr() => usize
      return exports.getLeftAudioBufferAddr() >>> 0;
    },
    getRightAudioBufferAddr() {
      // assembly/ts/gb/getRightAudioBufferAddr() => usize
      return exports.getRightAudioBufferAddr() >>> 0;
    },
    getFilledBufferAddr() {
      // assembly/ts/gb/getFilledBufferAddr() => usize
      return exports.getFilledBufferAddr() >>> 0;
    },
    initLock() {
      // assembly/ts/gb/initLock() => usize
      return exports.initLock() >>> 0;
    },
    initSb() {
      // assembly/ts/gb/initSb() => usize
      return exports.initSb() >>> 0;
    },
    initSc() {
      // assembly/ts/gb/initSc() => usize
      return exports.initSc() >>> 0;
    },
    initCycleSumLocal() {
      // assembly/ts/gb/initCycleSumLocal() => usize
      return exports.initCycleSumLocal() >>> 0;
    },
    initPostLock() {
      // assembly/ts/gb/initPostLock() => usize
      return exports.initPostLock() >>> 0;
    },
    initCycleSumRecv() {
      // assembly/ts/gb/initCycleSumRecv() => usize
      return exports.initCycleSumRecv() >>> 0;
    },
    initSlower() {
      // assembly/ts/gb/initSlower() => usize
      return exports.initSlower() >>> 0;
    },
    initWaitSc() {
      // assembly/ts/gb/initWaitSc() => usize
      return exports.initWaitSc() >>> 0;
    },
    getSerialLock() {
      // assembly/ts/gb/getSerialLock() => usize
      return exports.getSerialLock() >>> 0;
    },
    getInterruptFlag() {
      // assembly/ts/gb/getInterruptFlag() => usize
      return exports.getInterruptFlag() >>> 0;
    },
    getPixelsAddr() {
      // assembly/ts/gb/getPixelsAddr() => usize
      return exports.getPixelsAddr() >>> 0;
    },
    getJoyPadAddr() {
      // assembly/ts/gb/getJoyPadAddr() => usize
      return exports.getJoyPadAddr() >>> 0;
    },
    allocateMemory(size) {
      // assembly/ts/gb/allocateMemory(i32) => usize
      return exports.allocateMemory(size) >>> 0;
    },
    getStackPointer() {
      // assembly/ts/gb/getStackPointer() => usize
      return exports.getStackPointer() >>> 0;
    },
    getStackPointerX() {
      // assembly/ts/gb/getStackPointerX() => usize
      return exports.getStackPointerX() >>> 0;
    },
    getHeapPointer() {
      // assembly/ts/gb/getHeapPointer() => usize
      return exports.getHeapPointer() >>> 0;
    },
    getHeapPointerX() {
      // assembly/ts/gb/getHeapPointerX() => usize
      return exports.getHeapPointerX() >>> 0;
    },
    getMemoryStats() {
      // assembly/ts/gb/getMemoryStats() => usize
      return exports.getMemoryStats() >>> 0;
    },
    getStatic() {
      // assembly/ts/gb/getStatic() => usize
      return exports.getStatic() >>> 0;
    },
    getStack() {
      // assembly/ts/gb/getStack() => usize
      return exports.getStack() >>> 0;
    },
    getHeap() {
      // assembly/ts/gb/getHeap() => usize
      return exports.getHeap() >>> 0;
    },
  }, exports);
  function __liftRecord26(pointer) {
    // assembly/ts/savefile/SaveDataDto
    // Hint: Opt-out from lifting as a record by providing an empty constructor
    if (!pointer) return null;
    return {
      title: __liftString(__getU32(pointer + 0)),
      encryptData: __liftString(__getU32(pointer + 4)),
    };
  }
  function __liftRecord17(pointer) {
    // assembly/ts/gb/rtc/RTC
    // Hint: Opt-out from lifting as a record by providing an empty constructor
    if (!pointer) return null;
    return {
      time: __getI32(pointer + 0),
      _latch: __getU8(pointer + 4) != 0,
      sec: __getI32(pointer + 8),
      min: __getI32(pointer + 12),
      hour: __getI32(pointer + 16),
      day: __getI32(pointer + 20),
      high: __getI32(pointer + 24),
      secLatch: __getI32(pointer + 28),
      minLatch: __getI32(pointer + 32),
      hourLatch: __getI32(pointer + 36),
      dayLatch: __getI32(pointer + 40),
      highLatch: __getI32(pointer + 44),
    };
  }
  function __liftRecord18(pointer) {
    // assembly/ts/gb/cartridge/SaveData
    // Hint: Opt-out from lifting as a record by providing an empty constructor
    if (!pointer) return null;
    return {
      _rtc: __liftRecord17(__getU32(pointer + 0)),
      _ram: __liftArray(__getI32, 2, __getU32(pointer + 4)),
      _title: __liftString(__getU32(pointer + 8)),
    };
  }
  function __liftRecord16(pointer) {
    // assembly/ts/gb/cartridge/Cartridge
    // Hint: Opt-out from lifting as a record by providing an empty constructor
    if (!pointer) return null;
    return {
      _gb: __liftInternref(__getU32(pointer + 0)),
      rtc: __liftRecord17(__getU32(pointer + 4)),
      hasSaveData: __getI32(pointer + 8),
      saveData: __liftRecord18(__getU32(pointer + 12)),
      _encryptData: __liftString(__getU32(pointer + 16)),
      title: __liftString(__getU32(pointer + 20)),
      cartridgeType: __getI32(pointer + 24),
      rom: __liftTypedArray(Uint8Array, __getU32(pointer + 28)),
      romBankNumber: __getI32(pointer + 32),
      ram: __liftTypedArray(Uint8Array, __getU32(pointer + 36)),
      ramBankNumber: __getI32(pointer + 40),
      ramEnable: __getU8(pointer + 44) != 0,
      ramBankMode: __getU8(pointer + 45) != 0,
      hasRAM: __getU8(pointer + 46) != 0,
      hasBattery: __getU8(pointer + 47) != 0,
      hasRTC: __getU8(pointer + 48) != 0,
      irSelect: __getU8(pointer + 49) != 0,
      irOn: __getU8(pointer + 50) != 0,
    };
  }
  function __liftString(pointer) {
    if (!pointer) return null;
    const
      end = pointer + new Uint32Array(memory.buffer)[pointer - 4 >>> 2] >>> 1,
      memoryU16 = new Uint16Array(memory.buffer);
    let
      start = pointer >>> 1,
      string = "";
    while (end - start > 1024) string += String.fromCharCode(...memoryU16.subarray(start, start += 1024));
    return string + String.fromCharCode(...memoryU16.subarray(start, end));
  }
  function __lowerString(value) {
    if (value == null) return 0;
    const
      length = value.length,
      pointer = exports.__new(length << 1, 2) >>> 0,
      memoryU16 = new Uint16Array(memory.buffer);
    for (let i = 0; i < length; ++i) memoryU16[(pointer >>> 1) + i] = value.charCodeAt(i);
    return pointer;
  }
  function __liftArray(liftElement, align, pointer) {
    if (!pointer) return null;
    const
      dataStart = __getU32(pointer + 4),
      length = __dataview.getUint32(pointer + 12, true),
      values = new Array(length);
    for (let i = 0; i < length; ++i) values[i] = liftElement(dataStart + (i << align >>> 0));
    return values;
  }
  function __liftTypedArray(constructor, pointer) {
    if (!pointer) return null;
    return new constructor(
      memory.buffer,
      __getU32(pointer + 4),
      __dataview.getUint32(pointer + 8, true) / constructor.BYTES_PER_ELEMENT
    ).slice();
  }
  class Internref extends Number {}
  const registry = new FinalizationRegistry(__release);
  function __liftInternref(pointer) {
    if (!pointer) return null;
    const sentinel = new Internref(__retain(pointer));
    registry.register(sentinel, pointer);
    return sentinel;
  }
  const refcounts = new Map();
  function __retain(pointer) {
    if (pointer) {
      const refcount = refcounts.get(pointer);
      if (refcount) refcounts.set(pointer, refcount + 1);
      else refcounts.set(exports.__pin(pointer), 1);
    }
    return pointer;
  }
  function __release(pointer) {
    if (pointer) {
      const refcount = refcounts.get(pointer);
      if (refcount === 1) exports.__unpin(pointer), refcounts.delete(pointer);
      else if (refcount) refcounts.set(pointer, refcount - 1);
      else throw Error(`invalid refcount '${refcount}' for reference '${pointer}'`);
    }
  }
  function __notnull() {
    throw TypeError("value must not be null");
  }
  let __dataview = new DataView(memory.buffer);
  function __getU8(pointer) {
    try {
      return __dataview.getUint8(pointer, true);
    } catch {
      __dataview = new DataView(memory.buffer);
      return __dataview.getUint8(pointer, true);
    }
  }
  function __getI32(pointer) {
    try {
      return __dataview.getInt32(pointer, true);
    } catch {
      __dataview = new DataView(memory.buffer);
      return __dataview.getInt32(pointer, true);
    }
  }
  function __getU32(pointer) {
    try {
      return __dataview.getUint32(pointer, true);
    } catch {
      __dataview = new DataView(memory.buffer);
      return __dataview.getUint32(pointer, true);
    }
  }
  return adaptedExports;
}


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
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
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!*************************!*\
  !*** ./adapter/emul.js ***!
  \*************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _orderlock_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./orderlock.js */ "./adapter/orderlock.js");
/* harmony import */ var _sync_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./sync.js */ "./adapter/sync.js");
/* harmony import */ var _gb_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../gb.js */ "./gb.js");
//import { instantiate } from '@assemblyscript/loader';




let mu;
let timestampLock;
let orderLock;
let multiPlay = false;

const width = 160;
const height = 144;
const canvasMargin = 16;
const canvasWidth = width + 2 * canvasMargin;
const canvasHeight = height + 2 * canvasMargin;

let ctx;

function callMain(flag) {
  self.postMessage({msg: flag});
}

let loadedData = null;

function hasSavedFile() {
  if(loadedData != null) {
    wasm.setLoadedData(loadedData);
  }
  return loadedData != null ? 1 : 0;
}

let wasm = null;

async function loadWasm() {   
  const response = await fetch('/gb.wasm');
  const bytes = await response.arrayBuffer();
  const result = await (0,_gb_js__WEBPACK_IMPORTED_MODULE_2__.instantiate)(bytes, { 
    env: {
      callMain,
      renderScreen,
      hasSavedFile,
      sync,
    }
  });
  return result;
}

self.onmessage = event => {
  const {msg, payload} = event.data;
  switch (msg) {
    case 'init':

      multiPlay = payload.multiPlay;

      mu = _sync_js__WEBPACK_IMPORTED_MODULE_1__.Mutex.connect(payload.mutex);
      timestampLock = new Int32Array(payload.timestampLockBuffer);

      orderLock = _orderlock_js__WEBPACK_IMPORTED_MODULE_0__.OrderLock.connect(payload.orderLock);

      const canvas = payload.canvas;
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      ctx = canvas.getContext('2d');
      
      load(payload.rom);
      break;
    case 'start':
      const current = performance.now();
      const travelTime = current - past;
      const leftDelayTime = delayGap - travelTime;

      setTimeout(() =>  update(), leftDelayTime);

      saveEmulLog(`delayGap - travelTime = ${delayGap.toFixed(3)} - ${travelTime.toFixed(3)} = ${leftDelayTime.toFixed(3)}`);
      /*
      if(delayGap <= 0) { // repay armotized delay by skipping the wait time
        //console.log("**** 1      : Gap1 is exceed 16.74");
        update();
        return;
      }

      if(leftDelayTime <= 0) { // repay armotized delay by skipping the wait time
        //console.log("****  2     : travel Time used all delayGap");
        update();
        return;
      }

      if(leftDelayTime > 4) {
        //console.log("****   3    : more than 4ms call SetTimeout ");
        setTimeout(() =>  update(), leftDelayTime);
        return;
      }

      //console.log("****    4   : left delay is less than and equal four. " + leftDelayTime.toFixed(3));
      update();
      */

      break;
    case 'play':
      play();
      break;
    case 'file':
      loadedData = payload.encryptData;
      break;
    case 'save':
      const saveDataDto = wasm.getSave();
      self.postMessage({msg: 'saveData', payload: {
        title: saveDataDto.title,
        encryptData: saveDataDto.encryptData
      }});
      break;
    case 'stop_multiplay':
      multiPlay = false;
      break;
    default:
  }
}

let imageData;
let renderCount = 0;
let lastMemorySize = 0;
let lastStackPointer = 0;
let lastHeapPointer = 0;

function checkMemoryGrowth() {
    const currentSize = wasm.getMemorySizeBytes();
    const currentStack = wasm.getStackPointer();
    const currentHeap = wasm.getHeapPointer();
    
    if (currentSize > lastMemorySize) {
        console.log(`>>>>>>>>>>>>>> Memory grew from ${lastMemorySize} to ${currentSize} bytes`);
    }
    
    if (currentStack !== lastStackPointer) {
        console.log(`Stack pointer changed from ${lastStackPointer} to ${currentStack}`);
    }
    
    if (currentHeap !== lastHeapPointer) {
        console.log(`Heap pointer changed from ${lastHeapPointer} to ${currentHeap}`);
    }
    
    lastMemorySize = currentSize;
    lastStackPointer = currentStack;
    lastHeapPointer = currentHeap;
}


function renderScreen() {
  /*
    checkMemoryGrowth(); // Check memory growth on each render
    const memSize = wasm.getMemorySize();
    console.log(`render ${wasm.getStackPointer()} ${wasm.getHeapPointer()} / ${wasm.getStatic()} ${wasm.getStack()} ${wasm.getHeap()} ${memSize} ${memSize << 16} -------- renderCount: ${renderCount++}`);
  */

    //console.log(`render ${wasm.memory.buffer.byteLength} ${imageData.data.byteOffset} ${imageData.data.buffer.byteLength} ${imageData.data.buffer.detached} ${pixelData.buffer.detached} ${renderCount++}`);
    
    try {
      if(frameRate == 0) {
        imageData = new ImageData(new Uint8ClampedArray(pixelData), canvasWidth, canvasHeight);
        ctx.putImageData(imageData, 0, 0);
      
        fps++;
        saveEmulLog("renderScreen");
      }
      frameRate = (frameRate + 1) % SPEED;
    } catch(error) {
     
      throw error;
      
      /*
      console.log(error);
      pixelData = new Uint8ClampedArray(wasm.memory.buffer, pixelPtr, size);
      imageData = new ImageData(pixelData, canvasWidth, canvasHeight);
      console.log(imageData.data);
      ctx.putImageData(imageData, 0, 0);
      second = true;
      */
      //throw error;
    }
}

function sendUint8ArrayToWasm(array) {
  // Allocate memory in WebAssembly
  const ptr = wasm.allocateMemory(array.length); // 1 is the id for Uint8Array
  
  // Create a view of the WebAssembly memory
  const wasmMemory = new Uint8Array(wasm.memory.buffer, ptr, array.length);
  
  // Copy the array data to WebAssembly memory
  wasmMemory.set(array);

  wasm.loadAndStart(ptr, array.length);

  wasm.release(ptr);

  wasm.setMultiPlay(multiPlay);
}

let next;
let pixelPtr;
let pixelData;
const size = canvasWidth * canvasHeight * 4; // Size in bytes

let joypadPtr;
let keyBuffer;

let sbPtr;
let sb;

let scPtr;
let sc;

let cycleSumPtr;
let cycleSumLocal;

let waitScPtr;
let waitSc;

let fpsInterval;

let serialLockPtr;
let serialLock;

let postLockPtr;
let postLock;

let cycleSumRecvPtr;
let cycleSumRecv;

let slowerPtr;
let slower;

let lockPtr;
let lock;

let interruptFlagPtr;
let interruptFlag;

let soundLeftPtr;
let soundRightPtr;
let soundLeft;
let soundRight;

const bufferSamples = 4096;
const soundBufferLen = bufferSamples * 8;

let filledPtr;
let filled;

async function load(rom) {
    wasm = await loadWasm();
    lastMemorySize = wasm.getMemorySizeBytes();
    lastStackPointer = wasm.getStackPointer();
    lastHeapPointer = wasm.getHeapPointer();
    
    console.log(`Initial memory state:
        Memory size: ${lastMemorySize}
        Stack pointer: ${lastStackPointer}
        Heap pointer: ${lastHeapPointer}`);
    
    sendUint8ArrayToWasm(rom);
    
    pixelPtr = wasm.getPixelsAddr();
    console.log(`pixelPtr ${pixelPtr}`);
    pixelData = new Uint8ClampedArray(wasm.memory.buffer, pixelPtr, size);
    //imageData = new ImageData(new Uint8ClampedArray(pixelData), canvasWidth, canvasHeight);

    joypadPtr = wasm.getJoyPadAddr();
    keyBuffer = new Uint8Array(wasm.memory.buffer, joypadPtr, 8);

    lockPtr = wasm.initLock();
    lock = new Int32Array(wasm.memory.buffer, lockPtr, 1);

    sbPtr = wasm.initSb();
    sb = new Int32Array(wasm.memory.buffer, sbPtr, 1);

    scPtr = wasm.initSc();
    sc = new Int32Array(wasm.memory.buffer, scPtr, 1);

    cycleSumPtr = wasm.initCycleSumLocal();
    cycleSumLocal = new Int32Array(wasm.memory.buffer, cycleSumPtr, 1);

    postLockPtr = wasm.initPostLock();
    postLock = new Int32Array(wasm.memory.buffer, postLockPtr, 1);

    cycleSumRecvPtr = wasm.initCycleSumRecv();
    cycleSumRecv = new Int32Array(wasm.memory.buffer, cycleSumRecvPtr, 1);

    slowerPtr = wasm.initSlower();
    slower = new Int32Array(wasm.memory.buffer, slowerPtr, 1);

    waitScPtr = wasm.initWaitSc();
    waitSc = new Int32Array(wasm.memory.buffer, waitScPtr, 1);

    serialLockPtr = wasm.getSerialLock();
    serialLock = new Int32Array(wasm.memory.buffer, serialLockPtr, 1);

    interruptFlagPtr = wasm.getInterruptFlag();
    interruptFlag = new Int32Array(wasm.memory.buffer, interruptFlagPtr, 1);

    soundLeftPtr = wasm.getLeftAudioBufferAddr();
    soundRightPtr = wasm.getRightAudioBufferAddr();

    soundLeft = new Float32Array(wasm.memory.buffer, soundLeftPtr, soundBufferLen);
    soundRight = new Float32Array(wasm.memory.buffer, soundRightPtr, soundBufferLen);

    filledPtr = wasm.getFilledBufferAddr();
    filled = new Int32Array(wasm.memory.buffer, filledPtr, 1);

    
    self.postMessage({msg:2, payload: {
      lock: { ptr: lockPtr, buffer: lock.buffer},
      sb: {ptr: sbPtr, buffer: sb.buffer},
      sc: {ptr: scPtr, buffer: sc.buffer},
      cycleSumLocal: {ptr: cycleSumPtr, buffer: cycleSumLocal.buffer},
      postLock : {ptr: postLockPtr, buffer: postLock.buffer},
      cycleSumRecv: {ptr: cycleSumRecvPtr, buffer: cycleSumRecv.buffer},
      slower: {ptr: slowerPtr, buffer: slower.buffer},
      waitSc: {ptr: waitScPtr, buffer: waitSc.buffer},
      serial: { ptr: serialLockPtr, buffer: serialLock.buffer},
      interruptFlag: {ptr: interruptFlagPtr, buffer: interruptFlag.buffer},
      // uint8array, size 8
      joypad: { ptr: joypadPtr, buffer: keyBuffer.buffer},
      soundLeft: { ptr: soundLeftPtr, buffer: soundLeft.buffer},
      soundRight: { ptr: soundRightPtr, buffer: soundRight.buffer},
      filled: { ptr: filledPtr, buffer: filled.buffer },
    }});
    
    checkMemoryGrowth();
    console.log(`----------------------------`);
}

function play() {
  next = performance.now();
  past = next;
  update();
  printOld = past;
  fpsInterval = setInterval(() => printFps(), 1000);
}


let fps = 0;
let isInitUpdate = true;
let firstNext = 0;
let printOld;

function printFps() {
  const current = performance.now();
  const setIntGap = (current - printOld).toFixed(0);

  self.postMessage({msg: 4, payload: fps + " " + setIntGap});
  //console.log(`fps:${fps}, ${setIntGap}`);
  /*
  const letter = fps + " " + Display.fps + " " + setIntGap;
  let isSame = true;
  if(fps !== Display.fps) {
    isSame = false; 
  } 
  //self.postMessage({msg: 'F', payload: letter, time:isSame});
  self.postMessage({msg: 'F', payload: fps, time:true});

  saveLog("%c FPS= " + letter, "background:cyan; color:black");
  saveLog("%c 1 sec= " + setIntGap, "background:cyan; color:red");
  Display.fps = 0;
  */
  printOld = current;
  fps = 0;
  updateCount = 0;

  if(isInitUpdate) {
    console.log("init");
    saveEmulLog("init");

    isInitUpdate = false;
    next = Math.floor((current-firstNext)/frameInterval) * frameInterval + firstNext;

    next += frameInterval;
    delayGap = next - current;
    past = current;

    
    self.postMessage({
      msg: 3
    });
    
    //setTimeout(() =>  update(), delayGap);
  }
}

const SPEED = 1;
const UPDATE_COUNT = 59 * SPEED;
const frameInterval = (17556 / 1048576) / SPEED * 1000;
let frameRate = 0;
let old;
let updateCount = 0;
let delayGap = 0;
let past;
let setFirstNext = false;


function saveEmulLog(...args) {
  //console.log(args.join(' '));
  const message = args.join(' ');
  const enterId = orderLock.getId();
  const paddedEnterId = enterId.toString().padStart(2, ' ');
  const line = "[    ] : " + paddedEnterId + " $ " + message;

  self.postMessage({
    msg: 'log',
    payload: line
  });
}

function sync() {
  if(multiPlay) {
      mu.lock();

      self.postMessage({
        msg: 'ts'
      });

      Atomics.store(timestampLock, 0, 1);
      Atomics.wait(timestampLock, 0, 1);
  }
}


function update() {
  const startTime = performance.now();
  const gap0 = startTime - past;
  saveEmulLog("[GAP0] {  e}__{s      }   = " + gap0.toFixed(3));

  wasm.update();

  updateCount++;

  if(!multiPlay) {
    Atomics.store(cycleSumLocal, 0, 0);
  }

  const current = performance.now();
  past = current;
  const gap1 = current - startTime;
  saveEmulLog("[GAP1]        {s_____e}   = " + gap1.toFixed(3));
   
  if(updateCount > UPDATE_COUNT) {
    isInitUpdate = true; // reset delay
  }

  if(!setFirstNext) {
    setFirstNext = true;
    firstNext = current;
    next = current;
    delayGap = frameInterval - gap1;
    isInitUpdate = false;
    setTimeout(update(), delayGap);
    return;
  }

  if(isInitUpdate) {
    return;
  }   

  next += frameInterval;//Display.frameInterval;
  delayGap = next - current;

  
  self.postMessage({ // recvQ
    msg: 3
  });
  
  //setTimeout(() =>  update(), delayGap);
}

})();

/******/ })()
;