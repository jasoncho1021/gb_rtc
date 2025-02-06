/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./public/dummylogger.js":
/*!*******************************!*\
  !*** ./public/dummylogger.js ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   customLog: () => (/* binding */ customLog)
/* harmony export */ });
function customLog(...args) {
    // Join the arguments into a single string
    //const message = args.join(' '); // You can customize the separator if needed
    //logs.push(message); // Store the log message
    //saveLine(message);
    // Optionally, log to the console as well
    //console.log(message); // This line can be removed if you don't want to log to the console
    //console.log(...args);
    //saveLine(message);
}

/***/ }),

/***/ "./public/js/emulworker.js":
/*!*********************************!*\
  !*** ./public/js/emulworker.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   saveEmulLog: () => (/* binding */ saveEmulLog)
/* harmony export */ });
/* harmony import */ var _gb_cpu_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./gb/cpu.js */ "./public/js/gb/cpu.js");
/* harmony import */ var _gb_display_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./gb/display.js */ "./public/js/gb/display.js");
/* harmony import */ var _sync_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./sync.js */ "./public/js/sync.js");
/* harmony import */ var _orderlock_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./orderlock.js */ "./public/js/orderlock.js");
/*
importScripts('gb/cartridge.js',
    'gb/cpu.js',
    'gb/display.js',
    'gb/joypad.js',
    'gb/rtc.js',
    'gb/serial.js',
    'gb/sound.js',
    'gb/timer.js',
    'sync.js',
    'orderlock.js',
  '../dummylogger.js');
*/


 // Adjust based on actual exports
 // Adjust based on actual exports


//const { Mutex } = self; 
//const { OrderLock } = self;

let delayGap = 0;
let timestampLock = 0;
let mu;
let orderLock;
const maxSize = 1024 * 1024 * 1000;

let sharedArray;
let sharedBuffer;
//let currentDataSize = 0; // Track the current size of data written

// Initialize TextEncoder and TextDecoder once
const txtEncoder = new TextEncoder();
const txtDecoder = new TextDecoder();

let sharedCurrentSizeBuffer;
let sharedCurrentSize;

function saveEmulLog(...args) {
  //saveLogImpl(...args);
  //console.log(args.join(' '));
  const message = args.join(' ');
  const enterId = orderLock.getId();
  const line = "[    ] : " + enterId + " $ " + message;

  self.postMessage({
    msg: 'log',
    payload: line,
    time: -1
  });
}

function saveLog(...args) {
  
}

function saveLogImpl(...args) {
  const enterId = orderLock.lock();
  //console.log("emul [GET LOCK]");
  const line = "[" + enterId + "] " + args.join(' ');
  
  let currentSize = Atomics.load(sharedCurrentSize, 0);
  const encodedLine = txtEncoder.encode(line + '\n'); // Add newline for separation
  const lineSize = encodedLine.length;

  // Check if there is enough space in the buffer
  if (currentSize + lineSize > maxSize) {
      console.log('Buffer is full. Cannot add more data.');
      orderLock.unLock();
      return false; // Indicate that the buffer is full
  }

  // Store the encoded line in the buffer atomically
  for (let i = 0; i < lineSize; i++) {
      Atomics.store(sharedArray, currentSize + i, encodedLine[i]);
  }

  // Update the current size atomically
  Atomics.add(new Int32Array(sharedBuffer), 0, lineSize); // Assuming the first 4 bytes of the buffer are used for currentSize
  //currentSize += lineSize; // Update the current size
  Atomics.add(sharedCurrentSize, 0, lineSize);

  orderLock.unLock();
  //console.log("emul [RELEASE LOCK]");
  return true; // Indicate success
}

self.onmessage = event => {
  const {msg, payload} = event.data;
  switch (msg) {
    case 'init':
      _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.canvas = payload.canvas;
      _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.canvas.width = _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.canvasWidth;
      _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.canvas.height = _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.canvasHeight;
      _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.ctx = _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.canvas.getContext('2d');
      timestampLock = new Int32Array(payload.networkTimingBuffer);
  
      mu = _sync_js__WEBPACK_IMPORTED_MODULE_2__.Mutex.connect(payload.smu);

      sharedBuffer = payload.buffer;
      sharedArray = new Uint8Array(sharedBuffer);

      sharedCurrentSizeBuffer = payload.currentSizeBuffer;
      sharedCurrentSize = new Int32Array(sharedCurrentSizeBuffer);

      orderLock = _orderlock_js__WEBPACK_IMPORTED_MODULE_3__.OrderLock.connect(payload.orderLock);

      loadAndStart(payload);
      break;
    case 'restart':
      const current = performance.now();
      const travelTime = current-past;
      const leftDelayTime = delayGap - travelTime;

      saveLog("delayGap     : ", delayGap.toFixed(3));
      saveLog("travelTime   : ", travelTime.toFixed(3));
      saveLog("leftDelayTime: ", leftDelayTime.toFixed(3));

      /*
      if(payload.isNextRecvQ) {
        saveLog("****0       : nextRecvQ is true");
        preStart();
        saveLog("****0       break");
        return;
      }
      */

      
      if(delayGap <= 0) { // repay armotized delay by skipping the wait time
        //console.log("**** 1      : Gap1 is exceed 16.74");
        preStart();
        saveLog("**** 1      break");
        return;
      }      
      
      if(leftDelayTime <= 0) { // repay armotized delay by skipping the wait time
        //console.log("****  2     : travel Time used all delayGap");
        preStart();
        saveLog("****  2     break");
        return;
      }

      
      if(leftDelayTime > 4) {
        //console.log("****   3    : more than 4ms call SetTimeout ");
        setTimeout(() =>  preStart(), leftDelayTime);
        saveLog("****   3    break");
        return;
      } 

      
      //console.log("****    4   : left delay is less than and equal four. " + leftDelayTime.toFixed(3));
      preStart();
      saveLog("****    4   break");
      

     //setTimeout(() =>  preStart(), leftDelayTime);
     //setTimeout(() =>  preStart(), delayGap);
      return;
    case 'start':
      noDelayUpdate();
      return;
    case 'stop':
      running = false;
      clearInterval(fpsInterval);
      return;
    default:
      //saveLog(event);
      console.log(event);
  }
};

let gb;
let cycles;
let next;
let paused = false;
let running = false;

let past;

let oldUpdateGap = 0;
let fps = 0;
let isInitUpdate = true;

let pastGap = 0;

let timestamp = 0;
let mainLock;
let tsIdx = 0;

function preStart() {
  self.postMessage({
    msg: 'T',
    payload: -1,
    time: -1
  });
}

let cpuCycles = 0;
const PERIOD = _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.cpuCyclesPerFrame/3;

function noDelayUpdate() {
  const startTime = performance.now();
  _gb_cpu_js__WEBPACK_IMPORTED_MODULE_0__.GameBoy.startTime = startTime;
  const gap0 = startTime - past;
  //saveLog("start time: ", startTime.toFixed(3));
  
  //console.log("%c [GAP0] {  e}__{s      }   = " + gap0.toFixed(3), "background:red; color:white")
  saveEmulLog("[GAP0] {  e}__{s      }   = " + gap0.toFixed(3));


    if (paused || !running) {
        return;
    }
    if (gb.cartridge.hasRTC) {
        gb.cartridge.rtc.updateTime();
    }

    let needHeadSync = true;

    while (cycles < _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.cpuCyclesPerFrame) {
        try {
          /*
              1 per gap
          */
          if(needHeadSync) {
            needHeadSync = false;
            tsIdx = (tsIdx + 1) % 10;

            mu.lock();

            self.postMessage({
              msg: 'ts',
              payload: tsIdx,
              time: -1
            });
            saveLog("ts request " + tsIdx);
            Atomics.store(timestampLock, 0, 1);
            saveLog("ts blocked " + tsIdx);
            Atomics.wait(timestampLock, 0, 1);
            saveLog("ts unblocked " + tsIdx);
          }

            cpuCycles = gb.cycle();
            cycles += cpuCycles;
            
            /*
              [TODO]
              if the user try to start 1p,
              this logic should be skipped

            
            timestamp += cpuCycles;
            if(timestamp >= PERIOD) {
              timestamp = timestamp - PERIOD;

              tsIdx = (tsIdx + 1) % 10;

              
              mu.lock();

              self.postMessage({
                msg: 'ts',
                payload: tsIdx,
                time: -1
              });
              saveLog("ts request " + tsIdx);
              Atomics.store(timestampLock, 0, 1);
              saveLog("ts blocked " + tsIdx);
              Atomics.wait(timestampLock, 0, 1);
              saveLog("ts unblocked " + tsIdx);
              
            }
            */
            
        } catch (error) {
            console.error(error);
            running = false;
            return;
        }
    }
    cycles -= _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.cpuCyclesPerFrame;
    saveLog("over cycles: ", cycles);

    fps++;


    const current = performance.now();
    past = current;
    const gap1 = current-startTime;
    //console.log("%c [GAP1]        {s_____e}   = " + gap1.toFixed(3), "background:green; color:white");
    saveEmulLog("[GAP1]        {s_____e}   = " + gap1.toFixed(3));


    if(fps > 59) {
      saveLog(fps + " fps over 59, reset old delay 0");
      isInitUpdate = true; // reset delay
    }
    
    /*
    if(isInitUpdate) {
      console.log("init");
      isInitUpdate = false;
      next = current;
      delayGap = Display.frameInterval - gap1;
    } else {

      // amortized
      next += Display.frameInterval; //next += 16.74 or 8.37
      delayGap = next - current;
    
                            // not amortized
                            /*
                            if((delayGap > 0) && (gap0 > delayGap)) {
                              delayGap = Display.frameInterval - (gap0 - delayGap) - gap1;
                            } else {
                              delayGap = Display.frameInterval - gap1;
                            }
                            */
    //}
    

    if(!setFirstNext) {
      setFirstNext = true;
      firstNext = current;
      next = current;
      delayGap = _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.frameInterval - gap1;
      isInitUpdate = false;
      setTimeout(noDelayUpdate, delayGap);
      return;
    }
  
    if(isInitUpdate) {
      console.log("init");
      isInitUpdate = false;
      next = Math.floor((current-firstNext)/_gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.frameInterval)*_gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.frameInterval + firstNext;
    }
     
    next += _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.frameInterval; //next += 16.74 or 8.37
    delayGap = next - current;


    self.postMessage({ // recvQ
      msg: 'M',
      payload: -1,
      time: -1
    });
}


function oldUpdate() {
  const startTime = performance.now();
    const gap0 = startTime - past;
    saveLog("%c [GAPx]    e}_ {s     e}   = " + pastGap.toFixed(3), "background:blue; color:white");
    saveLog("%c [GAP0] {  e}__{s      }   = " + gap0.toFixed(3), "background:red; color:white");
    if(pastGap > 0) {
        saveLog("%c [GAPr]    e} _{s     e}   = " + (gap0-pastGap).toFixed(3), "background:green; color:white");
    } else {
        saveLog("%c [GAPr]    e} _{s     e}   = " + (gap0).toFixed(3), "background:green; color:white");
    }

    if (paused || !running) {
        return;
    }
    if (gb.cartridge.hasRTC) {
        gb.cartridge.rtc.updateTime();
    }
    while (cycles < _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.cpuCyclesPerFrame) {
        try {
            cycles += gb.cycle();
        } catch (error) {
            console.error(error);
            running = false;
            return;
        }
    }
    cycles -= _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.cpuCyclesPerFrame;

    fps++;

    const current = performance.now();
    const gap1 = current-startTime;
    let nextGap;

    
    if(isInitUpdate) {
      isInitUpdate = false;
      next = current;
      nextGap = _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.frameInterval-gap1;
    } else {
      next += _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.frameInterval; //next += 16.74 or 8.37
      nextGap = next - current;
    }
    

    // origin
    //next += Display.frameInterval; //next += 16.74 or 8.37
    //nextGap = next - current;
    //


    saveLog("%c [GAP1]        {s_____e}   = " + gap1.toFixed(3), "background:orange; color:black");
    saveLog("%c [GAP4]        {s     e}___= " + nextGap.toFixed(3), "color:blue");

    past = current;

    pastGap = nextGap;
    
    setTimeout(oldUpdate, nextGap);
}

let lastTime;
function paint(callTime) {
  saveLog("%c [GAP$] {s__}___{e  }   = " + (callTime - lastTime).toFixed(3), "background:green; color:white");
  lastTime = callTime;

  /*
  const startTime = performance.now();
  const gap0 = startTime - past;
  saveLog("%c [GAP0] s}____{e    }   = " + gap0.toFixed(3), "background:red; color:white");
  */
  

  if (paused || !running) {
    return;
  }
  if (gb.cartridge.hasRTC) {
    saveLog("%c RTC " , "background:black; color:white");
    gb.cartridge.rtc.updateTime();
  }

  while (cycles < _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.cpuCyclesPerFrame) {
    try {
      cycles += gb.cycle();
    } catch (error) {
      console.error(error);
      running = false;
      return;
    }
  }
  cycles -= _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.cpuCyclesPerFrame;

  fps++;

  /*
  const current = performance.now();
  const gap1 = current - startTime;
  past = current;
  saveLog("%c [GAP1]       {s___e}   = " + gap1.toFixed(3), "background:orange; color:black");
  */
  

  requestAnimationFrame(paint);
}


function updateOG() {
  const startTime = performance.now();
  const gap0 = startTime - past;
  saveLog("%c [GAP0] s}____{e    }   = " + gap0.toFixed(3), "background:red; color:white");

  if (paused || !running) {
    return;
  }
  if (gb.cartridge.hasRTC) {
    gb.cartridge.rtc.updateTime();
  }

  while (cycles < _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.cpuCyclesPerFrame) {
    try {
      cycles += gb.cycle();
    } catch (error) {
      console.error(error);
      running = false;
      return;
    }
  }
  cycles -= _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.cpuCyclesPerFrame;

  fps++;






  /**
         'loadAndStart'   'setTimeout'
      next  : now,         now+16.74,         // ideal lap time
      before: now,   now+x            now+y,


     =========|=========|
      (     )   (    )
            <--       <--

      updateGap = next - current
     
   */
  /*
  const current = performance.now();
  const gap1 = current-startTime;
  let updateGap;
  if(isInitUpdate) {  // load ---3000ms--> 첫 update, 갭 벌어지는 것 보정
    isInitUpdate = false;
    next = current;
    updateGap = Display.frameInterval-gap1;
  } else {
    next += Display.frameInterval; // +16.74ms
    updateGap = next - current;
  }
  past = current;

  saveLog("%c [GAP1]       {s___e}   = " + gap1.toFixed(3), "background:orange; color:black");
  saveLog("%c [GAPu] s}    {    e}<--= " + updateGap.toFixed(3), "background:green; color:white");
  
  setTimeout(() => update(), updateGap);
*/



  /*
   const current = performance.now();
   const setTimeoutGap = current-past;
   past = current;
   const updateGap = Display.frameInterval - setTimeoutGap;

   saveLog("%c [GAP1]        {s-----e}   = " + (current-startTime).toFixed(3), "background:orange; color:black");
   saveLog("%c [GAP2] {  s}--{------e}   = "+ setTimeoutGap.toFixed(3), "background:yellow; color:black");
   saveLog("%c [GAP3} {  s--16.74---e}   = "+ updateGap.toFixed(3), "background:green; color:white");
   */



/**
 *   (       )                (      )
 * 
 *           _________.........______xxxxx
 * 
 *           <------->                       oldUpdateGap     
 *           <----------------->             gap0
 *                             <----->       gap1
 *           <----------------------->       gap2
 *                                   <--->   updateGap
 *                    <------->              realDelay
 */

  /**
   * 
   *                          if oldUpdateGap <= gap0
   *                               (    )    (     )
   *                                   <-->....
   *                                   <------>
   *                                updateGap = 16.74 - (gap0 - oldUpdateGap) - gap1;
   *                          else
   *                               (    )    (     )
   *                                   <-------->
   *                                   <------>
   *                                updateGap = 16.74 -         0             - gap1;
   * 
   * 
   *    if oldUpdateGap <= 0 (already over 16.74), then take 4ms gap0 as default delay of mine.
   * 
   */
  
  const current = performance.now();
  const gap1 = current - startTime;
  const gap2 = current - past;
  const realDelay = oldUpdateGap > gap0 ? 0 : gap0 - oldUpdateGap;
  
  let updateGap;
  if(isInitUpdate) {  // load ---3000ms--> 첫 update, 갭 벌어지는 것 보정
    isInitUpdate = false;
    updateGap = _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.frameInterval - gap1;
  } else {
    //updateGap = Display.frameInterval - gap2 + oldUpdateGap;  //Display.frameInterval - (gap0 - oldUpdateGap) - gap1;
    updateGap = _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.frameInterval - realDelay - gap1;
  }

  saveLog("%c [GAP1]       {s___e}   = " + gap1.toFixed(3), "background:orange; color:black");
  //saveLog("%c [GAP2] s}____{____e}   = " + gap2.toFixed(3), "background:yellow; color:black");
  saveLog("%c [GAP2] s}  __{    e}   = " + realDelay.toFixed(3), "background:yellow; color:black");
  saveLog("%c [GAP3] s}__  {    e}   = " + oldUpdateGap.toFixed(3), "background:green; color:white");
  saveLog("%c [GAP4] s}    {s   e}__ = " + updateGap.toFixed(3), "background:blue; color:white");

  if(updateGap < 0) {
    updateGap = 0;
  }
  oldUpdateGap = updateGap;
  past = current;


  setTimeout(() => update(), updateGap);
  


  /** 
      setInterval
  */
  /*
  const current = performance.now();
  const gap1 = current - startTime;
  past = current;
  saveLog("%c [GAP1]       {s___e}   = " + gap1.toFixed(3), "background:orange; color:black");
  */
  
  
}

let printOld;

function printFps() {
  const current = performance.now();

 /*
  save the int value to setIntGap
 */
  const setIntGap = (current - printOld).toFixed(0);
  const letter = fps + " " + _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.fps + " " + setIntGap;
  let isSame = true;
  if(fps !== _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.fps) {
    isSame = false; 
  } 
  self.postMessage({msg: 'F', payload: letter, time:isSame});

  saveLog("%c FPS= " + letter, "background:cyan; color:black");
  saveLog("%c 1 sec= " + setIntGap,
      "background:cyan; color:red");
  _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.fps = 0;
  fps = 0;
  printOld = current;
}

let fpsInterval;

function loadAndStart(payload) {
  let rom = payload.uInt8Array;
  gb = new _gb_cpu_js__WEBPACK_IMPORTED_MODULE_0__.GameBoy(payload.flagSharedBuffer,
      payload.sbSharedBuffer,
      payload.scSharedBuffer,
      payload.transferTriggerSharedBuffer,
      payload.useInternalClockSharedBuffer,
      payload.sharedBuffer,
      payload.timingBuffer,
      payload.waitScBuffer,
      payload.keySharedBuffer,
      payload.scDirtySharedBuffer,
      payload.scMonitorStartSharedBuffer,
      payload.soundLeftSab,
      payload.soundRightSab,
      payload.fillSab,
      payload.bufferLen);
  gb.setMessenger(self);
  try {
    gb.cartridge.load(rom);
    running = true;
    past = performance.now();
    cycles = 0;
    saveLog("load");

    next = past;

    //update();
    //oldUpdate();

    noDelayUpdate();

    //setInterval(() => update(), Display.frameInterval);

    //requestAnimationFrame(paint);

    printOld = past;
    fpsInterval = setInterval(() => printFps(), 1000);
  } catch (error) {
    console.error(error);
  }
}

let setFirstNext = false;
let firstNext = 0;

function update() {
  const startTime = performance.now();

  if (paused || !running) {
      return;
  }
  if (gb.cartridge.hasRTC) {
      gb.cartridge.rtc.updateTime();
  }
  while (cycles < _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.cpuCyclesPerFrame) {
      try {
          cycles += gb.cycle();
      } catch (error) {
          console.error(error);
          running = false;
          return;
      }
  }
  cycles -= _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.cpuCyclesPerFrame;
  const current = performance.now();
  
  fps++;

  if(fps > 59) {
    isInitUpdate = true; // reset delay
  }
  
  const gap1 = current-startTime;

  /**
   *   never init
   * 
   */
  isInitUpdate = false;

  
  if(isInitUpdate) {
    console.log("init");
    isInitUpdate = false;

    next = current;
    delayGap = _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.frameInterval - gap1;
  } else{
    next += _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.frameInterval; //next += 16.74 or 8.37
    delayGap = next - current;
  }
  

  /*
  if(!setFirstNext) {
    setFirstNext = true;
    firstNext = current;
    next = current;
    delayGap = Display.frameInterval - gap1;
    isInitUpdate = false;
    setTimeout(update, delayGap);
    return;
  }

  if(isInitUpdate) {
    console.log("init");
    isInitUpdate = false;
    next = Math.floor((current-firstNext)/Display.frameInterval)*Display.frameInterval + firstNext;
  }
  
  next += Display.frameInterval; //next += 16.74 or 8.37
  delayGap = next - current;
  */
  setTimeout(update, delayGap);
}

    /**
     *                                        next=current
     *                                         |-------|-------|
     *    |----g--|----g--|----g--|----g--|xxxxg--|-------|-------|
     */
    /**
     *  1. delayGap 이 벌어지는 걸(채무 늘어나는 것) 초기화하려고 한 로직?
     *     아니다. speed 줄이려고 만든 로직이다. 즉, delayGap 청산 하고 새로 시작.
     * 
     *  2. next 위치 초기화 하는 거랑 속도 제한이랑(fps > 59 로 측정) 무슨 상관인가?
     *     delayGap 청산 하고 새로 시작.
     *     
     *  3. delayGap 만 날려버리면 될텐데. next 기준점은 옮기지 않고.
     *     하지만 now() 와 next + 16.74*n 을 가지고 어떻게 지금 위치로 next + 16.74*x 복귀시키지?
     *     --> next -= 16.74*y
     *   
     *         next = firstNext + 16.74*y
     *         y = (now()-firstNext)/16.74
     *     
     *  4. 질주시켜도 delayGap 상환 다 안 되나? 아, fps 59(59번)으론 상환하기 부족하구나.
     *     
     *  5. sound.js에서 (this.nextPush - now) 갭 차이가 점점 커졌던거는 
     *     위의 next=current 를 반복 해주는 동안 점점 기준점이 단축되기 때문?
     */

/***/ }),

/***/ "./public/js/gb/cartridge.js":
/*!***********************************!*\
  !*** ./public/js/gb/cartridge.js ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Cartridge: () => (/* binding */ Cartridge)
/* harmony export */ });
class Cartridge {
    constructor(gb) {
        this.gb = gb;
    }

    readROM(address) {
        switch (this.cartridgeType) {
            case 0x00:
            case 0x08:
            case 0x09:
                return this.rom[address];
            case 0x01:
            case 0x02:
            case 0x03:
            case 0x05:
            case 0x06:
            case 0x11:
            case 0x12:
            case 0x13:
            case 0x0f:
            case 0x10:
            case 0x19:
            case 0x1a:
            case 0x1b:
            case 0x1c:
            case 0x1d:
            case 0x1e:
            case 0xff:
                switch (address >> 14) {
                    case 0:
                        return this.rom[address & 0x3fff];
                    case 1:
                        return this.rom[(this.romBankNumber << 14) | (address & 0x3fff)];
                }
        }
    }

    writeROM(address, value) {
        switch (this.cartridgeType) {
            case 0x00:
            case 0x08:
            case 0x09:
                break;
            case 0x01:
            case 0x02:
            case 0x03:
                switch (address >> 13) {
                    case 0:
                        if (this.hasRAM) {
                            this.ramEnable = (value & 0xf) == 0xa;
                        }
                        break;
                    case 1:
                        this.romBankNumber &= 0x60;
                        if ((value & 0x1f) == 0) {
                            value |= 0x1;
                        }
                        this.romBankNumber |= value & 0x1f;
                        this.romBankNumber %= (this.rom.length / 0x4000);
                        break;
                    case 2:
                        if (this.ramBankMode) {
                            if (this.hasRAM) {
                                this.ramBankNumber = value & 0x3;
                                this.ramBankNumber %= (this.ram.length / 0x2000);
                            }
                            this.romBankNumber &= 0x1f;
                        } else {
                            this.romBankNumber &= 0x1f;
                            this.romBankNumber |= (value & 0x3) << 5;
                            this.romBankNumber %= (this.rom.length / 0x4000);
                            if (this.hasRAM) {
                                this.ramBankNumber = 0;
                            }
                        }
                        break;
                    case 3:
                        this.ramBankMode = (value & 0x1) != 0;
                        break;
                }
                break;
            case 0x05:
            case 0x06:
                switch ((address >> 8) & 0x41) {
                    case 0:
                        this.ramEnable = (value & 0xf) == 0xa;
                        break;
                    case 1:
                        if ((value & 0xf) == 0) {
                            value |= 0x1;
                        }
                        this.romBankNumber = value & 0xf;
                        this.romBankNumber %= (this.rom.length / 0x4000);
                        break;
                }
                break;
            case 0x11:
            case 0x12:
            case 0x13:
            case 0x0f:
            case 0x10:
                switch (address >> 13) {
                    case 0:
                        if (this.hasRAM) {
                            this.ramEnable = (value & 0xf) == 0xa;
                        }
                        break;
                    case 1:
                        if ((value & 0x7f) == 0) {
                            value |= 0x1;
                        }
                        this.romBankNumber = value & 0x7f;
                        this.romBankNumber %= (this.rom.length / 0x4000);
                        break;
                    case 2:
                        switch (value) {
                            case 0x00:
                            case 0x01:
                            case 0x02:
                            case 0x03:
                                if (this.hasRAM) {
                                    this.ramBankNumber = value;
                                    this.ramBankNumber %= (this.ram.length / 0x2000);
                                }
                                break;
                            case 0x08:
                            case 0x09:
                            case 0x0a:
                            case 0x0b:
                            case 0x0c:
                                if (this.hasRTC) {
                                    this.ramBankNumber = value;
                                }
                                break;
                        }
                        break;
                    case 3:
                        if (this.hasRTC) {
                            this.rtc.latch = value;
                        }
                        break;
                }
                break;
            case 0x19:
            case 0x1a:
            case 0x1b:
            case 0x1c:
            case 0x1d:
            case 0x1e:
                switch (address >> 12) {
                    case 0:
                    case 1:
                        if (this.hasRAM) {
                            this.ramEnable = (value & 0xf) == 0xa;
                        }
                        break;
                    case 2:
                        this.romBankNumber &= 0x100;
                        this.romBankNumber |= value;
                        this.romBankNumber %= (this.rom.length / 0x4000);
                        break;
                    case 3:
                        this.romBankNumber &= 0xff;
                        this.romBankNumber |= (value & 0x1) << 8;
                        this.romBankNumber %= (this.rom.length / 0x4000);
                        break;
                    case 4:
                    case 5:
                        if (this.hasRAM) {
                            this.ramBankNumber = value & 0xf;
                            this.ramBankNumber %= (this.ram.length / 0x2000);
                        }
                        break;
                }
                break;
            case 0xff:
                switch (address >> 13) {
                    case 0:
                        this.irSelect = value == 0xe;
                        break;
                    case 1:
                        this.romBankNumber = value & 0x3f;
                        this.romBankNumber %= (this.rom.length / 0x4000);
                        break;
                    case 2:
                        this.ramBankNumber = value & 0x3;
                        this.ramBankNumber %= (this.ram.length / 0x2000);
                        break;
                }
                break;
        }
    }

    readRAM(address) {
        if (this.ramEnable) {
            switch (this.cartridgeType) {
                case 0x00:
                    break;
                case 0x08:
                case 0x09:
                    return this.ram[address];
                case 0x01:
                    break;
                case 0x02:
                case 0x03:
                    return this.ram[(this.ramBankNumber << 13) | address];
                case 0x05:
                case 0x06:
                    return 0xf0 | this.ram[address & 0x1ff];
                case 0x11:
                    break;
                case 0x12:
                case 0x13:
                case 0x0f:
                case 0x10:
                    switch (this.ramBankNumber) {
                        case 0x00:
                        case 0x01:
                        case 0x02:
                        case 0x03:
                            return this.ram[(this.ramBankNumber << 13) | address];
                        case 0x08:
                            return this.rtc.s;
                        case 0x09:
                            return this.rtc.m;
                        case 0x0a:
                            return this.rtc.h;
                        case 0x0b:
                            return this.rtc.dl;
                        case 0x0c:
                            return this.rtc.dh;
                    }
                    break;
                case 0x19:
                case 0x1a:
                case 0x1b:
                case 0x1c:
                case 0x1d:
                case 0x1e:
                    return this.ram[(this.ramBankNumber << 13) | address];
                case 0xff:
                    if (this.irSelect) {
                        return this.irOn ? 0xc0 : 0xff;
                    } else {
                        return this.ram[(this.ramBankNumber << 13) | address];
                    }
            }
        }
        return 0xff;
    }

    writeRAM(address, value) {
        if (this.ramEnable) {
            switch (this.cartridgeType) {
                case 0x00:
                    break;
                case 0x08:
                case 0x09:
                    this.ram[address] = value;
                    break;
                case 0x01:
                    break;
                case 0x02:
                case 0x03:
                    this.ram[(this.ramBankNumber << 13) | address] = value;
                    break;
                case 0x05:
                case 0x06:
                    this.ram[address & 0x1ff] = value & 0xf;
                    break;
                case 0x11:
                    break;
                case 0x12:
                case 0x13:
                case 0x0f:
                case 0x10:
                    switch (this.ramBankNumber) {
                        case 0x00:
                        case 0x01:
                        case 0x02:
                        case 0x03:
                            this.ram[(this.ramBankNumber << 13) | address] = value;
                            break;
                        case 0x08:
                            this.rtc.s = value;
                            break;
                        case 0x09:
                            this.rtc.m = value;
                            break;
                        case 0x0a:
                            this.rtc.h = value;
                            break;
                        case 0x0b:
                            this.rtc.dl = value;
                            break;
                        case 0x0c:
                            this.rtc.dh = value;
                            break;
                    }
                    break;
                case 0x19:
                case 0x1a:
                case 0x1b:
                case 0x1c:
                case 0x1d:
                case 0x1e:
                    this.ram[(this.ramBankNumber << 13) | address] = value;
                    break;
                case 0xff:
                    if (this.irSelect) {
                        this.irOn = (value & 0x1) != 0;
                    } else {
                        this.ram[(this.ramBankNumber << 13) | address] = value;
                    }
                    break;
            }
        }
    }

    load(file) {
        this.title = new TextDecoder('ascii').decode(file.slice(0x134, 0x144));

        const cgb = file[0x143];
        this.gb.cgb = (cgb & 0x80) != 0;
        this.gb.a = cgb ? 0x11 : 0x01;

        this.cartridgeType = file[0x147];
        switch (this.cartridgeType) {
            case 0x09:
                this.hasBattery = true;
            case 0x08:
                this.ramEnable = true;
                this.hasRAM = true;
            case 0x00:
                this.rom = file;
                break;
            case 0x03:
                this.hasBattery = true;
            case 0x02:
                this.ramEnable = false;
                this.ramBankMode = false;
                this.hasRAM = true;
            case 0x01:
                this.rom = file;
                this.romBankNumber = 1;
                break;
            case 0x06:
                this.hasBattery = true;
            case 0x05:
                this.rom = file;
                this.romBankNumber = 1;
                this.ram = new Uint8Array(0x200);
                this.ramEnable = false;
                this.hasRAM = true;
                break;
            case 0x10:
                this.hasRAM = true;
            case 0x0f:
                this.rom = file;
                this.romBankNumber = 1;
                this.ramEnable = false;
                this.hasBattery = true;
                this.hasRTC = true;
                break;
            case 0x13:
                this.hasBattery = true;
            case 0x12:
                this.ramEnable = false;
                this.hasRAM = true;
            case 0x11:
                this.rom = file;
                this.romBankNumber = 1;
                break;
            case 0x1e:
            case 0x1b:
                this.hasBattery = true;
            case 0x1d:
            case 0x1a:
                this.ramEnable = false;
                this.hasRAM = true;
            case 0x1c:
            case 0x19:
                this.rom = file;
                this.romBankNumber = 1;
                break;
            case 0xff:
                this.rom = file;
                this.romBankNumber = 1;
                this.ramEnable = true;
                this.hasRAM = true;
                this.hasBattery = true;
                break;
            default:
                throw 'unknown cartridge type: 0x' + this.cartridgeType.toString(16);
        }

        const romSize = 32768 << file[0x148];
        if (file.length != romSize) {
            throw 'wrong file size';
        }

        const ramSize = file[0x149];
        if (this.hasRAM) {
            /**
             * this cartridge type
             * does not directly access localStorage from webworker
             */
            /*
            if (this.hasBattery && this.title in localStorage) {
                this.ram = new Uint8Array(localStorage[this.title].split(',').map(parseFloat));
            } else {
             */
                switch (ramSize) {
                    case 0x00:
                        break;
                    case 0x02:
                        this.ram = new Uint8Array(0x2000);
                        break;
                    case 0x03:
                        this.ram = new Uint8Array(0x8000);
                        break;
                    case 0x04:
                        this.ram = new Uint8Array(0x20000);
                        break;
                    case 0x05:
                        this.ram = new Uint8Array(0x10000);
                        break;
                    default:
                        throw 'unknown RAM size: 0x' + ramSize.toString(16);
                }
            //}
        }
        if (this.hasRTC) {
            if (this.hasBattery && (this.title + 'TIME') in localStorage) {
                this.rtc = new RTC();
                Object.assign(this.rtc, JSON.parse(localStorage[this.title + 'TIME']));
            } else {
                this.rtc = new RTC();
            }
        }
    }

    save() {
        if (this.hasRAM && this.hasBattery) {
            localStorage[this.title] = this.ram;
        }
        if (this.hasRTC && this.hasBattery) {
            localStorage[this.title + 'TIME'] = JSON.stringify(this.rtc);
        }
    }
}


/***/ }),

/***/ "./public/js/gb/cpu.js":
/*!*****************************!*\
  !*** ./public/js/gb/cpu.js ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   GameBoy: () => (/* binding */ GameBoy)
/* harmony export */ });
/* harmony import */ var _cartridge_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./cartridge.js */ "./public/js/gb/cartridge.js");
/* harmony import */ var _display_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./display.js */ "./public/js/gb/display.js");
/* harmony import */ var _joypad_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./joypad.js */ "./public/js/gb/joypad.js");
/* harmony import */ var _serial_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./serial.js */ "./public/js/gb/serial.js");
/* harmony import */ var _sound_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./sound.js */ "./public/js/gb/sound.js");
/* harmony import */ var _timer_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./timer.js */ "./public/js/gb/timer.js");
/* harmony import */ var _dummylogger_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../../dummylogger.js */ "./public/dummylogger.js");
/* harmony import */ var _emulworker_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../emulworker.js */ "./public/js/emulworker.js");
 // Adjust the import based on the actual exports





 // Adjust based on actual exports


class GameBoy {
  constructor(flagSharedBuffer, sbSharedBuffer, scSharedBuffer,
      transferTriggerSharedBuffer,
      useInternalClockSharedBuffer,
      sharedBuffer,
      timingBuffer,
      waitScBuffer,
      keySharedBuffer,
      scDirtySharedBuffer,
      scMonitorStartSharedBuffer,
      soundLeftSab,
      soundRightSab,
      fillSab,
      bufferLen) {
    this.display = new _display_js__WEBPACK_IMPORTED_MODULE_1__.Display(this);
    this.timer = new _timer_js__WEBPACK_IMPORTED_MODULE_5__.Timer(this);
    this.joypad = new _joypad_js__WEBPACK_IMPORTED_MODULE_2__.Joypad(this, keySharedBuffer);
    this.cartridge = new _cartridge_js__WEBPACK_IMPORTED_MODULE_0__.Cartridge(this);
    this.sound = new _sound_js__WEBPACK_IMPORTED_MODULE_4__.Sound(this, soundLeftSab, soundRightSab, fillSab, bufferLen);
    this.serial = new _serial_js__WEBPACK_IMPORTED_MODULE_3__.Serial(this, sbSharedBuffer, scSharedBuffer,
        transferTriggerSharedBuffer,
        useInternalClockSharedBuffer, sharedBuffer);

    this.a = 0;
    this.fz = false;
    this.fn = false;
    this.fh = false;
    this.fc = false;
    this.b = 0;
    this.c = 0;
    this.d = 0;
    this.e = 0;
    this.h = 0;
    this.l = 0;
    this._pc = 0x0100;
    this._sp = 0xfffe;

    this.ime = false;

    this.halt = false;

    //this._if = 0;
    this._if = new Int32Array(flagSharedBuffer);

    this._ie = 0;

    this._svbk = 0;

    this.doubleSpeed = false;
    this.speedTrigger = false;

    this.irReadEnable = 0;
    this.irOn = false;

    this.wram = new Uint8Array(0x8000);
    this.hram = new Uint8Array(0x7f);

    this.cgb = false;
    this.cycles = 0;

    this._waitForIO = false;

    this._timing = new Int32Array(timingBuffer);

    this._messenger = null;

    this._lock = new Int32Array(sharedBuffer);

    this._waitForSc = new Int32Array(waitScBuffer);

    this._scDirty = new Int32Array(scDirtySharedBuffer);

    this._scMonitor = new Int32Array(scMonitorStartSharedBuffer);
  }

  get waitForIO() {
    return this._waitForIO;
  }

  set waitForIO(value) {
    this._waitForIO = value;
  }

  get timing() {
    return this._timing;
  }

  get f() {
    return (this.fz << 7) | (this.fn << 6) | (this.fh << 5) | (this.fc << 4);
  }

  set f(value) {
    this.fz = (value & 0x80) != 0;
    this.fn = (value & 0x40) != 0;
    this.fh = (value & 0x20) != 0;
    this.fc = (value & 0x10) != 0;
  }

  get bc() {
    return (this.b << 8) | this.c;
  }

  get de() {
    return (this.d << 8) | this.e;
  }

  get hl() {
    return (this.h << 8) | this.l;
  }

  get sp() {
    return this._sp;
  }

  get sph() {
    return this._sp >> 8;
  }

  get spl() {
    return this._sp & 0xff;
  }

  get pc() {
    return this._pc;
  }

  get pch() {
    return this._pc >> 8;
  }

  get pcl() {
    return this._pc & 0xff;
  }

  set bc(value) {
    this.b = (value >> 8) & 0xff;
    this.c = value & 0xff;
  }

  set de(value) {
    this.d = (value >> 8) & 0xff;
    this.e = value & 0xff;
  }

  set hl(value) {
    this.h = (value >> 8) & 0xff;
    this.l = value & 0xff;
  }

  set sp(value) {
    this._sp = value & 0xffff;
  }

  set pc(value) {
    this._pc = value & 0xffff;
  }

  get svbk() {
    if (!this.cgb) {
      return 0xff;
    }
    return 0xf8 | this._svbk;
  }

  set svbk(value) {
    if (!this.cgb) {
      return;
    }
    this._svbk = value & 0x7;
  }

  get key1() {
    if (!this.cgb) {
      return 0xff;
    }
    return 0x7e | (this.doubleSpeed << 7) | this.speedTrigger;
  }

  set key1(value) {
    if (!this.cgb) {
      return;
    }
    this.speedTrigger = (value & 0x1) != 0;
  }

  get rp() {
    if (!this.cgb) {
      return 0xff;
    }
    return 0x3c | (this.irReadEnable << 6) | (!(this.irReadEnable && this.irOn)
        << 1) | this.irOn;
  }

  set rp(value) {
    if (!this.cgb) {
      return;
    }
    this.irReadEnable = (value & 0xc0) >> 6;
    this.irOn = (value & 0x1) != 0;
  }

  get if() {
    //return 0xe0 | this._if[0];
    return 0xe0 | Atomics.load(this._if, 0);
  }

  set if(value) {
    //this._if[0] = value & GameBoy.interrupts;
    //Atomics.store(this._if, 0, value & GameBoy.interrupts);
    Atomics.or(this._if, 0, value & GameBoy.interrupts);
  }

  get ie() {
    return this._ie;
  }

  set ie(value) {
    this._ie = value & GameBoy.interrupts;
  }

  setMessenger(messenger) {
    this._messenger = messenger;
    this.serial.messenger = messenger;
    this.sound.messenger = messenger;
  }

  requestInterrupt(interrupt) {
    //this._if[0] |= interrupt;
    Atomics.or(this._if, 0, interrupt);
  }

  clearInterrupt(interrupt) {
    //this._if[0] &= ~interrupt;
    Atomics.and(this._if, 0, ~interrupt);
  }

  callInterrupt(address) {
    this.writeAddress(--this.sp, this.pch);
    this.writeAddress(--this.sp, this.pcl);
    this.pc = address;
  }

  readWRAM(address) {
    switch (address >> 12) {
      case 0:
        return this.wram[address];
      case 1:
        return this.wram[((this._svbk == 0 ? 1 : this._svbk) << 12) | (address
            & 0xfff)];
    }
  }

  writeWRAM(address, value) {
    switch (address >> 12) {
      case 0:
        this.wram[address] = value;
        break;
      case 1:
        this.wram[((this._svbk == 0 ? 1 : this._svbk) << 12) | (address
            & 0xfff)] = value;
        break;
    }
  }

  readAddress(address) {
    switch (address >> 13) {
      case 0x0:
      case 0x1:
      case 0x2:
      case 0x3:
        return this.cartridge.readROM(address & 0x7fff);
      case 0x4:
        return this.display.readVRAM(address & 0x1fff);
      case 0x5:
        return this.cartridge.readRAM(address & 0x1fff);
      case 0x6:
        return this.readWRAM(address & 0x1fff);
      case 0x7:
        if (address <= 0xfdff) {
          return this.readWRAM(address & 0x1fff);
        } else if (address <= 0xfe9f) {
          return this.display.oam[address & 0xff];
        } else if (address <= 0xfeff) {
          return 0xff;
        } else if (address <= 0xff7f) {
          if (address >= 0xff10 && address <= 0xff3f) {
            return this.sound.readAddress(address & 0xff);
          } else {
            switch (address & 0xff) {
              case 0x00:
                return this.joypad.p1;
              case 0x01:
                //customLog("[get sb by cpu] ");
                return this.serial.sb;
              case 0x02:
                //saveEmulLog("read ff02: " + this.serial.sc);
                //customLog("[get sc by cpu] ");
                return this.serial.sc;
              case 0x04:
                return this.timer.div;
              case 0x05:
                return this.timer.tima;
              case 0x06:
                return this.timer.tma;
              case 0x07:
                return this.timer.tac;
              case 0x0f:
                return this.if;
              case 0x40:
                return this.display.lcdc;
              case 0x41:
                return this.display.stat;
              case 0x42:
                return this.display.scy;
              case 0x43:
                return this.display.scx;
              case 0x44:
                return this.display.ly;
              case 0x45:
                return this.display.lyc;
              case 0x47:
                return this.display.bgp;
              case 0x48:
                return this.display.obp0;
              case 0x49:
                return this.display.obp1;
              case 0x4a:
                return this.display.wy;
              case 0x4b:
                return this.display.wx;
              case 0x4d:
                //saveEmulLog("read ff4d: " + this.key1);
                return this.key1;
              case 0x4f:
                return this.display.vbk;
              case 0x55:
                return this.display.hdma5;
              case 0x56:
                return this.rp;
              case 0x68:
                return this.display.bcps;
              case 0x69:
                return this.display.bcpd;
              case 0x6a:
                return this.display.ocps;
              case 0x6b:
                return this.display.ocpd;
              case 0x70:
                return this.svbk;
              default:
                return 0xff;
            }
          }
        } else if (address <= 0xfffe) {
          return this.hram[address & 0x7f];
        } else {
          return this.ie;
        }
    }
  }

  writeAddress(address, value) {
    switch (address >> 13) {
      case 0x0:
      case 0x1:
      case 0x2:
      case 0x3:
        this.cartridge.writeROM(address & 0x7fff, value);
        break;
      case 0x4:
        this.display.writeVRAM(address & 0x1fff, value);
        break;
      case 0x5:
        this.cartridge.writeRAM(address & 0x1fff, value);
        break;
      case 0x6:
        this.writeWRAM(address & 0x1fff, value);
        break;
      case 0x7:
        if (address <= 0xfdff) {
          this.writeWRAM(address & 0x1fff, value);
        } else if (address <= 0xfe9f) {
          this.display.oam[address & 0xff] = value;
        } else if (address <= 0xfeff) {

        } else if (address <= 0xff7f) {
          if (address >= 0xff10 && address <= 0xff3f) {
            this.sound.writeAddress(address & 0xff, value);
          } else {
            switch (address & 0xff) {
              case 0x00:
                this.joypad.p1 = value;
                break;
              case 0x01:
                //customLog("[set sb by cpu] ");
                this.serial.sb = value;
                break;
              case 0x02:
                //saveEmulLog("ff02: " + value);
                //customLog("[set sc by cpu] ");
                this.serial.sc = value;

                if ((value | 0x7E) === 0xFE) {
                  Atomics.store(this._waitForSc, 0, 1);
                  (0,_dummylogger_js__WEBPACK_IMPORTED_MODULE_6__.customLog)("update sc ", value);

                  self.postMessage({msg: 'sc', payload: -1, time:-1});
                  /*
                  if(Atomics.load(this._scDirty, 0) === 1) {
                    //Atomics.store(this._lock, 0, 1);
                    //Atomics.wait(this._lock, 0, 1); // Wait until lock is changed to 0
                  }
                   */
                }

                break;
              case 0x04:
                this.timer.div = value;
                break;
              case 0x05:
                this.timer.tima = value;
                break;
              case 0x06:
                this.timer.tma = value;
                break;
              case 0x07:
                this.timer.tac = value;
                break;
              case 0x0f:
                this.if = value;
                break;
              case 0x40:
                this.display.lcdc = value;
                break;
              case 0x41:
                this.display.stat = value;
                break;
              case 0x42:
                this.display.scy = value;
                break;
              case 0x43:
                this.display.scx = value;
                break;
              case 0x45:
                this.display.lyc = value;
                break;
              case 0x46:
                this.display.dma = value;
                break;
              case 0x47:
                this.display.bgp = value;
                break;
              case 0x48:
                this.display.obp0 = value;
                break;
              case 0x49:
                this.display.obp1 = value;
                break;
              case 0x4a:
                this.display.wy = value;
                break;
              case 0x4b:
                this.display.wx = value;
                break;
              case 0x4d:
                //saveEmulLog("ff4d: " + value);
                this.key1 = value;
                break;
              case 0x4f:
                this.display.vbk = value;
                break;
              case 0x51:
                this.display.hdma1 = value;
                break;
              case 0x52:
                this.display.hdma2 = value;
                break;
              case 0x53:
                this.display.hdma3 = value;
                break;
              case 0x54:
                this.display.hdma4 = value;
                break;
              case 0x55:
                this.display.hdma5 = value;
                break;
              case 0x56:
                this.rp = value;
                break;
              case 0x68:
                this.display.bcps = value;
                break;
              case 0x69:
                this.display.bcpd = value;
                break;
              case 0x6a:
                this.display.ocps = value;
                break;
              case 0x6b:
                this.display.ocpd = value;
                break;
              case 0x70:
                this.svbk = value;
                break;
              default:
                break;
            }
          }
        } else if (address <= 0xfffe) {
          this.hram[address & 0x7f] = value;
        } else {
          this.ie = value;
        }
        break;
    }
  }

  readRegister(register) {
    switch (register) {
      case 0:
        return this.b;
      case 1:
        return this.c;
      case 2:
        return this.d;
      case 3:
        return this.e;
      case 4:
        return this.h;
      case 5:
        return this.l;
      case 6:
        return this.readAddress(this.hl);
      case 7:
        return this.a;
    }
  }

  writeRegister(register, value) {
    switch (register) {
      case 0:
        this.b = value;
        break;
      case 1:
        this.c = value;
        break;
      case 2:
        this.d = value;
        break;
      case 3:
        this.e = value;
        break;
      case 4:
        this.h = value;
        break;
      case 5:
        this.l = value;
        break;
      case 6:
        this.writeAddress(this.hl, value);
        break;
      case 7:
        this.a = value;
        break;
    }
  }

  readDoubleRegisterIndirect(register) {
    switch (register) {
      case 0:
        return this.readAddress(this.bc);
      case 1:
        return this.readAddress(this.de);
      case 2:
        return this.readAddress(this.hl++);
      case 3:
        return this.readAddress(this.hl--);
    }
  }

  writeDoubleRegisterIndirect(register, value) {
    switch (register) {
      case 0:
        this.writeAddress(this.bc, value);
        break;
      case 1:
        this.writeAddress(this.de, value);
        break;
      case 2:
        this.writeAddress(this.hl++, value);
        break;
      case 3:
        this.writeAddress(this.hl--, value);
        break;
    }
  }

  readDoubleRegister(register) {
    switch (register) {
      case 0:
        return this.bc;
      case 1:
        return this.de;
      case 2:
        return this.hl;
      case 3:
        return this.sp;
    }
  }

  writeDoubleRegister(register, value) {
    switch (register) {
      case 0:
        this.bc = value;
        break;
      case 1:
        this.de = value;
        break;
      case 2:
        this.hl = value;
        break;
      case 3:
        this.sp = value;
        break;
    }
  }

  popDoubleRegister(register) {
    switch (register) {
      case 0:
        this.c = this.readAddress(this.sp++);
        this.b = this.readAddress(this.sp++);
        break;
      case 1:
        this.e = this.readAddress(this.sp++);
        this.d = this.readAddress(this.sp++);
        break;
      case 2:
        this.l = this.readAddress(this.sp++);
        this.h = this.readAddress(this.sp++);
        break;
      case 3:
        this.f = this.readAddress(this.sp++);
        this.a = this.readAddress(this.sp++);
        break;
    }
  }

  pushDoubleRegister(register) {
    switch (register) {
      case 0:
        this.writeAddress(--this.sp, this.b);
        this.writeAddress(--this.sp, this.c);
        break;
      case 1:
        this.writeAddress(--this.sp, this.d);
        this.writeAddress(--this.sp, this.e);
        break;
      case 2:
        this.writeAddress(--this.sp, this.h);
        this.writeAddress(--this.sp, this.l);
        break;
      case 3:
        this.writeAddress(--this.sp, this.a);
        this.writeAddress(--this.sp, this.f);
        break;
    }
  }

  readCondition(condition) {
    switch (condition) {
      case 0:
        return !this.fz;
      case 1:
        return this.fz;
      case 2:
        return !this.fc;
      case 3:
        return this.fc;
    }
  }

  runHdma() {
    this.writeAddress(0x8000 | this.display.hdmaDst++,
        this.readAddress(this.display.hdmaSrc++));
    if ((this.display.hdmaDst & 0xf) == 0) {
      this.display.hdmaCounter--;
      if (this.display.hdmaCounter == 0) {
        this.display.hdmaOn = false;
        this.display.hblankHdmaOn = false;
        this.display.hdmaTrigger = false;
      }
      if (this.display.hblankHdmaOn) {
        this.display.hdmaOn = false;
      }
    }
  }

  cycle() {

    Atomics.wait(this._lock, 0, 1); // Wait until lock is changed to 0

    //Atomics.add(this._timing, 0, 1);

    let cycles = 0;
    if ((this.ime || this.halt) && (this.ie & this.if) != 0) {
      this.halt = false;
      if (this.ime) {
        this.ime = false;
        if ((this.ie & this.if & GameBoy.vblankInterrupt) != 0) {
          this.clearInterrupt(GameBoy.vblankInterrupt);
          this.callInterrupt(0x0040);
        } else if ((this.ie & this.if & GameBoy.statInterrupt) != 0) {
          this.clearInterrupt(GameBoy.statInterrupt);
          this.callInterrupt(0x0048);
        } else if ((this.ie & this.if & GameBoy.timerInterrupt) != 0) {
          this.clearInterrupt(GameBoy.timerInterrupt);
          this.callInterrupt(0x0050);
        } else if ((this.ie & this.if & GameBoy.serialInterrupt) != 0) {
          this.clearInterrupt(GameBoy.serialInterrupt);
          this.callInterrupt(0x0058);
        } else if ((this.ie & this.if & GameBoy.joypadInterrupt) != 0) {
          this.clearInterrupt(GameBoy.joypadInterrupt);
          this.callInterrupt(0x0060);
        }
        cycles += 5;
      }
    } else {
      cycles += (this.halt || this.display.hdmaOn) ? 1 : this.decode();
    }

    let hardwareCycles = cycles; // cycles / (this.doubleSpeed ? 2 : 1);  왜 안 해주는지?  아래에서 display,sound 를 /2 만큼 느리게 돌려서 timer, serial을 상대적으로 빠르게 함.
    while (hardwareCycles > 0) {
      this.timer.cycle();
      this.serial.cycle();
      hardwareCycles--;
    }

    this.cycles += cycles / (this.doubleSpeed ? 2 : 1); // /2 되면 절반만 도네?
    while (this.cycles > 0) {
      if (this.display.hdmaOn) {
        this.runHdma();
      }
      this.display.cycle();
      this.sound.cycle();
      this.cycles--;
    }

    if (this.display.hdmaTrigger) {
      this.display.hdmaTrigger = false;
      this.display.hdmaOn = true;
    }

    return cycles / (this.doubleSpeed ? 2 : 1);
  }

  decode() {
    const instr = this.readAddress(this.pc++);
    let cycles = GameBoy.instrCycles[instr];
    const quad = instr >> 6, op1 = (instr & 0x3f) >> 3, op2 = instr & 0x7;
    if (quad === 0) {
      if (op2 == 6) {
        // LD r, n
        const imm = this.readAddress(this.pc++);
        this.writeRegister(op1, imm);
      } else if (op2 == 2) {
        if ((op1 & 0x1) != 0) {
          // LD A, (rr)
          this.a = this.readDoubleRegisterIndirect(op1 >> 1);
        } else {
          // LD (rr), A
          this.writeDoubleRegisterIndirect(op1 >> 1, this.a);
        }
      } else if ((op1 & 0x1) == 0 && op2 == 1) {
        // LD dd, nn
        const imm1 = this.readAddress(this.pc++);
        const imm2 = this.readAddress(this.pc++);
        this.writeDoubleRegister(op1 >> 1, (imm2 << 8) | imm1);
      } else if (op1 == 1 && op2 == 0) {
        // LD (nn), SP
        const imm1 = this.readAddress(this.pc++);
        const imm2 = this.readAddress(this.pc++);
        let address = (imm2 << 8) | imm1;
        this.writeAddress(address++, this.spl);
        this.writeAddress(address++, this.sph);
      } else if (op2 == 4) {
        // INC r
        const tmp = (this.readRegister(op1) + 1) & 0xff;
        this.writeRegister(op1, tmp);
        this.fh = (tmp & 0xf) == 0;
        this.fn = false;
        this.fz = tmp == 0;
      } else if (op2 == 5) {
        // DEC r
        const tmp = (this.readRegister(op1) - 1) & 0xff;
        this.writeRegister(op1, tmp);
        this.fh = (tmp & 0xf) == 0xf;
        this.fn = true;
        this.fz = tmp == 0;
      } else if ((op1 & 0x1) != 0 && op2 == 1) {
        // ADD HL, ss
        const ss = this.readDoubleRegister(op1 >> 1);
        this.fc = this.hl + ss > 0xffff;
        this.fh = (this.hl & 0xfff) + (ss & 0xfff) > 0xfff;
        this.fn = false;
        this.hl += ss;
      } else if ((op1 & 0x1) == 0 && op2 == 3) {
        // INC ss
        this.writeDoubleRegister(op1 >> 1,
            this.readDoubleRegister(op1 >> 1) + 1);
      } else if ((op1 & 0x1) != 0 && op2 == 3) {
        // DEC ss
        this.writeDoubleRegister(op1 >> 1,
            this.readDoubleRegister(op1 >> 1) - 1);
      } else if (op1 == 0 && op2 == 7) {
        // RLCA
        const carry = this.a & 0x80;
        this.a = ((this.a << 1) | (carry >> 7)) & 0xff;
        this.fc = carry != 0;
        this.fh = false;
        this.fn = false;
        this.fz = false;
      } else if (op1 == 1 && op2 == 7) {
        // RRCA
        const carry = this.a & 0x1;
        this.a = ((carry << 7) | (this.a >> 1)) & 0xff;
        this.fc = carry != 0;
        this.fh = false;
        this.fn = false;
        this.fz = false;
      } else if (op1 == 2 && op2 == 7) {
        // RLA
        const carry = this.a & 0x80;
        this.a = ((this.a << 1) | this.fc) & 0xff;
        this.fc = carry != 0;
        this.fh = false;
        this.fn = false;
        this.fz = false;
      } else if (op1 == 3 && op2 == 7) {
        // RRA
        const carry = this.a & 0x1;
        this.a = ((this.fc << 7) | (this.a >> 1)) & 0xff;
        this.fc = carry != 0;
        this.fh = false;
        this.fn = false;
        this.fz = false;
      } else if (op1 == 3 && op2 == 0) {
        // JR e
        const offset = this.readAddress(this.pc++) << 24 >> 24;
        this.pc += offset;
      } else if ((op1 & 0x4) != 0 && op2 == 0) {
        // JR cc, e
        const offset = this.readAddress(this.pc++) << 24 >> 24;
        if (this.readCondition(op1 & 0x3)) {
          this.pc += offset;
          cycles += 1;
        }
      } else if (op1 == 4 && op2 == 7) {
        // DAA
        let tmp = this.a;
        if (!this.fn) {
          if (this.fc || tmp > 0x99) {
            tmp += 0x60;
            this.fc = true;
          }
          if (this.fh || (tmp & 0xf) > 0x9) {
            tmp += 0x06;
          }
        } else {
          if (this.fc) {
            tmp -= 0x60;
          }
          if (this.fh) {
            tmp -= 0x6;
          }
        }
        this.fh = false;
        this.fz = (tmp & 0xff) == 0;
        this.a = tmp & 0xff;
      } else if (op1 == 5 && op2 == 7) {
        // CPL
        this.a ^= 0xff;
        this.fh = true;
        this.fn = true;
      } else if (op1 == 0 && op2 == 0) {
        // NOP
      } else if (op1 == 6 && op2 == 7) {
        // SCF
        this.fc = true;
        this.fh = false;
        this.fn = false;
      } else if (op1 == 7 && op2 == 7) {
        // CCF
        this.fc = !this.fc;
        this.fh = false;
        this.fn = false;
      } else if (op1 == 2 && op2 == 0) {
        // STOP
        this.pc++;
        if (this.speedTrigger) {
          this.speedTrigger = false;
          this.doubleSpeed = !this.doubleSpeed;
        }
      }
    } else if (quad === 1) {
      if (op1 != 6 || op2 != 6) {
        // LD r, r'
        this.writeRegister(op1, this.readRegister(op2));
      } else {
        // HALT
        this.halt = true;
      }
    } else if (quad === 2) {
      const r = this.readRegister(op2);
      if (op1 == 0) {
        // ADD A, r
        const tmp = this.a + r;
        this.fc = tmp > 0xff;
        this.fh = (this.a & 0xf) + (r & 0xf) > 0xf;
        this.fn = false;
        this.fz = (tmp & 0xff) == 0;
        this.a = tmp & 0xff;
      } else if (op1 == 1) {
        // ADC A, r
        const carry = this.fc;
        const tmp = this.a + r + carry;
        this.fc = tmp > 0xff;
        this.fh = (this.a & 0xf) + (r & 0xf) + carry > 0xf;
        this.fn = false;
        this.fz = (tmp & 0xff) == 0;
        this.a = tmp & 0xff;
      } else if (op1 == 2) {
        // SUB A, r
        const tmp = this.a - r;
        this.fc = tmp < 0;
        this.fh = (this.a & 0xf) - (r & 0xf) < 0;
        this.fn = true;
        this.fz = (tmp & 0xff) == 0;
        this.a = tmp & 0xff;
      } else if (op1 == 3) {
        // SBC A, r
        const carry = this.fc
        const tmp = this.a - r - carry;
        this.fc = tmp < 0;
        this.fh = (this.a & 0xf) - (r & 0xf) - carry < 0;
        this.fn = true;
        this.fz = (tmp & 0xff) == 0;
        this.a = tmp & 0xff;
      } else if (op1 == 4) {
        // AND A, r
        const tmp = this.a & r;
        this.fc = false;
        this.fh = true;
        this.fn = false;
        this.fz = tmp == 0;
        this.a = tmp;
      } else if (op1 == 5) {
        // XOR A, r
        const tmp = this.a ^ r;
        this.fc = false;
        this.fh = false;
        this.fn = false;
        this.fz = tmp == 0;
        this.a = tmp;
      } else if (op1 == 6) {
        // OR A, r
        const tmp = this.a | r;
        this.a |= r;
        this.fc = false;
        this.fh = false;
        this.fn = false;
        this.fz = tmp == 0;
        this.a = tmp;
      } else if (op1 == 7) {
        // CP A, r
        const tmp = this.a - r;
        this.fc = tmp < 0;
        this.fh = (this.a & 0xf) - (r & 0xf) < 0;
        this.fn = true;
        this.fz = (tmp & 0xff) == 0;
      }
    } else if (quad === 3) {
      if (op1 == 6 && op2 == 2) {
        // LD A, (C)
        this.a = this.readAddress(0xff00 | this.c);
      } else if (op1 == 4 && op2 == 2) {
        // LD (C), A
        this.writeAddress(0xff00 | this.c, this.a);
      } else if (op1 == 6 && op2 == 0) {
        // LD A, (n)
        const imm = this.readAddress(this.pc++);
        this.a = this.readAddress(0xff00 | imm);
      } else if (op1 == 4 && op2 == 0) {
        // LD (n), A
        const imm = this.readAddress(this.pc++);
        this.writeAddress(0xff00 | imm, this.a);
      } else if (op1 == 7 && op2 == 2) {
        // LD A, (nn)
        const imm1 = this.readAddress(this.pc++);
        const imm2 = this.readAddress(this.pc++);
        this.a = this.readAddress((imm2 << 8) | imm1);
      } else if (op1 == 5 && op2 == 2) {
        // LD (nn), A
        const imm1 = this.readAddress(this.pc++);
        const imm2 = this.readAddress(this.pc++);
        this.writeAddress((imm2 << 8) | imm1, this.a);
      } else if (op1 == 7 && op2 == 1) {
        // LD SP, HL
        this.sp = this.hl;
      } else if ((op1 & 0x1) == 0 && op2 == 5) {
        // PUSH qq
        this.pushDoubleRegister(op1 >> 1);
      } else if ((op1 & 0x1) == 0 && op2 == 1) {
        // POP qq
        this.popDoubleRegister(op1 >> 1);
      } else if (op1 == 7 && op2 == 0) {
        // LDHL SP, e
        const offset = this.readAddress(this.pc++) << 24 >> 24;
        const tmp = this.sp + offset;
        this.fc = (this.sp & 0xff) + (offset & 0xff) > 0xff;
        this.fh = (this.sp & 0xf) + (offset & 0xf) > 0xf;
        this.fn = false;
        this.fz = false;
        this.hl = tmp;
      } else if (op1 == 5 && op2 == 0) {
        // ADD SP, e
        const offset = this.readAddress(this.pc++) << 24 >> 24;
        const tmp = this.sp + offset;
        this.fc = (this.sp & 0xff) + (offset & 0xff) > 0xff;
        this.fh = (this.sp & 0xf) + (offset & 0xf) > 0xf;
        this.fn = false;
        this.fz = false;
        this.sp = tmp;
      } else if (op1 == 0 && op2 == 6) {
        // ADD A, n
        const imm = this.readAddress(this.pc++);
        const tmp = this.a + imm
        this.fc = tmp > 0xff;
        this.fh = (this.a & 0xf) + (imm & 0xf) > 0xf;
        this.fn = false;
        this.fz = (tmp & 0xff) == 0;
        this.a = tmp & 0xff;
      } else if (op1 == 1 && op2 == 6) {
        // ADC A, n
        const imm = this.readAddress(this.pc++);
        const carry = this.fc;
        const tmp = this.a + imm + carry
        this.fc = tmp > 0xff;
        this.fh = (this.a & 0xf) + (imm & 0xf) + carry > 0xf;
        this.fn = false;
        this.fz = (tmp & 0xff) == 0;
        this.a = tmp & 0xff;
      } else if (op1 == 2 && op2 == 6) {
        // SUB A, n
        const imm = this.readAddress(this.pc++);
        const tmp = this.a - imm;
        this.fc = tmp < 0;
        this.fh = (this.a & 0xf) - (imm & 0xf) < 0;
        this.fn = true;
        this.fz = (tmp & 0xff) == 0;
        this.a = tmp & 0xff;
      } else if (op1 == 3 && op2 == 6) {
        // SBC A, n
        const imm = this.readAddress(this.pc++);
        const carry = this.fc;
        const tmp = this.a - imm - carry;
        this.fc = tmp < 0;
        this.fh = (this.a & 0xf) - (imm & 0xf) - carry < 0;
        this.fn = true;
        this.fz = (tmp & 0xff) == 0;
        this.a = tmp & 0xff;
      } else if (op1 == 4 && op2 == 6) {
        // AND A, n
        const imm = this.readAddress(this.pc++);
        const tmp = this.a & imm;
        this.fc = false;
        this.fh = true;
        this.fn = false;
        this.fz = tmp == 0;
        this.a = tmp;
      } else if (op1 == 5 && op2 == 6) {
        // XOR A, n
        const imm = this.readAddress(this.pc++);
        const tmp = this.a ^ imm;
        this.fc = false;
        this.fh = false;
        this.fn = false;
        this.fz = tmp == 0;
        this.a = tmp;
      } else if (op1 == 6 && op2 == 6) {
        // OR A, n
        const imm = this.readAddress(this.pc++);
        const tmp = this.a | imm;
        this.fc = false;
        this.fh = false;
        this.fn = false;
        this.fz = tmp == 0;
        this.a = tmp;
      } else if (op1 == 7 && op2 == 6) {
        // CP A, n
        const imm = this.readAddress(this.pc++);
        const tmp = this.a - imm;
        this.fc = tmp < 0;
        this.fh = (this.a & 0xf) - (imm & 0xf) < 0;
        this.fn = true;
        this.fz = (tmp & 0xff) == 0;
      } else if (op1 == 1 && op2 == 3) {
        cycles += this.decode_cb();
      } else if (op1 == 0 && op2 == 3) {
        // JP nn
        const imm1 = this.readAddress(this.pc++);
        const imm2 = this.readAddress(this.pc++);
        this.pc = (imm2 << 8) | imm1;
      } else if ((op1 & 0x4) == 0 && op2 == 2) {
        // JP cc, nn
        const imm1 = this.readAddress(this.pc++);
        const imm2 = this.readAddress(this.pc++);
        if (this.readCondition(op1 & 0x3)) {
          this.pc = (imm2 << 8) | imm1;
          cycles += 1;
        }
      } else if (op1 == 5 && op2 == 1) {
        // JP HL
        this.pc = this.hl;
      } else if (op1 == 1 && op2 == 5) {
        // CALL nn
        const imm1 = this.readAddress(this.pc++);
        const imm2 = this.readAddress(this.pc++);
        this.writeAddress(--this.sp, this.pch);
        this.writeAddress(--this.sp, this.pcl);
        this.pc = (imm2 << 8) | imm1;
      } else if ((op1 & 0x4) == 0 && op2 == 4) {
        // CALL cc, nn
        const imm1 = this.readAddress(this.pc++);
        const imm2 = this.readAddress(this.pc++);
        if (this.readCondition(op1 & 0x3)) {
          this.writeAddress(--this.sp, this.pch);
          this.writeAddress(--this.sp, this.pcl);
          this.pc = (imm2 << 8) | imm1;
          cycles += 3;
        }
      } else if (op1 == 1 && op2 == 1) {
        // RET
        this.pc = this.readAddress(this.sp++);
        this.pc |= this.readAddress(this.sp++) << 8;
      } else if (op1 == 3 && op2 == 1) {
        // RETI
        this.pc = this.readAddress(this.sp++);
        this.pc |= this.readAddress(this.sp++) << 8;
        this.ime = true;
      } else if ((op1 & 0x4) == 0 && op2 == 0) {
        // RET cc
        if (this.readCondition(op1 & 0x3)) {
          this.pc = this.readAddress(this.sp++);
          this.pc |= this.readAddress(this.sp++) << 8;
          cycles += 3;
        }
      } else if (op2 == 7) {
        // RST t
        this.writeAddress(--this.sp, this.pch);
        this.writeAddress(--this.sp, this.pcl);
        this.pc = op1 << 3;
      } else if (op1 == 6 && op2 == 3) {
        // DI
        this.ime = false;
      } else if (op1 == 7 && op2 == 3) {
        // EI
        this.ime = true;
      } else {
        throw 'unknown instruction: 0x' + instr.toString(16);
      }
    }
    return cycles;
  }

  decode_cb() {
    const instr = this.readAddress(this.pc++);
    let cycles = GameBoy.cbInstrCycles[instr];
    const quad = instr >> 6, op1 = (instr & 0x3f) >> 3, op2 = instr & 0x7;
    if (quad == 0) {
      const r = this.readRegister(op2);
      if (op1 == 0) {
        // RLC r
        const carry = r & 0x80;
        const tmp = ((r << 1) | (carry >> 7)) & 0xff;
        this.writeRegister(op2, tmp);
        this.fc = carry != 0;
        this.fh = 0;
        this.fn = 0;
        this.fz = tmp == 0;
      } else if (op1 == 1) {
        // RRC r
        const carry = r & 0x1;
        const tmp = ((carry << 7) | (r >> 1)) & 0xff;
        this.writeRegister(op2, tmp);
        this.fc = carry != 0;
        this.fh = 0;
        this.fn = 0;
        this.fz = tmp == 0;
      } else if (op1 == 2) {
        // RL r
        const carry = r & 0x80;
        const tmp = ((r << 1) | this.fc) & 0xff;
        this.writeRegister(op2, tmp);
        this.fc = carry != 0;
        this.fh = 0;
        this.fn = 0;
        this.fz = tmp == 0;
      } else if (op1 == 3) {
        // RR r
        const carry = r & 0x1;
        const tmp = ((this.fc << 7) | (r >> 1)) & 0xff;
        this.writeRegister(op2, tmp);
        this.fc = carry != 0;
        this.fh = 0;
        this.fn = 0;
        this.fz = tmp == 0;
      } else if (op1 == 4) {
        // SLA r
        const carry = r & 0x80;
        const tmp = (r << 1) & 0xff;
        this.writeRegister(op2, tmp);
        this.fc = carry != 0;
        this.fh = 0;
        this.fn = 0;
        this.fz = tmp == 0;
      } else if (op1 == 5) {
        // SRA r
        const carry = r & 0x1;
        const tmp = ((r & 0x80) | (r >> 1)) & 0xff;
        this.writeRegister(op2, tmp);
        this.fc = carry != 0;
        this.fh = 0;
        this.fn = 0;
        this.fz = tmp == 0;
      } else if (op1 == 6) {
        // SWAP r
        const tmp = ((r << 4) | (r >> 4)) & 0xff;
        this.writeRegister(op2, tmp);
        this.fc = 0;
        this.fh = 0;
        this.fn = 0;
        this.fz = tmp == 0;
      } else if (op1 == 7) {
        // SRL r
        const carry = r & 0x1;
        const tmp = (r >> 1) & 0xff;
        this.writeRegister(op2, tmp);
        this.fc = carry != 0;
        this.fh = 0;
        this.fn = 0;
        this.fz = tmp == 0;
      }
    } else if (quad == 1) {
      // BIT b, r
      this.fh = true;
      this.fn = false;
      this.fz = (this.readRegister(op2) & (1 << op1)) == 0;
    } else if (quad == 2) {
      // RES b, r
      this.writeRegister(op2, this.readRegister(op2) & ~(1 << op1))
    } else if (quad == 3) {
      // SET b, r
      this.writeRegister(op2, this.readRegister(op2) | (1 << op1))
    }
    return cycles;
  }
}

GameBoy.frequency = (4194304 / 4);//1048576;
GameBoy.instrCycles = [
  1, 3, 2, 2, 1, 1, 2, 1, 5, 2, 2, 2, 1, 1, 2, 1,
  0, 3, 2, 2, 1, 1, 2, 1, 3, 2, 2, 2, 1, 1, 2, 1,
  2, 3, 2, 2, 1, 1, 2, 1, 2, 2, 2, 2, 1, 1, 2, 1,
  2, 3, 2, 2, 3, 3, 3, 1, 2, 2, 2, 2, 1, 1, 2, 1,
  1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1,
  1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1,
  1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1,
  2, 2, 2, 2, 2, 2, 0, 2, 1, 1, 1, 1, 1, 1, 2, 1,
  1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1,
  1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1,
  1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1,
  1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1,
  2, 3, 3, 4, 3, 4, 2, 4, 2, 4, 3, 0, 3, 6, 2, 4,
  2, 3, 3, 0, 3, 4, 2, 4, 2, 4, 3, 0, 3, 0, 2, 4,
  3, 3, 2, 0, 0, 4, 2, 4, 4, 1, 4, 0, 0, 0, 2, 4,
  3, 3, 2, 1, 0, 4, 2, 4, 3, 2, 4, 1, 0, 0, 2, 4,
];
GameBoy.cbInstrCycles = [
  2, 2, 2, 2, 2, 2, 4, 2, 2, 2, 2, 2, 2, 2, 4, 2,
  2, 2, 2, 2, 2, 2, 4, 2, 2, 2, 2, 2, 2, 2, 4, 2,
  2, 2, 2, 2, 2, 2, 4, 2, 2, 2, 2, 2, 2, 2, 4, 2,
  2, 2, 2, 2, 2, 2, 4, 2, 2, 2, 2, 2, 2, 2, 4, 2,
  2, 2, 2, 2, 2, 2, 3, 2, 2, 2, 2, 2, 2, 2, 3, 2,
  2, 2, 2, 2, 2, 2, 3, 2, 2, 2, 2, 2, 2, 2, 3, 2,
  2, 2, 2, 2, 2, 2, 3, 2, 2, 2, 2, 2, 2, 2, 3, 2,
  2, 2, 2, 2, 2, 2, 3, 2, 2, 2, 2, 2, 2, 2, 3, 2,
  2, 2, 2, 2, 2, 2, 4, 2, 2, 2, 2, 2, 2, 2, 4, 2,
  2, 2, 2, 2, 2, 2, 4, 2, 2, 2, 2, 2, 2, 2, 4, 2,
  2, 2, 2, 2, 2, 2, 4, 2, 2, 2, 2, 2, 2, 2, 4, 2,
  2, 2, 2, 2, 2, 2, 4, 2, 2, 2, 2, 2, 2, 2, 4, 2,
  2, 2, 2, 2, 2, 2, 4, 2, 2, 2, 2, 2, 2, 2, 4, 2,
  2, 2, 2, 2, 2, 2, 4, 2, 2, 2, 2, 2, 2, 2, 4, 2,
  2, 2, 2, 2, 2, 2, 4, 2, 2, 2, 2, 2, 2, 2, 4, 2,
  2, 2, 2, 2, 2, 2, 4, 2, 2, 2, 2, 2, 2, 2, 4, 2,
];
GameBoy.joypadInterrupt = 0x10;
GameBoy.serialInterrupt = 0x8;
GameBoy.timerInterrupt = 0x4;
GameBoy.statInterrupt = 0x2;
GameBoy.vblankInterrupt = 0x1;
GameBoy.interrupts = 0x1f;

GameBoy.startTime = 0;

/***/ }),

/***/ "./public/js/gb/display.js":
/*!*********************************!*\
  !*** ./public/js/gb/display.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Display: () => (/* binding */ Display)
/* harmony export */ });
/* harmony import */ var _cpu_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./cpu.js */ "./public/js/gb/cpu.js");
/* harmony import */ var _dummylogger_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../dummylogger.js */ "./public/dummylogger.js");

 // Adjust based on actual exports

class Display {
    constructor(gb) {
        this.gb = gb;

        this.lcdOn = true;
        this.windowTilemap = false;
        this.windowOn = false;
        this.bgWindowTileMode = true;
        this.bgTilemap = false;
        this.objHeight = false;
        this.objOn = false;
        this.bgOn = true;

        this.lycMatchInt = false;
        this.mode10Int = false;
        this.mode01Int = false;
        this.mode00Int = false;
        this.lycMatch = false;
        this.mode = 0;

        this.scy = 0;
        this.scx = 0;

        this.ly = 0;

        this.lyc = 0;

        this._bgp = 0;
        this._obp0 = 0;
        this._obp1 = 0;

        this.bgPalette = [0, 0, 0, 0];
        this.objPalette = [[0, 0, 0, 0], [0, 0, 0, 0]];

        this.bgColorIndex = 0;
        this.bgColorInc = false;

        this.objColorIndex = 0;
        this.objColorInc = false;

        this._bcpd = new Uint8Array(0x40);
        this._ocpd = new Uint8Array(0x40);

        this.bgColorPalette = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
        this.objColorPalette = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];

        this.wy = 0;
        this.wx = 0;

        this._vbk = 0;

        this.hdmaSrc = 0;
        this.hdmaDst = 0;

        this._hdma5 = 0;

        this.hdmaOn = false;
        this.hblankHdmaOn = false;
        this.hdmaTrigger = false;
        this.hdmaCounter = 0;

        this.cycles = 0;
        this.windowLine = 0;

        this.statInterrupt = false;

        this.vram = new Uint8Array(0x4000);
        this.oam = new Uint8Array(0xa0);

        this.imageData = Display.ctx.createImageData(Display.canvasWidth, Display.canvasHeight);
        this.pixels = new Uint32Array(this.imageData.data.buffer);
        this.bgClear = new Uint8Array(Display.width);
        this.bgPriority = new Uint8Array(Display.width);

        this.priorRenderLap = 0;
    }

    get lcdc() {
        return (this.lcdOn << 7) | (this.windowTilemap << 6) | (this.windowOn << 5) | (this.bgWindowTileMode << 4) | (this.bgTilemap << 3) | (this.objHeight << 2) | (this.objOn << 1) | this.bgOn;
    }

    set lcdc(value) {
        this.lcdOn = (value & 0x80) != 0;
        this.windowTilemap = (value & 0x40) != 0;
        this.windowOn = (value & 0x20) != 0;
        this.bgWindowTileMode = (value & 0x10) != 0;
        this.bgTilemap = (value & 0x8) != 0;
        this.objHeight = (value & 0x4) != 0;
        this.objOn = (value & 0x2) != 0;
        this.bgOn = (value & 0x1) != 0;
    }

    get stat() {
        return 0x80 | (this.lycMatchInt << 6) | (this.mode10Int << 5) | (this.mode01Int << 4) | (this.mode00Int << 3) | (this.lycMatch << 2) | this.mode;
    }

    set stat(value) {
        this.lycMatchInt = (value & 0x40) != 0;
        this.mode10Int = (value & 0x20) != 0;
        this.mode01Int = (value & 0x10) != 0;
        this.mode00Int = (value & 0x8) != 0;
    }

    set dma(value) {
        const src = value << 8;
        for (let index = 0; index < this.oam.length; index++) {
            this.oam[index] = this.gb.readAddress(src + index)
        }
    }

    get bgp() {
        return this._bgp;
    }

    set bgp(value) {
        this._bgp = value;
        this.bgPalette = [value & 0x3, (value >> 2) & 0x3, (value >> 4) & 0x3, (value >> 6) & 0x3];
    }

    get obp0() {
        return this._obp0;
    }

    set obp0(value) {
        this._obp0 = value;
        this.objPalette[0] = [value & 0x3, (value >> 2) & 0x3, (value >> 4) & 0x3, (value >> 6) & 0x3];
    }

    get obp1() {
        return this._obp1;
    }

    set obp1(value) {
        this._obp1 = value;
        this.objPalette[1] = [value & 0x3, (value >> 2) & 0x3, (value >> 4) & 0x3, (value >> 6) & 0x3];
    }

    set hdma1(value) {
        if (!this.gb.cgb) {
            return;
        }
        this.hdmaSrc = (value << 8) | (this.hdmaSrc & 0x00ff);
    }

    set hdma2(value) {
        if (!this.gb.cgb) {
            return;
        }
        this.hdmaSrc = (this.hdmaSrc & 0xff00) | (value & 0xf0);
    }

    set hdma3(value) {
        if (!this.gb.cgb) {
            return;
        }
        this.hdmaDst = ((value & 0x1f) << 8) | (this.hdmaDst & 0x00ff);
    }

    set hdma4(value) {
        if (!this.gb.cgb) {
            return;
        }
        this.hdmaDst = (this.hdmaDst & 0xff00) | (value & 0xf0);
    }

    get hdma5() {
        if (!this.gb.cgb) {
            return 0xff;
        }
        return ((!this.hdmaOn && !this.hblankHdmaOn) << 7) | ((this.hdmaCounter - 1) & 0x7f);
    }

    set hdma5(value) {
        if (!this.gb.cgb) {
            return;
        }
        if ((value & 0x80) == 0 && this.hblankHdmaOn) {
            this.hblankHdmaOn = false;
            return;
        }
        this.hdmaOn = (value & 0x80) == 0;
        this.hblankHdmaOn = (value & 0x80) != 0;
        if (this.hblankHdmaOn && this.mode == Display.modes.hblank) {
            this.hdmaOn = true;
        }
        this._hdma5 = value;
        this.hdmaCounter = (value & 0x7f) + 1;
    }

    get bcps() {
        if (!this.gb.cgb) {
            return 0xff;
        }
        return 0x40 | (this.bgColorInc << 7) | this.bgColorIndex;
    }

    set bcps(value) {
        if (!this.gb.cgb) {
            return;
        }
        this.bgColorInc = (value & 0x80) != 0;
        this.bgColorIndex = value & 0x3f;
    }

    get bcpd() {
        if (!this.gb.cgb) {
            return 0xff;
        }
        return this._bcpd[this.bgColorIndex];
    }

    set bcpd(value) {
        if (!this.gb.cgb) {
            return;
        }
        this._bcpd[this.bgColorIndex] = value;
        if ((this.bgColorIndex & 0x1) != 0) {
            this.bgColorPalette[this.bgColorIndex >> 3][(this.bgColorIndex & 0x6) >> 1] = ((value & 0x7f) << 8) | (this.bgColorPalette[this.bgColorIndex >> 3][(this.bgColorIndex & 0x6) >> 1] & 0xff)
        } else {
            this.bgColorPalette[this.bgColorIndex >> 3][(this.bgColorIndex & 0x6) >> 1] = (this.bgColorPalette[this.bgColorIndex >> 3][(this.bgColorIndex & 0x6) >> 1] & 0xff00) | value;
        }
        if (this.bgColorInc) {
            this.bgColorIndex = (this.bgColorIndex + 1) & 0x3f;
        }
    }

    get ocps() {
        if (!this.gb.cgb) {
            return 0xff;
        }
        return 0x40 | (this.objColorInc << 7) | this.objColorIndex;
    }

    set ocps(value) {
        if (!this.gb.cgb) {
            return;
        }
        this.objColorInc = (value & 0x80) != 0;
        this.objColorIndex = value & 0x3f;
    }

    get ocpd() {
        if (!this.gb.cgb) {
            return 0xff;
        }
        return this._ocpd[this.objColorIndex];
    }

    set ocpd(value) {
        if (!this.gb.cgb) {
            return;
        }
        this._ocpd[this.objColorIndex] = value;
        if ((this.objColorIndex & 0x1) != 0) {
            this.objColorPalette[this.objColorIndex >> 3][(this.objColorIndex & 0x6) >> 1] = ((value & 0x7f) << 8) | (this.objColorPalette[this.objColorIndex >> 3][(this.objColorIndex & 0x6) >> 1] & 0xff)
        } else {
            this.objColorPalette[this.objColorIndex >> 3][(this.objColorIndex & 0x6) >> 1] = (this.objColorPalette[this.objColorIndex >> 3][(this.objColorIndex & 0x6) >> 1] & 0xff00) | value;
        }
        if (this.objColorInc) {
            this.objColorIndex = (this.objColorIndex + 1) & 0x3f;
        }
    }

    get vbk() {
        if (!this.gb.cgb) {
            return 0xff;
        }
        return 0xfe | this._vbk;
    }

    set vbk(value) {
        if (!this.gb.cgb) {
            return;
        }
        this._vbk = value & 0x1;
    }

    readVRAM(address) {
        return this.vram[(this._vbk << 13) | address];
    }

    writeVRAM(address, value) {
        this.vram[(this._vbk << 13) | address] = value;
    }

    renderLine() {
        const address = (this.ly + Display.canvasMargin) * Display.canvasWidth + Display.canvasMargin;
        for (let x = 0; x < Display.width; x++) {
            if (this.bgOn) {
                if (this.windowOn && this.ly >= this.wy && x >= this.wx - 7) {
                    const tilemapY = (this.windowLine >> 3) & 0x1f;
                    const tilemapX = ((x - (this.wx - 7)) >> 3) & 0x1f;
                    const tilemapAddress = (this.windowTilemap ? 0x1c00 : 0x1800) | (tilemapY << 5) | tilemapX;

                    let tile = this.vram[tilemapAddress];
                    if (!this.bgWindowTileMode && tile < 0x80) {
                        tile += 0x100;
                    }
                    const tileY = this.windowLine & 0x7;
                    const tileAddress = (tile << 4) | (tileY << 1);

                    const tileX = (x - (this.wx - 7)) & 0x7;
                    const palette = (((this.vram[tileAddress + 1] << tileX) & 0x80) >> 6) | (((this.vram[tileAddress] << tileX) & 0x80) >> 7);

                    this.bgClear[x] = palette;
                    this.pixels[address + x] = Display.palette[this.bgPalette[palette]];
                } else {
                    const tilemapY = ((this.ly + this.scy) >> 3) & 0x1f;
                    const tilemapX = ((x + this.scx) >> 3) & 0x1f;
                    const tilemapAddress = (this.bgTilemap ? 0x1c00 : 0x1800) | (tilemapY << 5) | tilemapX;

                    let tile = this.vram[tilemapAddress];
                    if (!this.bgWindowTileMode && tile < 0x80) {
                        tile += 0x100;
                    }
                    const tileY = (this.ly + this.scy) & 0x7;
                    const tileAddress = (tile << 4) | (tileY << 1);

                    const tileX = (x + this.scx) & 0x7;
                    const palette = (((this.vram[tileAddress + 1] << tileX) & 0x80) >> 6) | (((this.vram[tileAddress] << tileX) & 0x80) >> 7);

                    this.bgClear[x] = palette;
                    this.pixels[address + x] = Display.palette[this.bgPalette[palette]];
                }
            } else {
                this.bgClear[x] = 0;
                this.pixels[address + x] = 0xffffffff;
            }
        }

        if (this.objOn) {
            const objs = [];
            for (let obj = 0; obj < 40 && objs.length < 10; obj++) {
                const objY = this.oam[obj * 4] - 16;
                const objX = this.oam[obj * 4 + 1] - 8;
                const tileY = (this.ly - objY) & 0xff;
                if (tileY < (this.objHeight ? 16 : 8)) {
                    let index = objs.length;
                    const compObjX = this.oam[objs[index - 1] * 4 + 1] - 8;
                    while (index > 0 && objX < compObjX) {
                        index--;
                    }
                    objs.splice(index, 0, obj);
                }
            }

            for (let index = objs.length - 1; index >= 0; index--) {
                const obj = objs[index];
                const objY = this.oam[obj * 4] - 16;
                const objX = this.oam[obj * 4 + 1] - 8;
                const tile = this.oam[obj * 4 + 2] & (this.objHeight ? 0xfe : 0xff);
                const attr = this.oam[obj * 4 + 3];
                const priority = (attr & 0x80) != 0;
                const yFlip = (attr & 0x40) != 0;
                const xFlip = (attr & 0x20) != 0;
                const paletteNumber = (attr & 0x10) >> 4;

                if (objX > -8 && objX < Display.width) {
                    let tileY = this.ly - objY;
                    if (yFlip) {
                        tileY = (this.objHeight ? 15 : 7) - tileY;
                    }
                    const tileAddress = (tile << 4) | (tileY << 1);

                    for (let x = Math.max(objX, 0); x < Math.min(objX + 8, Display.width); x++) {
                        let tileX = x - objX;
                        if (xFlip) {
                            tileX = 7 - tileX;
                        }
                        const palette = (((this.vram[tileAddress + 1] << tileX) & 0x80) >> 6) | (((this.vram[tileAddress] << tileX) & 0x80) >> 7);

                        if (palette != 0 && (!priority || this.bgClear[x] == 0)) {
                            this.pixels[address + x] = Display.palette[this.objPalette[paletteNumber][palette]];
                        }
                    }
                }
            }
        }
    }

    renderLineColor() {
        const address = (this.ly + Display.canvasMargin) * Display.canvasWidth + Display.canvasMargin;
        for (let x = 0; x < Display.width; x++) {
            if (this.windowOn && this.ly >= this.wy && x >= this.wx - 7) {
                const tilemapY = (this.windowLine >> 3) & 0x1f;
                const tilemapX = ((x - (this.wx - 7)) >> 3) & 0x1f;
                const tilemapAddress = (this.windowTilemap ? 0x1c00 : 0x1800) | (tilemapY << 5) | tilemapX;
                const tileAttributeAddress = 0x2000 | tilemapAddress;

                const attributes = this.vram[tileAttributeAddress];
                this.bgPriority[x] = (attributes & 0x80) != 0;
                const yFlip = (attributes & 0x40) != 0;
                const xFlip = (attributes & 0x20) != 0;
                const bankAddress = (attributes & 0x8) << 10;
                const paletteNumber = attributes & 0x7;

                let tile = this.vram[tilemapAddress];
                if (!this.bgWindowTileMode && tile < 0x80) {
                    tile += 0x100;
                }
                let tileY = this.windowLine & 0x7;
                if (yFlip) {
                    tileY = 7 - tileY;
                }
                const tileAddress = bankAddress | (tile << 4) | (tileY << 1);

                let tileX = (x - (this.wx - 7)) & 0x7;
                if (xFlip) {
                    tileX = 7 - tileX;
                }
                const palette = (((this.vram[tileAddress + 1] << tileX) & 0x80) >> 6) | (((this.vram[tileAddress] << tileX) & 0x80) >> 7);

                this.bgClear[x] = palette;
                this.pixels[address + x] = Display.colorPalette[this.bgColorPalette[paletteNumber][palette]];
            } else {
                const tilemapY = ((this.ly + this.scy) >> 3) & 0x1f;
                const tilemapX = ((x + this.scx) >> 3) & 0x1f;
                const tilemapAddress = (this.bgTilemap ? 0x1c00 : 0x1800) | (tilemapY << 5) | tilemapX;
                const tileAttributeAddress = 0x2000 | tilemapAddress;

                const attributes = this.vram[tileAttributeAddress];
                this.bgPriority[x] = (attributes & 0x80) != 0;
                const yFlip = (attributes & 0x40) != 0;
                const xFlip = (attributes & 0x20) != 0;
                const bankAddress = (attributes & 0x8) << 10;
                const paletteNumber = attributes & 0x7;

                let tile = this.vram[tilemapAddress];
                if (!this.bgWindowTileMode && tile < 0x80) {
                    tile += 0x100;
                }
                let tileY = (this.ly + this.scy) & 0x7;
                if (yFlip) {
                    tileY = 7 - tileY;
                }
                const tileAddress = bankAddress | (tile << 4) | (tileY << 1);

                let tileX = (x + this.scx) & 0x7;
                if (xFlip) {
                    tileX = 7 - tileX;
                }
                const palette = (((this.vram[tileAddress + 1] << tileX) & 0x80) >> 6) | (((this.vram[tileAddress] << tileX) & 0x80) >> 7);

                this.bgClear[x] = palette;
                this.pixels[address + x] = Display.colorPalette[this.bgColorPalette[paletteNumber][palette]];
            }
        }

        if (this.objOn) {
            const objs = [];
            for (let obj = 0; obj < 40 && objs.length < 10; obj++) {
                const objY = this.oam[obj * 4] - 16;
                const tileY = (this.ly - objY) & 0xff;
                if (tileY < (this.objHeight ? 16 : 8)) {
                    objs.push(obj);
                }
            }

            for (let index = objs.length - 1; index >= 0; index--) {
                const obj = objs[index];
                const objY = this.oam[obj * 4] - 16;
                const objX = this.oam[obj * 4 + 1] - 8;
                const tile = this.oam[obj * 4 + 2] & (this.objHeight ? 0xfe : 0xff);
                const attr = this.oam[obj * 4 + 3];
                const priority = (attr & 0x80) != 0;
                const yFlip = (attr & 0x40) != 0;
                const xFlip = (attr & 0x20) != 0;
                const bankAddress = (attr & 0x8) << 10;
                const paletteNumber = attr & 0x7;

                if (objX > -8 && objX < Display.width) {
                    let tileY = this.ly - objY;
                    if (yFlip) {
                        tileY = (this.objHeight ? 15 : 7) - tileY;
                    }
                    const tileAddress = bankAddress | (tile << 4) | (tileY << 1);

                    for (let x = Math.max(objX, 0); x < Math.min(objX + 8, Display.width); x++) {
                        let tileX = x - objX;
                        if (xFlip) {
                            tileX = 7 - tileX;
                        }
                        const palette = (((this.vram[tileAddress + 1] << tileX) & 0x80) >> 6) | (((this.vram[tileAddress] << tileX) & 0x80) >> 7);

                        if (palette != 0 && (!this.bgOn || this.bgClear[x] == 0 || (this.bgPriority[x] == 0 && !priority))) {
                            this.pixels[address + x] = Display.colorPalette[this.objColorPalette[paletteNumber][palette]];
                        }
                    }
                }
            }
        }
    }

    renderFrame() {
        //customLog("%c render before","background:blue; color:white")
        Display.ctx.putImageData(this.imageData, 0, 0);
        Display.fps++;
        //customLog("GameBoy start time: ", GameBoy.startTime.toFixed(3));
        const current = performance.now();
        (0,_dummylogger_js__WEBPACK_IMPORTED_MODULE_1__.customLog)("%c render after(" + Display.renderCpuCycles + "): " + (current - _cpu_js__WEBPACK_IMPORTED_MODULE_0__.GameBoy.startTime).toFixed(3),"background:black; color:white");
        (0,_dummylogger_js__WEBPACK_IMPORTED_MODULE_1__.customLog)("renderLap: " + (current - this.priorRenderLap).toFixed(3));
        this.priorRenderLap = current;
        Display.renderCpuCycles = 0;
    }

    cycle() {
        Display.renderCpuCycles++;

        if (this.lcdOn) {
            this.lycMatch = this.ly == this.lyc;

            if (this.ly < Display.height) {
                if (this.cycles == 0) {
                    this.mode = Display.modes.searchOAM;
                }
                if (this.cycles == 80) {
                    this.mode = Display.modes.transfer;
                }
                if (this.cycles == 248) {
                    this.mode = Display.modes.hblank;
                    if (this.gb.cgb) {
                        this.renderLineColor();
                    } else {
                        this.renderLine();
                    }
                    if (this.hblankHdmaOn) {
                        this.hdmaTrigger = true;
                    }
                }
            }
            if (this.ly == Display.height && this.cycles == 0) {
                this.gb.requestInterrupt(_cpu_js__WEBPACK_IMPORTED_MODULE_0__.GameBoy.vblankInterrupt);
                this.mode = Display.modes.vblank;
                this.renderFrame();
            }

            const _statInterrupt = this.statInterrupt;
            this.statInterrupt = (this.lycMatchInt && this.lycMatch) || (this.mode10Int && this.mode == Display.modes.searchOAM) || (this.mode01Int && this.mode == Display.modes.vblank) || (this.mode00Int && this.mode == Display.modes.hblank);
            if (!_statInterrupt && this.statInterrupt) {
                this.gb.requestInterrupt(_cpu_js__WEBPACK_IMPORTED_MODULE_0__.GameBoy.statInterrupt);
            }

            this.cycles += Display.cyclesPerCPUCycle;
            if (this.cycles == Display.cyclesPerLine) {
                this.cycles = 0;
                if (this.windowOn && this.ly >= this.wy && this.wx <= 166) {
                    this.windowLine++;
                }
                this.ly++;
                if (this.ly == Display.linesPerFrame) {
                    this.ly = 0;
                    this.windowLine = 0;
                }
            }
        } else {
            this.cycles = 0;
            this.ly = 0;
            this.lycMatch = false;
            this.mode = Display.modes.hblank;
        }
    }
}
Display.width = 160;
Display.height = 144;
Display.frequency = 4194304;
Display.cyclesPerLine = 456;
Display.linesPerFrame = 154;
Display.cyclesPerCPUCycle = Display.frequency / (4194304 / 4);//GameBoy.frequency; // (4194304 / 1048576) == 4
Display.cpuCyclesPerFrame = Display.cyclesPerLine * Display.linesPerFrame / Display.cyclesPerCPUCycle;
                            // (456 * 154) / (4194304 / 1048576) == 70224 / 4 == 17556
Display.frameDuration = Display.cpuCyclesPerFrame / (4194304 / 4);//GameBoy.frequency;
                            // (456 * 154) / (4194304 / 1048576) / 1048576 = (456 * 154) / 4194304
Display.frameInterval = Display.frameDuration * 1000; // 16.74 ms
Display.palette = [
    0xffdeffef, 0xff94d7ad, 0xff739252, 0xff423418  // ffEFFFDE in little endian, ARGB order -> 0xABGR
    //0xffe6f8da, 0xff99c886, 0xff437969, 0xff051f2a
    //0xffffffff, 0xffaaaaaa, 0xff555555, 0xff000000,
];
Display.colorPalette = Array.from(Array(0x8000), (v, k) => {
    
    /*
    const b = Math.floor((k >> 10) * 0xff / 0x1f);
    const g = Math.floor(((k & 0x3e0) >> 5) * 0xff / 0x1f);
    const r = Math.floor((k & 0x1f) * 0xff / 0x1f);
    //return 0xff000000 | (b << 16) | (g << 8) | r;
    */
    const b = (k >> 10) & 0x1F;
    const g = (k >> 5) & 0x1F;
    const r = k & 0x1F;
	return 0xff000000 | ((r * 3 + g * 2 + b * 11) >> 1) << 16 | (g * 3 + b) << 9 | (r * 13 + g * 2 + b) >> 1;
});
Display.modes = {
    hblank: 0,
    vblank: 1,
    searchOAM: 2,
    transfer: 3,
}
Display.canvasMargin = 16;
Display.canvasWidth = Display.width + 2 * Display.canvasMargin;
Display.canvasHeight = Display.height + 2 * Display.canvasMargin;
/*
Display.canvas = document.getElementById('canvas');
Display.canvas.width = Display.canvasWidth;
Display.canvas.height = Display.canvasHeight;
Display.ctx = Display.canvas.getContext('2d');

 */
Display.fps = 0;
Display.renderCpuCycles = 0;


/***/ }),

/***/ "./public/js/gb/joypad.js":
/*!********************************!*\
  !*** ./public/js/gb/joypad.js ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Joypad: () => (/* binding */ Joypad)
/* harmony export */ });
class Joypad {
    constructor(gb, keySharedBuffer) {
        this.gb = gb;

        this._p1 = 0;

        this._key = new Int32Array(keySharedBuffer);

/*        this.start = false; //0  Enter
        this.select = false; //1 ShiftRight
        this.b = false;//2 KeyZ
        this.a = false;//3 KeyX

        this.down = false;//4  ArrowDown
        this.up = false;//5  ArrowUp
        this.left = false;//6  ArrowLeft
        this.right = false;//7  ArrowRight*/
    }

    set a(value) {
        this._key[3] = value;
    }

    get p1() {
        switch (this._p1) {
            case 0:
                return 0xc0 | (!(this._key[0] || this._key[4]) << 3) | (!(this._key[1] || this._key[5]) << 2) | (!(this._key[2] || this._key[6]) << 1) | !(this._key[3] || this._key[7]);
            case 1:
                return 0xd0 | (!this._key[0] << 3) | (!this._key[1] << 2) | (!this._key[2] << 1) | !this._key[3];
            case 2:
                return 0xe0 | (!this._key[4] << 3) | (!this._key[5] << 2) | (!this._key[6] << 1) | !this._key[7];
            case 3:
                return 0xff;
        }
    }

    set p1(value) {
        this._p1 = (value & 0x30) >> 4;
    }
}


/***/ }),

/***/ "./public/js/gb/serial.js":
/*!********************************!*\
  !*** ./public/js/gb/serial.js ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Serial: () => (/* binding */ Serial)
/* harmony export */ });
/* harmony import */ var _dummylogger_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../dummylogger.js */ "./public/dummylogger.js");
/* harmony import */ var _emulworker_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../emulworker.js */ "./public/js/emulworker.js");
 // Adjust based on actual exports


class Serial {
  constructor(gb, sbSharedBuffer, scSharedBuffer, transferTriggerSharedBuffer,
      useInternalClockSharedBuffer, sharedBuffer) {
    this.gb = gb;

    this._sb = new Int32Array(sbSharedBuffer);
    this._sc = new Int32Array(scSharedBuffer);

    this.transferTrigger = new Int32Array(transferTriggerSharedBuffer);

    //this.transferRunning = false;
    this.transferInProgress = false;

    //this.useInternalClock = false;
    this.useInternalClock = new Int32Array(useInternalClockSharedBuffer);

    this.fastClock = false;

    //this.cycleCounter = 0;
    //this.cycles = 0;
    this.divider = 0;

    this._messenger = null;

    this._isReadySc = new Int32Array(scSharedBuffer);

    //this.handleMessage = this.handleMessage.bind(this);
    this._lock = new Int32Array(sharedBuffer);

    this.serialCycle = 0;
  }

  set isReadySc(value) {
    this._isReadySc[0] = value;
  }

  get isReadySc() {
    return this._isReadySc[0];
  }

  set messenger(value) {
    this._messenger = value;
  }

  get sb() {
    const value = Atomics.load(this._sb, 0);
    (0,_dummylogger_js__WEBPACK_IMPORTED_MODULE_0__.customLog)("<< get sb ", value);
    return value;
  }

  set sb(value) {
    Atomics.store(this._sb, 0, value);
    (0,_dummylogger_js__WEBPACK_IMPORTED_MODULE_0__.customLog)(">> set sb ", value);
  }

  get sc() {
    //return 0x7e | (this.transferRunning << 7) | this.useInternalClock[0];
    const value = Atomics.load(this._sc, 0);
    (0,_dummylogger_js__WEBPACK_IMPORTED_MODULE_0__.customLog)("<< get sc ", value);
    return (0x7e | value);
  }

  set sc(value) {
    /*
        value = 128  0x 1000 0000
                129  0x 1000 0001
     */
    Atomics.store(this._sc, 0, value);
    (0,_dummylogger_js__WEBPACK_IMPORTED_MODULE_0__.customLog)(">> set sc ", value);

    if ((value | 0x7E) === 0xFF) {
      this.transferInProgress = true;
      this.divider = 0;
    }

    const clockSpeed = (value & 0b10);
    if ( clockSpeed === 0b10) {
      Serial.transferTime = Serial.cpuCyclesPerFastCycle * 8;
      //console.log("fast: " + Serial.transferTime);
    } else if ( clockSpeed === 0b0 ){
      Serial.transferTime = Serial.cpuCyclesPerCycle * 8;
      //console.log("normal: " + Serial.transferTime);
    }
  }

  cycle() {
    this.serialCycle++;

    if (this.transferInProgress) {
      if (++this.divider >= Serial.transferTime) {
        this.transferInProgress = false;
        this._messenger.postMessage({
          msg: 'Q',
          payload: this._sb[0],
          time: -1 //Atomics.load(this.gb.timing, 0)
        });
        //customLog("%c 104 serial cycle:" + this.serialCycle, "background:brown; color:white");
        this.serialCycle = 0;
        //customLog("++ serial blocked ", Atomics.load(this.gb.timing, 0));
        Atomics.store(this._lock, 0, 1);
        (0,_emulworker_js__WEBPACK_IMPORTED_MODULE_1__.saveEmulLog)("++ serial store ");
        Atomics.wait(this._lock, 0, 1); // Wait until lock is changed to 0
        (0,_emulworker_js__WEBPACK_IMPORTED_MODULE_1__.saveEmulLog)("-- serial released");
      }
    }
  }
}

Serial.frequency = 8192;
Serial.cpuCyclesPerCycle = (4194304 / 4) / Serial.frequency;//GameBoy.frequency / Serial.frequency;
Serial.transferTime = Serial.cpuCyclesPerCycle * 8;
//Serial.cpuCyclesPerCycle = (GameBoy.frequency * 4) / Serial.frequency;

Serial.fastFrequency = 262144;
Serial.cpuCyclesPerFastCycle = (4194304 / 4) / Serial.fastFrequency;//GameBoy.frequency / Serial.frequency;
//Serial.cpuCyclesPerFastCycle = GameBoy.frequency / Serial.fastFrequency;


/***/ }),

/***/ "./public/js/gb/sound.js":
/*!*******************************!*\
  !*** ./public/js/gb/sound.js ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Sound: () => (/* binding */ Sound)
/* harmony export */ });
class Sound {
    constructor(gb, soundLeftSab, soundRightSab, fillSab, bufferLen) {
        this.gb = gb;

        this.channel3WaveTable = [
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
        ];

        this.cycles = 0;
        this.frame = 0;

        this.clearState();

        this.soundEnable = false;

        /*
        this.gainNode = Sound.ctx.createGain();
        this.gainNode.gain.value = Sound.volume;
        this.gainNode.connect(Sound.ctx.destination);
        */

        /*
        this.buffer = Sound.ctx.createBuffer(2, Sound.bufferSamples, Sound.sampleFrequency);
        this.bufferLeft = this.buffer.getChannelData(0);
        this.bufferRight = this.buffer.getChannelData(1);
        */

        this.bufferLeft = new Float32Array(soundLeftSab);
        this.bufferRight = new Float32Array(soundRightSab);

        this.filled = new Int32Array(fillSab);
        this.bufferLen = bufferLen;
        this.genCount = 0;

        this._messenger = null;
    }

    set messenger(value) {
        this._messenger = value;
    }

    get nr10() {
        return 0x80 | (this.channel1SweepDuration << 4) | (this.channel1SweepDown << 3) | this.channel1SweepShift;
    }

    set nr10(value) {
        this.channel1SweepDuration = (value & 0x70) >> 4;
        this.channel1SweepDown = (value & 0x8) != 0;
        this.channel1SweepShift = value & 0x7;
    }

    get nr11() {
        return 0x3f | (this.channel1Duty << 6);
    }

    set nr11(value) {
        this.channel1Duty = (value & 0xc0) >> 6;
        this.channel1LengthCounter = 64 - (value & 0x3f);
    }

    get nr12() {
        return (this.channel1InitialVolume << 4) | (this.channel1VolumeUp << 3) | this.channel1EnvelopeDuration;
    }

    set nr12(value) {
        this.channel1InitialVolume = (value & 0xf0) >> 4;
        this.channel1VolumeUp = (value & 0x8) != 0;
        this.channel1EnvelopeDuration = value & 0x7;
    }

    get nr13() {
        return 0xff;
    }

    set nr13(value) {
        this.channel1Frequency = (this.channel1Frequency & 0x700) | value;
    }

    get nr14() {
        return 0xbf | (this.channel1LengthEnable << 6);
    }

    set nr14(value) {
        this.channel1Trigger = (value & 0x80) != 0;
        this.channel1LengthEnable = (value & 0x40) != 0;
        this.channel1Frequency = ((value & 0x7) << 8) | (this.channel1Frequency & 0xff);
    }

    get nr21() {
        return 0x3f | (this.channel2Duty << 6);
    }

    set nr21(value) {
        this.channel2Duty = (value & 0xc0) >> 6;
        this.channel2LengthCounter = 64 - (value & 0x3f);
    }

    get nr22() {
        return (this.channel2InitialVolume << 4) | (this.channel2VolumeUp << 3) | this.channel2EnvelopeDuration;
    }

    set nr22(value) {
        this.channel2InitialVolume = (value & 0xf0) >> 4;
        this.channel2VolumeUp = (value & 0x8) != 0;
        this.channel2EnvelopeDuration = value & 0x7;
    }

    get nr23() {
        return 0xff;
    }

    set nr23(value) {
        this.channel2Frequency = (this.channel2Frequency & 0x700) | value;
    }

    get nr24() {
        return 0xbf | (this.channel2LengthEnable << 6);
    }

    set nr24(value) {
        this.channel2Trigger = (value & 0x80) != 0;
        this.channel2LengthEnable = (value & 0x40) != 0;
        this.channel2Frequency = ((value & 0x7) << 8) | (this.channel2Frequency & 0xff);
    }

    get nr30() {
        return 0x7f | (this.channel3Play << 7);
    }

    set nr30(value) {
        this.channel3Play = (value & 0x80) != 0;
    }

    get nr31() {
        return 0xff;
    }

    set nr31(value) {
        this.channel3LengthCounter = 256 - value;
    }

    get nr32() {
        return 0x9f | (this.channel3Volume << 5);
    }

    set nr32(value) {
        this.channel3Volume = (value & 0x60) >> 5;
    }

    get nr33() {
        return 0xff;
    }

    set nr33(value) {
        this.channel3Frequency = (this.channel3Frequency & 0x700) | value;
    }

    get nr34() {
        return 0xbf | (this.channel3LengthEnable << 6);
    }

    set nr34(value) {
        this.channel3Trigger = (value & 0x80) != 0;
        this.channel3LengthEnable = (value & 0x40) != 0;
        this.channel3Frequency = ((value & 0x7) << 8) | (this.channel3Frequency & 0xff);
    }

    get nr41() {
        return 0xff;
    }

    set nr41(value) {
        this.channel4LengthCounter = 64 - (value & 0x3f);
    }

    get nr42() {
        return (this.channel4InitialVolume << 4) | (this.channel4VolumeUp << 3) | this.channel4EnvelopeDuration;
    }

    set nr42(value) {
        this.channel4InitialVolume = (value & 0xf0) >> 4;
        this.channel4VolumeUp = (value & 0x8) != 0;
        this.channel4EnvelopeDuration = value & 0x7;
    }

    get nr43() {
        return (this.channel4ShiftClockFrequency << 4) | (this.channel4CounterStep << 3) | this.channel4DivisionRatio;
    }

    set nr43(value) {
        this.channel4ShiftClockFrequency = (value & 0xf0) >> 4;
        this.channel4CounterStep = (value & 0x8) != 0;
        this.channel4DivisionRatio = value & 0x7;
    }

    get nr44() {
        return 0xbf | (this.channel4LengthEnable << 6);
    }

    set nr44(value) {
        this.channel4Trigger = (value & 0x80) != 0;
        this.channel4LengthEnable = (value & 0x40) != 0;
    }

    get nr50() {
        return (this.outputVinRight << 7) | (this.rightVolume << 4) | (this.outputVinLeft << 3) | this.leftVolume;
    }

    set nr50(value) {
        this.outputVinRight = (value & 0x80) != 0;
        this.rightVolume = (value & 0x70) >> 4;
        this.outputVinLeft = (value & 0x8) != 0;
        this.leftVolume = value & 0x7;
    }

    get nr51() {
        return (this.channel4RightEnable << 7) | (this.channel3RightEnable << 6) | (this.channel2RightEnable << 5) | (this.channel1RightEnable << 4) | (this.channel4LeftEnable << 3) | (this.channel3LeftEnable << 2) | (this.channel2LeftEnable << 1) | this.channel1LeftEnable;
    }

    set nr51(value) {
        this.channel4RightEnable = (value & 0x80) != 0;
        this.channel3RightEnable = (value & 0x40) != 0;
        this.channel2RightEnable = (value & 0x20) != 0;
        this.channel1RightEnable = (value & 0x10) != 0;
        this.channel4LeftEnable = (value & 0x8) != 0;
        this.channel3LeftEnable = (value & 0x4) != 0;
        this.channel2LeftEnable = (value & 0x2) != 0;
        this.channel1LeftEnable = (value & 0x1) != 0;
    }

    get nr52() {
        return 0x70 | (this.soundEnable << 7) | (this.channel4Enable << 3) | (this.channel3Enable << 2) | (this.channel2Enable << 1) | this.channel1Enable;
    }

    set nr52(value) {
        this.soundEnable = (value & 0x80) != 0;
        if (!this.soundEnable) {
            this.clearState();
        }
    }

    readAddress(address) {
        if (address <= 0x2f) {
            switch (address) {
                case 0x10: return this.nr10;
                case 0x11: return this.nr11;
                case 0x12: return this.nr12;
                case 0x13: return this.nr13;
                case 0x14: return this.nr14;
                case 0x16: return this.nr21;
                case 0x17: return this.nr22;
                case 0x18: return this.nr23;
                case 0x19: return this.nr24;
                case 0x1a: return this.nr30;
                case 0x1b: return this.nr31;
                case 0x1c: return this.nr32;
                case 0x1d: return this.nr33;
                case 0x1e: return this.nr34;
                case 0x20: return this.nr41;
                case 0x21: return this.nr42;
                case 0x22: return this.nr43;
                case 0x23: return this.nr44;
                case 0x24: return this.nr50;
                case 0x25: return this.nr51;
                case 0x26: return this.nr52;
                default: return 0xff;
            }
        } else {
            return this.readWave(address & 0xf);
        }
    }

    writeAddress(address, value) {
        if (this.soundEnable) {
            if (address <= 0x2f) {
                switch (address) {
                    case 0x10: this.nr10 = value; break;
                    case 0x11: this.nr11 = value; break;
                    case 0x12: this.nr12 = value; break;
                    case 0x13: this.nr13 = value; break;
                    case 0x14: this.nr14 = value; break;
                    case 0x16: this.nr21 = value; break;
                    case 0x17: this.nr22 = value; break;
                    case 0x18: this.nr23 = value; break;
                    case 0x19: this.nr24 = value; break;
                    case 0x1a: this.nr30 = value; break;
                    case 0x1b: this.nr31 = value; break;
                    case 0x1c: this.nr32 = value; break;
                    case 0x1d: this.nr33 = value; break;
                    case 0x1e: this.nr34 = value; break;
                    case 0x20: this.nr41 = value; break;
                    case 0x21: this.nr42 = value; break;
                    case 0x22: this.nr43 = value; break;
                    case 0x23: this.nr44 = value; break;
                    case 0x24: this.nr50 = value; break;
                    case 0x25: this.nr51 = value; break;
                    case 0x26: this.nr52 = value; break;
                    default: break;
                }
            } else {
                this.writeWave(address & 0xf, value);
            }
        } else if (address == 0x26) {
            this.nr52 = value;
        }
    }

    readWave(address) {
        return (this.channel3WaveTable[address * 2] << 4) | this.channel3WaveTable[address * 2 + 1];
    }

    writeWave(address, value) {
        this.channel3WaveTable[address * 2] = (value & 0xf0) >> 4;
        this.channel3WaveTable[address * 2 + 1] = value & 0xf;
    }

    clearState() {
        this.frame = 0;
        this.channel1Enable = false;
        this.channel2Enable = false;
        this.channel3Enable = false;
        this.channel4Enable = false;
        this.channel1SweepDuration = 0;
        this.channel1SweepDown = false;
        this.channel1SweepShift = 0;
        this.channel1SweepEnable = false;
        this.channel1Duty = 0;
        this.channel1InitialVolume = 0;
        this.channel1VolumeUp = false;
        this.channel1EnvelopeDuration = 0;
        this.channel1Frequency = 0;
        this.channel1Trigger = false;
        this.channel1LengthEnable = false;
        this.channel2Duty = 0;
        this.channel2InitialVolume = 0;
        this.channel2VolumeUp = false;
        this.channel2EnvelopeDuration = 0;
        this.channel2Frequency = 0;
        this.channel2Trigger = false;
        this.channel2LengthEnable = false;
        this.channel3Play = false;
        this.channel3Volume = 0;
        this.channel3Frequency = 0;
        this.channel3Trigger = false;
        this.channel3LengthEnable = false;
        this.channel4InitialVolume = 0;
        this.channel4VolumeUp = false;
        this.channel4EnvelopeDuration = 0;
        this.channel4ShiftClockFrequency = 0;
        this.channel4CounterStep = false;
        this.channel4DivisionRatio = 0;
        this.channel4Trigger = false;
        this.channel4LengthEnable = false;
        this.outputVinRight = false;
        this.rightVolume = 0;
        this.outputVinLeft = false;
        this.leftVolume = 0;
        this.channel1LeftEnable = false;
        this.channel2LeftEnable = false;
        this.channel3LeftEnable = false;
        this.channel4LeftEnable = false;
        this.channel1RightEnable = false;
        this.channel2RightEnable = false;
        this.channel3RightEnable = false;
        this.channel4RightEnable = false;
    }

    genLFSR() {

        if(this.channel4CounterStep) {
            this.genCount++;
            if(this.genCount > 127 || this.genCount == 1) {
                this.channel4LFSR = 0x7fff;
                return;
            }
        }

        const tmp = ((this.channel4LFSR & 0x2) >> 1) ^ (this.channel4LFSR & 0x1);
        this.channel4LFSR = (tmp << 14) | (this.channel4LFSR >> 1);
        if (this.channel4CounterStep) {
            this.channel4LFSR = (this.channel4LFSR & 0x7fbf) | (tmp << 6);
        }
    }

    updateLength() {
        if (this.channel1LengthEnable) {
            this.channel1LengthCounter--;
            if (this.channel1LengthCounter == 0) {
                this.channel1Enable = false;
            }
        }
        if (this.channel2LengthEnable) {
            this.channel2LengthCounter--;
            if (this.channel2LengthCounter == 0) {
                this.channel2Enable = false;
            }
        }
        if (this.channel3LengthEnable) {
            this.channel3LengthCounter--;
            if (this.channel3LengthCounter == 0) {
                this.channel3Enable = false;
            }
        }
        if (this.channel4LengthEnable) {
            this.channel4LengthCounter--;
            if (this.channel4LengthCounter == 0) {
                this.channel4Enable = false;
            }
        }
    }

    updateSweep() {
        this.channel1SweepCounter--;
        if (this.channel1SweepCounter <= 0) {
            this.channel1SweepCounter = this.channel1SweepDuration;
            if (this.channel1SweepDuration != 0 && this.channel1SweepEnable) {
                let tmp = this.channel1SweepFrequency + (this.channel1SweepDown ? -1 : 1) * (this.channel1SweepFrequency >> this.channel1SweepShift);
                if (tmp > 2047) {
                    this.channel1Enable = false;
                } else if (this.channel1SweepShift != 0) {
                    this.channel1Frequency = this.channel1SweepFrequency = tmp;
                    tmp = tmp + (this.channel1SweepDown ? -1 : 1) * (tmp >> this.channel1SweepShift);
                    if (tmp > 2047) {
                        this.channel1Enable = false;
                    }
                }
            }
        }
    }

    updateVolume() {
        if (this.channel1Enable && this.channel1EnvelopeDuration != 0) {
            this.channel1EnvelopeCounter--;
            if (this.channel1EnvelopeCounter == 0) {
                this.channel1EnvelopeCounter = this.channel1EnvelopeDuration;
                if (this.channel1VolumeUp && this.channel1Volume < 15) {
                    this.channel1Volume++;
                }
                if (!this.channel1VolumeUp && this.channel1Volume > 0) {
                    this.channel1Volume--;
                }
            }
        }
        if (this.channel2Enable && this.channel2EnvelopeDuration != 0) {
            this.channel2EnvelopeCounter--;
            if (this.channel2EnvelopeCounter == 0) {
                this.channel2EnvelopeCounter = this.channel2EnvelopeDuration;
                if (this.channel2VolumeUp && this.channel2Volume < 15) {
                    this.channel2Volume++;
                }
                if (!this.channel2VolumeUp && this.channel2Volume > 0) {
                    this.channel2Volume--;
                }
            }
        }
        if (this.channel4Enable && this.channel4EnvelopeDuration != 0) {
            this.channel4EnvelopeCounter--;
            if (this.channel4EnvelopeCounter == 0) {
                this.channel4EnvelopeCounter = this.channel4EnvelopeDuration;
                if (this.channel4VolumeUp && this.channel4Volume < 15) {
                    this.channel4Volume++;
                }
                if (!this.channel4VolumeUp && this.channel4Volume > 0) {
                    this.channel4Volume--;
                }
            }
        }
    }

    updateTrigger() {
        if (this.channel1Trigger) {
            this.channel1Trigger = false;
            this.channel1Enable = true;
            this.channel1FrequencyCounter = (2048 - this.channel1Frequency) * Sound.cyclesPerPulse;
            if (this.channel1LengthCounter == 0) {
                this.channel1LengthCounter = 64;
            }
            this.channel1SweepFrequency = this.channel1Frequency;
            this.channel1SweepCounter = this.channel1SweepDuration;
            this.channel1SweepEnable = this.channel1SweepDuration != 0 || this.channel1SweepShift != 0;
            this.channel1EnvelopeCounter = this.channel1EnvelopeDuration;
            this.channel1Volume = this.channel1InitialVolume;
            this.channel1Index = 0;
            if (this.channel1SweepShift > 0) {
                const tmp = this.channel1SweepFrequency + (this.channel1SweepDown ? -1 : 1) * (this.channel1SweepFrequency >> this.channel1SweepShift);
                if (tmp > 2047) {
                    this.channel1Enable = false;
                } else if (tmp >= 0) {
                    this.channel1Frequency = this.channel1SweepFrequency = tmp;
                }
            }
        }
        if (this.channel2Trigger) {
            this.channel2Trigger = false;
            this.channel2Enable = true;
            this.channel2FrequencyCounter = (2048 - this.channel2Frequency) * Sound.cyclesPerPulse;
            if (this.channel2LengthCounter == 0) {
                this.channel2LengthCounter = 64;
            }
            this.channel2EnvelopeCounter = this.channel2EnvelopeDuration;
            this.channel2Volume = this.channel2InitialVolume;
            this.channel2Index = 0;
        }
        if (this.channel3Trigger) {
            this.channel3Trigger = false;
            this.channel3Enable = true;
            this.channel3FrequencyCounter = (2048 - this.channel3Frequency) * Sound.cyclesPerWave;
            if (this.channel3LengthCounter == 0) {
                this.channel3LengthCounter = 256;
            }
            this.channel3Index = 0;
        }
        if (this.channel4Trigger) {
            this.channel4Trigger = false;
            this.channel4Enable = true;
            this.channel4FrequencyCounter = Sound.divisionRatios[this.channel4DivisionRatio] << this.channel4ShiftClockFrequency;
            if (this.channel4LengthCounter == 0) {
                this.channel4LengthCounter = 64;
            }
            this.channel4EnvelopeCounter = this.channel4EnvelopeDuration;
            this.channel4Volume = this.channel4InitialVolume;
            this.channel4LFSR = 0x7fff;
            this.genCount = 0;
        }
    }

    updateDAC() {
        if (this.channel1Enable && this.channel1InitialVolume == 0 && !this.channel1VolumeUp) {
            this.channel1Enable = false;
        }
        if (this.channel2Enable && this.channel2InitialVolume == 0 && !this.channel2VolumeUp) {
            this.channel2Enable = false;
        }
        if (this.channel3Enable && !this.channel3Play) {
            this.channel3Enable = false;
        }
        if (this.channel4Enable && this.channel4InitialVolume == 0 && !this.channel4VolumeUp) {
            this.channel4Enable = false;
        }
    }

    updateFrequency() {
        let left = 0;
        let right = 0;
        if (this.channel1Enable) {
            this.channel1FrequencyCounter -= Sound.cyclesPerSample;
            while (this.channel1FrequencyCounter <= 0) {
                this.channel1FrequencyCounter += (2048 - this.channel1Frequency) * Sound.cyclesPerPulse;
                this.channel1Index = (this.channel1Index + 1) % 8;
            }
            if (this.channel1Volume != 0) {
                const signal = Sound.pulseTable[this.channel1Duty][this.channel1Index] * this.channel1Volume / 15;
                if (this.channel1LeftEnable) {
                    left += signal;
                }
                if (this.channel1RightEnable) {
                    right += signal;
                }
            }
        }
        if (this.channel2Enable) {
            this.channel2FrequencyCounter -= Sound.cyclesPerSample;
            while (this.channel2FrequencyCounter <= 0) {
                this.channel2FrequencyCounter += (2048 - this.channel2Frequency) * Sound.cyclesPerPulse;
                this.channel2Index = (this.channel2Index + 1) % 8;
            }
            if (this.channel2Volume != 0) {
                const signal = Sound.pulseTable[this.channel2Duty][this.channel2Index] * this.channel2Volume / 15;
                if (this.channel2LeftEnable) {
                    left += signal;
                }
                if (this.channel2RightEnable) {
                    right += signal;
                }
            }
        }
        if (this.channel3Enable) {
            this.channel3FrequencyCounter -= Sound.cyclesPerSample;
            while (this.channel3FrequencyCounter <= 0) {
                this.channel3FrequencyCounter += (2048 - this.channel3Frequency) * Sound.cyclesPerWave;
                this.channel3Index = (this.channel3Index + 1) % 32;
            }
            if (this.channel3Volume != 0) {
                const signal = (this.channel3WaveTable[this.channel3Index] >> Sound.volumeShift[this.channel3Volume]) / 15;
                if (this.channel3LeftEnable) {
                    left += signal;
                }
                if (this.channel3RightEnable) {
                    right += signal;
                }
            }
        }
        if (this.channel4Enable) {
            this.channel4FrequencyCounter -= Sound.cyclesPerSample;
            while (this.channel4FrequencyCounter <= 0) {
                this.channel4FrequencyCounter += Sound.divisionRatios[this.channel4DivisionRatio] << this.channel4ShiftClockFrequency;
                this.genLFSR();
            }

            if(this.channel4CounterStep && this.genCount > 127) {
                this.genCount = 0;
            }

            if (this.channel4Volume != 0) {
                const signal = (~this.channel4LFSR & 0b1) * this.channel4Volume / 15;
                if (this.channel4LeftEnable) {
                    left += signal;
                }
                if (this.channel4RightEnable) {
                    right += signal;
                }
            }
        }
        left *= (this.leftVolume + 1) / 8;
        right *= (this.rightVolume + 1) / 8;

        const idx = (this.cycles / Sound.cyclesPerSample) % this.bufferLen;
        this.bufferLeft[idx] = left / Sound.channelCount + Sound.ctxKeeper;
        this.bufferRight[idx] = right / Sound.channelCount + Sound.ctxKeeper;
  
        if(((this.cycles / Sound.cyclesPerSample) % Sound.bufferSamples) == (Sound.bufferSamples - 1)) {
            const old = Atomics.add(this.filled, 0, Sound.bufferSamples);
            //console.log("fill: " + (old + Sound.bufferSamples));
        }
    }

    cycle() {
        this.cycles += Sound.cyclesPerCPUCycle;
        //this.cycles = (this.cycles + Sound.cyclesPerCPUCycle) % this.bufferLen; // 4096(bufferSamples) * 8 == 32768  소리 안 남..

        if (this.soundEnable) {
            if (this.cycles % Sound.cyclesPerSample == 0) {
                this.updateTrigger();
                this.updateDAC();
                this.updateFrequency();
            }
            if (this.cycles % Sound.cyclesPerFrame == 0) {
                this.frame++;
                switch (this.frame % 8) {
                    case 2:
                    case 6:
                        this.updateSweep();
                    case 0:
                    case 4:
                        this.updateLength();
                        break;
                    case 7:
                        this.updateVolume();
                        break;
                }
            }
        }
    }
}
Sound.frequency = 4194304;//4194304
Sound.cyclesPerCPUCycle = Sound.frequency / (4194304 / 4);//GameBoy.frequency;
Sound.pulseFrequency = Sound.frequency / 4;//1048576;
Sound.cyclesPerPulse = Sound.frequency / Sound.pulseFrequency;
Sound.waveFrequency = Sound.frequency / 2;//2097152;
Sound.cyclesPerWave = Sound.frequency / Sound.waveFrequency;
Sound.bufferSamples = Sound.frequency / 1024;//4096;
Sound.sampleFrequency = Sound.frequency / 64;//65536;
Sound.bufferDuration = Sound.bufferSamples / Sound.sampleFrequency; // 0.0625
Sound.latency = 0.125;  // (4096/65536)*2
Sound.volume = 0.25;
Sound.frameFrequency = Sound.frequency / (8192);//   Sound.frequency / 8192;   //512;
Sound.cyclesPerFrame = Sound.frequency / Sound.frameFrequency;  // 8192
Sound.cyclesPerSample = Sound.frequency / Sound.sampleFrequency; // 64
Sound.cyclesPerBuffer = Sound.cyclesPerSample * Sound.bufferSamples; // 262144
Sound.channelCount = 4;
Sound.pulseTable = [
    [0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 1, 1, 1],
    [0, 1, 1, 1, 1, 1, 1, 0],
];
Sound.volumeShift = [
    4, 0, 1, 2,
];
Sound.divisionRatios = [
    2, 4, 8, 12, 16, 20, 24, 28,
].map((value => value * Sound.cyclesPerCPUCycle));
//Sound.ctx = new (window.AudioContext || window.webkitAudioContext)();
Sound.ctxKeeper = 0.000001;

/***/ }),

/***/ "./public/js/gb/timer.js":
/*!*******************************!*\
  !*** ./public/js/gb/timer.js ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Timer: () => (/* binding */ Timer)
/* harmony export */ });
/* harmony import */ var _cpu_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./cpu.js */ "./public/js/gb/cpu.js");


class Timer {
    constructor(gb) {
        this.gb = gb;

        this._div = 0;
        this._tima = 0;
        this._tma = 0;
        this.timerEnable = false;
        this.clockSelect = 0;

        this.overflow = false;
    }

    get div() {
        return this._div >> 8;
    }

    set div(value) {
        if (this.tacBit) {
            this.timaIncrement();
        }
        this._div = 0;
    }

    get tima() {
        return this._tima;
    }

    set tima(value) {
        if (!this.overflow) {
            this._tima = value;
        }
    }

    get tma() {
        return this._tma;
    }

    set tma(value) {
        this._tma = value;
        if (this.overflow) {
            this._tima = this._tma;
        }
    }

    get tac() {
        return 0xf8 | (this.timerEnable << 2) | this.clockSelect;
    }

    set tac(value) {
        const oldBit = this.timerEnable && this.tacBit;
        this.timerEnable = (value & 0x4) != 0;
        this.clockSelect = value & 0x3;
        const newBit = this.timerEnable && this.tacBit;
        if (oldBit && !newBit) {
            this.timaIncrement();
        }
    }

    get tacBit() {
        return (this._div & Timer.tacBits[this.clockSelect]) != 0;
    }

    timaIncrement() {
        this._tima = (this._tima + 1) & 0xff;
        this.overflow = this._tima == 0;
    }

    cycle() {
        if (this.overflow) {
            this._div = (this._div + Timer.cyclesPerCPUCycle) & 0xffff;
            this.overflow = false;
            this._tima = this._tma;
            this.gb.requestInterrupt(_cpu_js__WEBPACK_IMPORTED_MODULE_0__.GameBoy.timerInterrupt);
        } else if (this.timerEnable && this.tacBit) {
            this._div = (this._div + Timer.cyclesPerCPUCycle) & 0xffff;
            if (!this.tacBit) {
                this.timaIncrement();
            }
        } else {
            this._div = (this._div + Timer.cyclesPerCPUCycle) & 0xffff;
        }
    }
}
Timer.tacBits = [
    0x200, 0x8, 0x20, 0x80,
];
Timer.frequency = 4194304;
Timer.cyclesPerCPUCycle = Timer.frequency / (4194304 / 4);//GameBoy.frequency;


/***/ }),

/***/ "./public/js/orderlock.js":
/*!********************************!*\
  !*** ./public/js/orderlock.js ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   OrderLock: () => (/* binding */ OrderLock)
/* harmony export */ });
const locked = 1;
const unlocked = 0;

/*
   INT_SIZE should be 2 to the power of n
   to use bitwise operation as modular operation.
*/
const INT_SIZE = 32;
const BIT_MOD = INT_SIZE - 1; 

class OrderLock {
  /**
   * Instantiate Mutex.
   * If opt_sab is provided, the mutex will use it as a backing array.
   * @param {SharedArrayBuffer} opt_sab Optional SharedArrayBuffer.
   */
  /*
  constructor(opt_sab, opt_queue_sab, opt_front, opt_end, opt_reserved) {
    this._sab = opt_sab || new SharedArrayBuffer(4);
    this._mu = new Int32Array(this._sab);

    this._queue_sab = opt_queue_sab || new SharedArrayBuffer(4*(INT_SIZE));
    this._queue = new Int32Array(this._queue_sab);

    this._front_sab = opt_front || new SharedArrayBuffer(4);
    this._end_sab = opt_end || new SharedArrayBuffer(4);

    this._front = new Int32Array(this._front_sab);
    this._end = new Int32Array(this._end_sab);

    this._reserved_sab = opt_reserved || new SharedArrayBuffer(4*(INT_SIZE));
    this._reserved = new Int32Array(this._reserved_sab);
    Atomics.store(this._reserved, 0 , -1);
  }
  */

  constructor(opt_sab, opt_order, opt_main, opt_worker, opt_dsab, opt_enter_order, opt_queue_sab, opt_front, opt_end, opt_reserved) {
    this._sab = opt_sab || new SharedArrayBuffer(4);
    this._mu = new Int32Array(this._sab);

    this._order_buffer = opt_order || new SharedArrayBuffer(4*(INT_SIZE));
    this._order = new Int32Array(this._order_buffer);
    this._order[0] = 1;

    this._main_buffer = opt_main || new SharedArrayBuffer(4*(INT_SIZE));
    this._main = new Int32Array(this._main_buffer);

    this._worker_buffer = opt_worker || new SharedArrayBuffer(4*(INT_SIZE));
    this._worker = new Int32Array(this._worker_buffer);

    this._dsab = opt_dsab || new SharedArrayBuffer(4);
    this._door = new Int32Array(this._dsab);

    this._enter_order_buffer = opt_enter_order || new SharedArrayBuffer(4*(INT_SIZE));
    this._enter_order = new Int32Array(this._enter_order_buffer);
    this._enter_order[0] = 1;

    this._queue_sab = opt_queue_sab || new SharedArrayBuffer(4*(INT_SIZE));
    this._queue = new Int32Array(this._queue_sab);

    this._front_sab = opt_front || new SharedArrayBuffer(4);
    this._end_sab = opt_end || new SharedArrayBuffer(4);

    this._front = new Int32Array(this._front_sab);
    this._end = new Int32Array(this._end_sab);

    this._reserved_sab = opt_reserved || new SharedArrayBuffer(4*(INT_SIZE));
    this._reserved = new Int32Array(this._reserved_sab);
    this._reserved[0] = -1;
  }

  /**
   * Instantiate a Mutex connected to the given one.
   * @param {OrderLock} mu the other Mutex.
   */
  static connect(mu) {
    //return new OrderLock(mu._sab, mu._queue_sab, mu._front_sab, mu._end_sab, mu._reserved_sab);
    return new OrderLock(mu._sab, mu._order_buffer, mu._main_buffer, mu._worker_buffer, mu._dsab, 
      mu._enter_order_buffer, mu._queue_sab, mu._front_sab, mu._end_sab, mu._reserved_sab);
  }


  //---------------------------------------------------------

  lock() {
    const enterId = this.getId();
    for(;;) {
        if (Atomics.compareExchange(this._mu, 0, unlocked, locked) == unlocked) {
          // get lock
          return enterId;
        }
        Atomics.wait(this._mu, 0, locked);
    }
  }

  spinLock() {
    const enterId = this.getId();
    for(;;) {
        if (Atomics.compareExchange(this._mu, 0, unlocked, locked) == unlocked) {
          // get lock
          return enterId;
        }
        //Atomics.wait(this._mu, 0, locked);
    }
  }

  getId() {
    const enterId = Atomics.add(this._order, 0, 1) % INT_SIZE;
    Atomics.and(this._order, 0, BIT_MOD);
    return enterId;
  }

  unLock() { 
    if (Atomics.compareExchange(this._mu, 0, locked, unlocked) != locked) {
        throw new Error("Mutex is in inconsistent state: unlock on unlocked Mutex.");
    }
    Atomics.notify(this._mu, 0, 1);
  }
  /**
   *  this._worker[0] is wait flag.
   */
  getWaitLock() {
    console.log("emul [WANT LOCK]");
    for(;;) {
      if(Atomics.load(this._main, 0) === 0) {    // is the other reserved?
        if (Atomics.compareExchange(this._mu, 0, unlocked, locked) == unlocked) {
          return;
        }
      }
      Atomics.store(this._worker, 0, 1);
      console.log("emul [WAIT     ]", Atomics.load(this._main, 0));
      Atomics.wait(this._mu, 0, locked);
    }
  }

  getWaitSpinLock() {
    let notWait = true;
    console.log("     [WANT LOCK]");
    for(;;) {
      if(Atomics.load(this._worker, 0) === 0) {    // is the other reserved?
        if (Atomics.compareExchange(this._mu, 0, unlocked, locked) == unlocked) {
          return;
        }
      }
      if(notWait) {
        console.log("     [WAIT     ]");
        Atomics.store(this._main, 0, 1);
        notWait = false;
      }
    }
  }

  releaseWaitLock() {
    if (Atomics.compareExchange(this._mu, 0, locked, unlocked) != locked) {
      throw new Error("Mutex is in inconsistent state: unlock on unlocked Mutex.");
    }
    Atomics.store(this._worker, 0, 0);
    Atomics.notify(this._mu, 0, 1)
  }

  releaseWaitSpinLock() {
    if (Atomics.compareExchange(this._mu, 0, locked, unlocked) != locked) {
        throw new Error("Mutex is in inconsistent state: unlock on unlocked Mutex.");
    }
    Atomics.store(this._main, 0, 0);
    Atomics.notify(this._mu, 0, 1)
  }


  getIncreasingOrderLock() {
    for(;;) {
      if(this._worker[0] <= this._main[0]) {    // is reserved?
        if (Atomics.compareExchange(this._mu, 0, unlocked, locked) == unlocked) {
          return;
        }
      }
      Atomics.store(this._main, 0, Atomics.add(this._order, 0 ,1));
      Atomics.wait(this._mu, 0, locked);
    }
  }

  getIncreasingOrderSpinLock() {
    let waitId = -1;
    for(;;) {
      if(this._worker[0] >= this._main[0]) {    
        if (Atomics.compareExchange(this._mu, 0, unlocked, locked) == unlocked) {
          return;
        }
      }
      if(waitId < 0) {
        waitId = Atomics.store(this._worker, 0, Atomics.add(this._order, 0 ,1));
      }
    }
  }

  releaseIncreasingOrderLock() { 
    if (Atomics.compareExchange(this._mu, 0, locked, unlocked) != locked) {
        throw new Error("Mutex is in inconsistent state: unlock on unlocked Mutex.");
    }
    Atomics.store(this._worker, 0, Atomics.add(this._order, 0 ,1));
    Atomics.notify(this._mu, 0, 1)
  }

  releaseIncreasingOrderSpinLock() { 
    if (Atomics.compareExchange(this._mu, 0, locked, unlocked) != locked) {
        throw new Error("Mutex is in inconsistent state: unlock on unlocked Mutex.");
    }
    Atomics.store(this._main, 0, Atomics.add(this._order, 0 ,1));
    Atomics.notify(this._mu, 0, 1)
  }
  
  /*
                    notify A, front==end(the last one in the queue), empty
                                    lock() from emul // newbie intercept
       A lockAsync(),
                    
  */
  lockQueue() {
    for(;;) {
        if(this.isReserved()) {
          Atomics.wait(this._queue, this.enqueue(), locked);
        }

        if (Atomics.compareExchange(this._mu, 0, unlocked, locked) == unlocked) {
          // get lock
          return;
        }
        //Atomics.wait(this._mu, 0, locked);
        Atomics.wait(this._queue, this.enqueue(), locked);
        // retry should success. because it is waked up by orderd
      }
  }

  lockAsync(waitId) {
    ////console.log("lockAsync :" + waitId);
    if(waitId == null) {                // newbie
        if(this.isReserved()) {         // waiters
            return this.getWaitAsync();
        } else {                        // empty
            return this.getlockAsync();
        }
    }
    
    if(waitId != null && this.isQualified(waitId)) {
        console.log("QUALIFED: " + waitId);
        return this.getlockAsync();
    } else {
        throw new Error("error with waitId: " + waitId + " reserved: " + this._reserved[0]);
    }
  }

  getWaitAsync() {
    const waitId = this.enqueue();
    let waitObj;
    waitObj = Atomics.waitAsync(this._queue, waitId, locked);
    if(waitObj.async == false) {
        this.dequeue();
    }
    return {waitObj:waitObj, waitId:waitId};
  }

  getlockAsync() {
    if(Atomics.compareExchange(this._mu, 0, unlocked, locked) == unlocked) {
      return {waitObj:null, waitId:null};
    }
    //return Atomics.waitAsync(this._mu, 0, locked);
    return this.getWaitAsync();
  }

  /*
  -----------------------------------------------------------------------
  */

  lockByOrder() {
    const enterId = this.getId();
    this.waitLoop(enterId);
    let waitId = -1;

    this.doorLock();
    /*
        if wait by reserved one, it wakeup once by its waitId
    */
    if(this.isReserved()) { // after dequeue
      //this.waitLoop(enterId);
      waitId = this.enqueue();
      this.addEnterOrder();

      this.doorUnLock();

      Atomics.wait(this._queue, waitId, locked);

      if (Atomics.compareExchange(this._mu, 0, unlocked, locked) == unlocked) {
        //this.addEnterOrder();
        return;
      } else {
        throw new Error("order broken");
      }
    }
    
    /*
        empty queue, let's compete
    */
    for(;;) {
      if (Atomics.compareExchange(this._mu, 0, unlocked, locked) == unlocked) {
        if(waitId < 0) {
          this.addEnterOrder();
          this.doorUnLock();
        }
        return;
      }

      if(waitId > -1) {
        throw new Error("order broken");
      }

      //this.waitLoop(enterId);
      waitId = this.enqueue();
      this.addEnterOrder();

      this.doorUnLock();

      Atomics.wait(this._queue, waitId, locked);
    }
  }

  /*
      emul 과 adapter 간의 진입 순서를 가르기 위함인듯.
      
      't2 adapter thread에서 spinlock 사용시(queue 없이) t3 emul thread가 새치기 할 수 있음'
               t1.gelock
      t2.wait
               t1.unlock
               t3.getLock
      t2.wait
      --> 이를 막기 위한 waitLoop


      emul 1 개 처리동안 adapter 에서 2 개 요청 들어오는 케이스
      enterOrder, enterId
          1         1      t1 call    emul
          1         2      t2 call    adapter  enterId of t2 = 1 // enterId+1, waitLoop(1 < 2)
          2         2      t1 getLock                            // enterOrder+1 -> break t2's waitLoop
          3         2      t2 waitAsync                          // enqueue -> enterOrder+1
          3         3      t3 call    adapter  enterId of t3 = 2 // enterId+1, pass waitLoop
          4         3      t3 waitAsync                          // enqueue -> enterOrder+1
                           t1 unlock
          4         3      t2 getLock


          when add enterOrder? 내 처리 끝나고 후배들 waitLoop 풀어주기 위해, 혹은 뉴비가 pass 할 수 있게 준비.
          after wait  ?
          after get lock ?  
          -> 둘 다
  */
  waitLoop(enterId) {
    while(Atomics.load(this._enter_order, 0) < enterId) { }
    return;
  }

  doorLock() {
    for(;;) {
        if (Atomics.compareExchange(this._door, 0, unlocked, locked) == unlocked) {
          return;
        }
        Atomics.wait(this._door, 0, locked);
    }
  }

  doorSpinLock() {
    for(;;) {
        if (Atomics.compareExchange(this._door, 0, unlocked, locked) == unlocked) {
          return;
        }
    }
  }

  doorUnLock() { 
    if (Atomics.compareExchange(this._door, 0, locked, unlocked) != locked) {
        throw new Error("Mutex is in inconsistent state: unlock on unlocked Mutex.");
    }
    Atomics.notify(this._door, 0, 1);
  }

  addEnterOrder() {
    Atomics.add(this._enter_order, 0, 1);
  }

  lockAsyncByOrder() {
    const enterId = this.getId();
    this.waitLoop(enterId);

    this.doorSpinLock();

    if(this.isReserved()) {
      return this.getWaitAsyncByOrder(enterId);
    } else {
      return this.getLockAsyncByOrder(enterId);
    }
  }

  getWaitAsyncByOrder(enterId) {
    if(enterId == null) {
      throw new Error("order broken at fulfilled");
    }
    //this.waitLoop(enterId);
    const waitId = this.enqueue();
    const waitObj = Atomics.waitAsync(this._queue, waitId, locked);
    if(waitObj.async == true) {
      this.addEnterOrder();
      this.doorUnLock();
    }
    return {waitObj:waitObj, waitId:waitId};
  }

  getLockAsyncByOrder(enterId) {
    if(Atomics.compareExchange(this._mu, 0, unlocked, locked) == unlocked) {
      this.addEnterOrder();
      this.doorUnLock();
      return {waitObj:null, waitId:null};
    }
    return this.getWaitAsyncByOrder(enterId);
  }

  retryWaitAsyncByOrder(waitId) {
    const waitObj = Atomics.waitAsync(this._queue, waitId, locked);
    if(waitObj.async == true) {
      this.addEnterOrder();
      this.doorUnLock();
    }
    return {waitObj:waitObj, waitId:waitId};
  }

  getLockAsyncByOrderAndReserved() {
    if(Atomics.compareExchange(this._mu, 0, unlocked, locked) == unlocked) {
      return {waitObj:null, waitId:null};
    }
    throw new Error("reserved was intercepted!");
  }

  unlockQueue() { 
    this.doorSpinLock();

    if (Atomics.compareExchange(this._mu, 0, locked, unlocked) != locked) {
        throw new Error("Mutex is in inconsistent state: unlock on unlocked Mutex.");
    }
    this.dequeue(); // wakeUp next

    this.doorUnLock();
  }

  enqueue() {
    const waitId = Atomics.add(this._end, 0, 1) % INT_SIZE; // modular to this._end later...to avoid race condition.
    /* 
        modular this._end here.
        waitId and thie._end could be different.
        Because the other thread add to this._end at the bewteen Atomics.add and Atomics.and
        But, we use waitId instead of double added this._end in this function.
    */
    Atomics.and(this._end, 0, BIT_MOD);

    Atomics.store(this._reserved, 0 , 1);

    Atomics.store(this._queue, waitId, locked);
    console.log("enqueue waitId: " + waitId);
    return waitId;
  }

  /*
        getLockAsyncByOrder

              emul1(lock)
              adapter1(queued)
              emul1(unlock), adapter2(enter while emul1 dequeue)
              
  */
  dequeue() {

    if(this.isEmpty()) {
      Atomics.store(this._reserved, 0 , -1);
      return;
    }
    const wakeUpId = Atomics.add(this._front, 0, 1) % INT_SIZE;
    console.log("dequeue wakeUpId: " + wakeUpId);
                                                              // << isEmpty true
    Atomics.and(this._front, 0, BIT_MOD);
                                                              // << reserved == -1
    //Atomics.store(this._reserved, 0, wakeUpId);

    Atomics.store(this._queue, wakeUpId, unlocked);
    Atomics.notify(this._queue, wakeUpId, 1);
  }

  isEmpty() {
    return (this._front[0] % INT_SIZE) == (this._end[0] % INT_SIZE);
  }

  isFull() {
    return ((this._end[0] + 1) % INT_SIZE) == (this._front[0] % INT_SIZE);
  }

  isQualified(waitId) {
    //console.log("isQualified: "+ this._reserved[0] + " " + waitId);
    return this._reserved[0] === waitId;
  }

  isReserved() {
    const reserved = Atomics.load(this._reserved, 0);
    if(reserved > -1) {
      console.log("isReservd: " + reserved);
      return true;
    }
    return false;
    // return Atomics.load(this._reserved, 0) > -1;
  }
};


/***/ }),

/***/ "./public/js/sync.js":
/*!***************************!*\
  !*** ./public/js/sync.js ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./public/js/emulworker.js");
/******/ 	
/******/ })()
;