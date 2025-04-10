/******/ (() => { // webpackBootstrap
/*!********************************!*\
  !*** ./public/js/logworker.js ***!
  \********************************/
let log = [];

onmessage = function(e) {
    const jsonData = e.data;
    switch(jsonData.option) {
        case 0:
            log.push(jsonData.data);
            break;
        case 1:
            postMessage(log);
            log = [];
            break;
        default:
    }
}

/******/ })()
;