/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

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
/* harmony import */ var _orderlock_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./orderlock.js */ "./public/js/orderlock.js");
/* harmony import */ var _gb_gbcontext_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./gb/gbcontext.js */ "./public/js/gb/gbcontext.js");


 // Adjust based on actual exports



function saveEmulLog(...args) {
  //console.log(args.join(' '));
  const message = args.join(' ');
  const enterId = orderLock.getId();
  const paddedEnterId = enterId.toString().padStart(2, ' ');
  const line = "[    ] : " + paddedEnterId + " $ " + message;

  self.postMessage({
    msg: 'log',
    payload: line,
    time: -1
  });
}

function saveLog(...args) {
  
}


let delayGap = 0;
let orderLock;

let multiPlay = false;
let runningState;

let masterContext;
let slaveContext;

const SNAP_SHOT_SIZE = 120;
const SNAP_SHOT_IDX_SIZE = 60 * 10; // 60 fps * 10s --> 1 바퀴 차이 나서 같은 인덱스면 10초 밀린 에러 상황임..
let snapShotIdx = -1;

self.onmessage = event => {
  const {msg, payload} = event.data;

  switch (msg) {
    case 'init':
      masterContext = payload.masterContext;
      slaveContext = payload.slaveContext;

      runningState = new Int32Array(masterContext.runningSab);
      
      multiPlay = payload.multiPlay;

      _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.canvas = payload.canvas;
      _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.canvas.width = _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.canvasWidth;
      _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.canvas.height = _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.canvasHeight;
      _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.ctx = _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.canvas.getContext('2d');
  
      orderLock = _orderlock_js__WEBPACK_IMPORTED_MODULE_2__.OrderLock.connect(payload.orderLock);

      loadAndStart(payload.rom, masterContext, slaveContext, payload.bufferLen);
      break;
    case 'restart':
      rollback(payload);

      const current = performance.now();
      const travelTime = current-past;
      const leftDelayTime = delayGap - travelTime;

      saveEmulLog("delayGap     : ", delayGap.toFixed(3));
      saveEmulLog("travelTime   : ", travelTime.toFixed(3));
      saveEmulLog("leftDelayTime: ", leftDelayTime.toFixed(3));
      
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
      //running = false;
      Atomics.store(runningState, 0, 0);
      clearInterval(fpsInterval);
      return;
    case 'save':
      /*
          should add gbSlave
      */
      if(payload < 1) {
        gb.cartridge.save();
      } else {
        gbSlave.cartridge.save();
      }

      return;
    default:
      console.log(event);
  }
};


let masterSnapShots = [];
let slaveSnapShots = [];

function saveSnapShot() {
  
  const cacheIdx = snapShotIdx % SNAP_SHOT_SIZE;

  const masterGbContext = new _gb_gbcontext_js__WEBPACK_IMPORTED_MODULE_3__.GbContext();
  gb.getSnapShot(masterGbContext);
  masterSnapShots[cacheIdx] = masterGbContext;

  const slaveGbContext = new _gb_gbcontext_js__WEBPACK_IMPORTED_MODULE_3__.GbContext();
  gbSlave.getSnapShot(slaveGbContext);
  slaveSnapShots[cacheIdx] = slaveGbContext;
  
}

const MIN_ROLL_BACK_GAP = 10;

function rollback(payload) {
  const frameIdx = payload.frameIdx;
  if(frameIdx < 0) { // just restart
    return;
  }

  let frameDiff = 0;
  if(snapShotIdx > frameIdx) {
    frameDiff = snapShotIdx - frameIdx
  } else if(snapShotIdx < frameIdx) {
    frameDiff = (snapShotIdx + SNAP_SHOT_IDX_SIZE) - frameIdx;
  }

  if(frameDiff > MIN_ROLL_BACK_GAP) {

    if(frameDiff >= SNAP_SHOT_SIZE) { // 모듈러 한 바뀌 돌아서 cache값 덮어씌여짐. 복구 못 함.
      console.log(`%cnot rollback. The frameDiff ${frameDiff} is greater than the cache size ${SNAP_SHOT_SIZE} recv: ${frameIdx}, current: ${snapShotIdx}`, 'background:red;color:white');
      saveEmulLog(`not rollback. The frameDiff ${frameDiff} is greater than the cache size ${SNAP_SHOT_SIZE} recv: ${frameIdx}, current: ${snapShotIdx}`);
    } else if (frameDiff != 0) {
      /*
      rollback
      */
      const targetFrameIdx = frameIdx % SNAP_SHOT_SIZE;
      // master
      gb.setSnapShot(masterSnapShots[targetFrameIdx]);

      // slave
      gbSlave.setSnapShot(slaveSnapShots[targetFrameIdx]);

      console.log(`%c${payload.keyType} ${payload.keyCode} rollback gap: ${frameDiff} recv: ${frameIdx}, current: ${snapShotIdx} to ${frameIdx}`, 'background:green;color:white');
      saveEmulLog(`${payload.keyType} ${payload.keyCode} rollback gap: ${frameDiff} recv: ${frameIdx}, current: ${snapShotIdx} to ${frameIdx}`);

      snapShotIdx = frameIdx;
    } else { // ==
      console.log(`%cnot rollback. frameDiff is ${frameDiff}`, 'background:red;color:white');
      saveEmulLog(`not rollback. frameDiff is ${frameDiff}`);
    }
   
  } else {
    console.log(`%c${payload.keyType} ${payload.keyCode} not rollback, gap ${frameDiff} is under MIN ${MIN_ROLL_BACK_GAP}. recv: ${frameIdx}, current: ${snapShotIdx}`, 'background:orange;color:black');
    saveEmulLog(`${payload.keyType} ${payload.keyCode} not rollback, gap ${frameDiff} is under MIN ${MIN_ROLL_BACK_GAP}. recv: ${frameIdx}, current: ${snapShotIdx}`);
  }

  /*
    set key to the rollbacked slave context
  */
  keySetter(payload.keyType, payload.keyCode);
}


function keySetter(keyType, keyCode) {
  switch (keyType) {
    case 'touchstart':
    case 'keydown':
      if(keyCode == 6) {
        gbSlave.joypad._key[7] = false;
      } else if(keyCode == 7) {
        gbSlave.joypad._key[6] = false;
      } else if(keyCode == 4) {
        gbSlave.joypad._key[5] = false;
      } else if(keyCode == 5) {
        gbSlave.joypad._key[4] = false;
      }
      gbSlave.joypad._key[keyCode] = true;
      break;
    case 'touchend':
    case 'keyup':
      gbSlave.joypad._key[keyCode] = false;
      break;
    default:
  }
}


let gb;
let gbSlave;
let cycles;
let next;
let paused = false;

let past;

let fps = 0;
let isInitUpdate = true;

function preStart() {
  /*
  self.postMessage({
    msg: 'T',
    payload: -1,
    time: -1
  });
  */
  noDelayUpdate();
}


let setFirstNext = false;
let firstNext = 0;

let slaveCycles = 0;

let masterInstrCycles = 0;
let masterHwCycles = 0;
let masterOutputDeviceCycles = 0;
let masterHalt = false;

let slaveInstrCycles = 0;
let slaveHwCycles = 0;
let slaveOutputDeviceCycles = 0;
let slaveHalt = false;

let masterWaitSc = false;
let slaveWaitSc = false;

let masterSkipOutputDivice = false;
let slaveSkipOutputDivice = false;

let masterWaitScCycles = 0;
function noDelayUpdate() {
  const startTime = performance.now();
  _gb_cpu_js__WEBPACK_IMPORTED_MODULE_0__.GameBoy.startTime = startTime;
  const gap0 = startTime - past;
  //saveLog("start time: ", startTime.toFixed(3));

  snapShotIdx = ( snapShotIdx + 1 ) % SNAP_SHOT_IDX_SIZE;
  
  //console.log(`%c[GAP0] {  e}__{s      }   =  ${gap0.toFixed(3)}`, "background:blue;color:white");
  saveEmulLog(`[GAP0] {  e}__{s      }   = ${gap0.toFixed(3)}, snapShotIdx: ${snapShotIdx}`);

  if (paused || (Atomics.load(runningState, 0) == 0)) {//!running) {
      return;
  }

  

  if (gb.cartridge.hasRTC) {
      gb.cartridge.rtc.updateTime();
  }
  if (multiPlay && gbSlave.cartridge.hasRTC) {
      gbSlave.cartridge.rtc.updateTime();
  }

  let loopCnt = 0;
  while ((cycles < _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.cpuCyclesPerFrame)) { // && (slaveCycles < Display.cpuCyclesPerFrame)
      try {
          loopCnt++;
        /*
          각 에뮬이 어떤 명령어를 사용하느냐에 따라 2개의 값이 누적값이 다름.
          특히 0 cycle 반환할떄 상대방은 tick 돌고있음 ( STOP, HALT 는 0 반환 )

          상대방이 HALT 면 나도 tick하지 않기..
        */
          //masterWaitScCycles++;
       
          if(masterHwCycles == 0 && masterWaitSc == false && slaveHalt == false) { //  && masterWaitSc == false

            if(masterSkipOutputDivice == true) {
              masterSkipOutputDivice = false;

              while(masterOutputDeviceCycles > 0) {
                gb.outputDeviceCycle();
                masterOutputDeviceCycles--;
              }
              gb.checkHdmaTrigger();
              cycles += gb.getSpeedCycle(masterInstrCycles);
            }

      
            masterInstrCycles = gb.cycle();
            /*
            masterCycleQueue.push(masterInstrCycles);
            if(masterCycleQueue.length > 3) {
              masterCycleQueue.shift();
            }
            */

            if(slaveWaitSc && gb.serial.sc == 254) {
              gbSlave.serial.exchange();
              slaveWaitSc = false;
            }

    
            if (masterInstrCycles == 0) {
              masterHalt = true;
              //console.log("master halt");
            } else {
              masterHalt = false;
            }
            
            masterHwCycles = masterInstrCycles;
            masterOutputDeviceCycles += gb.getSpeedCycle(masterInstrCycles);
          }

          if(slaveHalt == false && masterHwCycles > 0 && masterWaitSc == false) {
            masterWaitSc = gb.hardwareCycle();
            /*
            if(masterWaitSc) {
              masterWaitScCycles = 0;
            }
            */
            masterHwCycles--;
          }

          if(masterHwCycles == 0 && masterWaitSc == true) {
            masterSkipOutputDivice = true;
          }

          /**
           *   gb.hardwareCycle()에서 masterWaitSc = true, masterHwCycles == 0 가 되면
           *   gb.outputDeviceCycle() 은 수행 안 된다.
           * 
           *   gbSlave에서 masterWaitSc = false 하면
           * 
           *   보류된 gb.outputDeviceCycle() 안 돌고 다음 masterInstrCycles = gb.cycle() 로 넘어가네.. 
           *   일단 += 로 직전 outputcycle도 살려두긴 하는데
           */

          if(slaveHalt == false && masterHwCycles == 0 && masterWaitSc == false) {
            while(masterOutputDeviceCycles > 0) {
              gb.outputDeviceCycle();
              masterOutputDeviceCycles--;
            }
            gb.checkHdmaTrigger();
            cycles += gb.getSpeedCycle(masterInstrCycles);
          }
        

          if(multiPlay) {

            if(slaveHwCycles == 0 && slaveWaitSc == false && masterHalt == false) { // && slaveWaitSc == false
             
              if(slaveSkipOutputDivice == true) {
                slaveSkipOutputDivice = false;
                console.log("do slaveSkipped");

                while(slaveOutputDeviceCycles > 0) {
                  gbSlave.outputDeviceCycle();
                  slaveOutputDeviceCycles--;
                }
                gbSlave.checkHdmaTrigger();
                slaveCycles += gbSlave.getSpeedCycle(slaveInstrCycles);
              }
             

              slaveInstrCycles = gbSlave.cycle();
              /*
              slaveCycleQueue.push({ m: masterInstrCycles, s: slaveInstrCycles,});
              if(slaveCycleQueue.length > 3) {
                slaveCycleQueue.shift();
              }
              */

              /*
              if(masterInstrCycles != slaveInstrCycles) {
                console.log(slaveCycleQueue);
                //throw new Error();
              }
              */

              if(masterWaitSc && gbSlave.serial.sc == 254) {
                /*
                console.log(`%cmasterCycles: ${cycles}, slaveCycles: ${slaveCycles} masterWaitScCycles: ${masterWaitScCycles}`, 'background:black;color:white');
                masterWaitScCycles = 0;
                */
                gb.serial.exchange();
                masterWaitSc = false;
              }

              if (slaveInstrCycles == 0) {
                slaveHalt = true;
                //console.log("slave halt");
              } else {
                slaveHalt = false;
              }

              slaveHwCycles = slaveInstrCycles;
              slaveOutputDeviceCycles += gbSlave.getSpeedCycle(slaveInstrCycles);
            }

            if(masterHalt == false && slaveHwCycles > 0 && slaveWaitSc == false) {
              slaveWaitSc = gbSlave.hardwareCycle();
              slaveHwCycles--;
            }

            if(slaveHwCycles == 0 && slaveWaitSc == true) {
              slaveSkipOutputDivice = true;
            }

            if(masterHalt == false && slaveHwCycles == 0  && slaveWaitSc == false) {
              while(slaveOutputDeviceCycles > 0) {
                gbSlave.outputDeviceCycle();
                slaveOutputDeviceCycles--;
              }
              gbSlave.checkHdmaTrigger();
              slaveCycles += gbSlave.getSpeedCycle(slaveInstrCycles);
            }
          }

      } catch (error) {
          console.error(error);
          //running = false;
          Atomics.store(runningState, 0 , 0);
          return;
      }
  }

  saveSnapShot();
    
  cycles -= _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.cpuCyclesPerFrame;
  if(multiPlay) {
    slaveCycles -= _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.cpuCyclesPerFrame;  
  }
  
  if(cycles != slaveCycles) {
    //console.log(`%cmasterCycles: ${cycles}, slaveCycles: ${slaveCycles}`,"background:blue; color:white;");
    //saveEmulLog(`masterCycles: ${cycles}, slaveCycles: ${slaveCycles}`);
    /*
    console.log(`oldoldmasterInstrCycles: ${oldoldMasterInstrCycle}, slave:  ${oldoldSlaveInstrCycle}`);
    console.log(`oldmasterInstrCycles: ${oldMasterInstrCycle}, slave:  ${oldSlaveInstrCycle}`);
    console.log(`masterInstrCycles: ${masterInstrCycles}, slave:  ${slaveInstrCycles}`);
    console.log(masterCycleQueue);
    console.log(slaveCycleQueue);
    */
  }
  

    fps++;

    const current = performance.now();
    past = current;
    const gap1 = current-startTime;

    saveEmulLog("[GAP1]        {s_____e}   = " + gap1.toFixed(3) + " loopCnt: " + loopCnt);

  
    if(fps > 59) { //  if(gap1 > 16.74) {
      saveLog(fps + " fps over 59, reset old delay 0");
      isInitUpdate = true; // reset delay
    }


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
      return;
    }
     
    next += _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.frameInterval; //next += 16.74 or 8.37
    delayGap = next - current;

    self.postMessage({ // recvQ
      msg: 'M',
      payload: -1,
      time: -1
    });
}

let printOld;

function printFps() {
  const current = performance.now();
  const setIntGap = (current - printOld).toFixed(0);
  const letter = fps + " " + _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.fps + " " + setIntGap;
  let isSame = true;
  if(fps !== _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.fps) {
    isSame = false; 
  } 
  //self.postMessage({msg: 'F', payload: letter, time:isSame});
  //self.postMessage({msg: 'F', payload: fps, time:true});

  const dualFps = masterFps;//fps + " M:" + masterFps;// + " S:";// + slaveFps;
  //console.log(`master renderCpuCycles: ${gb.display.renderCpuCycles}, slave : ${gbSlave.display.renderCpuCycles}`);

  self.postMessage({msg: 'F', payload: dualFps, time:true});

  saveLog("%c FPS= " + letter, "background:cyan; color:black");
  saveLog("%c 1 sec= " + setIntGap, "background:cyan; color:red");

  //console.log(letter);

  masterFps = 0;
 
  //Display.fps = 0;
  fps = 0;
  printOld = current;


  if(isInitUpdate) {
    console.log("init");
    saveEmulLog("init");
    isInitUpdate = false;
    next = Math.floor((current-firstNext)/_gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.frameInterval) * _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.frameInterval + firstNext;
    
    next += _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.frameInterval;
    delayGap = next - current;
    //setTimeout(noDelayUpdate, delayGap);
    self.postMessage({
      msg: 'M',
      payload: -1,
      time: -1
    });
  }
}

let fpsInterval;

let masterFps = 0;

let masterFrameIdx = 0;


function loadAndStart(rom, masterContext, slaveContext, bufferLen) {
  gb = new _gb_cpu_js__WEBPACK_IMPORTED_MODULE_0__.GameBoy(
    masterContext.keySharedBuffer,
    masterContext.soundLeftSab,
    masterContext.soundRightSab,
    masterContext.soundFilledSab,
    bufferLen
  );
  gb.display.setImageData(_gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.ctx.createImageData(_gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.canvasWidth, _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.canvasHeight));
  gb.display.renderFrameCallback = (imageData) => { 

    _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.ctx.putImageData(imageData, 0, 0);

    masterFps++;
    masterFrameIdx = (masterFrameIdx + 1) % 256;
  }
  gb.name = 'MASTER';
  gb.connectedGb = null;
 

  if(multiPlay) {
    gbSlave = new _gb_cpu_js__WEBPACK_IMPORTED_MODULE_0__.GameBoy(
      slaveContext.keySharedBuffer,
      slaveContext.soundLeftSab,
      slaveContext.soundRightSab,
      slaveContext.soundFilledSab,
      bufferLen
    );

    const width = _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.canvasWidth; // Set the width
    const height = _gb_display_js__WEBPACK_IMPORTED_MODULE_1__.Display.canvasHeight; // Set the height

    // Create a Uint8ClampedArray for the pixel data
    const pixelData = new Uint8ClampedArray(width * height * 4); // 4 values per pixel (RGBA)

    gbSlave.display.setImageData(new ImageData(pixelData, width, height));
    gbSlave.display.renderFrameCallback = (imageData) => { 

      const copiedImageData = new ImageData(
        new Uint8ClampedArray(imageData.data), // Create a new Uint8ClampedArray from the original data
        imageData.width,
        imageData.height
      );

      self.postMessage({
        msg: 'slaveImageData',
        payload: copiedImageData,
        time: snapShotIdx
      });

    };

    gbSlave.name = 'SLAVE';
    gbSlave.connectedGb = gb;
    gb.connectedGb = gbSlave;
  }


  try {
    
    gb.cartridge.load(rom, masterContext.ram, masterContext.rtc);
    if(multiPlay) {
      gbSlave.cartridge.load(rom, slaveContext.ram, slaveContext.rtc);
    }
    playGame();
  } catch (error) {
    console.error(error);
  }
}

function playGame() {
  Atomics.store(runningState, 0, 1);
  past = performance.now();
  cycles = 0;
  slaveCycles = 0;
  next = past;
  noDelayUpdate();
  printOld = past;
  fpsInterval = setInterval(() => printFps(), 1000);
}


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
/* harmony import */ var _rtc_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./rtc.js */ "./public/js/gb/rtc.js");


class Cartridge {
    constructor(gb) {
        this.gb = gb;
    }

    getSnapShot(gbContext) {
        gbContext.title = this.title;
        gbContext.cartridgeType = this.cartridgeType;
        gbContext.rom = this.rom;
        gbContext.romBankNumber = this.romBankNumber;
        gbContext.ram = this.ram;
        gbContext.ramBankNumber = this.ramBankNumber;
        gbContext.ramEnable = this.ramEnable;
        gbContext.ramBankMode = this.ramBankMode;
        gbContext.hasRAM = this.hasRAM;
        gbContext.hasBattery = this.hasBattery;
        gbContext.hasRTC = this.hasRTC;
        gbContext.irSelect = this.irSelect;
        gbContext.irOn = this.irOn;
        if(this.hasRTC) {
            gbContext.rtc = this.rtc;
            this.rtc.getSnapShot(gbContext);
        }
    }

    setSnapShot(gbContext) {
        this.title = gbContext.title;
        this.cartridgeType = gbContext.cartridgeType;
        this.rom = gbContext.rom;
        this.romBankNumber = gbContext.romBankNumber;
        this.ram = gbContext.ram;
        this.ramBankNumber = gbContext.ramBankNumber;
        this.ramEnable = gbContext.ramEnable;
        this.ramBankMode = gbContext.ramBankMode;
        this.hasRAM = gbContext.hasRAM;
        this.hasBattery = gbContext.hasBattery;
        this.hasRTC = gbContext.hasRTC;
        this.irSelect = gbContext.irSelect;
        this.irOn = gbContext.irOn;
        if(this.hasRTC) {
            this.rtc = gbContext.rtc;
            this.rtc.setSnapShot(gbContext);
        }
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

    load(file, uploadedRam, uploadedRtc) {
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
            if (this.hasBattery && (uploadedRam != null)) {
                this.ram = new Uint8Array(Object.values(uploadedRam).map(parseFloat));
            } else {
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
            }
        }
        if (this.hasRTC) {
            if (this.hasBattery && (uploadedRtc != null)) {
                this.rtc = new _rtc_js__WEBPACK_IMPORTED_MODULE_0__.RTC();
                Object.assign(this.rtc, uploadedRtc);
            } else {
                this.rtc = new _rtc_js__WEBPACK_IMPORTED_MODULE_0__.RTC();
            }
        }
    }

    save() {
        let savedRam = '';
        if(this.hasRAM && this.hasBattery) {
            savedRam = this.ram;
        }
        let savedRtc = '';
        if(this.hasRTC && this.hasBattery) {
            savedRtc = this.rtc;
        }
        self.postMessage({msg: 'saveData', payload: {
            title: this.title,
            ram: savedRam,
            rtc: savedRtc
        }, time: this.gb.name});
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
/* harmony import */ var _emulworker_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../emulworker.js */ "./public/js/emulworker.js");
 // Adjust the import based on the actual exports







class GameBoy {
  
  constructor(
      keySharedBuffer,
      soundLeftSab,
      soundRightSab,
      fillSab,
      bufferLen,
    ) {
    this.display = new _display_js__WEBPACK_IMPORTED_MODULE_1__.Display(this); 
    this.timer = new _timer_js__WEBPACK_IMPORTED_MODULE_5__.Timer(this);
    this.joypad = new _joypad_js__WEBPACK_IMPORTED_MODULE_2__.Joypad(this, keySharedBuffer);
    this.cartridge = new _cartridge_js__WEBPACK_IMPORTED_MODULE_0__.Cartridge(this);
    this.sound = new _sound_js__WEBPACK_IMPORTED_MODULE_4__.Sound(this, soundLeftSab, soundRightSab, fillSab, bufferLen);
    this.serial = new _serial_js__WEBPACK_IMPORTED_MODULE_3__.Serial(this);

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

    this._if = 0;

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

    this.serialHandler = false;
  }

  getSnapShot(gbContext) {
    gbContext.a = this.a;
    gbContext.fz = this.fz;
    gbContext.fn = this.fn;
    gbContext.fh = this.fh;
    gbContext.fc = this.fc;
    gbContext.b = this.b;
    gbContext.c = this.c;
    gbContext.d = this.d;
    gbContext.e = this.e;
    gbContext.h = this.h;
    gbContext.l = this.l;
    gbContext._pc = this._pc;
    gbContext._sp = this._sp;
    gbContext.ime = this.ime;
    gbContext.halt = this.halt;
    gbContext._if = this._if;
    gbContext._ie = this._ie;
    gbContext._svbk = this._svbk;
    gbContext.doubleSpeed = this.doubleSpeed;
    gbContext.speedTrigger = this.speedTrigger;
    gbContext.irReadEnable = this.irReadEnable;
    gbContext.irOn = this.irOn;
    gbContext.wram = new Uint8Array(this.wram);
    gbContext.hram = new Uint8Array(this.hram);
    gbContext.cgb = this.cgb;
    gbContext.cpuCycles = this.cycles;

    this.display.getSnapShot(gbContext);
    this.timer.getSnapShot(gbContext);
    this.joypad.getSnapShot(gbContext);
    this.cartridge.getSnapShot(gbContext);
    this.sound.getSnapShot(gbContext);
    this.serial.getSnapShot(gbContext);  
  }

  setSnapShot(gbContext) {
    this.a = gbContext.a;
    this.fz = gbContext.fz;
    this.fn = gbContext.fn;
    this.fh = gbContext.fh;
    this.fc = gbContext.fc;
    this.b = gbContext.b;
    this.c = gbContext.c;
    this.d = gbContext.d;
    this.e = gbContext.e;
    this.h = gbContext.h;
    this.l = gbContext.l;
    this._pc = gbContext._pc;
    this._sp = gbContext._sp;
    this.ime = gbContext.ime;
    this.halt = gbContext.halt;
    this._if = gbContext._if;
    this._ie = gbContext._ie;
    this._svbk = gbContext._svbk;
    this.doubleSpeed = gbContext.doubleSpeed;
    this.speedTrigger = gbContext.speedTrigger;
    this.irReadEnable = gbContext.irReadEnable;
    this.irOn = gbContext.irOn;
    this.wram = new Uint8Array(gbContext.wram);
    this.hram = new Uint8Array(gbContext.hram);
    this.cgb = gbContext.cgb;
    this.cycles = gbContext.cpuCycles;

    this.display.setSnapShot(gbContext);
    this.timer.setSnapShot(gbContext);
    this.joypad.setSnapShot(gbContext);
    this.cartridge.setSnapShot(gbContext);
    this.sound.setSnapShot(gbContext);
    this.serial.setSnapShot(gbContext);
  }

  get name() {
    return this._name;
  }

  set name(name) {
    this._name = name;
  }

  get connectedGb() {
    return this._connectedGb;
  }

  set connectedGb(connectedGb) {
    this._connectedGb = connectedGb;
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
    return 0xe0 | this._if;
  }

  set if(value) {
    const before = value;
    this._if = value & GameBoy.interrupts;

    if((before & GameBoy.serialInterrupt) != 0) {
      this.requestInterrupt(GameBoy.serialInterrupt);
    }
  }

  get ie() {
    return this._ie;
  }

  set ie(value) {
    this._ie = value & GameBoy.interrupts;
  }

  requestInterrupt(interrupt) {
    this._if |= interrupt;
  }

  clearInterrupt(interrupt) {
    this._if &= ~interrupt;
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
      case 0x3: //  6       011/0       0  ~ 7FFF 
        return this.cartridge.readROM(address & 0x7fff);
      case 0x4: //  8       100/0
        return this.display.readVRAM(address & 0x1fff);
      case 0x5: // A000 -> 101/0 0000 0000 0000
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
                return this.serial.sb;
              case 0x02:
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
                this.serial.sb = value;
                break;
              case 0x02:
                this.serial.sc = value;
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
          //saveEmulLog("jump from pc: " + this.pc);
          this.serialHandler = true;
          //console.log(`${this.name} jump from pc: ${this.pc}`);
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

    return cycles;

    /*
    let hardwareCycles = cycles; // 아래에서 display,sound 를 /2 만큼 느리게 돌려서 timer, serial을 상대적으로 빠르게 함.
    while (hardwareCycles > 0) {
      this.timer.cycle();
      this.serial.cycle();
      hardwareCycles--;
    }

    // -0.5 += 2.5
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
    */
  }

  cycleOrigin() {
    const instrCycles = this.cycle();
    if(instrCycles == 0) {
      //console.log("zero");
    }
    let hardwareCycles = instrCycles;
    while (hardwareCycles > 0) {
      this.hardwareCycle();
      hardwareCycles--;
    }

    const result = this.getSpeedCycle(instrCycles);//instrCycles / (this.doubleSpeed ? 2 : 1);
    this.cycles += result; // -0.5 += 2.5
    while(this.cycles > 0) {
      this.outputDeviceCycle();
      this.cycles--;
    }

    this.checkHdmaTrigger();

    return this.getSpeedCycle(instrCycles);
  }

  hardwareCycle() {
    this.timer.cycle();
    return this.serial.cycle();
  }

  getSpeedCycle(cycles) {  // 홀수면? 1 cycle 손해네?
    return cycles / (this.doubleSpeed ? 2 : 1);
  }

  outputDeviceCycle() {
    if (this.display.hdmaOn) {
      this.runHdma();
    }
    this.display.cycle();
    this.sound.cycle();
  }

  checkHdmaTrigger() {
    if (this.display.hdmaTrigger) {
      this.display.hdmaTrigger = false;
      this.display.hdmaOn = true;
    }
  }

  decode() {
    const instr = this.readAddress(this.pc++);
    let cycles = GameBoy.instrCycles[instr];
    let instrName = "none";
    const quad = instr >> 6, op1 = (instr & 0x3f) >> 3, op2 = instr & 0x7;
    if (quad === 0) {
      if (op2 == 6) {
        instrName = " LD r, n"
        const imm = this.readAddress(this.pc++);
        this.writeRegister(op1, imm);
      } else if (op2 == 2) {
        if ((op1 & 0x1) != 0) {
          instrName = " LD A, (rr)"
          this.a = this.readDoubleRegisterIndirect(op1 >> 1);
        } else {
          instrName = "/ LD (rr), A"
          this.writeDoubleRegisterIndirect(op1 >> 1, this.a);
        }
      } else if ((op1 & 0x1) == 0 && op2 == 1) {
       instrName = " LD dd, nn"
        const imm1 = this.readAddress(this.pc++);
        const imm2 = this.readAddress(this.pc++);
        this.writeDoubleRegister(op1 >> 1, (imm2 << 8) | imm1);
      } else if (op1 == 1 && op2 == 0) {
        instrName = " LD (nn), SP"
        const imm1 = this.readAddress(this.pc++);
        const imm2 = this.readAddress(this.pc++);
        let address = (imm2 << 8) | imm1;
        this.writeAddress(address++, this.spl);
        this.writeAddress(address++, this.sph);
      } else if (op2 == 4) {
        instrName = " INC r"
        const tmp = (this.readRegister(op1) + 1) & 0xff;
        this.writeRegister(op1, tmp);
        this.fh = (tmp & 0xf) == 0;
        this.fn = false;
        this.fz = tmp == 0;
      } else if (op2 == 5) {
        instrName = " DEC r"
        const tmp = (this.readRegister(op1) - 1) & 0xff;
        this.writeRegister(op1, tmp);
        this.fh = (tmp & 0xf) == 0xf;
        this.fn = true;
        this.fz = tmp == 0;
      } else if ((op1 & 0x1) != 0 && op2 == 1) {
        instrName = " ADD HL, ss"
        const ss = this.readDoubleRegister(op1 >> 1);
        this.fc = this.hl + ss > 0xffff;
        this.fh = (this.hl & 0xfff) + (ss & 0xfff) > 0xfff;
        this.fn = false;
        this.hl += ss;
      } else if ((op1 & 0x1) == 0 && op2 == 3) {
        instrName = " INC ss"
        this.writeDoubleRegister(op1 >> 1,
            this.readDoubleRegister(op1 >> 1) + 1);
      } else if ((op1 & 0x1) != 0 && op2 == 3) {
        instrName = " DEC ss"
        this.writeDoubleRegister(op1 >> 1,
            this.readDoubleRegister(op1 >> 1) - 1);
      } else if (op1 == 0 && op2 == 7) {
        instrName = " RLCA"
        const carry = this.a & 0x80;
        this.a = ((this.a << 1) | (carry >> 7)) & 0xff;
        this.fc = carry != 0;
        this.fh = false;
        this.fn = false;
        this.fz = false;
      } else if (op1 == 1 && op2 == 7) {
        instrName = " RRCA"
        const carry = this.a & 0x1;
        this.a = ((carry << 7) | (this.a >> 1)) & 0xff;
        this.fc = carry != 0;
        this.fh = false;
        this.fn = false;
        this.fz = false;
      } else if (op1 == 2 && op2 == 7) {
        instrName = " RLA"
        const carry = this.a & 0x80;
        this.a = ((this.a << 1) | this.fc) & 0xff;
        this.fc = carry != 0;
        this.fh = false;
        this.fn = false;
        this.fz = false;
      } else if (op1 == 3 && op2 == 7) {
        instrName = " RRA"
        const carry = this.a & 0x1;
        this.a = ((this.fc << 7) | (this.a >> 1)) & 0xff;
        this.fc = carry != 0;
        this.fh = false;
        this.fn = false;
        this.fz = false;
      } else if (op1 == 3 && op2 == 0) {
        instrName = " JR e"
        const offset = this.readAddress(this.pc++) << 24 >> 24;
        this.pc += offset;
      } else if ((op1 & 0x4) != 0 && op2 == 0) {
        instrName = " JR cc, e"
        const offset = this.readAddress(this.pc++) << 24 >> 24;
        if (this.readCondition(op1 & 0x3)) {
          this.pc += offset;
          cycles += 1;
        }
      } else if (op1 == 4 && op2 == 7) {
        instrName = " DAA"
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
        instrName = " CPL"
        this.a ^= 0xff;
        this.fh = true;
        this.fn = true;
      } else if (op1 == 0 && op2 == 0) {
        instrName = " NOP"
      } else if (op1 == 6 && op2 == 7) {
        instrName = " SCF"
        this.fc = true;
        this.fh = false;
        this.fn = false;
      } else if (op1 == 7 && op2 == 7) {
        instrName = " CCF"
        this.fc = !this.fc;
        this.fh = false;
        this.fn = false;
      } else if (op1 == 2 && op2 == 0) {
        instrName = " STOP"
        this.pc++;
        if (this.speedTrigger) {
          this.speedTrigger = false;
          this.doubleSpeed = !this.doubleSpeed;
        }
      }
    } else if (quad === 1) {
      if (op1 != 6 || op2 != 6) {
        instrName = " LD r, r'"
        this.writeRegister(op1, this.readRegister(op2));
      } else {
        instrName = " HALT"
        this.halt = true;
      }
    } else if (quad === 2) {
      const r = this.readRegister(op2);
      if (op1 == 0) {
        instrName = " ADD A, r"
        const tmp = this.a + r;
        this.fc = tmp > 0xff;
        this.fh = (this.a & 0xf) + (r & 0xf) > 0xf;
        this.fn = false;
        this.fz = (tmp & 0xff) == 0;
        this.a = tmp & 0xff;
      } else if (op1 == 1) {
        instrName = " ADC A, r"
        const carry = this.fc;
        const tmp = this.a + r + carry;
        this.fc = tmp > 0xff;
        this.fh = (this.a & 0xf) + (r & 0xf) + carry > 0xf;
        this.fn = false;
        this.fz = (tmp & 0xff) == 0;
        this.a = tmp & 0xff;
      } else if (op1 == 2) {
        instrName = " SUB A, r"
        const tmp = this.a - r;
        this.fc = tmp < 0;
        this.fh = (this.a & 0xf) - (r & 0xf) < 0;
        this.fn = true;
        this.fz = (tmp & 0xff) == 0;
        this.a = tmp & 0xff;
      } else if (op1 == 3) {
        instrName = " SBC A, r"
        const carry = this.fc
        const tmp = this.a - r - carry;
        this.fc = tmp < 0;
        this.fh = (this.a & 0xf) - (r & 0xf) - carry < 0;
        this.fn = true;
        this.fz = (tmp & 0xff) == 0;
        this.a = tmp & 0xff;
      } else if (op1 == 4) {
        instrName = " AND A, r"
        const tmp = this.a & r;
        this.fc = false;
        this.fh = true;
        this.fn = false;
        this.fz = tmp == 0;
        this.a = tmp;
      } else if (op1 == 5) {
        instrName = " XOR A, r"
        const tmp = this.a ^ r;
        this.fc = false;
        this.fh = false;
        this.fn = false;
        this.fz = tmp == 0;
        this.a = tmp;
      } else if (op1 == 6) {
        instrName = " OR A, r"
        const tmp = this.a | r;
        this.a |= r;
        this.fc = false;
        this.fh = false;
        this.fn = false;
        this.fz = tmp == 0;
        this.a = tmp;
      } else if (op1 == 7) {
        instrName = " CP A, r"
        const tmp = this.a - r;
        this.fc = tmp < 0;
        this.fh = (this.a & 0xf) - (r & 0xf) < 0;
        this.fn = true;
        this.fz = (tmp & 0xff) == 0;
      }
    } else if (quad === 3) {
      if (op1 == 6 && op2 == 2) {
        instrName = " LD A, (C)"
        this.a = this.readAddress(0xff00 | this.c);
      } else if (op1 == 4 && op2 == 2) {
        instrName = " LD (C), A"
        this.writeAddress(0xff00 | this.c, this.a);
      } else if (op1 == 6 && op2 == 0) {
        instrName = " LD A, (n)"
        const imm = this.readAddress(this.pc++);
        this.a = this.readAddress(0xff00 | imm);
      } else if (op1 == 4 && op2 == 0) {
        instrName = " LD (n), A"
        const imm = this.readAddress(this.pc++);
        this.writeAddress(0xff00 | imm, this.a);
      } else if (op1 == 7 && op2 == 2) {
        instrName = " LD A, (nn)"
        const imm1 = this.readAddress(this.pc++);
        const imm2 = this.readAddress(this.pc++);
        this.a = this.readAddress((imm2 << 8) | imm1);
      } else if (op1 == 5 && op2 == 2) {
        instrName = " LD (nn), A"
        const imm1 = this.readAddress(this.pc++);
        const imm2 = this.readAddress(this.pc++);
        this.writeAddress((imm2 << 8) | imm1, this.a);
      } else if (op1 == 7 && op2 == 1) {
        instrName = " LD SP, HL"
        this.sp = this.hl;
      } else if ((op1 & 0x1) == 0 && op2 == 5) {
        instrName = " PUSH qq"
        this.pushDoubleRegister(op1 >> 1);
      } else if ((op1 & 0x1) == 0 && op2 == 1) {
        instrName = " POP qq"
        this.popDoubleRegister(op1 >> 1);
      } else if (op1 == 7 && op2 == 0) {
        instrName = " LDHL SP, e"
        const offset = this.readAddress(this.pc++) << 24 >> 24;
        const tmp = this.sp + offset;
        this.fc = (this.sp & 0xff) + (offset & 0xff) > 0xff;
        this.fh = (this.sp & 0xf) + (offset & 0xf) > 0xf;
        this.fn = false;
        this.fz = false;
        this.hl = tmp;
      } else if (op1 == 5 && op2 == 0) {
        instrName = " ADD SP, e"
        const offset = this.readAddress(this.pc++) << 24 >> 24;
        const tmp = this.sp + offset;
        this.fc = (this.sp & 0xff) + (offset & 0xff) > 0xff;
        this.fh = (this.sp & 0xf) + (offset & 0xf) > 0xf;
        this.fn = false;
        this.fz = false;
        this.sp = tmp;
      } else if (op1 == 0 && op2 == 6) {
        instrName = " ADD A, n"
        const imm = this.readAddress(this.pc++);
        const tmp = this.a + imm
        this.fc = tmp > 0xff;
        this.fh = (this.a & 0xf) + (imm & 0xf) > 0xf;
        this.fn = false;
        this.fz = (tmp & 0xff) == 0;
        this.a = tmp & 0xff;
      } else if (op1 == 1 && op2 == 6) {
        instrName = " ADC A, n"
        const imm = this.readAddress(this.pc++);
        const carry = this.fc;
        const tmp = this.a + imm + carry
        this.fc = tmp > 0xff;
        this.fh = (this.a & 0xf) + (imm & 0xf) + carry > 0xf;
        this.fn = false;
        this.fz = (tmp & 0xff) == 0;
        this.a = tmp & 0xff;
      } else if (op1 == 2 && op2 == 6) {
        instrName = " SUB A, n"
        const imm = this.readAddress(this.pc++);
        const tmp = this.a - imm;
        this.fc = tmp < 0;
        this.fh = (this.a & 0xf) - (imm & 0xf) < 0;
        this.fn = true;
        this.fz = (tmp & 0xff) == 0;
        this.a = tmp & 0xff;
      } else if (op1 == 3 && op2 == 6) {
        instrName = " SBC A, n"
        const imm = this.readAddress(this.pc++);
        const carry = this.fc;
        const tmp = this.a - imm - carry;
        this.fc = tmp < 0;
        this.fh = (this.a & 0xf) - (imm & 0xf) - carry < 0;
        this.fn = true;
        this.fz = (tmp & 0xff) == 0;
        this.a = tmp & 0xff;
      } else if (op1 == 4 && op2 == 6) {
        instrName = " AND A, n"
        const imm = this.readAddress(this.pc++);
        const tmp = this.a & imm;
        this.fc = false;
        this.fh = true;
        this.fn = false;
        this.fz = tmp == 0;
        this.a = tmp;
      } else if (op1 == 5 && op2 == 6) {
        instrName = " XOR A, n"
        const imm = this.readAddress(this.pc++);
        const tmp = this.a ^ imm;
        this.fc = false;
        this.fh = false;
        this.fn = false;
        this.fz = tmp == 0;
        this.a = tmp;
      } else if (op1 == 6 && op2 == 6) {
        instrName = " OR A, n"
        const imm = this.readAddress(this.pc++);
        const tmp = this.a | imm;
        this.fc = false;
        this.fh = false;
        this.fn = false;
        this.fz = tmp == 0;
        this.a = tmp;
      } else if (op1 == 7 && op2 == 6) {
        instrName = " CP A, n"
        const imm = this.readAddress(this.pc++);
        const tmp = this.a - imm;
        this.fc = tmp < 0;
        this.fh = (this.a & 0xf) - (imm & 0xf) < 0;
        this.fn = true;
        this.fz = (tmp & 0xff) == 0;
      } else if (op1 == 1 && op2 == 3) {
        cycles += this.decode_cb();
      } else if (op1 == 0 && op2 == 3) {
        instrName = " JP nn"
        const imm1 = this.readAddress(this.pc++);
        const imm2 = this.readAddress(this.pc++);
        this.pc = (imm2 << 8) | imm1;
      } else if ((op1 & 0x4) == 0 && op2 == 2) {
        instrName = " JP cc, nn"
        const imm1 = this.readAddress(this.pc++);
        const imm2 = this.readAddress(this.pc++);
        if (this.readCondition(op1 & 0x3)) {
          this.pc = (imm2 << 8) | imm1;
          cycles += 1;
        }
      } else if (op1 == 5 && op2 == 1) {
        instrName = " JP HL"
        this.pc = this.hl;
      } else if (op1 == 1 && op2 == 5) {
        instrName = " CALL nn"
        const imm1 = this.readAddress(this.pc++);
        const imm2 = this.readAddress(this.pc++);
        this.writeAddress(--this.sp, this.pch);
        this.writeAddress(--this.sp, this.pcl);
        this.pc = (imm2 << 8) | imm1;
      } else if ((op1 & 0x4) == 0 && op2 == 4) {
        instrName = " CALL cc, nn"
        const imm1 = this.readAddress(this.pc++);
        const imm2 = this.readAddress(this.pc++);
        if (this.readCondition(op1 & 0x3)) {
          this.writeAddress(--this.sp, this.pch);
          this.writeAddress(--this.sp, this.pcl);
          this.pc = (imm2 << 8) | imm1;
          cycles += 3;
        }
      } else if (op1 == 1 && op2 == 1) {
        instrName = " RET"
        this.pc = this.readAddress(this.sp++);
        this.pc |= this.readAddress(this.sp++) << 8;
      } else if (op1 == 3 && op2 == 1) {
        instrName = " RETI"
        this.pc = this.readAddress(this.sp++);
        this.pc |= this.readAddress(this.sp++) << 8;
        this.ime = true;

        if(this.serialHandler) {
          this.serialHandler = false;
          //console.log(`${this.name} RETI pc: ${this.pc}`);
        }
        //saveEmulLog("RETI pc: " + this.pc);
      } else if ((op1 & 0x4) == 0 && op2 == 0) {
        instrName = " RET cc"
        if (this.readCondition(op1 & 0x3)) {
          this.pc = this.readAddress(this.sp++);
          this.pc |= this.readAddress(this.sp++) << 8;
          cycles += 3;
        }
      } else if (op2 == 7) {
        instrName = " RST t"
        this.writeAddress(--this.sp, this.pch);
        this.writeAddress(--this.sp, this.pcl);
        this.pc = op1 << 3;
      } else if (op1 == 6 && op2 == 3) {
        instrName = " DI"
        this.ime = false;
      } else if (op1 == 7 && op2 == 3) {
        instrName = " EI"
        this.ime = true;
      } else {
        throw 'unknown instruction: 0x' + instr.toString(16);
      }
    }

    /*
    if(cycles == 0) {// && (instrName !== " HALT")) {
      console.log(this.name + " instr:" + instrName + " 0 cycles");
    }
    */
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

        //this.imageData = Display.ctx.createImageData(Display.canvasWidth, Display.canvasHeight);
        //this.pixels = new Uint32Array(this.imageData.data.buffer);
        this.bgClear = new Uint8Array(Display.width);
        this.bgPriority = new Uint8Array(Display.width);

        //this.priorRenderLap = 0;

        this._renderCpuCycles = 0;

        this.fpsPeriod = 0;
    }

    getSnapShot(gbContext) {
        gbContext.lcdOn = this.lcdOn;
        gbContext.windowTilemap = this.windowTilemap;
        gbContext.windowOn = this.windowOn;
        gbContext.bgWindowTileMode = this.bgWindowTileMode;
        gbContext.bgTilemap = this.bgTilemap;
        gbContext.objHeight = this.objHeight;
        gbContext.objOn = this.objOn;
        gbContext.bgOn = this.bgOn;
        gbContext.lycMatchInt = this.lycMatchInt;
        gbContext.mode10Int = this.mode10Int;
        gbContext.mode01Int = this.mode01Int;
        gbContext.mode00Int = this.mode00Int;
        gbContext.lycMatch = this.lycMatch;
        gbContext.mode = this.mode;
        gbContext.scy = this.scy;
        gbContext.scx = this.scx;
        gbContext.ly = this.ly;
        gbContext.lyc = this.lyc;
        gbContext._bgp = this._bgp;
        gbContext._obp0 = this._obp0;
        gbContext._obp1 = this._obp1;
        gbContext.bgPalette = structuredClone(this.bgPalette);
        gbContext.scy = this.scy;
        gbContext.scx = this.scx;
        gbContext.ly = this.ly;
        gbContext.lyc = this.lyc;
        gbContext._bgp = this._bgp;
        gbContext._obp0 = this._obp0;
        gbContext._obp1 = this._obp1;
        gbContext.bgPalette = structuredClone(this.bgPalette);
        gbContext.objPalette = structuredClone(this.objPalette);
        gbContext.bgColorIndex = this.bgColorIndex;
        gbContext.bgColorInc = this.bgColorInc;
        gbContext.objColorIndex = this.objColorIndex;
        gbContext.objColorInc = this.objColorInc;
        gbContext._bcpd = new Uint8Array(this._bcpd);
        gbContext._ocpd = new Uint8Array(this._ocpd);
        gbContext.bgColorPalette = structuredClone(this.bgColorPalette);
        gbContext.objColorPalette = structuredClone(this.objColorPalette);
        gbContext.wy = this.wy;
        gbContext.wx = this.wx;
        gbContext._vbk = this._vbk;
        gbContext.hdmaSrc = this.hdmaSrc;
        gbContext.hdmaDst = this.hdmaDst;
        gbContext._hdma5 = this._hdma5;
        gbContext.hdmaOn = this.hdmaOn;
        gbContext.hblankHdmaOn = this.hblankHdmaOn;
        gbContext.hdmaTrigger = this.hdmaTrigger;
        gbContext.hdmaCounter = this.hdmaCounter;
        gbContext.displayCycles = this.cycles;
        gbContext.windowLine = this.windowLine;
        gbContext.statInterrupt = this.statInterrupt;
        gbContext.vram = new Uint8Array(this.vram);
        gbContext.oam = new Uint8Array(this.oam);
        gbContext.bgClear = new Uint8Array(this.bgClear);
        gbContext.bgPriority = new Uint8Array(this.bgPriority);
    }

    setSnapShot(gbContext) {
        this.lcdOn = gbContext.lcdOn;
        this.windowTilemap = gbContext.windowTilemap;
        this.windowOn = gbContext.windowOn;
        this.bgWindowTileMode = gbContext.bgWindowTileMode;
        this.bgTilemap = gbContext.bgTilemap;
        this.objHeight = gbContext.objHeight;
        this.objOn = gbContext.objOn;
        this.bgOn = gbContext.bgOn;
        this.lycMatchInt = gbContext.lycMatchInt;
        this.mode10Int = gbContext.mode10Int;
        this.mode01Int = gbContext.mode01Int;
        this.mode00Int = gbContext.mode00Int;
        this.lycMatch = gbContext.lycMatch;
        this.mode = gbContext.mode;
        this.scy = gbContext.scy;
        this.scx = gbContext.scx;
        this.ly = gbContext.ly;
        this.lyc = gbContext.lyc;
        this._bgp = gbContext._bgp;
        this._obp0 = gbContext._obp0;
        this._obp1 = gbContext._obp1;
        this.bgPalette = structuredClone(gbContext.bgPalette);
        this.scy = gbContext.scy;
        this.scx = gbContext.scx;
        this.ly = gbContext.ly;
        this.lyc = gbContext.lyc;
        this._bgp = gbContext._bgp;
        this._obp0 = gbContext._obp0;
        this._obp1 = gbContext._obp1;
        this.bgPalette = structuredClone(gbContext.bgPalette);
        this.objPalette = structuredClone(gbContext.objPalette);
        this.bgColorIndex = gbContext.bgColorIndex;
        this.bgColorInc = gbContext.bgColorInc;
        this.objColorIndex = gbContext.objColorIndex;
        this.objColorInc = gbContext.objColorInc;
        this._bcpd = new Uint8Array(gbContext._bcpd);
        this._ocpd = new Uint8Array(gbContext._ocpd);
        this.bgColorPalette = structuredClone(gbContext.bgColorPalette);
        this.objColorPalette = structuredClone(gbContext.objColorPalette);
        this.wy = gbContext.wy;
        this.wx = gbContext.wx;
        this._vbk = gbContext._vbk;
        this.hdmaSrc = gbContext.hdmaSrc;
        this.hdmaDst = gbContext.hdmaDst;
        this._hdma5 = gbContext._hdma5;
        this.hdmaOn = gbContext.hdmaOn;
        this.hblankHdmaOn = gbContext.hblankHdmaOn;
        this.hdmaTrigger = gbContext.hdmaTrigger;
        this.hdmaCounter = gbContext.hdmaCounter;
        this.cycles = gbContext.displayCycles;
        this.windowLine = gbContext.windowLine;
        this.statInterrupt = gbContext.statInterrupt;
        this.vram = new Uint8Array(gbContext.vram);
        this.oam = new Uint8Array(gbContext.oam);
        this.bgClear = new Uint8Array(gbContext.bgClear);
        this.bgPriority = new Uint8Array(gbContext.bgPriority);
    }

    get renderCpuCycles() {
        return this._renderCpuCycles;
    }

    setImageData(imageData) {
        this.imageData = imageData;
        this.pixels = new Uint32Array(this.imageData.data.buffer);
    }

    set renderFrameCallback(callback) { // Added setter for renderCallback
        this._renderFrameCallback = callback; // Store the callback in a private variable
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
                const tileY = (this.ly - objY) & 0xff;
                if (tileY < (this.objHeight ? 16 : 8)) {
                    /*
                        fix bug: pokemon red trade animation, the left half of monster is not rendered.
                    */
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

        /*
        // Create a new ArrayBuffer to hold the address and the pixel data
        const pixelCount = Display.width; // Number of pixels to copy
        const combinedBufferSize = 4 + pixelCount * 4; // 4 bytes for the address + pixelCount * 4 bytes for pixel data
        const combinedBuffer = new ArrayBuffer(combinedBufferSize);
        
        // Create a DataView to write the address and pixel data
        const dataView = new DataView(combinedBuffer);
        dataView.setUint32(0, address, true); // Write the address at the start of the buffer (little-endian)

        // Manually copy pixel data from this.pixels to the combined buffer using DataView
        for (let i = 0; i < pixelCount; i++) {
            const pixel = this.pixels[address + i]; // Get the pixel from the original array
            dataView.setUint32(4 + i * 4, pixel, true); // Write the pixel value at the correct offset (after the address)
        }

        // Pass the combined buffer to the callback
        this._renderLineCallback(combinedBuffer);
        */
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
        //Display.ctx.putImageData(this.imageData, 0, 0);

        if((++this.fpsPeriod) == Display.fps) {
            this._renderFrameCallback(this.imageData);
            this.fpsPeriod = 0;
        }
   
        //customLog("GameBoy start time: ", GameBoy.startTime.toFixed(3));
        //const current = performance.now();
        //customLog("%c render after(" + Display.renderCpuCycles + "): " + (current - GameBoy.startTime).toFixed(3),"background:black; color:white");
        //customLog("renderLap: " + (current - this.priorRenderLap).toFixed(3));
        //this.priorRenderLap = current;

        this._renderCpuCycles = 0;
    }

    cycle() {
        this._renderCpuCycles++;

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
Display.fps = 1;
Display.renderCpuCycles = 0;


/***/ }),

/***/ "./public/js/gb/gbcontext.js":
/*!***********************************!*\
  !*** ./public/js/gb/gbcontext.js ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   GbContext: () => (/* binding */ GbContext)
/* harmony export */ });
class GbContext {
    constructor() {
        //rtc
        this.time = 0;
        this._latch = false;
        this.sec = 0;
        this.min = 0;
        this.hour = 0;
        this.day = 0;
        this.high = 0;
        this.secLatch = 0;
        this.minLatch = 0;
        this.hourLatch = 0;
        this.dayLatch = 0;
        this.highLatch = 0;

        // cpu;
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
        this._if = 0;
        this._ie = 0;
        this._svbk = 0;
        this.doubleSpeed = false;
        this.speedTrigger = false;
        this.irReadEnable = 0;
        this.irOn = false;
        this.wram;//new Uint8Array(0x8000);
        this.hram;//new Uint8Array(0x7f);
        this.cgb = false;
        this.cpuCycles = 0;

        //diplay
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
        this.bgPalette;// = [0, 0, 0, 0];
        this.objPalette;// = [[0, 0, 0, 0], [0, 0, 0, 0]];
        this.bgColorIndex = 0;
        this.bgColorInc = false;
        this.objColorIndex = 0;
        this.objColorInc = false;
        this._bcpd;// = new Uint8Array(0x40);
        this._ocpd;// = new Uint8Array(0x40);
        this.bgColorPalette;// = Array.from({ length: 8 }, () => [0, 0, 0, 0]);
        this.objColorPalette;// = Array.from({ length: 8 }, () => [0, 0, 0, 0]);
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
        this.displayCycles = 0;
        this.windowLine = 0;
        this.statInterrupt = false;
        this.vram;// = new Uint8Array(0x4000);
        this.oam;// = new Uint8Array(0xa0);
        this.bgClear;// = new Uint8Array(Display.width);
        this.bgPriority;// = new Uint8Array(Display.width);


        //timer
        this._div = 0;
        this._tima = 0;
        this._tma = 0;
        this.timerEnable = false;
        this.clockSelect = 0;
        this.overflow = false;


        //joypad
        this._p1 = 0;
        this._key = new Int32Array(8);


        //cartridge
        this.title = '';
        this.cartridgeType = null;
        this.rom = null;
        this.romBankNumber = 0;
        this.ram = null;
        this.ramBankNumber = 0;
        this.ramEnable = false;
        this.ramBankMode = false;
        this.hasRAM = false;
        this.hasBattery = false;
        this.hasRTC = false;
        this.irSelect = false;
        this.irOn = false;
        this.rtc = null;


        //sound
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

        this.channel1SweepFrequency = 0;
        this.channel1Index = 0;
        this.channel1EnvelopeCounter = 0;
        this.channel4LFSR = 0;
        this.channel1LengthCounter = 0;
        this.channel2LengthCounter = 0;
        this.channel3LengthCounter = 0;
        this.channel4LengthCounter = 0;
        this.channel1SweepCounter = 0;
        this.soundEnable = false;
        this.channel3WaveTable;// = new Array(32).fill(0);
        this.soundCycles = 0;

        /*
        this.limiter;// = (this.bufferLen * Sound.cyclesPerSample);
        this.filled;// = new Int32Array(fillSab);
        this.bufferLeft;// = new Float32Array(soundLeftSab);
        this.bufferRight;// = new Float32Array(soundRightSab);
        this.slaveBuffer;// = new Float32Array(Sound.bufferSamples * 2);
        this.bufferLen;// = bufferLen;
        this.genCount = 0;
        this.cnt = 0;
        this.soundIdx = 0;
        */


        //serial
        this._sb = 0;
        this._sc = 0;
        this.transferInProgress = false;
        this.divider = 0;

    }
}

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
    }

    getSnapShot(gbContext) {
        gbContext._p1 = this._p1;
        gbContext._key.set(this._key);
    }

    setSnapShot(gbContext) {
        this._p1 = gbContext._p1;
        this._key.set(gbContext._key);
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

/***/ "./public/js/gb/rtc.js":
/*!*****************************!*\
  !*** ./public/js/gb/rtc.js ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   RTC: () => (/* binding */ RTC)
/* harmony export */ });
class RTC {
    constructor() {
        this.time = 0;

        this._latch = false;

        this.sec = 0;
        this.min = 0;
        this.hour = 0;
        this.day = 0;
        this.high = 0;

        this.secLatch = 0;
        this.minLatch = 0;
        this.hourLatch = 0;
        this.dayLatch = 0;
        this.highLatch = 0;
    }

    getSnapShot(gbContext) {
        gbContext.time = this.time;
        gbContext._latch = this._latch;
        gbContext.sec = this.sec;
        gbContext.min = this.min;
        gbContext.hour = this.hour;
        gbContext.day = this.day;
        gbContext.high = this.high;
        gbContext.secLatch = this.secLatch;
        gbContext.minLatch = this.minLatch;
        gbContext.hourLatch = this.hourLatch;
        gbContext.dayLatch = this.dayLatch;
        gbContext.highLatch = this.highLatch;
    }

    setSnapShot(gbContext) {
        this.time = gbContext.time;
        this._latch = gbContext._latch;
        this.sec = gbContext.sec;
        this.min = gbContext.min;
        this.hour = gbContext.hour;
        this.day = gbContext.day;
        this.high = gbContext.high;
        this.secLatch = gbContext.secLatch;
        this.minLatch = gbContext.minLatch;
        this.hourLatch = gbContext.hourLatch;
        this.dayLatch = gbContext.dayLatch;
        this.highLatch = gbContext.highLatch;
    }

    set latch(value) {
        const _latch = (value & 0x1) != 0;
        if (!this._latch && _latch) {
            this.secLatch = this.sec;
            this.minLatch = this.min;
            this.hourLatch = this.hour;
            this.dayLatch = this.day;
            this.highLatch = this.high;
        }
        this._latch = _latch;
    }

    get s() {
        return this.secLatch;
    }

    set s(value) {
        this.sec = value;
    }

    get m() {
        return this.minLatch;
    }

    set m(value) {
        this.min = value;
    }

    get h() {
        return this.hourLatch;
    }

    set h(value) {
        this.hour = value;
    }

    get dl() {
        return this.dayLatch;
    }

    set dl(value) {
        this.day = value;
    }

    get dh() {
        return 0x3e | this.highLatch;
    }

    set dh(value) {
        this.high = value;
    }

    updateTime() {
        if ((this.high & 0x40) == 0) {
            const cur = Math.floor(Date.now() / 1000);
            while (this.time + 60 * 60 * 24 < cur) {
                this.time += 60 * 60 * 24;
                this.day++;
                if (this.day == 256) {
                    this.day = 0;
                    if ((this.high & 0x1) != 0) {
                        this.high |= 0x80;
                    }
                    this.high ^= 0x1;
                }
            }
            while (this.time + 60 * 60 < cur) {
                this.time += 60 * 60;
                this.hour++;
                if (this.hour == 24) {
                    this.hour = 0;
                    this.day++;
                    if (this.day == 256) {
                        this.day = 0;
                        if ((this.high & 0x1) != 0) {
                            this.high |= 0x80;
                        }
                        this.high ^= 0x1;
                    }
                }
            }
            while (this.time + 60 < cur) {
                this.time += 60;
                this.min++;
                if (this.min == 60) {
                    this.min = 0;
                    this.hour++;
                    if (this.hour == 24) {
                        this.hour = 0;
                        this.day++;
                        if (this.day == 256) {
                            this.day = 0;
                            if ((this.high & 0x1) != 0) {
                                this.high |= 0x80;
                            }
                            this.high ^= 0x1;
                        }
                    }
                }
            }
            while (this.time < cur) {
                this.time++;
                this.sec++;
                if (this.sec == 60) {
                    this.sec = 0;
                    this.min++;
                    if (this.min == 60) {
                        this.min = 0;
                        this.hour++;
                        if (this.hour == 24) {
                            this.hour = 0;
                            this.day++;
                            if (this.day == 256) {
                                this.day = 0;
                                if ((this.high & 0x1) != 0) {
                                    this.high |= 0x80;
                                }
                                this.high ^= 0x1;
                            }
                        }
                    }
                }
            }
        }
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
/* harmony import */ var _emulworker_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../emulworker.js */ "./public/js/emulworker.js");
/* harmony import */ var _cpu_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./cpu.js */ "./public/js/gb/cpu.js");



class Serial {
  constructor(gb) {
    this.gb = gb;

    this._sb = 0;
    this._sc = 0;

    this.transferInProgress = false;

    this.fastClock = false;

    this.divider = 0;
  }

  getSnapShot(gbContext) {
    gbContext._sb = this._sb;
    gbContext._sc = this._sc;
    gbContext.transferInProgress = this.transferInProgress;
    gbContext.divider = this.divider;
  }

  setSnapShot(gbContext) {
    this._sb = gbContext._sb;
    this._sc = gbContext._sc;
    this.transferInProgress = gbContext.transferInProgress;
    this.divider = gbContext.divider;
  }


  get sb() {
    //saveEmulLog("<< get sb ", this._sb);
    return this._sb;
  }

  set sb(value) {
    //console.log(`${this.gb.name} set sb: ${value}`);
    //saveEmulLog(">> set sb ", value);
    this._sb = value;
  }

  get sc() {
    //saveEmulLog("<< get sc ", this._sc);
    return (0x7e | this._sc);
  }

  set sc(value) {
    //console.log(`${this.gb.name} set sc: ${value}`);
    /*
        value = 128  0x 1000 0000
                129  0x 1000 0001
     */
    this._sc =  value;
    //saveEmulLog(">> set sc ", value);

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
    } else {
      console.log("sc clockSpeed bit exception " + value);
    }
  }

  cycle() {
    if (this.transferInProgress) {
      if (++this.divider >= Serial.transferTime) {
        this.transferInProgress = false;
        return this.exchange();
      }
    }

    return false;
  }

  exchange() {
    if(this.gb.connectedGb == null) {
      return false;
    }

    const masterSb = this.sb;
    const slave = this.gb.connectedGb;
    let slaveSb = slave.serial.sb;
    
    //console.log(`< ${this.gb.name} request serial >`);

    if(slave.serial.sc != 0xFE) { //& 0xFE) == 0) { // 1111 1110 ,, 0xFE
      console.log(`%c ${this.gb.name} is master with sb: ${masterSb}, ${slave.name} is slave with sb: ${slaveSb}, sc: ${slave.serial.sc}`, "background:orange;color:white");
      (0,_emulworker_js__WEBPACK_IMPORTED_MODULE_0__.saveEmulLog)(`waitsc ${this.gb.name} is master with sb: ${masterSb}, ${slave.name} is slave with sb: ${slaveSb}, sc: ${slave.serial.sc}`);
      if(!this.gb.cgb) {
        //return true;   
        slaveSb = 0; // tennisworld,, replace waitSc to respond with 0..
      }
    }
    
    // master
    this.sb = slaveSb;
    this.sc &= 0x7F;
    this.gb.requestInterrupt(_cpu_js__WEBPACK_IMPORTED_MODULE_1__.GameBoy.serialInterrupt);

    // slave
    slave.serial.sb = masterSb;
    slave.serial.sc &= 0x7F;
    slave.requestInterrupt(_cpu_js__WEBPACK_IMPORTED_MODULE_1__.GameBoy.serialInterrupt);

    let packet = "packet [ A 0x" + slaveSb.toString(16) + " 0x" + masterSb.toString(16) + " ]";
    if(this.gb.name == 'MASTER') {
      //console.log(`%c ${this.gb.name} send ${packet}`,'background:red;color:white');
      (0,_emulworker_js__WEBPACK_IMPORTED_MODULE_0__.saveEmulLog)(`${this.gb.name} send ${packet}`);
    } else {
      //console.log(`%c ${this.gb.name} send ${packet}`,'background:green;color:white');
      (0,_emulworker_js__WEBPACK_IMPORTED_MODULE_0__.saveEmulLog)(`${this.gb.name} send ${packet}`);
    }

    return false;
  }
}

Serial.frequency = 8192;
Serial.transferTime = Serial.cpuCyclesPerCycle * 8;
Serial.cpuCyclesPerCycle = (4194304 / 4) / Serial.frequency;

Serial.fastFrequency = 262144;
Serial.cpuCyclesPerFastCycle = (4194304 / 4) / Serial.fastFrequency;


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

        this.slaveBuffer = new Float32Array(Sound.bufferSamples * 2);

        this.filled = new Int32Array(fillSab);
        this.bufferLen = bufferLen;
        this.genCount = 0;

        this.limiter = (this.bufferLen * Sound.cyclesPerSample);

        this.cnt = 0;

        this.soundIdx = 0;
    }

    getSnapShot(gbContext) {
        gbContext.frame = this.frame;
        gbContext.channel1Enable = this.channel1Enable;
        gbContext.channel2Enable = this.channel2Enable;
        gbContext.channel3Enable = this.channel3Enable;
        gbContext.channel4Enable = this.channel4Enable;
        gbContext.channel1SweepDuration = this.channel1SweepDuration;
        gbContext.channel1SweepDown = this.channel1SweepDown;
        gbContext.channel1SweepShift = this.channel1SweepShift;
        gbContext.channel1SweepEnable = this.channel1SweepEnable;
        gbContext.channel1Duty = this.channel1Duty;
        gbContext.channel1InitialVolume = this.channel1InitialVolume;
        gbContext.channel1VolumeUp = this.channel1VolumeUp;
        gbContext.channel1EnvelopeDuration = this.channel1EnvelopeDuration;
        gbContext.channel1Frequency = this.channel1Frequency;
        gbContext.channel1Trigger = this.channel1Trigger;
        gbContext.channel1LengthEnable = this.channel1LengthEnable;
        gbContext.channel2Duty = this.channel2Duty;
        gbContext.channel2InitialVolume = this.channel2InitialVolume;
        gbContext.channel2VolumeUp = this.channel2VolumeUp;
        gbContext.channel2EnvelopeDuration = this.channel2EnvelopeDuration;
        gbContext.channel2Frequency = this.channel2Frequency;
        gbContext.channel2Trigger = this.channel2Trigger;
        gbContext.channel2LengthEnable = this.channel2LengthEnable;
        gbContext.channel3Play = this.channel3Play;
        gbContext.channel3Volume = this.channel3Volume;
        gbContext.channel3Frequency = this.channel3Frequency;
        gbContext.channel3Trigger = this.channel3Trigger;
        gbContext.channel3LengthEnable = this.channel3LengthEnable;
        gbContext.channel4InitialVolume = this.channel4InitialVolume;
        gbContext.channel4VolumeUp = this.channel4VolumeUp;
        gbContext.channel4EnvelopeDuration = this.channel4EnvelopeDuration;
        gbContext.channel4ShiftClockFrequency = this.channel4ShiftClockFrequency;
        gbContext.channel4CounterStep = this.channel4CounterStep;
        gbContext.channel4DivisionRatio = this.channel4DivisionRatio;
        gbContext.channel4Trigger = this.channel4Trigger;
        gbContext.channel4LengthEnable = this.channel4LengthEnable;
        gbContext.outputVinRight = this.outputVinRight;
        gbContext.rightVolume = this.rightVolume;
        gbContext.outputVinLeft = this.outputVinLeft;
        gbContext.leftVolume = this.leftVolume;
        gbContext.channel1LeftEnable = this.channel1LeftEnable;
        gbContext.channel2LeftEnable = this.channel2LeftEnable;
        gbContext.channel3LeftEnable = this.channel3LeftEnable;
        gbContext.channel4LeftEnable = this.channel4LeftEnable;
        gbContext.channel1RightEnable = this.channel1RightEnable;
        gbContext.channel2RightEnable = this.channel2RightEnable;
        gbContext.channel3RightEnable = this.channel3RightEnable;
        gbContext.channel4RightEnable = this.channel4RightEnable;


        gbContext.channel1SweepFrequency = this.channel1SweepFrequency;
        gbContext.channel1Index = this.channel1Index;
        gbContext.channel1EnvelopeCounter = this.channel1EnvelopeCounter;
        gbContext.channel4LFSR = this.channel4LFSR;
        gbContext.channel1LengthCounter = this.channel1LengthCounter;
        gbContext.channel2LengthCounter = this.channel2LengthCounter;
        gbContext.channel3LengthCounter = this.channel3LengthCounter;
        gbContext.channel4LengthCounter = this.channel4LengthCounter;
        gbContext.channel1SweepCounter = this.channel1SweepCounter;
        gbContext.soundEnable = this.soundEnable;
        gbContext.channel3WaveTable = structuredClone(this.channel3WaveTable);
        gbContext.soundCycles = this.cycles;


        /*
        gbContext.limiter = this.limiter;
        gbContext.filled = this.filled;
        gbContext.bufferLeft = this.bufferLeft;
        gbContext.bufferRight = this.bufferRight;
        gbContext.slaveBuffer = this.slaveBuffer;
        gbContext.bufferLen = this.bufferLen;
        gbContext.genCount = this.genCount;
        gbContext.cnt = this.cnt;
        gbContext.soundIdx = this.soundIdx;
        */
    }

    setSnapShot(gbContext) {
        this.frame = gbContext.frame;
        this.channel1Enable = gbContext.channel1Enable;
        this.channel2Enable = gbContext.channel2Enable;
        this.channel3Enable = gbContext.channel3Enable;
        this.channel4Enable = gbContext.channel4Enable;
        this.channel1SweepDuration = gbContext.channel1SweepDuration;
        this.channel1SweepDown = gbContext.channel1SweepDown;
        this.channel1SweepShift = gbContext.channel1SweepShift;
        this.channel1SweepEnable = gbContext.channel1SweepEnable;
        this.channel1Duty = gbContext.channel1Duty;
        this.channel1InitialVolume = gbContext.channel1InitialVolume;
        this.channel1VolumeUp = gbContext.channel1VolumeUp;
        this.channel1EnvelopeDuration = gbContext.channel1EnvelopeDuration;
        this.channel1Frequency = gbContext.channel1Frequency;
        this.channel1Trigger = gbContext.channel1Trigger;
        this.channel1LengthEnable = gbContext.channel1LengthEnable;
        this.channel2Duty = gbContext.channel2Duty;
        this.channel2InitialVolume = gbContext.channel2InitialVolume;
        this.channel2VolumeUp = gbContext.channel2VolumeUp;
        this.channel2EnvelopeDuration = gbContext.channel2EnvelopeDuration;
        this.channel2Frequency = gbContext.channel2Frequency;
        this.channel2Trigger = gbContext.channel2Trigger;
        this.channel2LengthEnable = gbContext.channel2LengthEnable;
        this.channel3Play = gbContext.channel3Play;
        this.channel3Volume = gbContext.channel3Volume;
        this.channel3Frequency = gbContext.channel3Frequency;
        this.channel3Trigger = gbContext.channel3Trigger;
        this.channel3LengthEnable = gbContext.channel3LengthEnable;
        this.channel4InitialVolume = gbContext.channel4InitialVolume;
        this.channel4VolumeUp = gbContext.channel4VolumeUp;
        this.channel4EnvelopeDuration = gbContext.channel4EnvelopeDuration;
        this.channel4ShiftClockFrequency = gbContext.channel4ShiftClockFrequency;
        this.channel4CounterStep = gbContext.channel4CounterStep;
        this.channel4DivisionRatio = gbContext.channel4DivisionRatio;
        this.channel4Trigger = gbContext.channel4Trigger;
        this.channel4LengthEnable = gbContext.channel4LengthEnable;
        this.outputVinRight = gbContext.outputVinRight;
        this.rightVolume = gbContext.rightVolume;
        this.outputVinLeft = gbContext.outputVinLeft;
        this.leftVolume = gbContext.leftVolume;
        this.channel1LeftEnable = gbContext.channel1LeftEnable;
        this.channel2LeftEnable = gbContext.channel2LeftEnable;
        this.channel3LeftEnable = gbContext.channel3LeftEnable;
        this.channel4LeftEnable = gbContext.channel4LeftEnable;
        this.channel1RightEnable = gbContext.channel1RightEnable;
        this.channel2RightEnable = gbContext.channel2RightEnable;
        this.channel3RightEnable = gbContext.channel3RightEnable;
        this.channel4RightEnable = gbContext.channel4RightEnable;
    
        this.channel1SweepFrequency = gbContext.channel1SweepFrequency;
        this.channel1Index = gbContext.channel1Index;
        this.channel1EnvelopeCounter = gbContext.channel1EnvelopeCounter;
        this.channel4LFSR = gbContext.channel4LFSR;
        this.channel1LengthCounter = gbContext.channel1LengthCounter;
        this.channel2LengthCounter = gbContext.channel2LengthCounter;
        this.channel3LengthCounter = gbContext.channel3LengthCounter;
        this.channel4LengthCounter = gbContext.channel4LengthCounter;
        this.channel1SweepCounter = gbContext.channel1SweepCounter;
        this.soundEnable = gbContext.soundEnable;
        this.channel3WaveTable = structuredClone(gbContext.channel3WaveTable);
        this.cycles = gbContext.soundCycles;
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
        /* zelda sound mode
        if(this.channel4CounterStep) {
            this.genCount++;
            if(this.genCount > 127 || this.genCount == 1) {
                this.channel4LFSR = 0x7fff;
                return;
            }
        }
        */
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
                const signal = Sound.pulseTable[this.channel1Duty][this.channel1Index] * this.channel1Volume / 15 * 2 - 1;
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
                const signal = Sound.pulseTable[this.channel2Duty][this.channel2Index] * this.channel2Volume / 15 * 2 - 1;
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
                const signal = (this.channel3WaveTable[this.channel3Index] >> Sound.volumeShift[this.channel3Volume]) / 15 * 2 - 1;
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
            /* zelda sound mode
            if(this.channel4CounterStep && this.genCount > 127) {
                this.genCount = 0;
            }
            */

            if (this.channel4Volume != 0) {
                const signal = (~this.channel4LFSR & 0b1) * this.channel4Volume / 15 * 2 - 1;
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

        const samples = (this.cycles / Sound.cyclesPerSample);
       
        const idx = samples % this.bufferLen;
        this.bufferLeft[idx] = left / Sound.channelCount;// + Sound.ctxKeeper;
        this.bufferRight[idx] = right / Sound.channelCount;// + Sound.ctxKeeper;
        

        const slaveIdx = samples % Sound.bufferSamples;
        this.slaveBuffer[slaveIdx] = left / Sound.channelCount;
        this.slaveBuffer[slaveIdx + Sound.bufferSamples] = right / Sound.channelCount;
  
        /*
        if(this.soundIdx == 0) {
            console.log(this.cycles + " " + idx + " val:" + left / Sound.channelCount);
            // idx == 7167 부터 넣음. 8191 까지.
        }
        */
       // this.cnt++;
       
        if((samples % Sound.bufferSamples) == (Sound.bufferSamples - 1)) {
            if(this.gb.name == 'MASTER') { // mute Master
                /*
                const halfLength = this.slaveBuffer.length / 2;
                const sub = this.slaveBuffer.subarray(0, halfLength);
                this.bufferLeft.set(sub, this.soundIdx);
                this.bufferRight.set(this.slaveBuffer.subarray(halfLength), this.soundIdx);
                
                this.soundIdx = (this.soundIdx + Sound.bufferSamples) % this.bufferLen;
                */
                //throw new Error(`cycles: ${this.cycles}, idx: ${idx}, soundIdx: ${this.soundIdx}`);

                const old = Atomics.add(this.filled, 0, Sound.bufferSamples);    
            }
            if(this.gb.name == 'SLAVE') {
                self.postMessage({msg: 'sound', payload: this.slaveBuffer, time: -1});                
            }
            //console.log("fill: " + (old + Sound.bufferSamples));
            //console.log("fill sound " + (this.cnt));
            //this.cnt = 0;
        }

        if(this.cycles >= this.limiter) {
            this.cycles = this.cycles - this.limiter;
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

    getSnapShot(gbContext) {
        gbContext._div = this._div;
        gbContext._tima = this._tima;
        gbContext._tma = this._tma;
        gbContext.timerEnable = this.timerEnable;
        gbContext.clockSelect = this.clockSelect;
        gbContext.overflow = this.overflow;
    }

    setSnapShot(gbContext) {
        this._div = gbContext._div;
        this._tima = gbContext._tima;
        this._tma = gbContext._tma;
        this.timerEnable = gbContext.timerEnable;
        this.clockSelect = gbContext.clockSelect;
        this.overflow = gbContext.overflow;
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